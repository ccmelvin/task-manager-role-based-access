import { SecurityAlertingService } from '../security-alerting';
import { SecurityEvent } from '../types';

// Mock console.log to capture log output
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

describe('SecurityAlertingService', () => {
  let alertingService: SecurityAlertingService;

  beforeEach(() => {
    alertingService = SecurityAlertingService.getInstance();
    mockConsoleLog.mockClear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const service1 = SecurityAlertingService.getInstance();
      const service2 = SecurityAlertingService.getInstance();
      expect(service1).toBe(service2);
    });
  });

  describe('Alert Rules Management', () => {
    it('should create a new alert rule', () => {
      const rule = alertingService.createAlertRule({
        name: 'Test Rule',
        description: 'Test description',
        eventType: 'AUTH',
        severity: ['HIGH'],
        threshold: 3,
        timeWindowMinutes: 10,
        enabled: true,
        escalationLevel: 'MEDIUM',
        notificationChannels: ['test-channel']
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Test Rule');
      expect(rule.eventType).toBe('AUTH');
    });

    it('should update an existing alert rule', () => {
      const rule = alertingService.createAlertRule({
        name: 'Test Rule',
        description: 'Test description',
        severity: ['HIGH'],
        threshold: 3,
        timeWindowMinutes: 10,
        enabled: true,
        escalationLevel: 'MEDIUM',
        notificationChannels: ['test-channel']
      });

      const updatedRule = alertingService.updateAlertRule(rule.id, {
        threshold: 5,
        enabled: false
      });

      expect(updatedRule).toBeTruthy();
      expect(updatedRule!.threshold).toBe(5);
      expect(updatedRule!.enabled).toBe(false);
      expect(updatedRule!.name).toBe('Test Rule'); // Should keep existing values
    });

    it('should delete an alert rule', () => {
      const rule = alertingService.createAlertRule({
        name: 'Test Rule',
        description: 'Test description',
        severity: ['HIGH'],
        threshold: 3,
        timeWindowMinutes: 10,
        enabled: true,
        escalationLevel: 'MEDIUM',
        notificationChannels: ['test-channel']
      });

      const deleted = alertingService.deleteAlertRule(rule.id);
      expect(deleted).toBe(true);

      const rules = alertingService.getAlertRules();
      expect(rules.find(r => r.id === rule.id)).toBeUndefined();
    });

    it('should get all alert rules including defaults', () => {
      const rules = alertingService.getAlertRules();
      expect(rules.length).toBeGreaterThan(0);
      
      // Check for default rules
      const authFailuresRule = rules.find(r => r.id === 'auth-failures');
      expect(authFailuresRule).toBeTruthy();
      expect(authFailuresRule!.name).toBe('Multiple Authentication Failures');
    });
  });

  describe('Notification Channels Management', () => {
    it('should create a notification channel', () => {
      const channel = alertingService.createNotificationChannel({
        type: 'EMAIL',
        configuration: {
          recipients: ['test@example.com']
        },
        enabled: true
      });

      expect(channel.id).toBeDefined();
      expect(channel.type).toBe('EMAIL');
      expect(channel.configuration.recipients).toEqual(['test@example.com']);
    });

    it('should get all notification channels including defaults', () => {
      const channels = alertingService.getNotificationChannels();
      expect(channels.length).toBeGreaterThan(0);
      
      // Check for default channels
      const defaultEmail = channels.find(c => c.id === 'default-email');
      expect(defaultEmail).toBeTruthy();
      expect(defaultEmail!.type).toBe('EMAIL');
    });
  });

  describe('Security Event Processing', () => {
    it('should process security events without errors', async () => {
      const event: SecurityEvent = {
        eventId: 'test-event-1',
        userId: 'user123',
        eventType: 'AUTH',
        action: 'login_attempt',
        result: 'FAILURE',
        details: { reason: 'invalid_password' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        severity: 'MEDIUM'
      };

      await expect(alertingService.processSecurityEvent(event)).resolves.not.toThrow();
    });

    it('should trigger alert when threshold is exceeded', async () => {
      // Create multiple failed auth events to trigger the default auth-failures rule
      const events: SecurityEvent[] = [];
      for (let i = 0; i < 6; i++) {
        events.push({
          eventId: `test-event-${i}`,
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

      // Process all events
      for (const event of events) {
        await alertingService.processSecurityEvent(event);
      }

      // Check if alert was triggered
      const activeAlerts = alertingService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      const authAlert = activeAlerts.find(alert => alert.ruleId === 'auth-failures');
      expect(authAlert).toBeTruthy();
      expect(authAlert!.eventCount).toBeGreaterThanOrEqual(5);
    });

    it('should trigger immediate alert for security violations', async () => {
      const violationEvent: SecurityEvent = {
        eventId: 'violation-1',
        userId: 'user123',
        eventType: 'SECURITY_VIOLATION',
        action: 'sql_injection_attempt',
        result: 'BLOCKED',
        details: { malicious_input: "'; DROP TABLE users; --" },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        severity: 'HIGH'
      };

      await alertingService.processSecurityEvent(violationEvent);

      const activeAlerts = alertingService.getActiveAlerts();
      const violationAlert = activeAlerts.find(alert => alert.ruleId === 'security-violations');
      expect(violationAlert).toBeTruthy();
      expect(violationAlert!.escalationLevel).toBe('HIGH');
    });

    it('should trigger critical alert for critical events', async () => {
      const criticalEvent: SecurityEvent = {
        eventId: 'critical-1',
        userId: 'admin123',
        eventType: 'SYSTEM',
        action: 'system_compromise_detected',
        result: 'BLOCKED',
        details: { threat_type: 'advanced_persistent_threat' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        severity: 'CRITICAL'
      };

      await alertingService.processSecurityEvent(criticalEvent);

      const activeAlerts = alertingService.getActiveAlerts();
      const criticalAlert = activeAlerts.find(alert => alert.ruleId === 'critical-events');
      expect(criticalAlert).toBeTruthy();
      expect(criticalAlert!.escalationLevel).toBe('CRITICAL');
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge an alert', async () => {
      // Create and trigger an alert first
      const violationEvent: SecurityEvent = {
        eventId: 'violation-1',
        userId: 'user123',
        eventType: 'SECURITY_VIOLATION',
        action: 'test_violation',
        result: 'BLOCKED',
        details: {},
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        severity: 'HIGH'
      };

      await alertingService.processSecurityEvent(violationEvent);

      const activeAlerts = alertingService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const alert = activeAlerts[0];
      const acknowledgedAlert = alertingService.acknowledgeAlert(alert.alertId, 'admin123');

      expect(acknowledgedAlert).toBeTruthy();
      expect(acknowledgedAlert!.status).toBe('ACKNOWLEDGED');
      expect(acknowledgedAlert!.acknowledgedBy).toBe('admin123');
      expect(acknowledgedAlert!.acknowledgedAt).toBeDefined();
    });

    it('should resolve an alert', async () => {
      // Create and trigger an alert first
      const violationEvent: SecurityEvent = {
        eventId: 'violation-1',
        userId: 'user123',
        eventType: 'SECURITY_VIOLATION',
        action: 'test_violation',
        result: 'BLOCKED',
        details: {},
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        severity: 'HIGH'
      };

      await alertingService.processSecurityEvent(violationEvent);

      const activeAlerts = alertingService.getActiveAlerts();
      const alert = activeAlerts[0];
      const resolvedAlert = alertingService.resolveAlert(alert.alertId);

      expect(resolvedAlert).toBeTruthy();
      expect(resolvedAlert!.status).toBe('RESOLVED');
      expect(resolvedAlert!.resolvedAt).toBeDefined();

      // Should no longer be in active alerts
      const updatedActiveAlerts = alertingService.getActiveAlerts();
      expect(updatedActiveAlerts.find(a => a.alertId === alert.alertId)).toBeUndefined();
    });
  });

  describe('Notification Formatting', () => {
    it('should log notifications for different channel types', async () => {
      const violationEvent: SecurityEvent = {
        eventId: 'violation-1',
        userId: 'user123',
        eventType: 'SECURITY_VIOLATION',
        action: 'test_violation',
        result: 'BLOCKED',
        details: {},
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        severity: 'HIGH'
      };

      await alertingService.processSecurityEvent(violationEvent);

      // Check that notifications were logged
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('EMAIL NOTIFICATION'),
        expect.stringContaining('SECURITY ALERT')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('SLACK NOTIFICATION'),
        expect.stringContaining('SECURITY ALERT')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in event processing gracefully', async () => {
      const originalConsoleError = console.error;
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      // Create an event that might cause processing issues
      const malformedEvent = {
        eventId: 'malformed-1',
        // Missing required fields
        timestamp: new Date().toISOString(),
        severity: 'HIGH'
      } as SecurityEvent;

      await expect(alertingService.processSecurityEvent(malformedEvent)).resolves.not.toThrow();

      console.error = originalConsoleError;
    });
  });
});