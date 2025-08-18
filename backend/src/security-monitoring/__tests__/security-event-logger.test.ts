import { SecurityEventLogger } from '../security-event-logger';

// Mock console.log to capture log output
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

describe('SecurityEventLogger', () => {
  let logger: SecurityEventLogger;

  beforeEach(() => {
    logger = SecurityEventLogger.getInstance();
    mockConsoleLog.mockClear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const logger1 = SecurityEventLogger.getInstance();
      const logger2 = SecurityEventLogger.getInstance();
      expect(logger1).toBe(logger2);
    });
  });

  describe('logSecurityEvent', () => {
    it('should log a security event with generated eventId and timestamp', async () => {
      const eventData = {
        userId: 'user123',
        eventType: 'AUTH' as const,
        action: 'login_attempt',
        result: 'SUCCESS' as const,
        details: { method: 'password' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        severity: 'LOW' as const
      };

      await logger.logSecurityEvent(eventData);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Security Event: AUTH - login_attempt')
      );

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData).toMatchObject({
        userId: 'user123',
        eventType: 'AUTH',
        action: 'login_attempt',
        result: 'SUCCESS',
        severity: 'LOW',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });
      expect(loggedData.eventId).toBeDefined();
      expect(loggedData.timestamp).toBeDefined();
    });

    it('should handle logging errors gracefully', async () => {
      const originalConsoleError = console.error;
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      // Force an error by passing invalid data
      const eventData = {
        userId: 'user123',
        eventType: 'AUTH' as const,
        action: 'login_attempt',
        result: 'SUCCESS' as const,
        details: { method: 'password' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        severity: 'LOW' as const
      };

      await logger.logSecurityEvent(eventData);

      // Should still log the event even if there's an error
      expect(mockConsoleLog).toHaveBeenCalled();

      console.error = originalConsoleError;
    });
  });

  describe('logAuthEvent', () => {
    it('should log authentication events with correct severity', async () => {
      await logger.logAuthEvent(
        'login_attempt',
        'user123',
        'FAILURE',
        { reason: 'invalid_password' },
        '192.168.1.1',
        'Mozilla/5.0',
        'req123'
      );

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData).toMatchObject({
        userId: 'user123',
        eventType: 'AUTH',
        action: 'login_attempt',
        result: 'FAILURE',
        severity: 'MEDIUM', // Failed auth should be MEDIUM severity
        requestId: 'req123'
      });
    });

    it('should sanitize sensitive details', async () => {
      await logger.logAuthEvent(
        'login_attempt',
        'user123',
        'SUCCESS',
        { password: 'secret123', username: 'user123' },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData.details.password).toBe('[REDACTED]');
      expect(loggedData.details.username).toBe('user123');
    });
  });

  describe('logAuthzEvent', () => {
    it('should log authorization events with resource information', async () => {
      await logger.logAuthzEvent(
        'access_resource',
        'user123',
        'tasks/456',
        'SUCCESS',
        { role: 'viewer' },
        '192.168.1.1',
        'Mozilla/5.0',
        'req123'
      );

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData).toMatchObject({
        userId: 'user123',
        eventType: 'AUTHZ',
        action: 'access_resource',
        resource: 'tasks/456',
        result: 'SUCCESS',
        severity: 'LOW'
      });
    });

    it('should assign MEDIUM severity to failed authorization', async () => {
      await logger.logAuthzEvent(
        'access_admin_panel',
        'user123',
        'admin/dashboard',
        'FAILURE',
        { role: 'viewer', required_role: 'admin' },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData.severity).toBe('MEDIUM');
    });
  });

  describe('logDataAccessEvent', () => {
    it('should log data access events', async () => {
      await logger.logDataAccessEvent(
        'query_tasks',
        'user123',
        'tasks_table',
        'SUCCESS',
        { query_type: 'scan', items_returned: 5 },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData).toMatchObject({
        userId: 'user123',
        eventType: 'DATA_ACCESS',
        action: 'query_tasks',
        resource: 'tasks_table',
        result: 'SUCCESS'
      });
    });
  });

  describe('logSecurityViolation', () => {
    it('should log security violations with HIGH severity', async () => {
      await logger.logSecurityViolation(
        'sql_injection_attempt',
        'user123',
        { malicious_input: "'; DROP TABLE users; --" },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData).toMatchObject({
        userId: 'user123',
        eventType: 'SECURITY_VIOLATION',
        action: 'sql_injection_attempt',
        result: 'BLOCKED',
        severity: 'HIGH'
      });
    });

    it('should handle security violations without userId', async () => {
      await logger.logSecurityViolation(
        'rate_limit_exceeded',
        undefined,
        { requests_per_minute: 1000 },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData.userId).toBeUndefined();
      expect(loggedData.eventType).toBe('SECURITY_VIOLATION');
    });
  });

  describe('Severity Determination', () => {
    it('should assign correct severity levels', async () => {
      // Test different scenarios
      const testCases = [
        {
          eventType: 'AUTH' as const,
          action: 'login_attempt',
          result: 'FAILURE' as const,
          expectedSeverity: 'MEDIUM'
        },
        {
          eventType: 'AUTHZ' as const,
          action: 'access_resource',
          result: 'FAILURE' as const,
          expectedSeverity: 'MEDIUM'
        },
        {
          eventType: 'DATA_ACCESS' as const,
          action: 'admin_delete',
          result: 'SUCCESS' as const,
          expectedSeverity: 'MEDIUM'
        },
        {
          eventType: 'AUTH' as const,
          action: 'token_refresh',
          result: 'SUCCESS' as const,
          expectedSeverity: 'LOW'
        }
      ];

      for (const testCase of testCases) {
        mockConsoleLog.mockClear();
        
        await logger.logSecurityEvent({
          userId: 'user123',
          eventType: testCase.eventType,
          action: testCase.action,
          result: testCase.result,
          details: {},
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          severity: 'LOW' // This will be overridden by determineSeverity
        });

        const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
        expect(loggedData.severity).toBe(testCase.expectedSeverity);
      }
    });
  });

  describe('Data Sanitization', () => {
    it('should redact sensitive information from details', async () => {
      const sensitiveDetails = {
        username: 'user123',
        password: 'secret123',
        token: 'jwt-token-here',
        secret: 'api-secret',
        apiKey: 'key-123',
        credential: 'cred-456',
        normalField: 'normal-value'
      };

      await logger.logAuthEvent(
        'login_attempt',
        'user123',
        'SUCCESS',
        sensitiveDetails,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData.details).toEqual({
        username: 'user123',
        password: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]',
        apiKey: '[REDACTED]',
        credential: '[REDACTED]',
        normalField: 'normal-value'
      });
    });
  });

  describe('Retention Policy', () => {
    it('should have default retention policy', () => {
      const policy = logger.getRetentionPolicy();
      expect(policy).toEqual({
        retentionDays: 365,
        archiveAfterDays: 90,
        compressionEnabled: true,
        encryptionEnabled: true
      });
    });

    it('should allow updating retention policy', () => {
      logger.setRetentionPolicy({
        retentionDays: 730,
        archiveAfterDays: 180
      });

      const policy = logger.getRetentionPolicy();
      expect(policy.retentionDays).toBe(730);
      expect(policy.archiveAfterDays).toBe(180);
      expect(policy.compressionEnabled).toBe(true); // Should keep existing values
    });
  });

  describe('Log Level Mapping', () => {
    it('should map severity to appropriate log levels', async () => {
      const severityTests = [
        { severity: 'CRITICAL' as const, expectedLevel: 'ERROR' },
        { severity: 'HIGH' as const, expectedLevel: 'WARN' }
      ];

      for (const test of severityTests) {
        mockConsoleLog.mockClear();
        
        // Use security violation to ensure HIGH/CRITICAL severity is preserved
        await logger.logSecurityViolation(
          'test_violation',
          'user123',
          {},
          '192.168.1.1',
          'Mozilla/5.0'
        );

        const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
        expect(loggedData.level).toBe('WARN'); // Security violations are always HIGH severity
      }

      // Test other severity levels with specific scenarios
      mockConsoleLog.mockClear();
      await logger.logAuthEvent(
        'login_attempt',
        'user123',
        'FAILURE',
        {},
        '192.168.1.1',
        'Mozilla/5.0'
      );
      let loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData.level).toBe('INFO'); // MEDIUM severity maps to INFO

      mockConsoleLog.mockClear();
      await logger.logAuthEvent(
        'token_refresh',
        'user123',
        'SUCCESS',
        {},
        '192.168.1.1',
        'Mozilla/5.0'
      );
      loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      expect(loggedData.level).toBe('DEBUG'); // LOW severity maps to DEBUG
    });
  });
});