/**
 * Tests for SecureErrorHandler
 */

import { SecureErrorHandler } from '../secure-error-handler';
import { ErrorContext, ValidationError } from '../types';

describe('SecureErrorHandler', () => {
  const mockContext: ErrorContext = {
    requestId: 'test-request-123',
    userId: 'user-456',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    endpoint: '/api/tasks',
    method: 'POST',
    timestamp: '2024-01-15T10:30:00.000Z'
  };

  describe('createSecureResponse', () => {
    it('should create secure response for authentication error', () => {
      const response = SecureErrorHandler.createSecureResponse(
        'AUTH_INVALID_TOKEN',
        mockContext
      );

      expect(response).toEqual({
        error: {
          code: 'AUTH_INVALID_TOKEN',
          message: 'Authentication failed. Please log in again.',
          details: undefined
        },
        requestId: 'test-request-123',
        timestamp: '2024-01-15T10:30:00.000Z'
      });
    });

    it('should create secure response with validation errors', () => {
      const validationErrors: ValidationError[] = [
        {
          field: 'title',
          message: 'Title is required',
          code: 'REQUIRED'
        },
        {
          field: 'description',
          message: 'Description must be less than 500 characters',
          code: 'LENGTH_EXCEEDED'
        }
      ];

      const response = SecureErrorHandler.createSecureResponse(
        'VALIDATION_FAILED',
        mockContext,
        validationErrors
      );

      expect(response.error.details).toEqual(validationErrors);
    });

    it('should not expose internal details in secure response', () => {
      const response = SecureErrorHandler.createSecureResponse(
        'SYSTEM_DATABASE_ERROR',
        mockContext
      );

      expect(response.error.message).toBe('A system error occurred. Please try again later.');
      expect(response).not.toHaveProperty('internalDetails');
      expect(response).not.toHaveProperty('stackTrace');
      expect(response).not.toHaveProperty('context');
    });
  });

  describe('createDetailedError', () => {
    it('should create detailed error with all information', () => {
      const originalError = new Error('Database connection failed');
      originalError.stack = 'Error: Database connection failed\n    at test.js:1:1';

      const detailedError = SecureErrorHandler.createDetailedError(
        'SYSTEM_DATABASE_ERROR',
        'Failed to connect to DynamoDB table: tasks-table',
        mockContext,
        originalError,
        { tableName: 'tasks-table', operation: 'query' }
      );

      expect(detailedError.internalDetails).toBe('Failed to connect to DynamoDB table: tasks-table');
      expect(detailedError.stackTrace).toBe(originalError.stack);
      expect(detailedError.severity).toBe('HIGH');
      expect(detailedError.category).toBe('SYSTEM');
      expect(detailedError.userId).toBe('user-456');
      expect(detailedError.ipAddress).toBe('192.168.1.1');
      expect(detailedError.context).toEqual({
        tableName: 'tasks-table',
        operation: 'query',
        originalErrorName: 'Error',
        originalErrorMessage: 'Database connection failed'
      });
    });

    it('should sanitize sensitive information in internal details', () => {
      const detailedError = SecureErrorHandler.createDetailedError(
        'SYSTEM_DATABASE_ERROR',
        'Connection failed with password=secret123 and token=abc123xyz',
        mockContext
      );

      expect(detailedError.internalDetails).toBe('Connection failed with password=*** and token=***');
    });

    it('should sanitize sensitive information in context', () => {
      const sensitiveContext = {
        password: 'secret123',
        token: 'bearer-token-xyz',
        secret: 'api-secret',
        key: 'encryption-key',
        authorization: 'Bearer token123',
        normalField: 'normal-value'
      };

      const detailedError = SecureErrorHandler.createDetailedError(
        'SYSTEM_DATABASE_ERROR',
        'Test error',
        mockContext,
        undefined,
        sensitiveContext
      );

      expect(detailedError.context.password).toBe('***');
      expect(detailedError.context.token).toBe('***');
      expect(detailedError.context.secret).toBe('***');
      expect(detailedError.context.key).toBe('***');
      expect(detailedError.context.authorization).toBe('***');
      expect(detailedError.context.normalField).toBe('normal-value');
    });

    it('should truncate long strings in context', () => {
      const longString = 'a'.repeat(1500);
      const contextWithLongString = { longField: longString };

      const detailedError = SecureErrorHandler.createDetailedError(
        'SYSTEM_DATABASE_ERROR',
        'Test error',
        mockContext,
        undefined,
        contextWithLongString
      );

      expect(detailedError.context.longField).toHaveLength(1015); // 1000 + '... [truncated]'
      expect(detailedError.context.longField).toMatch(/\.\.\. \[truncated\]$/);
    });
  });

  describe('createErrorContext', () => {
    it('should create error context with provided values', () => {
      const context = SecureErrorHandler.createErrorContext(
        'req-123',
        'user-456',
        '10.0.0.1',
        'Test Agent',
        '/api/test',
        'GET'
      );

      expect(context.requestId).toBe('req-123');
      expect(context.userId).toBe('user-456');
      expect(context.ipAddress).toBe('10.0.0.1');
      expect(context.userAgent).toBe('Test Agent');
      expect(context.endpoint).toBe('/api/test');
      expect(context.method).toBe('GET');
      expect(context.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should generate UUID for requestId if not provided', () => {
      const context = SecureErrorHandler.createErrorContext();

      expect(context.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(context.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('handleUnknownError', () => {
    it('should handle validation error', () => {
      const error = new Error('Invalid input format');
      error.name = 'ValidationError';

      const result = SecureErrorHandler.handleUnknownError(error, mockContext);

      expect(result.secureResponse.error.code).toBe('VALIDATION_INVALID_FORMAT');
      expect(result.detailedError.category).toBe('VALIDATION');
      expect(result.detailedError.internalDetails).toBe('Unhandled error: Invalid input format');
    });

    it('should handle unauthorized error', () => {
      const error = new Error('Unauthorized access');
      error.name = 'UnauthorizedError';

      const result = SecureErrorHandler.handleUnknownError(error, mockContext);

      expect(result.secureResponse.error.code).toBe('AUTH_INVALID_TOKEN');
      expect(result.detailedError.category).toBe('AUTHENTICATION');
    });

    it('should handle security violation', () => {
      const error = new Error('<script>alert("xss")</script>');

      const result = SecureErrorHandler.handleUnknownError(error, mockContext);

      expect(result.secureResponse.error.code).toBe('SECURITY_SUSPICIOUS_ACTIVITY');
      expect(result.detailedError.category).toBe('SECURITY_VIOLATION');
      expect(result.detailedError.severity).toBe('CRITICAL');
    });

    it('should handle generic system error', () => {
      const error = new Error('Generic error message');

      const result = SecureErrorHandler.handleUnknownError(error, mockContext);

      expect(result.secureResponse.error.code).toBe('UNKNOWN_ERROR');
      expect(result.detailedError.category).toBe('SYSTEM');
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create validation error response with field details', () => {
      const validationErrors: ValidationError[] = [
        {
          field: 'email',
          message: 'Invalid email format',
          code: 'INVALID_FORMAT'
        }
      ];

      const response = SecureErrorHandler.createValidationErrorResponse(
        validationErrors,
        mockContext
      );

      expect(response.error.code).toBe('VALIDATION_FAILED');
      expect(response.error.message).toBe('Validation failed for one or more fields.');
      expect(response.error.details).toEqual(validationErrors);
    });
  });

  describe('createAuthenticationErrorResponse', () => {
    it('should create generic authentication error to prevent user enumeration', () => {
      const response = SecureErrorHandler.createAuthenticationErrorResponse(mockContext);

      expect(response.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(response.error.message).toBe('Invalid credentials provided.');
      // Should not reveal whether user exists or not
    });
  });

  describe('createAuthorizationErrorResponse', () => {
    it('should create authorization error response', () => {
      const response = SecureErrorHandler.createAuthorizationErrorResponse(
        'DELETE',
        'task-123',
        mockContext
      );

      expect(response.error.code).toBe('AUTHZ_INSUFFICIENT_PERMISSIONS');
      expect(response.error.message).toBe('You do not have permission to perform this action.');
    });
  });

  describe('utility methods', () => {
    it('should correctly identify if error should alert', () => {
      expect(SecureErrorHandler.shouldAlert('SECURITY_SUSPICIOUS_ACTIVITY')).toBe(true);
      expect(SecureErrorHandler.shouldAlert('SYSTEM_DATABASE_ERROR')).toBe(true);
      expect(SecureErrorHandler.shouldAlert('VALIDATION_REQUIRED_FIELD')).toBe(false);
      expect(SecureErrorHandler.shouldAlert('AUTH_TOKEN_EXPIRED')).toBe(false);
    });

    it('should correctly identify if error should be logged', () => {
      expect(SecureErrorHandler.shouldLog('AUTH_INVALID_TOKEN')).toBe(true);
      expect(SecureErrorHandler.shouldLog('SYSTEM_DATABASE_ERROR')).toBe(true);
      expect(SecureErrorHandler.shouldLog('VALIDATION_REQUIRED_FIELD')).toBe(false);
    });

    it('should return correct error severity', () => {
      expect(SecureErrorHandler.getErrorSeverity('SECURITY_SUSPICIOUS_ACTIVITY')).toBe('CRITICAL');
      expect(SecureErrorHandler.getErrorSeverity('SYSTEM_DATABASE_ERROR')).toBe('HIGH');
      expect(SecureErrorHandler.getErrorSeverity('AUTH_INVALID_TOKEN')).toBe('MEDIUM');
      expect(SecureErrorHandler.getErrorSeverity('VALIDATION_REQUIRED_FIELD')).toBe('LOW');
    });

    it('should return correct error category', () => {
      expect(SecureErrorHandler.getErrorCategory('AUTH_INVALID_TOKEN')).toBe('AUTHENTICATION');
      expect(SecureErrorHandler.getErrorCategory('AUTHZ_INSUFFICIENT_PERMISSIONS')).toBe('AUTHORIZATION');
      expect(SecureErrorHandler.getErrorCategory('VALIDATION_REQUIRED_FIELD')).toBe('VALIDATION');
      expect(SecureErrorHandler.getErrorCategory('SYSTEM_DATABASE_ERROR')).toBe('SYSTEM');
      expect(SecureErrorHandler.getErrorCategory('SECURITY_SUSPICIOUS_ACTIVITY')).toBe('SECURITY_VIOLATION');
    });
  });
});