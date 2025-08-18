/**
 * Tests for ErrorLogger
 */

import { ErrorLogger, LogEntry, SecurityAuditEntry } from '../error-logger';
import { DetailedError, ErrorContext } from '../types';

// Mock console methods
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();
const mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation();

describe('ErrorLogger', () => {
  const mockContext: ErrorContext = {
    requestId: 'test-request-123',
    userId: 'user-456',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    endpoint: '/api/tasks',
    method: 'POST',
    timestamp: '2024-01-15T10:30:00.000Z'
  };

  const mockDetailedError: DetailedError = {
    error: {
      code: 'SYSTEM_DATABASE_ERROR',
      message: 'A system error occurred. Please try again later.'
    },
    requestId: 'test-request-123',
    timestamp: '2024-01-15T10:30:00.000Z',
    internalDetails: 'Failed to connect to DynamoDB with password=secret123',
    stackTrace: 'Error: Database connection failed\n    at test.js:1:1',
    context: {
      tableName: 'tasks-table',
      operation: 'query',
      token: 'bearer-token-xyz'
    },
    severity: 'HIGH',
    category: 'SYSTEM',
    userId: 'user-456',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logError', () => {
    it('should log error with sanitized sensitive information', () => {
      ErrorLogger.logError(mockDetailedError);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.objectContaining({
          level: 'ERROR',
          message: 'Failed to connect to DynamoDB with password=***',
          errorCode: 'SYSTEM_DATABASE_ERROR',
          severity: 'HIGH',
          category: 'SYSTEM',
          context: expect.objectContaining({
            tableName: 'tasks-table',
            operation: 'query',
            token: '***'
          })
        })
      );
    });

    it('should log security events separately for security-related errors', () => {
      const securityError: DetailedError = {
        ...mockDetailedError,
        error: { code: 'AUTH_INVALID_TOKEN', message: 'Authentication failed' },
        category: 'AUTHENTICATION',
        severity: 'CRITICAL'
      };

      ErrorLogger.logError(securityError);

      // Should log both regular error and security audit
      expect(mockConsoleError).toHaveBeenCalledTimes(3); // Error log + Security audit + Security alert
    });

    it('should use appropriate log level based on severity', () => {
      const lowSeverityError: DetailedError = {
        ...mockDetailedError,
        severity: 'LOW'
      };

      ErrorLogger.logError(lowSeverityError);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.any(Object)
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log authentication failure as security event', () => {
      const authError: DetailedError = {
        ...mockDetailedError,
        error: { code: 'AUTH_INVALID_TOKEN', message: 'Authentication failed' },
        category: 'AUTHENTICATION',
        severity: 'MEDIUM'
      };

      ErrorLogger.logSecurityEvent(authError, 'Account temporarily locked');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY-AUDIT]'),
        expect.objectContaining({
          securityEvent: 'AUTHENTICATION_FAILURE',
          threatLevel: 'MEDIUM',
          actionTaken: 'Account temporarily locked'
        })
      );
    });

    it('should trigger alert for critical security events', () => {
      const criticalSecurityError: DetailedError = {
        ...mockDetailedError,
        error: { code: 'SECURITY_SUSPICIOUS_ACTIVITY', message: 'Security violation detected' },
        category: 'SECURITY_VIOLATION',
        severity: 'CRITICAL'
      };

      ErrorLogger.logSecurityEvent(criticalSecurityError);

      // Should log security audit and trigger alert
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY-ALERT]'),
        expect.any(Object)
      );
    });
  });

  describe('logInfo', () => {
    it('should log info message with sanitized context', () => {
      const additionalData = {
        operation: 'createTask',
        password: 'secret123',
        normalField: 'normal-value'
      };

      ErrorLogger.logInfo('Task created successfully', mockContext, additionalData);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.objectContaining({
          level: 'INFO',
          message: 'Task created successfully',
          context: expect.objectContaining({
            operation: 'createTask',
            password: '***',
            normalField: 'normal-value'
          })
        })
      );
    });
  });

  describe('logWarning', () => {
    it('should log warning message', () => {
      ErrorLogger.logWarning('Rate limit approaching', mockContext);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        expect.objectContaining({
          level: 'WARN',
          message: 'Rate limit approaching'
        })
      );
    });
  });

  describe('logPerformance', () => {
    it('should log performance info for normal operations', () => {
      ErrorLogger.logPerformance('database-query', 1500, mockContext, { query: 'SELECT * FROM tasks' });

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.objectContaining({
          level: 'INFO',
          message: 'Performance: database-query completed in 1500ms',
          duration: 1500
        })
      );
    });

    it('should log performance warning for slow operations', () => {
      ErrorLogger.logPerformance('slow-query', 6000, mockContext);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        expect.objectContaining({
          level: 'WARN',
          message: 'Performance: slow-query completed in 6000ms',
          duration: 6000
        })
      );
    });
  });

  describe('sensitive data sanitization', () => {
    it('should sanitize passwords in messages', () => {
      const errorWithPassword: DetailedError = {
        ...mockDetailedError,
        internalDetails: 'Connection failed with password=mysecret123 and user=admin'
      };

      ErrorLogger.logError(errorWithPassword);

      const logCall = mockConsoleError.mock.calls[0][1] as LogEntry;
      expect(logCall.message).toBe('Connection failed with password=*** and user=admin');
    });

    it('should sanitize tokens in messages', () => {
      const errorWithToken: DetailedError = {
        ...mockDetailedError,
        internalDetails: 'API call failed with token=abc123xyz and bearer token123'
      };

      ErrorLogger.logError(errorWithToken);

      const logCall = mockConsoleError.mock.calls[0][1] as LogEntry;
      expect(logCall.message).toBe('API call failed with token=*** and bearer ***');
    });

    it('should sanitize email addresses', () => {
      const errorWithEmail: DetailedError = {
        ...mockDetailedError,
        internalDetails: 'User john.doe@example.com attempted invalid action'
      };

      ErrorLogger.logError(errorWithEmail);

      const logCall = mockConsoleError.mock.calls[0][1] as LogEntry;
      expect(logCall.message).toBe('User j***@example.com attempted invalid action');
    });

    it('should sanitize phone numbers', () => {
      const errorWithPhone: DetailedError = {
        ...mockDetailedError,
        internalDetails: 'Contact attempt to 555-123-4567 failed'
      };

      ErrorLogger.logError(errorWithPhone);

      const logCall = mockConsoleError.mock.calls[0][1] as LogEntry;
      expect(logCall.message).toBe('Contact attempt to 55***67 failed');
    });

    it('should sanitize credit card numbers', () => {
      const errorWithCC: DetailedError = {
        ...mockDetailedError,
        internalDetails: 'Payment failed for card 4532-1234-5678-9012'
      };

      ErrorLogger.logError(errorWithCC);

      const logCall = mockConsoleError.mock.calls[0][1] as LogEntry;
      expect(logCall.message).toBe('Payment failed for card 45***12');
    });

    it('should sanitize nested objects in context', () => {
      const errorWithNestedSensitive: DetailedError = {
        ...mockDetailedError,
        context: {
          user: {
            password: 'secret123',
            email: 'user@example.com'
          },
          api: {
            key: 'api-key-xyz',
            token: 'bearer-token'
          }
        }
      };

      ErrorLogger.logError(errorWithNestedSensitive);

      const logCall = mockConsoleError.mock.calls[0][1] as LogEntry;
      expect(logCall.context?.user.password).toBe('***');
      expect(logCall.context?.user.email).toBe('u***@example.com');
      expect(logCall.context?.api.key).toBe('***');
      expect(logCall.context?.api.token).toBe('***');
    });

    it('should truncate long strings in context', () => {
      const longString = 'a'.repeat(1500);
      const errorWithLongString: DetailedError = {
        ...mockDetailedError,
        context: {
          longField: longString
        }
      };

      ErrorLogger.logError(errorWithLongString);

      const logCall = mockConsoleError.mock.calls[0][1] as LogEntry;
      expect(logCall.context?.longField).toHaveLength(1015); // 1000 + '... [truncated]'
      expect(logCall.context?.longField).toMatch(/\.\.\. \[truncated\]$/);
    });

    it('should sanitize stack traces', () => {
      const errorWithSensitiveStack: DetailedError = {
        ...mockDetailedError,
        stackTrace: 'Error: Failed\n    at /home/user/secret-project/app.js:123:45\n    at password=secret123'
      };

      ErrorLogger.logError(errorWithSensitiveStack);

      const logCall = mockConsoleError.mock.calls[0][1] as LogEntry;
      expect(logCall.stackTrace).toContain('.../app.js:123:45');
      expect(logCall.stackTrace).toContain('password=***');
    });

    it('should sanitize user agent version info', () => {
      const errorWithDetailedUA: DetailedError = {
        ...mockDetailedError,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0.19042.1234; Win64; x64) Chrome/91.0.4472.124'
      };

      ErrorLogger.logError(errorWithDetailedUA);

      const logCall = mockConsoleError.mock.calls[0][1] as LogEntry;
      expect(logCall.userAgent).toBe('Mozilla/5.0 (Windows NT x.x.x.x; Win64; x64) Chrome/x.x.x.x');
    });
  });

  describe('security event mapping', () => {
    it('should map authentication errors correctly', () => {
      const authError: DetailedError = {
        ...mockDetailedError,
        error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' },
        category: 'AUTHENTICATION'
      };

      ErrorLogger.logSecurityEvent(authError);

      const auditCall = mockConsoleError.mock.calls[0][1] as SecurityAuditEntry;
      expect(auditCall.securityEvent).toBe('AUTHENTICATION_FAILURE');
    });

    it('should map authorization errors correctly', () => {
      const authzError: DetailedError = {
        ...mockDetailedError,
        error: { code: 'AUTHZ_INSUFFICIENT_PERMISSIONS', message: 'Access denied' },
        category: 'AUTHORIZATION'
      };

      ErrorLogger.logSecurityEvent(authzError);

      const auditCall = mockConsoleError.mock.calls[0][1] as SecurityAuditEntry;
      expect(auditCall.securityEvent).toBe('AUTHORIZATION_FAILURE');
    });

    it('should map brute force attempts correctly', () => {
      const bruteForceError: DetailedError = {
        ...mockDetailedError,
        error: { code: 'SECURITY_BRUTE_FORCE', message: 'Too many attempts' },
        category: 'SECURITY_VIOLATION'
      };

      ErrorLogger.logSecurityEvent(bruteForceError);

      const auditCall = mockConsoleError.mock.calls[0][1] as SecurityAuditEntry;
      expect(auditCall.securityEvent).toBe('BRUTE_FORCE_ATTEMPT');
    });
  });
});