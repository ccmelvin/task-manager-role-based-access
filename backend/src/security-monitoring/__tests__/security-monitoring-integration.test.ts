import {
    SecurityAlertingService,
    SecurityDashboardService,
    SecurityEventLogger,
    getSecurityAlerting,
    getSecurityDashboard,
    getSecurityLogger
} from '../index';

// Mock console.log to capture log output
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

describe('Security Monitoring Integration', () => {
  let logger: SecurityEventLogger;
  let alerting: SecurityAlertingService;
  let dashboard: SecurityDashboardService;

  beforeEach(() => {
    logger = getSecurityLogger();
    alerting = getSecurityAlerting();
    dashboard = getSecurityDashboard();
    
    // Clear any existing data
    (dashboard as any).events = [];
    (dashboard as any).alerts = [];
    (alerting as any).eventBuffer = [];
    (alerting as any).activeAlerts = new Map();
    
    mockConsoleLog.mockClear();
  });

  describe('End-to-End Security Event Processing', () => {
    it('should process security events through the complete pipeline', async () => {
      // 1. Log a security event
      await logger.logAuthEvent(
        'login_attempt',
        'user123',
        'FAILURE',
        { reason: 'invalid_password' },
        '192.168.1.1',
        'Mozilla/5.0',
        'req123'
      );

      // Verify event was logged
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Security Event: AUTH - login_attempt')
      );

      // 2. Simulate adding the event to dashboard
      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      dashboard.addSecurityEvent({
        eventId: loggedData.eventId,
        userId: 'user123',
        eventType: 'AUTH',
        action: 'login_attempt',
        result: 'FAILURE',
        details: { reason: 'invalid_password' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: loggedData.timestamp,
        severity: 'MEDIUM'
      });

      // 3. Process the event through alerting
      await alerting.processSecurityEvent({
        eventId: loggedData.eventId,
        userId: 'user123',
        eventType: 'AUTH',
        action: 'login_attempt',
        result: 'FAILURE',
        details: { reason: 'invalid_password' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: loggedData.timestamp,
        severity: 'MEDIUM'
      });

      // 4. Generate multiple events to trigger alert
      for (let i = 0; i < 5; i++) {
        await alerting.processSecurityEvent({
          eventId: `event-${i}`,
          userId: 'user123',
          eventType: 'AUTH',
          action: 'login_attempt',
          result: 'FAILURE',
          details: { reason: 'invalid_password' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date().toISOString(),
          severity: 'MEDIUM'
        });
      }

      // 5. Check if alert was triggered
      const activeAlerts = alerting.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const authAlert = activeAlerts.find(alert => alert.ruleId === 'auth-failures');
      expect(authAlert).toBeTruthy();

      // 6. Add alert to dashboard
      if (authAlert) {
        dashboard.addSecurityAlert(authAlert);
      }

      // 7. Generate dashboard metrics
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();
      const metrics = dashboard.getDashboardMetrics(startTime, endTime);

      expect(metrics.overview.totalEvents).toBeGreaterThan(0);
      expect(metrics.overview.totalAlerts).toBeGreaterThan(0);
      expect(metrics.eventsByType.AUTH).toBeGreaterThan(0);

      // 8. Generate security report
      const report = dashboard.generateSecurityReport('DAILY', startTime, endTime);
      expect(report.summary.totalEvents).toBeGreaterThan(0);
      expect(report.summary.totalAlerts).toBeGreaterThan(0);
    });

    it('should handle security violations with immediate alerting', async () => {
      // 1. Log a security violation
      await logger.logSecurityViolation(
        'sql_injection_attempt',
        'user456',
        { malicious_input: "'; DROP TABLE users; --" },
        '192.168.1.100',
        'Mozilla/5.0',
        'req456'
      );

      // Verify violation was logged
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Security Event: SECURITY_VIOLATION - sql_injection_attempt')
      );

      // 2. Process through alerting (should trigger immediate alert)
      const loggedData = JSON.parse(mockConsoleLog.mock.calls[0][0]);
      await alerting.processSecurityEvent({
        eventId: loggedData.eventId,
        userId: 'user456',
        eventType: 'SECURITY_VIOLATION',
        action: 'sql_injection_attempt',
        result: 'BLOCKED',
        details: { malicious_input: "'; DROP TABLE users; --" },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        timestamp: loggedData.timestamp,
        severity: 'HIGH'
      });

      // 3. Check if alert was triggered immediately
      const activeAlerts = alerting.getActiveAlerts();
      const violationAlert = activeAlerts.find(alert => alert.ruleId === 'security-violations');
      expect(violationAlert).toBeTruthy();
      expect(violationAlert!.escalationLevel).toBe('HIGH');

      // 4. Verify notifications were sent
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('EMAIL NOTIFICATION'),
        expect.stringContaining('SECURITY ALERT')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('SLACK NOTIFICATION'),
        expect.stringContaining('SECURITY ALERT')
      );
    });

    it('should support alert lifecycle management', async () => {
      // 1. Create a security violation to trigger an alert
      await alerting.processSecurityEvent({
        eventId: 'violation-1',
        userId: 'user789',
        eventType: 'SECURITY_VIOLATION',
        action: 'unauthorized_access',
        result: 'BLOCKED',
        details: { attempted_resource: '/admin/users' },
        ipAddress: '192.168.1.200',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        severity: 'HIGH'
      });

      // 2. Verify alert was created
      let activeAlerts = alerting.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      const alert = activeAlerts[0];
      expect(alert.status).toBe('ACTIVE');

      // 3. Acknowledge the alert
      const acknowledgedAlert = alerting.acknowledgeAlert(alert.alertId, 'admin123');
      expect(acknowledgedAlert).toBeTruthy();
      expect(acknowledgedAlert!.status).toBe('ACKNOWLEDGED');
      expect(acknowledgedAlert!.acknowledgedBy).toBe('admin123');

      // 4. Resolve the alert
      const resolvedAlert = alerting.resolveAlert(alert.alertId);
      expect(resolvedAlert).toBeTruthy();
      expect(resolvedAlert!.status).toBe('RESOLVED');

      // 5. Verify alert is no longer active
      activeAlerts = alerting.getActiveAlerts();
      expect(activeAlerts.find(a => a.alertId === alert.alertId)).toBeUndefined();
    });

    it('should generate comprehensive security reports', async () => {
      // 1. Generate various types of security events
      const events = [
        {
          eventId: 'auth-success-1',
          userId: 'user1',
          eventType: 'AUTH' as const,
          action: 'login',
          result: 'SUCCESS' as const,
          details: {},
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date().toISOString(),
          severity: 'LOW' as const
        },
        {
          eventId: 'auth-failure-1',
          userId: 'user1',
          eventType: 'AUTH' as const,
          action: 'login',
          result: 'FAILURE' as const,
          details: { reason: 'invalid_password' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date().toISOString(),
          severity: 'MEDIUM' as const
        },
        {
          eventId: 'authz-success-1',
          userId: 'user2',
          eventType: 'AUTHZ' as const,
          action: 'access_resource',
          result: 'SUCCESS' as const,
          details: { resource: '/api/tasks' },
          ipAddress: '192.168.1.2',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date().toISOString(),
          severity: 'LOW' as const
        },
        {
          eventId: 'violation-1',
          userId: 'user3',
          eventType: 'SECURITY_VIOLATION' as const,
          action: 'xss_attempt',
          result: 'BLOCKED' as const,
          details: { malicious_script: '<script>alert("xss")</script>' },
          ipAddress: '192.168.1.3',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date().toISOString(),
          severity: 'HIGH' as const
        }
      ];

      // 2. Add events to dashboard
      events.forEach(event => dashboard.addSecurityEvent(event));

      // 3. Generate report
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();
      const report = dashboard.generateSecurityReport('DAILY', startTime, endTime);

      // 4. Verify report completeness
      expect(report.reportId).toBeDefined();
      expect(report.reportType).toBe('DAILY');
      expect(report.summary.totalEvents).toBe(4);
      expect(report.sections.executiveSummary).toContain('4 security events');
      expect(report.sections.securityEvents.totalEvents).toBe(4);
      expect(report.sections.securityEvents.topEventTypes.length).toBeGreaterThan(0);
      expect(report.sections.recommendations.length).toBeGreaterThan(0);

      // 5. Verify event type breakdown
      const authEvents = report.sections.securityEvents.topEventTypes.find(t => t.eventType === 'AUTH');
      expect(authEvents).toBeTruthy();
      expect(authEvents!.count).toBe(2);
      expect(authEvents!.percentage).toBe(50);
    });
  });

  describe('Convenience Functions', () => {
    it('should provide singleton instances through convenience functions', () => {
      const logger1 = getSecurityLogger();
      const logger2 = getSecurityLogger();
      expect(logger1).toBe(logger2);

      const alerting1 = getSecurityAlerting();
      const alerting2 = getSecurityAlerting();
      expect(alerting1).toBe(alerting2);

      const dashboard1 = getSecurityDashboard();
      const dashboard2 = getSecurityDashboard();
      expect(dashboard1).toBe(dashboard2);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully across all components', async () => {
      const originalConsoleError = console.error;
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      // Test logger error handling
      await expect(logger.logSecurityEvent({
        userId: 'user123',
        eventType: 'AUTH',
        action: 'test',
        result: 'SUCCESS',
        details: {},
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        severity: 'LOW'
      })).resolves.not.toThrow();

      // Test alerting error handling
      await expect(alerting.processSecurityEvent({
        eventId: 'test',
        userId: 'user123',
        eventType: 'AUTH',
        action: 'test',
        result: 'SUCCESS',
        details: {},
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        severity: 'LOW'
      })).resolves.not.toThrow();

      // Test dashboard error handling
      expect(() => dashboard.getDashboardMetrics(
        new Date().toISOString(),
        new Date().toISOString()
      )).not.toThrow();

      console.error = originalConsoleError;
    });
  });
});