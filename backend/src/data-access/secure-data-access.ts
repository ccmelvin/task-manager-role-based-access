import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DeleteCommand,
    DeleteCommandInput,
    DynamoDBDocumentClient,
    GetCommand,
    GetCommandInput,
    PutCommand,
    PutCommandInput,
    QueryCommand,
    QueryCommandInput
} from '@aws-sdk/lib-dynamodb';
import { AuthorizationContext, AuthorizationService } from '../auth';

export interface Task {
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

export interface QueryOptions {
  limit?: number;
  exclusiveStartKey?: Record<string, any>;
  filterExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, any>;
}

export interface QueryResult<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, any>;
  count: number;
  scannedCount: number;
}

export interface DataAccessAuditLog {
  timestamp: string;
  userId: string;
  operation: 'query' | 'get' | 'put' | 'delete';
  resource: string;
  resourceId?: string;
  indexName?: string;
  success: boolean;
  errorMessage?: string;
  itemCount?: number;
  requestId: string;
}

/**
 * Secure data access layer with encryption-aware methods and audit logging
 */
export class SecureDataAccess {
  private static instance: SecureDataAccess;
  private docClient: DynamoDBDocumentClient;
  private authService: AuthorizationService;
  private databaseConfig: DatabaseConfig | null = null;

  private constructor() {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    this.authService = AuthorizationService.getInstance();
  }

  /**
   * Initialize database configuration from secrets
   */
  private async initializeDatabaseConfig(): Promise<void> {
    if (this.databaseConfig) {
      return; // Already initialized
    }

    const databaseSecretArn = process.env.DATABASE_SECRET_ARN;
    if (!databaseSecretArn) {
      throw new Error('DATABASE_SECRET_ARN environment variable is required');
    }

    const secretsManager = getSecretsManager();
    this.databaseConfig = await secretsManager.getDatabaseConfig(databaseSecretArn);
  }

  /**
   * Get tasks table name from config
   */
  private async getTasksTable(): Promise<string> {
    await this.initializeDatabaseConfig();
    return this.databaseConfig!.tasksTableName;
  }

  /**
   * Get user profiles table name from config
   */
  private async getUserProfilesTable(): Promise<string> {
    await this.initializeDatabaseConfig();
    return this.databaseConfig!.userProfilesTableName;
  }

  public static getInstance(): SecureDataAccess {
    if (!SecureDataAccess.instance) {
      SecureDataAccess.instance = new SecureDataAccess();
    }
    return SecureDataAccess.instance;
  }

  /**
   * Query tasks assigned to a specific user
   */
  async queryTasksByAssignedUser(
    userId: string,
    authContext: AuthorizationContext,
    options: QueryOptions = {},
    requestId: string
  ): Promise<QueryResult<Task>> {
    const startTime = Date.now();
    
    try {
      // Validate data access permission
      const hasAccess = await this.validateDataAccess(authContext, 'task', 'read', { assignedTo: userId });
      if (!hasAccess) {
        await this.logDataAccess({
          timestamp: new Date().toISOString(),
          userId: authContext.userId,
          operation: 'query',
          resource: 'tasks',
          indexName: 'UserTasksIndex',
          success: false,
          errorMessage: 'Access denied',
          requestId
        });
        throw new Error('Access denied to query tasks for this user');
      }

      const tasksTable = await this.getTasksTable();
      const queryParams: QueryCommandInput = {
        TableName: tasksTable,
        IndexName: 'UserTasksIndex',
        KeyConditionExpression: 'assignedTo = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Limit: options.limit || 50,
        ScanIndexForward: false, // Most recent first
      };

      // Add optional parameters
      if (options.exclusiveStartKey) {
        queryParams.ExclusiveStartKey = options.exclusiveStartKey;
      }

      if (options.filterExpression) {
        queryParams.FilterExpression = options.filterExpression;
        if (options.expressionAttributeNames) {
          queryParams.ExpressionAttributeNames = options.expressionAttributeNames;
        }
        if (options.expressionAttributeValues) {
          queryParams.ExpressionAttributeValues = {
            ...queryParams.ExpressionAttributeValues,
            ...options.expressionAttributeValues
          };
        }
      }

      const command = new QueryCommand(queryParams);
      const result = await this.docClient.send(command);

      const queryResult: QueryResult<Task> = {
        items: (result.Items || []) as Task[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0,
        scannedCount: result.ScannedCount || 0
      };

      // Log successful access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'query',
        resource: 'tasks',
        indexName: 'UserTasksIndex',
        success: true,
        itemCount: queryResult.count,
        requestId
      });

      return queryResult;

    } catch (error) {
      // Log failed access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'query',
        resource: 'tasks',
        indexName: 'UserTasksIndex',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  /**
   * Query tasks created by a specific user
   */
  async queryTasksByCreator(
    creatorId: string,
    authContext: AuthorizationContext,
    options: QueryOptions = {},
    requestId: string
  ): Promise<QueryResult<Task>> {
    try {
      // Validate data access permission
      const hasAccess = await this.validateDataAccess(authContext, 'task', 'read', { createdBy: creatorId });
      if (!hasAccess) {
        await this.logDataAccess({
          timestamp: new Date().toISOString(),
          userId: authContext.userId,
          operation: 'query',
          resource: 'tasks',
          indexName: 'CreatorTasksIndex',
          success: false,
          errorMessage: 'Access denied',
          requestId
        });
        throw new Error('Access denied to query tasks for this creator');
      }

      const tasksTable = await this.getTasksTable();
      const queryParams: QueryCommandInput = {
        TableName: tasksTable,
        IndexName: 'CreatorTasksIndex',
        KeyConditionExpression: 'createdBy = :creatorId',
        ExpressionAttributeValues: {
          ':creatorId': creatorId
        },
        Limit: options.limit || 50,
        ScanIndexForward: false, // Most recent first
      };

      // Add optional parameters
      if (options.exclusiveStartKey) {
        queryParams.ExclusiveStartKey = options.exclusiveStartKey;
      }

      if (options.filterExpression) {
        queryParams.FilterExpression = options.filterExpression;
        if (options.expressionAttributeNames) {
          queryParams.ExpressionAttributeNames = options.expressionAttributeNames;
        }
        if (options.expressionAttributeValues) {
          queryParams.ExpressionAttributeValues = {
            ...queryParams.ExpressionAttributeValues,
            ...options.expressionAttributeValues
          };
        }
      }

      const command = new QueryCommand(queryParams);
      const result = await this.docClient.send(command);

      const queryResult: QueryResult<Task> = {
        items: (result.Items || []) as Task[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0,
        scannedCount: result.ScannedCount || 0
      };

      // Log successful access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'query',
        resource: 'tasks',
        indexName: 'CreatorTasksIndex',
        success: true,
        itemCount: queryResult.count,
        requestId
      });

      return queryResult;

    } catch (error) {
      // Log failed access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'query',
        resource: 'tasks',
        indexName: 'CreatorTasksIndex',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  /**
   * Query tasks by status
   */
  async queryTasksByStatus(
    status: string,
    authContext: AuthorizationContext,
    options: QueryOptions = {},
    requestId: string
  ): Promise<QueryResult<Task>> {
    try {
      // Validate data access permission
      const hasAccess = await this.validateDataAccess(authContext, 'task', 'read');
      if (!hasAccess) {
        await this.logDataAccess({
          timestamp: new Date().toISOString(),
          userId: authContext.userId,
          operation: 'query',
          resource: 'tasks',
          indexName: 'StatusTasksIndex',
          success: false,
          errorMessage: 'Access denied',
          requestId
        });
        throw new Error('Access denied to query tasks by status');
      }

      const tasksTable = await this.getTasksTable();
      const queryParams: QueryCommandInput = {
        TableName: tasksTable,
        IndexName: 'StatusTasksIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status
        },
        Limit: options.limit || 50,
        ScanIndexForward: false, // Most recent first
      };

      // Add optional parameters
      if (options.exclusiveStartKey) {
        queryParams.ExclusiveStartKey = options.exclusiveStartKey;
      }

      if (options.filterExpression) {
        queryParams.FilterExpression = options.filterExpression;
        if (options.expressionAttributeNames) {
          queryParams.ExpressionAttributeNames = {
            ...queryParams.ExpressionAttributeNames,
            ...options.expressionAttributeNames
          };
        }
        if (options.expressionAttributeValues) {
          queryParams.ExpressionAttributeValues = {
            ...queryParams.ExpressionAttributeValues,
            ...options.expressionAttributeValues
          };
        }
      }

      const command = new QueryCommand(queryParams);
      const result = await this.docClient.send(command);

      // Filter results based on user permissions
      const authorizedItems: Task[] = [];
      for (const item of (result.Items || []) as Task[]) {
        const itemAccess = await this.validateDataAccess(authContext, 'task', 'read', item);
        if (itemAccess) {
          authorizedItems.push(item);
        }
      }

      const queryResult: QueryResult<Task> = {
        items: authorizedItems,
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: authorizedItems.length,
        scannedCount: result.ScannedCount || 0
      };

      // Log successful access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'query',
        resource: 'tasks',
        indexName: 'StatusTasksIndex',
        success: true,
        itemCount: queryResult.count,
        requestId
      });

      return queryResult;

    } catch (error) {
      // Log failed access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'query',
        resource: 'tasks',
        indexName: 'StatusTasksIndex',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  /**
   * Get a single task by ID with encryption-aware access
   */
  async getTaskById(
    taskId: string,
    authContext: AuthorizationContext,
    requestId: string
  ): Promise<Task | null> {
    try {
      const tasksTable = await this.getTasksTable();
      const getParams: GetCommandInput = {
        TableName: tasksTable,
        Key: { taskId }
      };

      const command = new GetCommand(getParams);
      const result = await this.docClient.send(command);

      if (!result.Item) {
        // Log access attempt for non-existent item
        await this.logDataAccess({
          timestamp: new Date().toISOString(),
          userId: authContext.userId,
          operation: 'get',
          resource: 'tasks',
          resourceId: taskId,
          success: true,
          itemCount: 0,
          requestId
        });
        return null;
      }

      const task = result.Item as Task;

      // Validate data access permission for this specific task
      const hasAccess = await this.validateDataAccess(authContext, 'task', 'read', task);
      if (!hasAccess) {
        await this.logDataAccess({
          timestamp: new Date().toISOString(),
          userId: authContext.userId,
          operation: 'get',
          resource: 'tasks',
          resourceId: taskId,
          success: false,
          errorMessage: 'Access denied',
          requestId
        });
        throw new Error('Access denied to this task');
      }

      // Log successful access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'get',
        resource: 'tasks',
        resourceId: taskId,
        success: true,
        itemCount: 1,
        requestId
      });

      return task;

    } catch (error) {
      // Log failed access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'get',
        resource: 'tasks',
        resourceId: taskId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  /**
   * Put a task with encryption-aware access
   */
  async putTask(
    task: Task,
    authContext: AuthorizationContext,
    requestId: string
  ): Promise<void> {
    try {
      // Validate data access permission
      const hasAccess = await this.validateDataAccess(authContext, 'task', 'write', task);
      if (!hasAccess) {
        await this.logDataAccess({
          timestamp: new Date().toISOString(),
          userId: authContext.userId,
          operation: 'put',
          resource: 'tasks',
          resourceId: task.taskId,
          success: false,
          errorMessage: 'Access denied',
          requestId
        });
        throw new Error('Access denied to write this task');
      }

      const tasksTable = await this.getTasksTable();
      const putParams: PutCommandInput = {
        TableName: tasksTable,
        Item: task
      };

      const command = new PutCommand(putParams);
      await this.docClient.send(command);

      // Log successful access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'put',
        resource: 'tasks',
        resourceId: task.taskId,
        success: true,
        itemCount: 1,
        requestId
      });

    } catch (error) {
      // Log failed access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'put',
        resource: 'tasks',
        resourceId: task.taskId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  /**
   * Delete a task with encryption-aware access
   */
  async deleteTask(
    taskId: string,
    authContext: AuthorizationContext,
    requestId: string
  ): Promise<void> {
    try {
      // First get the task to validate access
      const task = await this.getTaskById(taskId, authContext, requestId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Validate data access permission for deletion
      const hasAccess = await this.validateDataAccess(authContext, 'task', 'delete', task);
      if (!hasAccess) {
        await this.logDataAccess({
          timestamp: new Date().toISOString(),
          userId: authContext.userId,
          operation: 'delete',
          resource: 'tasks',
          resourceId: taskId,
          success: false,
          errorMessage: 'Access denied',
          requestId
        });
        throw new Error('Access denied to delete this task');
      }

      const tasksTable = await this.getTasksTable();
      const deleteParams: DeleteCommandInput = {
        TableName: tasksTable,
        Key: { taskId }
      };

      const command = new DeleteCommand(deleteParams);
      await this.docClient.send(command);

      // Log successful access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'delete',
        resource: 'tasks',
        resourceId: taskId,
        success: true,
        itemCount: 1,
        requestId
      });

    } catch (error) {
      // Log failed access
      await this.logDataAccess({
        timestamp: new Date().toISOString(),
        userId: authContext.userId,
        operation: 'delete',
        resource: 'tasks',
        resourceId: taskId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  /**
   * Validate data access permissions
   */
  private async validateDataAccess(
    authContext: AuthorizationContext,
    resource: string,
    action: string,
    resourceData?: any
  ): Promise<boolean> {
    try {
      const permission = await this.authService.validatePermission(
        authContext,
        resource,
        action,
        resourceData
      );
      return permission.allowed;
    } catch (error) {
      console.error('Error validating data access:', error);
      return false;
    }
  }

  /**
   * Log data access operations for audit trail
   */
  private async logDataAccess(logEntry: DataAccessAuditLog): Promise<void> {
    try {
      // Log to CloudWatch
      console.log(JSON.stringify({
        ...logEntry,
        level: 'INFO',
        eventType: 'DATA_ACCESS_AUDIT',
        severity: logEntry.success ? 'LOW' : 'MEDIUM'
      }));

      // In a production environment, you might also want to:
      // 1. Send to a dedicated audit log table
      // 2. Send to CloudTrail
      // 3. Send to a SIEM system
      // 4. Trigger alerts for failed access attempts

    } catch (error) {
      // Don't let audit logging failures affect the main operation
      console.error('Failed to log data access:', error);
    }
  }
}