// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'test-task-id-123',
}));

// Mock AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  ScanCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
}));

// Mock AuthorizationService
const mockValidatePermission = jest.fn();
jest.mock('../auth/authorization-service', () => ({
  AuthorizationService: {
    getInstance: jest.fn(() => ({
      validatePermission: mockValidatePermission,
    })),
  },
}));

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../tasks';

// Mock console.log to avoid cluttering test output
const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('Tasks Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TASKS_TABLE = 'test-tasks-table';
  });

  afterEach(() => {
    consoleSpy.mockClear();
  });

  const createMockEvent = (
    method: string,
    body?: any,
    pathParams?: any,
    authContext?: any
  ): APIGatewayProxyEvent => ({
    httpMethod: method,
    body: body ? JSON.stringify(body) : null,
    pathParameters: pathParams || null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    path: '/tasks',
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: authContext || {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'Admin',
        groups: '["admin"]',
        allRoles: '["Admin"]',
      },
      httpMethod: method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
        clientCert: null,
      },
      path: '/tasks',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTime: '01/Jan/1970:00:00:00 +0000',
      requestTimeEpoch: 0,
      resourceId: 'test-resource',
      resourcePath: '/tasks',
      stage: 'test',
    },
    resource: '/tasks',
  });

  describe('GET /tasks', () => {
    it('should return tasks for admin user', async () => {
      const mockTasks = [
        {
          taskId: 'task-1',
          title: 'Test Task 1',
          assignedTo: 'other-user',
          createdBy: 'other-user',
        },
        {
          taskId: 'task-2',
          title: 'Test Task 2',
          assignedTo: 'test-user-123',
          createdBy: 'test-user-123',
        },
      ];

      mockSend.mockResolvedValue({ Items: mockTasks });
      mockValidatePermission
        .mockResolvedValueOnce({ allowed: true }) // General read permission
        .mockResolvedValueOnce({ allowed: true }) // Task 1 specific permission
        .mockResolvedValueOnce({ allowed: true }); // Task 2 specific permission

      const event = createMockEvent('GET');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(mockValidatePermission).toHaveBeenCalledTimes(3);
    });

    it('should filter tasks based on permissions for contributor', async () => {
      const mockTasks = [
        {
          taskId: 'task-1',
          title: 'Test Task 1',
          assignedTo: 'other-user',
          createdBy: 'other-user',
        },
        {
          taskId: 'task-2',
          title: 'Test Task 2',
          assignedTo: 'test-user-123',
          createdBy: 'test-user-123',
        },
      ];

      mockSend.mockResolvedValue({ Items: mockTasks });
      mockValidatePermission
        .mockResolvedValueOnce({ allowed: true }) // General read permission
        .mockResolvedValueOnce({ allowed: false }) // Task 1 specific permission denied
        .mockResolvedValueOnce({ allowed: true }); // Task 2 specific permission allowed

      const event = createMockEvent('GET', null, null, {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'Contributor',
        groups: '["contributor"]',
        allRoles: '["Contributor"]',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].taskId).toBe('task-2');
    });

    it('should deny access if user has no read permission', async () => {
      mockValidatePermission.mockResolvedValue({ allowed: false });

      const event = createMockEvent('GET', null, null, {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'Viewer',
        groups: '["viewer"]',
        allRoles: '["Viewer"]',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Insufficient permissions to read tasks');
    });
  });

  describe('POST /tasks', () => {
    it('should create task for authorized user', async () => {
      mockValidatePermission.mockResolvedValue({ allowed: true });
      mockSend.mockResolvedValue({});

      const taskData = {
        title: 'New Task',
        description: 'Task description',
        deadline: '2024-12-31T23:59:59Z',
        priority: 'high',
      };

      const event = createMockEvent('POST', taskData);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('New Task');
      expect(body.data.taskId).toBe('test-task-id-123');
      expect(mockValidatePermission).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'test-user-123' }),
        'task',
        'create'
      );
    });

    it('should deny task creation for unauthorized user', async () => {
      mockValidatePermission.mockResolvedValue({ allowed: false });

      const taskData = {
        title: 'New Task',
        deadline: '2024-12-31T23:59:59Z',
      };

      const event = createMockEvent('POST', taskData, null, {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'Viewer',
        groups: '["viewer"]',
        allRoles: '["Viewer"]',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Insufficient permissions to create tasks');
    });
  });

  describe('PUT /tasks/:taskId', () => {
    it('should update task for authorized user', async () => {
      const existingTask = {
        taskId: 'task-1',
        title: 'Existing Task',
        assignedTo: 'test-user-123',
        createdBy: 'test-user-123',
      };

      mockSend
        .mockResolvedValueOnce({ Item: existingTask }) // GetCommand
        .mockResolvedValueOnce({}); // PutCommand

      mockValidatePermission.mockResolvedValue({ allowed: true });

      const updates = { title: 'Updated Task' };
      const event = createMockEvent('PUT', updates, { taskId: 'task-1' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Updated Task');
      expect(mockValidatePermission).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'test-user-123' }),
        'task',
        'update',
        existingTask
      );
    });

    it('should deny task update for unauthorized user', async () => {
      const existingTask = {
        taskId: 'task-1',
        title: 'Existing Task',
        assignedTo: 'other-user',
        createdBy: 'other-user',
      };

      mockSend.mockResolvedValue({ Item: existingTask });
      mockValidatePermission.mockResolvedValue({ allowed: false });

      const updates = { title: 'Updated Task' };
      const event = createMockEvent('PUT', updates, { taskId: 'task-1' }, {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'Viewer',
        groups: '["viewer"]',
        allRoles: '["Viewer"]',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Insufficient permissions to update this task');
    });

    it('should return 404 for non-existent task', async () => {
      mockSend.mockResolvedValue({ Item: null });

      const updates = { title: 'Updated Task' };
      const event = createMockEvent('PUT', updates, { taskId: 'non-existent' });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Task not found');
    });
  });

  describe('DELETE /tasks/:taskId', () => {
    it('should delete task for authorized user', async () => {
      const existingTask = {
        taskId: 'task-1',
        title: 'Task to Delete',
        assignedTo: 'test-user-123',
        createdBy: 'test-user-123',
      };

      mockSend
        .mockResolvedValueOnce({ Item: existingTask }) // GetCommand
        .mockResolvedValueOnce({}); // DeleteCommand

      mockValidatePermission.mockResolvedValue({ allowed: true });

      const event = createMockEvent('DELETE', null, { taskId: 'task-1' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(mockValidatePermission).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'test-user-123' }),
        'task',
        'delete',
        existingTask
      );
    });

    it('should deny task deletion for unauthorized user', async () => {
      const existingTask = {
        taskId: 'task-1',
        title: 'Task to Delete',
        assignedTo: 'other-user',
        createdBy: 'other-user',
      };

      mockSend.mockResolvedValue({ Item: existingTask });
      mockValidatePermission.mockResolvedValue({ allowed: false });

      const event = createMockEvent('DELETE', null, { taskId: 'task-1' }, {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'Contributor',
        groups: '["contributor"]',
        allRoles: '["Contributor"]',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Insufficient permissions to delete this task');
    });

    it('should return 404 for non-existent task', async () => {
      mockSend.mockResolvedValue({ Item: null });

      const event = createMockEvent('DELETE', null, { taskId: 'non-existent' });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Task not found');
    });
  });

  describe('Error handling', () => {
    it('should handle method not allowed', async () => {
      const event = createMockEvent('PATCH');
      const result = await handler(event);

      expect(result.statusCode).toBe(405);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should handle internal server errors', async () => {
      mockValidatePermission.mockRejectedValue(new Error('Database error'));

      const event = createMockEvent('GET');
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Database error');
    });
  });
});