/**
 * Tasks API Validation Tests
 * Tests for input validation and sanitization in task endpoints
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../tasks';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

// Mock the authorization service
jest.mock('../auth', () => ({
  AuthorizationService: {
    getInstance: () => ({
      validatePermission: jest.fn().mockResolvedValue({ allowed: true })
    })
  }
}));

describe('Tasks API Validation', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    requestContext: {
      authorizer: {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'Admin',
        groups: '["Admin"]',
        allRoles: '["Admin"]'
      }
    } as any,
    httpMethod: 'POST',
    pathParameters: null,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  describe('POST /tasks - Create Task Validation', () => {
    test('should reject empty request body', async () => {
      const event = {
        ...mockEvent,
        body: null
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('MISSING_REQUEST_BODY');
    });

    test('should reject invalid JSON', async () => {
      const event = {
        ...mockEvent,
        body: 'invalid json'
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_JSON');
    });

    test('should reject missing required fields', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          description: 'A task without title or deadline'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            code: 'REQUIRED_FIELD_MISSING'
          }),
          expect.objectContaining({
            field: 'deadline',
            code: 'REQUIRED_FIELD_MISSING'
          })
        ])
      );
    });

    test('should reject invalid field values', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          title: '', // Too short
          deadline: 'invalid-date',
          priority: 'invalid-priority'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details.length).toBeGreaterThan(0);
    });

    test('should sanitize and accept valid input', async () => {
      // Mock DynamoDB operations
      const mockSend = jest.fn().mockResolvedValue({});
      require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from = jest.fn().mockReturnValue({
        send: mockSend
      });

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          title: '  Valid Task Title  ', // Should be trimmed
          description: 'A valid task description',
          deadline: futureDate,
          priority: 'high'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Valid Task Title'); // Trimmed
      expect(mockSend).toHaveBeenCalled();
    });

    test('should reject XSS attempts', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          title: '<script>alert("xss")</script>',
          deadline: new Date(Date.now() + 86400000).toISOString()
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      // Should either reject due to pattern validation or sanitize the input
      if (result.statusCode === 201) {
        const body = JSON.parse(result.body);
        expect(body.data.title).not.toContain('<script>');
        expect(body.data.title).toContain('&lt;script&gt;');
      } else {
        expect(result.statusCode).toBe(400);
      }
    });
  });

  describe('PUT /tasks/:id - Update Task Validation', () => {
    test('should reject missing task ID', async () => {
      const event = {
        ...mockEvent,
        httpMethod: 'PUT',
        pathParameters: null,
        body: JSON.stringify({ title: 'Updated Title' })
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('MISSING_TASK_ID');
    });

    test('should reject invalid task ID format', async () => {
      const event = {
        ...mockEvent,
        httpMethod: 'PUT',
        pathParameters: { taskId: 'invalid-uuid' },
        body: JSON.stringify({ title: 'Updated Title' })
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });

    test('should sanitize malicious input in updates', async () => {
      // Mock DynamoDB operations
      const mockSend = jest.fn()
        .mockResolvedValueOnce({ Item: { taskId: 'valid-uuid', title: 'Original Title' } }) // GET
        .mockResolvedValueOnce({}); // PUT
      
      require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from = jest.fn().mockReturnValue({
        send: mockSend
      });

      const event = {
        ...mockEvent,
        httpMethod: 'PUT',
        pathParameters: { taskId: '123e4567-e89b-12d3-a456-426614174000' },
        body: JSON.stringify({
          title: '<img src="x" onerror="alert(\'xss\')">'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);
        expect(body.data.title).not.toContain('<img');
        expect(body.data.title).not.toContain('onerror');
      }
    });
  });

  describe('DELETE /tasks/:id - Delete Task Validation', () => {
    test('should reject missing task ID', async () => {
      const event = {
        ...mockEvent,
        httpMethod: 'DELETE',
        pathParameters: null
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('MISSING_TASK_ID');
    });

    test('should sanitize task ID parameter', async () => {
      // Mock DynamoDB operations
      const mockSend = jest.fn()
        .mockResolvedValueOnce({ Item: { taskId: 'valid-uuid', title: 'Task to Delete' } }) // GET
        .mockResolvedValueOnce({}); // DELETE
      
      require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from = jest.fn().mockReturnValue({
        send: mockSend
      });

      const event = {
        ...mockEvent,
        httpMethod: 'DELETE',
        pathParameters: { taskId: '  123e4567-e89b-12d3-a456-426614174000  ' } // With spaces
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      // Should work after sanitization
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Authentication Validation', () => {
    test('should reject requests without user ID', async () => {
      const event = {
        ...mockEvent,
        requestContext: {
          authorizer: {
            email: 'test@example.com',
            role: 'Admin',
            groups: '["Admin"]'
          }
        } as any
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('should reject requests without email', async () => {
      const event = {
        ...mockEvent,
        requestContext: {
          authorizer: {
            userId: 'test-user-id',
            role: 'Admin',
            groups: '["Admin"]'
          }
        } as any
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('should sanitize authentication context', async () => {
      // Mock DynamoDB operations
      const mockSend = jest.fn().mockResolvedValue({ Items: [] });
      require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from = jest.fn().mockReturnValue({
        send: mockSend
      });

      const event = {
        ...mockEvent,
        httpMethod: 'GET',
        requestContext: {
          authorizer: {
            userId: '  test-user-id  ', // With spaces
            email: '  test@example.com  ', // With spaces
            role: 'Admin',
            groups: '["Admin"]',
            allRoles: '["Admin"]'
          }
        } as any
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      // Should work after sanitization
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Error Response Format', () => {
    test('should return consistent error response format', async () => {
      const event = {
        ...mockEvent,
        body: null
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(body).toHaveProperty('requestId');
      expect(body).toHaveProperty('timestamp');
      
      // Verify timestamp is valid ISO string
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    test('should include validation details in error response', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          title: '', // Invalid
          deadline: 'invalid-date' // Invalid
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details).toBeInstanceOf(Array);
      expect(body.error.details.length).toBeGreaterThan(0);
      
      body.error.details.forEach((detail: any) => {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
        expect(detail).toHaveProperty('code');
      });
    });
  });
});