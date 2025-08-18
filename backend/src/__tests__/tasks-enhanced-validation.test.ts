/**
 * Enhanced Validation Tests for Tasks API
 * Tests comprehensive input validation and sanitization
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

// Create a wrapper function that matches the expected signature
const createTestHandler = () => {
  const { handler: originalHandler } = require('../tasks');
  return (event: APIGatewayProxyEvent, context: any) => originalHandler(event, context);
};

// Mock dependencies
jest.mock('../auth');
jest.mock('../sanitization');
jest.mock('../validation');
jest.mock('../security/security-middleware');
jest.mock('@aws-sdk/lib-dynamodb');

describe('Tasks API Enhanced Validation', () => {
  let mockEvent: APIGatewayProxyEvent;
  let mockLambdaContext: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock lambda context
    mockLambdaContext = {
      awsRequestId: 'test-request-id',
      functionName: 'test-function',
      functionVersion: '1',
      memoryLimitInMB: '128',
      remainingTimeInMillis: () => 30000
    };

    // Mock base event
    mockEvent = {
      httpMethod: 'GET',
      path: '/tasks',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; test)'
      },
      requestContext: {
        authorizer: {
          userId: 'test-user-id',
          email: 'test@example.com',
          role: 'Contributor',
          groups: '["Contributor"]',
          allRoles: '["Contributor"]'
        }
      } as any,
      body: null,
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      stageVariables: null,
      resource: ''
    };

    // Mock security middleware
    const mockSecurityMiddleware = {
      extractSecurityContext: jest.fn().mockReturnValue({
        requestId: 'test-request-id',
        timestamp: '2023-01-01T00:00:00.000Z',
        userAgent: 'Mozilla/5.0 (compatible; test)',
        ipAddress: '192.168.1.1',
        origin: 'https://example.com'
      }),
      createMiddleware: jest.fn().mockReturnValue((handler: any) => 
        (event: any, context: any) => handler(event, context)
      )
    };

    // Mock validation engine
    const mockValidationEngine = {
      validate: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
        sanitizedData: {}
      })
    };

    // Mock authorization service
    const mockAuthService = {
      validatePermission: jest.fn().mockResolvedValue({ allowed: true })
    };

    // Mock sanitization service
    const mockSanitizationService = {
      sanitizeText: jest.fn().mockImplementation((text) => text),
      sanitizeAllTextFields: jest.fn().mockImplementation((obj) => obj)
    };

    // Apply mocks
    require('../security/security-middleware').SecurityMiddleware = {
      getInstance: () => mockSecurityMiddleware
    };
    require('../validation').ValidationEngine = {
      getInstance: () => mockValidationEngine
    };
    require('../auth').AuthorizationService = {
      getInstance: () => mockAuthService
    };
    require('../sanitization').SanitizationService = {
      getInstance: () => mockSanitizationService
    };

    // Mock DynamoDB
    const mockDocClient = {
      send: jest.fn().mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined
      })
    };
    require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient = {
      from: () => mockDocClient
    };
  });

  describe('Request Validation', () => {
    it('should validate request headers', async () => {
      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      // Mock header validation failure
      mockValidationEngine.validate
        .mockReturnValueOnce({
          isValid: false,
          errors: [{
            field: 'User-Agent',
            message: 'User-Agent is too short',
            code: 'VALIDATION_ERROR'
          }],
          sanitizedData: null
        });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.message).toBe('headers validation failed');
    });

    it('should validate query parameters', async () => {
      mockEvent.queryStringParameters = {
        limit: '150', // Exceeds maximum
        status: 'invalid-status'
      };

      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      // Mock successful header validation, failed query validation
      mockValidationEngine.validate
        .mockReturnValueOnce({ isValid: true, errors: [], sanitizedData: {} }) // headers
        .mockReturnValueOnce({
          isValid: false,
          errors: [{
            field: 'limit',
            message: 'Limit must be between 1 and 100',
            code: 'VALIDATION_ERROR'
          }],
          sanitizedData: null
        }); // query

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.message).toBe('query validation failed');
    });

    it('should validate path parameters', async () => {
      mockEvent.httpMethod = 'PUT';
      mockEvent.pathParameters = {
        taskId: 'invalid-uuid'
      };

      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      // Mock successful header and query validation, failed path validation
      mockValidationEngine.validate
        .mockReturnValueOnce({ isValid: true, errors: [], sanitizedData: {} }) // headers
        .mockReturnValueOnce({ isValid: true, errors: [], sanitizedData: {} }) // query
        .mockReturnValueOnce({
          isValid: false,
          errors: [{
            field: 'taskId',
            message: 'Task ID must be a valid UUID',
            code: 'VALIDATION_ERROR'
          }],
          sanitizedData: null
        }); // path

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.message).toBe('path validation failed');
    });
  });

  describe('GET /tasks with Query Parameters', () => {
    it('should handle valid query parameters', async () => {
      mockEvent.queryStringParameters = {
        limit: '25',
        status: 'pending',
        priority: 'high'
      };

      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      // Mock all validations as successful
      mockValidationEngine.validate
        .mockReturnValue({ 
          isValid: true, 
          errors: [], 
          sanitizedData: {
            limit: 25,
            status: 'pending',
            priority: 'high'
          }
        });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.pagination).toBeDefined();
      expect(body.data.pagination.limit).toBe(25);
    });

    it('should apply default limit when not provided', async () => {
      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      mockValidationEngine.validate
        .mockReturnValue({ 
          isValid: true, 
          errors: [], 
          sanitizedData: {}
        });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.pagination.limit).toBe(50); // Default limit
    });
  });

  describe('POST /tasks with Enhanced Validation', () => {
    beforeEach(() => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        title: 'Test Task',
        description: 'Test Description',
        deadline: '2024-12-31T23:59:59.999Z',
        priority: 'medium'
      });
    });

    it('should validate and sanitize task creation data', async () => {
      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      // Mock successful validations
      mockValidationEngine.validate
        .mockReturnValueOnce({ isValid: true, errors: [], sanitizedData: {} }) // headers
        .mockReturnValueOnce({ isValid: true, errors: [], sanitizedData: {} }) // query
        .mockReturnValueOnce({ 
          isValid: true, 
          errors: [], 
          sanitizedData: {
            title: 'Test Task',
            description: 'Test Description',
            deadline: '2024-12-31T23:59:59.999Z',
            priority: 'medium'
          }
        }); // body

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Test Task');
    });

    it('should reject invalid task data', async () => {
      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      // Mock successful header/query validation, failed body validation
      mockValidationEngine.validate
        .mockReturnValueOnce({ isValid: true, errors: [], sanitizedData: {} }) // headers
        .mockReturnValueOnce({ isValid: true, errors: [], sanitizedData: {} }) // query
        .mockReturnValueOnce({
          isValid: false,
          errors: [{
            field: 'title',
            message: 'Title is required',
            code: 'REQUIRED_FIELD'
          }],
          sanitizedData: null
        }); // body

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details[0].field).toBe('title');
    });

    it('should handle JSON parsing errors', async () => {
      mockEvent.body = 'invalid json';

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_JSON');
    });

    it('should validate assignment permissions', async () => {
      mockEvent.body = JSON.stringify({
        title: 'Test Task',
        deadline: '2024-12-31T23:59:59.999Z',
        assignedTo: 'other-user-id'
      });

      const mockAuthService = require('../auth').AuthorizationService.getInstance();
      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      // Mock successful validations
      mockValidationEngine.validate
        .mockReturnValue({ 
          isValid: true, 
          errors: [], 
          sanitizedData: {
            title: 'Test Task',
            deadline: '2024-12-31T23:59:59.999Z',
            assignedTo: 'other-user-id'
          }
        });

      // Mock permission check failure for assignment
      mockAuthService.validatePermission
        .mockResolvedValueOnce({ allowed: true }) // create permission
        .mockResolvedValueOnce({ allowed: false }); // assign permission

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(body.error.message).toContain('assign tasks to other users');
    });
  });

  describe('PUT /tasks/:taskId with Enhanced Validation', () => {
    beforeEach(() => {
      mockEvent.httpMethod = 'PUT';
      mockEvent.pathParameters = {
        taskId: '123e4567-e89b-12d3-a456-426614174000'
      };
      mockEvent.body = JSON.stringify({
        title: 'Updated Task',
        status: 'in-progress'
      });
    });

    it('should validate task updates', async () => {
      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      const mockDocClient = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from();
      
      // Mock existing task
      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          taskId: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Original Task',
          assignedTo: 'test-user-id',
          createdBy: 'test-user-id'
        }
      });

      // Mock successful validations
      mockValidationEngine.validate
        .mockReturnValue({ 
          isValid: true, 
          errors: [], 
          sanitizedData: {
            taskId: '123e4567-e89b-12d3-a456-426614174000',
            title: 'Updated Task',
            status: 'in-progress'
          }
        });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Updated Task');
    });

    it('should validate reassignment permissions', async () => {
      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      const mockAuthService = require('../auth').AuthorizationService.getInstance();
      const mockDocClient = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from();
      
      mockEvent.body = JSON.stringify({
        assignedTo: 'other-user-id'
      });

      // Mock existing task
      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          taskId: '123e4567-e89b-12d3-a456-426614174000',
          assignedTo: 'original-user-id',
          createdBy: 'test-user-id'
        }
      });

      // Mock successful validations
      mockValidationEngine.validate
        .mockReturnValue({ 
          isValid: true, 
          errors: [], 
          sanitizedData: {
            taskId: '123e4567-e89b-12d3-a456-426614174000',
            assignedTo: 'other-user-id'
          }
        });

      // Mock permission checks
      mockAuthService.validatePermission
        .mockResolvedValueOnce({ allowed: true }) // update permission
        .mockResolvedValueOnce({ allowed: false }); // assign permission

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(body.error.message).toContain('reassign tasks');
    });
  });

  describe('Error Handling and Information Disclosure Prevention', () => {
    it('should not expose internal error details', async () => {
      const mockDocClient = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from();
      
      // Mock database error
      mockDocClient.send.mockRejectedValue(new Error('Internal database error with sensitive info'));

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(body.error.message).not.toContain('sensitive info');
      expect(body.error.message).not.toContain('database');
    });

    it('should include request ID for error tracking', async () => {
      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      mockValidationEngine.validate
        .mockReturnValueOnce({
          isValid: false,
          errors: [{ field: 'test', message: 'Test error', code: 'TEST' }],
          sanitizedData: null
        });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.requestId).toBeDefined();
      expect(typeof body.requestId).toBe('string');
    });

    it('should sanitize error details', async () => {
      const mockValidationEngine = require('../validation').ValidationEngine.getInstance();
      
      mockValidationEngine.validate
        .mockReturnValueOnce({
          isValid: false,
          errors: [{
            field: 'email',
            message: 'Invalid email: user@secret-domain.com',
            code: 'VALIDATION_ERROR'
          }],
          sanitizedData: null
        });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      // Error message should be sanitized to not expose the actual email
      expect(body.error.details[0].message).not.toContain('secret-domain.com');
    });
  });

  describe('Rate Limiting and Security Headers', () => {
    it('should include security headers in responses', async () => {
      const result = await handler(mockEvent);

      expect(result.headers).toBeDefined();
      // Security headers should be applied by the security middleware
      expect(result.headers['X-Request-ID']).toBeDefined();
    });

    it('should handle large payloads', async () => {
      // Create a large payload (over 1MB)
      const largePayload = 'x'.repeat(1024 * 1024 + 1);
      mockEvent.body = largePayload;
      mockEvent.httpMethod = 'POST';

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(413);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });
});