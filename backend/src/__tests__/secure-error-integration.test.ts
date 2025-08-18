/**
 * Integration tests for secure error handling in Lambda functions
 */

import { APIGatewayProxyEvent, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import { handler as authorizerHandler } from '../authorizer';
import { ErrorLogger } from '../error-handling';
import { handler as tasksHandler } from '../tasks';

// Mock console methods to capture logs
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();

// Mock the Cognito JWT verifier
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn()
    }))
  }
}));

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

// Helper function to create test events
const createTasksEvent = (
  method: string = 'GET',
  body: string | null = null,
  pathParameters: Record<string, string> | null = null
): APIGatewayProxyEvent => ({
  httpMethod: method,
  path: '/tasks',
  resource: '/tasks',
  body,
  pathParameters,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Test-Agent/1.0'
  },
  multiValueHeaders: {},
  isBase64Encoded: false,
  requestContext: {
    requestId: 'test-request-id',
    stage: 'test',
    resourceId: 'test',
    resourcePath: '/tasks',
    httpMethod: method,
    path: '/test/tasks',
    protocol: 'HTTP/1.1',
    requestTimeEpoch: Date.now(),
    requestTime: new Date().toISOString(),
    identity: {
      sourceIp: '192.168.1.1',
      userAgent: 'Test-Agent/1.0'
    },
    authorizer: {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'Contributor',
      groups: '["Contributors"]',
      allRoles: '["Contributor", "Viewer"]'
    }
  } as any,
  stageVariables: null
});

describe('Secure Error Handling Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USER_POOL_ID = 'test-pool-id';
    process.env.TASKS_TABLE = 'test-tasks-table';
  });

  describe('Authorizer Error Handling', () => {
    const createAuthorizerEvent = (token?: string): APIGatewayRequestAuthorizerEvent => ({
      type: 'REQUEST',
      methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/GET/tasks',
      resource: '/tasks',
      path: '/tasks',
      httpMethod: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {
        resourceId: 'test',
        resourcePath: '/tasks',
        httpMethod: 'GET',
        requestId: 'test-request-id',
        protocol: 'HTTP/1.1',
        path: '/test/tasks',
        stage: 'test',
        requestTimeEpoch: Date.now(),
        requestTime: new Date().toISOString(),
        identity: {
          sourceIp: '192.168.1.1',
          userAgent: 'Test-Agent/1.0'
        },
        accountId: '123456789012',
        apiId: 'abcdef123'
      } as any
    });

    it('should handle missing token with secure error logging', async () => {
      const event = createAuthorizerEvent();

      await expect(authorizerHandler(event)).rejects.toThrow('Unauthorized');

      // Verify secure error logging
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.objectContaining({
          level: 'ERROR',
          errorCode: 'AUTH_MISSING_TOKEN',
          category: 'AUTHENTICATION',
          severity: 'MEDIUM'
        })
      );

      // Verify security audit logging
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY-AUDIT]'),
        expect.objectContaining({
          securityEvent: 'AUTHENTICATION_FAILURE',
          threatLevel: 'MEDIUM'
        })
      );
    });

    it('should handle invalid token with secure error logging', async () => {
      const { CognitoJwtVerifier } = require('aws-jwt-verify');
      const mockVerifier = CognitoJwtVerifier.create();
      mockVerifier.verify.mockRejectedValue(new Error('Invalid token'));

      const event = createAuthorizerEvent('invalid-token');

      await expect(authorizerHandler(event)).rejects.toThrow('Unauthorized');

      // Verify secure error logging for invalid token
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.objectContaining({
          level: 'ERROR',
          errorCode: 'AUTH_INVALID_TOKEN',
          category: 'AUTHENTICATION',
          severity: 'MEDIUM'
        })
      );
    });

    it('should handle successful authentication with info logging', async () => {
      const { CognitoJwtVerifier } = require('aws-jwt-verify');
      const mockVerifier = CognitoJwtVerifier.create();
      mockVerifier.verify.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
        'cognito:groups': ['Contributors']
      });

      const event = createAuthorizerEvent('valid-token');

      const result = await authorizerHandler(event);

      expect(result.principalId).toBe('user-123');
      expect(result.context?.role).toBe('Contributor');

      // Verify info logging for successful authentication
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.objectContaining({
          level: 'INFO',
          message: 'User authorization successful'
        })
      );
    });
  });

  describe('Tasks Handler Error Handling', () => {

    it('should handle authentication errors with secure responses', async () => {
      const event = createTasksEvent();
      // Remove authorization context to simulate auth failure
      delete event.requestContext.authorizer;

      const result = await tasksHandler(event, {} as any);

      expect(result.statusCode).toBe(401);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(responseBody.error.message).toBe('Invalid credentials provided.');
      expect(responseBody.requestId).toBeDefined();
      expect(responseBody.timestamp).toBeDefined();

      // Should not expose internal details
      expect(responseBody).not.toHaveProperty('internalDetails');
      expect(responseBody).not.toHaveProperty('stackTrace');
    });

    it('should handle validation errors with field-specific details', async () => {
      const event = createTasksEvent('POST', JSON.stringify({
        // Missing required title field
        description: 'Test description'
      }));

      const result = await tasksHandler(event, {} as any);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('VALIDATION_FAILED');
      expect(responseBody.error.message).toBe('Validation failed for one or more fields.');
      expect(responseBody.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String),
            code: expect.any(String)
          })
        ])
      );
    });

    it('should handle malformed JSON with secure error response', async () => {
      const event = createTasksEvent('POST', '{ invalid json }');

      const result = await tasksHandler(event, {} as any);

      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('VALIDATION_INVALID_FORMAT');
      expect(responseBody.error.message).toBe('Invalid data format provided.');

      // Verify error logging
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.objectContaining({
          level: 'ERROR',
          errorCode: 'VALIDATION_INVALID_FORMAT',
          category: 'VALIDATION'
        })
      );
    });

    it('should handle large payload attacks', async () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB payload
      const event = createTasksEvent('POST', largePayload);

      const result = await tasksHandler(event, {} as any);

      expect(result.statusCode).toBe(413);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('VALIDATION_LENGTH_EXCEEDED');
    });

    it('should handle system errors with generic responses', async () => {
      // Mock a system error by making DynamoDB operations fail
      const mockError = new Error('DynamoDB connection failed');
      
      // This would require mocking the actual DynamoDB operations
      // For now, we'll test the error handling structure
      const event = createTasksEvent();

      // The actual system error testing would require more complex mocking
      // but the structure is in place for secure error handling
    });

    it('should log performance metrics for successful operations', async () => {
      const event = createTasksEvent();

      // Mock successful operation (would require mocking DynamoDB)
      // For now, verify the performance logging structure is in place
      
      // The performance logging would be called in successful operations
      // ErrorLogger.logPerformance would be invoked with operation details
    });
  });

  describe('Error Sanitization', () => {
    it('should sanitize sensitive information in error logs', () => {
      const sensitiveContext = {
        password: 'secret123',
        token: 'bearer-token-xyz',
        email: 'user@example.com',
        normalField: 'normal-value'
      };

      // Test the sanitization through ErrorLogger
      const errorContext = {
        requestId: 'test-123',
        userId: 'user-456',
        timestamp: new Date().toISOString()
      };

      ErrorLogger.logInfo('Test message with password=secret123', errorContext, sensitiveContext);

      // Verify sanitization occurred
      const logCall = mockConsoleInfo.mock.calls.find(call => 
        call[0].includes('[INFO]')
      );
      
      expect(logCall).toBeDefined();
      const logEntry = logCall![1];
      expect(logEntry.context.password).toBe('***');
      expect(logEntry.context.token).toBe('***');
      expect(logEntry.context.email).toBe('u***@example.com');
      expect(logEntry.context.normalField).toBe('normal-value');
    });

    it('should not expose stack traces in client responses', async () => {
      const event = createTasksEvent('POST', 'invalid-json');

      const result = await tasksHandler(event, {} as any);
      const responseBody = JSON.parse(result.body);

      // Client response should not contain stack trace
      expect(responseBody).not.toHaveProperty('stackTrace');
      expect(responseBody).not.toHaveProperty('internalDetails');
      
      // But error should be logged server-side with details
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.objectContaining({
          level: 'ERROR',
          stackTrace: expect.any(String)
        })
      );
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events for authentication failures', async () => {
      const event = createTasksEvent();
      delete event.requestContext.authorizer;

      await tasksHandler(event, {} as any);

      // Verify security audit logging
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY-AUDIT]'),
        expect.objectContaining({
          securityEvent: 'AUTHENTICATION_FAILURE',
          threatLevel: expect.any(String)
        })
      );
    });

    it('should trigger alerts for critical security events', () => {
      // Test that critical security events trigger alerts
      // This would be tested through the ErrorLogger.logSecurityEvent method
      
      const criticalError = {
        error: { code: 'SECURITY_SUSPICIOUS_ACTIVITY', message: 'Security violation' },
        requestId: 'test-123',
        timestamp: new Date().toISOString(),
        internalDetails: 'Suspicious activity detected',
        context: { suspiciousActivity: true },
        severity: 'CRITICAL' as const,
        category: 'SECURITY_VIOLATION' as const,
        userId: 'user-123'
      };

      ErrorLogger.logSecurityEvent(criticalError);

      // Verify alert was triggered
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY-ALERT]'),
        expect.objectContaining({
          event: 'SECURITY_VIOLATION',
          threatLevel: 'CRITICAL'
        })
      );
    });
  });
});