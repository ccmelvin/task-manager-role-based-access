import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { AuthorizationContext, AuthorizationService } from './auth';
import { QueryOptions, SecureDataAccess, Task as SecureTask } from './data-access';
import { ErrorContext, ErrorLogger, SecureErrorHandler, ValidationError } from './error-handling';
import { SanitizationService } from './sanitization';
import { SecurityMiddleware } from './security/security-middleware';
import { ValidationEngine, requestHeadersSchema, taskCreationSchema, taskPathSchema, taskQuerySchema, taskUpdateSchema } from './validation';
interface Task {
  taskId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo: string;
  createdBy: string;
  deadline: string;
  attachments: string[];
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

interface AuthContext {
  userId: string;
  email: string;
  role: string;
  groups: string[];
}

// Create service instances
const authService = AuthorizationService.getInstance();
const validationEngine = ValidationEngine.getInstance();
const sanitizationService = SanitizationService.getInstance();
const securityMiddleware = SecurityMiddleware.getInstance();
const secureDataAccess = SecureDataAccess.getInstance();

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

let databaseConfig: DatabaseConfig | null = null;
let apiConfig: ApiConfig | null = null;

/**
 * Initialize configuration from secrets
 */
async function initializeConfig(): Promise<void> {
  if (databaseConfig && apiConfig) {
    return; // Already initialized
  }

  const databaseSecretArn = process.env.DATABASE_SECRET_ARN;
  const apiSecretArn = process.env.API_SECRET_ARN;

  if (!databaseSecretArn || !apiSecretArn) {
    throw new Error('DATABASE_SECRET_ARN and API_SECRET_ARN environment variables are required');
  }

  const secretsManager = getSecretsManager();
  
  [databaseConfig, apiConfig] = await Promise.all([
    secretsManager.getDatabaseConfig(databaseSecretArn),
    secretsManager.getApiConfig(apiSecretArn),
  ]);
}

// Comprehensive input validation helper
interface ValidationInput {
  data: any;
  schema: any[];
  inputType: 'body' | 'query' | 'path' | 'headers';
  requestId: string;
  securityContext?: any;
}

function validateInput({ data, schema, inputType, requestId, securityContext }: ValidationInput): {
  isValid: boolean;
  sanitizedData?: any;
  errorResponse?: APIGatewayProxyResult;
} {
  const errorContext = securityContext || SecureErrorHandler.createErrorContext(requestId);

  if (!data && inputType !== 'query') {
    return {
      isValid: false,
      errorResponse: createErrorResponse(
        400, 
        'VALIDATION_REQUIRED_FIELD', 
        `${inputType} data is required`, 
        undefined, 
        requestId, 
        errorContext
      )
    };
  }

  // For query parameters, provide empty object if null
  const inputData = data || {};

  const validationResult = validationEngine.validate(inputData, schema);
  
  if (!validationResult.isValid) {
    const validationErrors: ValidationError[] = validationResult.errors.map(error => ({
      field: error.field,
      message: error.message,
      code: error.code
    }));
    
    return {
      isValid: false,
      errorResponse: {
        statusCode: 400,
        headers: getSecurityHeaders(true),
        body: JSON.stringify(SecureErrorHandler.createValidationErrorResponse(validationErrors, errorContext))
      }
    };
  }

  return {
    isValid: true,
    sanitizedData: validationResult.sanitizedData
  };
}

// Enhanced request validation function
function validateRequest(
  event: APIGatewayProxyEvent,
  requestId: string,
  errorContext: ErrorContext
): {
  isValid: boolean;
  sanitizedData?: {
    headers: any;
    query: any;
    path: any;
  };
  errorResponse?: APIGatewayProxyResult;
} {
  // Validate headers
  const headersValidation = validateInput({
    data: event.headers,
    schema: requestHeadersSchema,
    inputType: 'headers',
    requestId,
    securityContext: errorContext
  });

  if (!headersValidation.isValid) {
    return headersValidation;
  }

  // Validate query parameters
  const queryValidation = validateInput({
    data: event.queryStringParameters,
    schema: taskQuerySchema,
    inputType: 'query',
    requestId,
    securityContext: errorContext
  });

  if (!queryValidation.isValid) {
    return queryValidation;
  }

  // Validate path parameters if they exist
  let pathValidation: { isValid: boolean; sanitizedData?: any; errorResponse?: APIGatewayProxyResult } = { 
    isValid: true, 
    sanitizedData: {} 
  };
  
  if (event.pathParameters) {
    pathValidation = validateInput({
      data: event.pathParameters,
      schema: taskPathSchema,
      inputType: 'path',
      requestId,
      securityContext: errorContext
    });

    if (!pathValidation.isValid) {
      return pathValidation;
    }
  }

  return {
    isValid: true,
    sanitizedData: {
      headers: headersValidation.sanitizedData || {},
      query: queryValidation.sanitizedData || {},
      path: pathValidation.sanitizedData || {}
    }
  };
}

// Legacy security headers helper - deprecated, use SecurityMiddleware instead
function getSecurityHeaders(includeRateLimit: boolean = false): Record<string, string> {
  // This function is kept for backward compatibility but should be replaced
  // with SecurityMiddleware.createSecureResponse()
  console.warn('getSecurityHeaders is deprecated. Use SecurityMiddleware.createSecureResponse() instead.');
  
  const corsOrigin = process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS || 'https://yourdomain.com'
    : 'http://localhost:3000';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=()',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  // Add rate limiting headers if requested
  if (includeRateLimit) {
    headers['X-RateLimit-Limit'] = '100';
    headers['X-RateLimit-Remaining'] = '99';
    headers['X-RateLimit-Reset'] = String(Math.floor(Date.now() / 1000) + 3600);
  }

  return headers;
}

// Enhanced error response helper using secure error handling
function createErrorResponse(
  statusCode: number, 
  code: string, 
  message: string, 
  details?: ValidationError[],
  requestId?: string,
  errorContext?: ErrorContext,
  originalError?: Error
): APIGatewayProxyResult {
  const finalRequestId = requestId || uuidv4();
  const context = errorContext || SecureErrorHandler.createErrorContext(finalRequestId);
  
  // Create detailed error for logging
  const detailedError = SecureErrorHandler.createDetailedError(
    code,
    message,
    context,
    originalError,
    { statusCode, hasDetails: !!details }
  );

  // Log the error if it should be logged
  if (SecureErrorHandler.shouldLog(code)) {
    ErrorLogger.logError(detailedError);
  }

  // Create secure response for client
  const secureResponse = SecureErrorHandler.createSecureResponse(code, context, details);

  return {
    statusCode,
    headers: getSecurityHeaders(true), // Include rate limit headers for errors
    body: JSON.stringify(secureResponse)
  };
}

function createSuccessResponse(
  statusCode: number,
  data: any,
  requestId: string,
  errorContext?: ErrorContext
): APIGatewayProxyResult {
  // Use SecurityMiddleware for secure success responses if available
  if (errorContext && securityMiddleware.createSecureSuccessResponse) {
    try {
      return securityMiddleware.createSecureSuccessResponse(
        statusCode,
        data,
        errorContext
      );
    } catch (error) {
      // Fallback to legacy implementation if SecurityMiddleware fails
      console.warn('SecurityMiddleware.createSecureSuccessResponse failed, using fallback');
    }
  }

  // Fallback to legacy implementation for backward compatibility
  return {
    statusCode,
    headers: getSecurityHeaders(true), // Include rate limit headers
    body: JSON.stringify({ success: true, data, requestId })
  };
}

// Legacy parameter validation helper - deprecated
// This function is kept for backward compatibility but should be replaced
// with the new validateInput function
function validateAndSanitizePathParams(
  pathParams: { [name: string]: string | undefined } | null,
  requestId: string,
  securityContext?: any
): { isValid: boolean; sanitizedParams?: { [name: string]: string }; errorResponse?: APIGatewayProxyResult } {
  console.warn('validateAndSanitizePathParams is deprecated. Use validateInput with taskPathSchema instead.');
  
  if (!pathParams) {
    return { isValid: true, sanitizedParams: {} };
  }

  const sanitizedParams: { [name: string]: string } = {};
  
  for (const [key, value] of Object.entries(pathParams)) {
    if (value === undefined || value === null) {
      continue; // Skip undefined parameters
    }

    if (typeof value !== 'string') {
      return {
        isValid: false,
        errorResponse: createErrorResponse(400, 'INVALID_PARAMETER', `Parameter ${key} must be a string`, undefined, requestId, securityContext)
      };
    }

    // Sanitize the parameter value
    const sanitizedValue = sanitizationService.sanitizeText(value, {
      allowHtml: false,
      maxLength: 100,
      trimWhitespace: true
    });

    if (!sanitizedValue) {
      return {
        isValid: false,
        errorResponse: createErrorResponse(400, 'INVALID_PARAMETER', `Parameter ${key} is invalid`, undefined, requestId, securityContext)
      };
    }

    sanitizedParams[key] = sanitizedValue;
  }

  return { isValid: true, sanitizedParams };
}

// Main handler function
async function tasksHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = uuidv4();
  const securityContext = securityMiddleware.extractSecurityContext(event, requestId);
  
  // Create error context for secure error handling
  const errorContext: ErrorContext = SecureErrorHandler.createErrorContext(
    requestId,
    event.requestContext.authorizer?.userId,
    event.requestContext.identity?.sourceIp,
    event.headers?.['User-Agent'],
    event.resource,
    event.httpMethod
  );
  
  const startTime = Date.now();
  
  try {
    // Initialize configuration from secrets
    await initializeConfig();
    // Validate request size to prevent large payload attacks
    const maxRequestSize = 1024 * 1024; // 1MB limit
    const requestSize = event.body ? Buffer.byteLength(event.body, 'utf8') : 0;
    
    if (requestSize > maxRequestSize) {
      return createErrorResponse(
        413, 
        'VALIDATION_LENGTH_EXCEEDED', 
        'Request payload exceeds maximum allowed size', 
        undefined, 
        requestId, 
        errorContext
      );
    }

    // Comprehensive request validation
    const requestValidation = validateRequest(event, requestId, errorContext);
    if (!requestValidation.isValid) {
      return requestValidation.errorResponse!;
    }

    const { headers: sanitizedHeaders, query: sanitizedQuery, path: sanitizedPath } = requestValidation.sanitizedData!;
    
    // Validate and sanitize authorization context
    const authContext: AuthContext = {
      userId: sanitizationService.sanitizeText(event.requestContext.authorizer?.userId || ''),
      email: sanitizationService.sanitizeText(event.requestContext.authorizer?.email || ''),
      role: sanitizationService.sanitizeText(event.requestContext.authorizer?.role || ''),
      groups: JSON.parse(event.requestContext.authorizer?.groups || '[]'),
    };

    // Validate required auth fields
    if (!authContext.userId || !authContext.email) {
      const authErrorResponse = SecureErrorHandler.createAuthenticationErrorResponse(errorContext);
      return {
        statusCode: 401,
        headers: getSecurityHeaders(true),
        body: JSON.stringify(authErrorResponse)
      };
    }

    // Update error context with user information
    errorContext.userId = authContext.userId;

    // Convert to AuthorizationContext for the authorization service
    const authzContext: AuthorizationContext = {
      userId: authContext.userId,
      email: authContext.email,
      roles: JSON.parse(event.requestContext.authorizer?.allRoles || '[]'),
      groups: authContext.groups,
    };

    const method = event.httpMethod;

    let result: APIGatewayProxyResult;
    
    switch (method) {
      case 'GET':
        result = await getTasks(authzContext, sanitizedQuery, requestId, errorContext);
        break;
      case 'POST':
        result = await createTask(event.body, authzContext, requestId, errorContext);
        break;
      case 'PUT':
        if (!sanitizedPath.taskId) {
          return createErrorResponse(
            400, 
            'VALIDATION_REQUIRED_FIELD', 
            'Task ID is required in the URL path', 
            undefined, 
            requestId, 
            errorContext
          );
        }
        result = await updateTask(sanitizedPath.taskId, event.body, authzContext, requestId, errorContext);
        break;
      case 'DELETE':
        if (!sanitizedPath.taskId) {
          return createErrorResponse(
            400, 
            'VALIDATION_REQUIRED_FIELD', 
            'Task ID is required in the URL path', 
            undefined, 
            requestId, 
            errorContext
          );
        }
        result = await deleteTask(sanitizedPath.taskId, authzContext, requestId, errorContext);
        break;
      default:
        return createErrorResponse(
          405, 
          'VALIDATION_INVALID_FORMAT', 
          'Method not allowed', 
          undefined, 
          requestId, 
          errorContext
        );
    }

    // Log performance metrics
    const duration = Date.now() - startTime;
    ErrorLogger.logPerformance(
      `${method} ${event.resource}`,
      duration,
      errorContext,
      { statusCode: result.statusCode }
    );

    return result;
    
  } catch (error) {
    // Handle unexpected errors with secure error handling
    const { secureResponse, detailedError } = SecureErrorHandler.handleUnknownError(
      error as Error,
      errorContext,
      { 
        method: event.httpMethod,
        resource: event.resource,
        requestSize: event.body ? Buffer.byteLength(event.body, 'utf8') : 0
      }
    );

    ErrorLogger.logError(detailedError, Date.now() - startTime);

    return {
      statusCode: 500,
      headers: getSecurityHeaders(true),
      body: JSON.stringify(secureResponse)
    };
  }
}

// Export the handler wrapped with security middleware
export const handler = securityMiddleware.createMiddleware({
  enableCors: true,
  enableRateLimit: true,
  rateLimitHeaders: {
    limit: 100,
    remaining: 99,
    reset: Math.floor(Date.now() / 1000) + 3600
  }
})(tasksHandler);

async function getTasks(auth: AuthorizationContext, queryParams: any, requestId: string, errorContext: ErrorContext) {
  try {
    // Check if user has permission to read tasks
    const readPermission = await authService.validatePermission(auth, 'task', 'read');
    
    if (!readPermission.allowed) {
      const authzErrorResponse = SecureErrorHandler.createAuthorizationErrorResponse('read', 'tasks', errorContext);
      return {
        statusCode: 403,
        headers: getSecurityHeaders(true),
        body: JSON.stringify(authzErrorResponse)
      };
    }

    // Determine query strategy based on parameters and user permissions
    let queryResult;
    const queryOptions: QueryOptions = {
      limit: queryParams.limit || 50,
      exclusiveStartKey: queryParams.lastEvaluatedKey ? JSON.parse(queryParams.lastEvaluatedKey) : undefined
    };

    // Build filter expressions for additional filtering
    const filterExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    if (queryParams.priority) {
      filterExpressions.push('#priority = :priority');
      expressionAttributeNames['#priority'] = 'priority';
      expressionAttributeValues[':priority'] = queryParams.priority;
    }

    if (filterExpressions.length > 0) {
      queryOptions.filterExpression = filterExpressions.join(' AND ');
      queryOptions.expressionAttributeNames = expressionAttributeNames;
      queryOptions.expressionAttributeValues = expressionAttributeValues;
    }

    // Use optimized query patterns based on query parameters
    if (queryParams.assignedTo) {
      // Query by assigned user using UserTasksIndex
      queryResult = await secureDataAccess.queryTasksByAssignedUser(
        queryParams.assignedTo,
        auth,
        queryOptions,
        requestId
      );
    } else if (queryParams.createdBy) {
      // Query by creator using CreatorTasksIndex
      queryResult = await secureDataAccess.queryTasksByCreator(
        queryParams.createdBy,
        auth,
        queryOptions,
        requestId
      );
    } else if (queryParams.status) {
      // Query by status using StatusTasksIndex
      queryResult = await secureDataAccess.queryTasksByStatus(
        queryParams.status,
        auth,
        queryOptions,
        requestId
      );
    } else {
      // Default: query user's assigned tasks
      queryResult = await secureDataAccess.queryTasksByAssignedUser(
        auth.userId,
        auth,
        queryOptions,
        requestId
      );
    }

    // Sanitize task data before returning
    const sanitizedTasks: SecureTask[] = [];
    for (const task of queryResult.items) {
      const sanitizedTask = sanitizationService.sanitizeAllTextFields(task, {
        title: 200,
        description: 2000
      });
      sanitizedTasks.push(sanitizedTask as SecureTask);
    }

    // Return response with pagination metadata
    const response = {
      tasks: sanitizedTasks,
      pagination: {
        count: queryResult.count,
        scannedCount: queryResult.scannedCount,
        limit: queryOptions.limit,
        lastEvaluatedKey: queryResult.lastEvaluatedKey ? JSON.stringify(queryResult.lastEvaluatedKey) : undefined,
        hasMore: queryResult.lastEvaluatedKey !== undefined
      }
    };
    
    ErrorLogger.logInfo(
      `Retrieved ${sanitizedTasks.length} tasks for user`,
      errorContext,
      { 
        queryType: queryParams.assignedTo ? 'assignedTo' : queryParams.createdBy ? 'createdBy' : queryParams.status ? 'status' : 'default',
        taskCount: sanitizedTasks.length,
        hasMore: response.pagination.hasMore
      }
    );
    
    return createSuccessResponse(200, response, requestId, errorContext);
  } catch (error) {
    const { secureResponse, detailedError } = SecureErrorHandler.handleUnknownError(
      error as Error,
      errorContext,
      { 
        operation: 'getTasks',
        queryParams: Object.keys(queryParams),
        userId: auth.userId
      }
    );

    ErrorLogger.logError(detailedError);

    return {
      statusCode: 500,
      headers: getSecurityHeaders(true),
      body: JSON.stringify(secureResponse)
    };
  }
}

async function createTask(requestBody: string | null, auth: AuthorizationContext, requestId: string, errorContext: ErrorContext) {
  try {
    // Check if user has permission to create tasks
    const createPermission = await authService.validatePermission(auth, 'task', 'create');
    
    if (!createPermission.allowed) {
      const authzErrorResponse = SecureErrorHandler.createAuthorizationErrorResponse('create', 'task', errorContext);
      return {
        statusCode: 403,
        headers: getSecurityHeaders(true),
        body: JSON.stringify(authzErrorResponse)
      };
    }

    // Parse and validate request body
    if (!requestBody) {
      return createErrorResponse(
        400, 
        'VALIDATION_REQUIRED_FIELD', 
        'Request body is required', 
        undefined, 
        requestId, 
        errorContext
      );
    }

    let taskData: any;
    try {
      taskData = JSON.parse(requestBody);
    } catch (parseError) {
      return createErrorResponse(
        400, 
        'VALIDATION_INVALID_FORMAT', 
        'Request body must be valid JSON', 
        undefined, 
        requestId, 
        errorContext,
        parseError as Error
      );
    }

    const bodyValidation = validateInput({
      data: taskData,
      schema: taskCreationSchema,
      inputType: 'body',
      requestId,
      securityContext: errorContext
    });

    if (!bodyValidation.isValid) {
      return bodyValidation.errorResponse!;
    }

    // Use sanitized data from validation
    const sanitizedData = bodyValidation.sanitizedData!;

    // Additional business logic validation
    if (sanitizedData.assignedTo && sanitizedData.assignedTo !== auth.userId) {
      // Check if user has permission to assign tasks to others
      const assignPermission = await authService.validatePermission(auth, 'task', 'assign');
      if (!assignPermission.allowed) {
        const authzErrorResponse = SecureErrorHandler.createAuthorizationErrorResponse('assign', 'task', errorContext);
        return {
          statusCode: 403,
          headers: getSecurityHeaders(true),
          body: JSON.stringify(authzErrorResponse)
        };
      }
    }

    const task: Task = {
      taskId: uuidv4(),
      title: sanitizedData.title,
      description: sanitizedData.description || '',
      status: 'pending',
      assignedTo: sanitizedData.assignedTo || auth.userId,
      createdBy: auth.userId,
      deadline: sanitizedData.deadline,
      attachments: sanitizedData.attachments || [],
      priority: sanitizedData.priority || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await secureDataAccess.putTask(task, auth, requestId);

    ErrorLogger.logInfo(
      'Task created successfully',
      errorContext,
      { 
        taskId: task.taskId,
        assignedTo: task.assignedTo,
        priority: task.priority,
        hasDeadline: !!task.deadline
      }
    );

    return createSuccessResponse(201, task, requestId, errorContext);
  } catch (error) {
    const { secureResponse, detailedError } = SecureErrorHandler.handleUnknownError(
      error as Error,
      errorContext,
      { 
        operation: 'createTask',
        userId: auth.userId,
        hasRequestBody: !!requestBody
      }
    );

    ErrorLogger.logError(detailedError);

    return {
      statusCode: 500,
      headers: getSecurityHeaders(true),
      body: JSON.stringify(secureResponse)
    };
  }
}

async function updateTask(taskId: string | undefined, requestBody: string | null, auth: AuthorizationContext, requestId: string, errorContext: ErrorContext) {
  try {
    // Validate taskId parameter
    if (!taskId) {
      return createErrorResponse(
        400, 
        'VALIDATION_REQUIRED_FIELD', 
        'Task ID is required', 
        undefined, 
        requestId, 
        errorContext
      );
    }

    // Sanitize taskId
    const sanitizedTaskId = sanitizationService.sanitizeText(taskId);
    if (!sanitizedTaskId) {
      return createErrorResponse(
        400, 
        'VALIDATION_INVALID_FORMAT', 
        'Task ID is invalid', 
        undefined, 
        requestId, 
        errorContext
      );
    }

    // Parse and validate request body
    if (!requestBody) {
      return createErrorResponse(
        400, 
        'VALIDATION_REQUIRED_FIELD', 
        'Request body is required', 
        undefined, 
        requestId, 
        errorContext
      );
    }

    let updateData: any;
    try {
      updateData = JSON.parse(requestBody);
    } catch (parseError) {
      return createErrorResponse(
        400, 
        'VALIDATION_INVALID_FORMAT', 
        'Request body must be valid JSON', 
        undefined, 
        requestId, 
        errorContext,
        parseError as Error
      );
    }

    // Add taskId to update data for validation
    updateData.taskId = sanitizedTaskId;

    const bodyValidation = validateInput({
      data: updateData,
      schema: taskUpdateSchema,
      inputType: 'body',
      requestId,
      securityContext: errorContext
    });

    if (!bodyValidation.isValid) {
      return bodyValidation.errorResponse!;
    }

    // Get existing task using secure data access
    const task = await secureDataAccess.getTaskById(sanitizedTaskId, auth, requestId);
    if (!task) {
      return createErrorResponse(
        404, 
        'AUTHZ_RESOURCE_ACCESS_DENIED', 
        'Task not found', 
        undefined, 
        requestId, 
        errorContext
      );
    }
    
    // Check if user has permission to update this specific task
    const updatePermission = await authService.validatePermission(auth, 'task', 'update', task);
    
    if (!updatePermission.allowed) {
      const authzErrorResponse = SecureErrorHandler.createAuthorizationErrorResponse('update', 'task', errorContext);
      return {
        statusCode: 403,
        headers: getSecurityHeaders(true),
        body: JSON.stringify(authzErrorResponse)
      };
    }

    // Use sanitized data from validation (excluding taskId)
    const sanitizedData = bodyValidation.sanitizedData!;
    delete sanitizedData.taskId;

    // Additional business logic validation for updates
    if (sanitizedData.assignedTo && sanitizedData.assignedTo !== task.assignedTo && sanitizedData.assignedTo !== auth.userId) {
      // Check if user has permission to reassign tasks
      const reassignPermission = await authService.validatePermission(auth, 'task', 'assign');
      if (!reassignPermission.allowed) {
        const authzErrorResponse = SecureErrorHandler.createAuthorizationErrorResponse('assign', 'task', errorContext);
        return {
          statusCode: 403,
          headers: getSecurityHeaders(true),
          body: JSON.stringify(authzErrorResponse)
        };
      }
    }

    const updatedTask = { 
      ...task, 
      ...sanitizedData, 
      updatedAt: new Date().toISOString() 
    };
    
    await secureDataAccess.putTask(updatedTask, auth, requestId);

    ErrorLogger.logInfo(
      'Task updated successfully',
      errorContext,
      { 
        taskId: sanitizedTaskId,
        updatedFields: Object.keys(sanitizedData),
        assignedTo: updatedTask.assignedTo
      }
    );

    return createSuccessResponse(200, updatedTask, requestId, errorContext);
  } catch (error) {
    const { secureResponse, detailedError } = SecureErrorHandler.handleUnknownError(
      error as Error,
      errorContext,
      { 
        operation: 'updateTask',
        taskId: taskId,
        userId: auth.userId,
        hasRequestBody: !!requestBody
      }
    );

    ErrorLogger.logError(detailedError);

    return {
      statusCode: 500,
      headers: getSecurityHeaders(true),
      body: JSON.stringify(secureResponse)
    };
  }
}

async function deleteTask(taskId: string | undefined, auth: AuthorizationContext, requestId: string, errorContext: ErrorContext) {
  try {
    // Validate taskId parameter
    if (!taskId) {
      return createErrorResponse(
        400, 
        'VALIDATION_REQUIRED_FIELD', 
        'Task ID is required', 
        undefined, 
        requestId, 
        errorContext
      );
    }

    // Sanitize taskId
    const sanitizedTaskId = sanitizationService.sanitizeText(taskId);
    if (!sanitizedTaskId) {
      return createErrorResponse(
        400, 
        'VALIDATION_INVALID_FORMAT', 
        'Task ID is invalid', 
        undefined, 
        requestId, 
        errorContext
      );
    }

    // Delete task using secure data access (includes permission validation)
    await secureDataAccess.deleteTask(sanitizedTaskId, auth, requestId);

    ErrorLogger.logInfo(
      'Task deleted successfully',
      errorContext,
      { taskId: sanitizedTaskId }
    );

    return createSuccessResponse(200, { message: 'Task deleted successfully' }, requestId, errorContext);
  } catch (error) {
    const { secureResponse, detailedError } = SecureErrorHandler.handleUnknownError(
      error as Error,
      errorContext,
      { 
        operation: 'deleteTask',
        taskId: taskId,
        userId: auth.userId
      }
    );

    ErrorLogger.logError(detailedError);

    return {
      statusCode: 500,
      headers: getSecurityHeaders(true),
      body: JSON.stringify(secureResponse)
    };
  }
}