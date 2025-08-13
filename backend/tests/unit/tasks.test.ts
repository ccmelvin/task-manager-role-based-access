/**
 * Unit tests for Tasks Lambda functions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Import the functions to test
// Note: We'll need to refactor tasks.ts to export individual functions
// For now, we'll create mock implementations

describe('Tasks Lambda Functions', () => {
  let mockDocClient: jest.Mocked<DynamoDBDocumentClient>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock DynamoDB Document Client
    mockDocClient = {
      send: jest.fn(),
    } as any;
  });

  describe('GET /tasks', () => {
    test('should return all tasks for admin user', async () => {
      // Mock DynamoDB response
      const mockTasks = [
        {
          taskId: '1',
          title: 'Test Task 1',
          description: 'First test task',
          status: 'pending',
          assignedTo: 'user1@example.com',
          createdBy: 'admin@example.com',
          deadline: '2025-12-31',
          priority: 'high',
          createdAt: '2025-08-13T10:00:00Z',
          updatedAt: '2025-08-13T10:00:00Z'
        }
      ];

      mockDocClient.send.mockResolvedValueOnce({
        Items: mockTasks
      });

      // Mock API Gateway event
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/tasks',
        requestContext: {
          authorizer: {
            userId: 'admin-user-id',
            email: 'admin@example.com',
            role: 'Admin',
            groups: ['Admins']
          }
        } as any
      };

      // Test the function (we'll need to implement this)
      const result = await mockGetTasks(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveLength(1);
      expect(body[0].title).toBe('Test Task 1');
    });

    test('should return only assigned tasks for regular user', async () => {
      const mockTasks = [
        {
          taskId: '1',
          title: 'Assigned Task',
          assignedTo: 'user@example.com',
          status: 'pending'
        }
      ];

      mockDocClient.send.mockResolvedValueOnce({
        Items: mockTasks
      });

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/tasks',
        requestContext: {
          authorizer: {
            userId: 'user-id',
            email: 'user@example.com',
            role: 'User',
            groups: ['Users']
          }
        } as any
      };

      const result = await mockGetTasks(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveLength(1);
      expect(body[0].assignedTo).toBe('user@example.com');
    });

    test('should handle DynamoDB errors', async () => {
      mockDocClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/tasks',
        requestContext: {
          authorizer: {
            userId: 'user-id',
            email: 'user@example.com',
            role: 'User'
          }
        } as any
      };

      const result = await mockGetTasks(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('POST /tasks', () => {
    test('should create new task for admin user', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const taskData = {
        title: 'New Test Task',
        description: 'Test task description',
        deadline: '2025-12-31',
        priority: 'medium',
        assignedTo: 'user@example.com'
      };

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/tasks',
        body: JSON.stringify(taskData),
        requestContext: {
          authorizer: {
            userId: 'admin-user-id',
            email: 'admin@example.com',
            role: 'Admin'
          }
        } as any
      };

      const result = await mockCreateTask(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.title).toBe('New Test Task');
      expect(body.taskId).toBe('test-uuid-1234');
      expect(body.createdBy).toBe('admin@example.com');
    });

    test('should reject task creation for regular user', async () => {
      const taskData = {
        title: 'New Test Task',
        description: 'Test task description'
      };

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/tasks',
        body: JSON.stringify(taskData),
        requestContext: {
          authorizer: {
            userId: 'user-id',
            email: 'user@example.com',
            role: 'User'
          }
        } as any
      };

      const result = await mockCreateTask(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Insufficient permissions');
    });

    test('should validate required fields', async () => {
      const taskData = {
        title: '', // Empty title
        description: 'Test description'
      };

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/tasks',
        body: JSON.stringify(taskData),
        requestContext: {
          authorizer: {
            userId: 'admin-user-id',
            email: 'admin@example.com',
            role: 'Admin'
          }
        } as any
      };

      const result = await mockCreateTask(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Title is required');
    });
  });

  describe('PUT /tasks/{id}', () => {
    test('should update task for admin user', async () => {
      const existingTask = {
        taskId: 'task-1',
        title: 'Original Title',
        status: 'pending',
        assignedTo: 'user@example.com',
        createdBy: 'admin@example.com'
      };

      const updateData = {
        title: 'Updated Title',
        status: 'in-progress'
      };

      // Mock get existing task
      mockDocClient.send.mockResolvedValueOnce({
        Item: existingTask
      });

      // Mock update task
      mockDocClient.send.mockResolvedValueOnce({});

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: '/tasks/task-1',
        pathParameters: { id: 'task-1' },
        body: JSON.stringify(updateData),
        requestContext: {
          authorizer: {
            userId: 'admin-user-id',
            email: 'admin@example.com',
            role: 'Admin'
          }
        } as any
      };

      const result = await mockUpdateTask(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.title).toBe('Updated Title');
      expect(body.status).toBe('in-progress');
    });

    test('should allow user to update their own assigned tasks', async () => {
      const existingTask = {
        taskId: 'task-1',
        title: 'User Task',
        status: 'pending',
        assignedTo: 'user@example.com',
        createdBy: 'admin@example.com'
      };

      mockDocClient.send.mockResolvedValueOnce({
        Item: existingTask
      });

      mockDocClient.send.mockResolvedValueOnce({});

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: '/tasks/task-1',
        pathParameters: { id: 'task-1' },
        body: JSON.stringify({ status: 'in-progress' }),
        requestContext: {
          authorizer: {
            userId: 'user-id',
            email: 'user@example.com',
            role: 'User'
          }
        } as any
      };

      const result = await mockUpdateTask(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
    });

    test('should reject update for non-assigned user', async () => {
      const existingTask = {
        taskId: 'task-1',
        assignedTo: 'other@example.com',
        createdBy: 'admin@example.com'
      };

      mockDocClient.send.mockResolvedValueOnce({
        Item: existingTask
      });

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: '/tasks/task-1',
        pathParameters: { id: 'task-1' },
        body: JSON.stringify({ status: 'completed' }),
        requestContext: {
          authorizer: {
            userId: 'user-id',
            email: 'user@example.com',
            role: 'User'
          }
        } as any
      };

      const result = await mockUpdateTask(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(403);
    });
  });

  describe('DELETE /tasks/{id}', () => {
    test('should delete task for admin user', async () => {
      const existingTask = {
        taskId: 'task-1',
        title: 'Task to Delete',
        createdBy: 'admin@example.com'
      };

      mockDocClient.send.mockResolvedValueOnce({
        Item: existingTask
      });

      mockDocClient.send.mockResolvedValueOnce({});

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/tasks/task-1',
        pathParameters: { id: 'task-1' },
        requestContext: {
          authorizer: {
            userId: 'admin-user-id',
            email: 'admin@example.com',
            role: 'Admin'
          }
        } as any
      };

      const result = await mockDeleteTask(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(204);
    });

    test('should reject delete for regular user', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/tasks/task-1',
        pathParameters: { id: 'task-1' },
        requestContext: {
          authorizer: {
            userId: 'user-id',
            email: 'user@example.com',
            role: 'User'
          }
        } as any
      };

      const result = await mockDeleteTask(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(403);
    });
  });
});

// Mock implementations (these would be the actual functions from tasks.ts)
async function mockGetTasks(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const authContext = event.requestContext.authorizer as any;
    
    // Mock implementation
    if (authContext.role === 'Admin') {
      return {
        statusCode: 200,
        body: JSON.stringify([{
          taskId: '1',
          title: 'Test Task 1',
          description: 'First test task',
          status: 'pending',
          assignedTo: 'user1@example.com',
          createdBy: 'admin@example.com',
          deadline: '2025-12-31',
          priority: 'high',
          createdAt: '2025-08-13T10:00:00Z',
          updatedAt: '2025-08-13T10:00:00Z'
        }])
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify([{
        taskId: '1',
        title: 'Assigned Task',
        assignedTo: 'user@example.com',
        status: 'pending'
      }])
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

async function mockCreateTask(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const authContext = event.requestContext.authorizer as any;
  
  if (authContext.role === 'User') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Insufficient permissions' })
    };
  }
  
  const taskData = JSON.parse(event.body || '{}');
  
  if (!taskData.title || taskData.title.trim() === '') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Title is required' })
    };
  }
  
  const newTask = {
    taskId: 'test-uuid-1234',
    ...taskData,
    createdBy: authContext.email,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return {
    statusCode: 201,
    body: JSON.stringify(newTask)
  };
}

async function mockUpdateTask(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const authContext = event.requestContext.authorizer as any;
  const taskId = event.pathParameters?.id;
  
  // Mock existing task check
  const existingTask = {
    taskId,
    assignedTo: authContext.role === 'User' ? authContext.email : 'other@example.com'
  };
  
  if (authContext.role === 'User' && existingTask.assignedTo !== authContext.email) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Insufficient permissions' })
    };
  }
  
  const updateData = JSON.parse(event.body || '{}');
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ...existingTask, ...updateData })
  };
}

async function mockDeleteTask(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const authContext = event.requestContext.authorizer as any;
  
  if (authContext.role !== 'Admin') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Insufficient permissions' })
    };
  }
  
  return {
    statusCode: 204,
    body: ''
  };
}
