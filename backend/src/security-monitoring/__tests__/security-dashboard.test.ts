import { SecurityAlert } from '../security-alerting';
import { SecurityDashboardService } from '../security-dashboard';
import { SecurityEvent } from '../types';

describe('SecurityDashboardService', () => {
  let dashboardService: SecurityDashboardService;

  beforeEach(() => {
    dashboardService = SecurityDashboardService.getInstance();
    // Clear any existing data by accessing private properties via type assertion
    (dashboardService as any).events = [];
    (dashboardService as any).alerts = [];
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const service1 = SecurityDashboardService.getInstance();
      const service2 = SecurityDashboardService.getInstance();
      expect(service1).toBe(service2);
    });
  });

  describe('Event and Alert Management', () => {
    it('should add security events', () => {
      const event: SecurityEvent = {
        eventId: 'test-event-1',
        userId: 'user123',
        eventType: 'AUTH',
        action: 'login_attempt',
        result: 'SUCCESS',
        details: {},
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString(),
        severity: 'LOW'
      };

      expect(() => dashboardService.addSecurityEvent(event)).not.toThrow();
    });

    it('should add security alerts', () => {
      const alert: SecurityAlert = {
        alertId: 'alert-1',
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        eventCount: 5,
        threshold: 3,
        timeWindow: '10 minutes',
        triggeredAt: new Date().toISOString(),
        severity: 'HIGH',
        escalationLevel: 'MEDIUM',
        events: [],
        status: 'ACTIVE'
      };

      expect(() => dashboardService.addSecurityAlert(alert)).not.toThrow();
    });
  });

  describe('Dashboard Metrics', () => {
    beforeEach(() => {
      // Add test data
      const now = new Date();
      const events: SecurityEvent[] = [
        {
          eventId: 'event-1',
          userId: 'user1',
          eventType: 'AUTH',
          action: 'login',
          result: 'SUCCESS',
          details: {},
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: now.toISOString(),
          severity: 'LOW'
        },
        {
          eventId: 'event-2',
          userId: 'user1',
          eventType: 'AUTH',
          action: 'login',
          result: 'FAILURE',
          details: {},
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: now.toISOString(),
          severity: 'MEDIUM'
        },
        {
          eventId: 'event-3',
          userId: 'user2',
          eventType: 'AUTHZ',
          action: 'access_resource',
          result: 'SUCCESS',
          details: {},
          ipAddress: '192.168.1.2',
          userAgent: 'Mozilla/5.0',
          timestamp: now.toISOString(),
          severity: 'LOW'
        },
        {
          eventId: 'event-4',
          userId: 'user3',
          eventType: 'SECURITY_VIOLATION',
          action: 'sql_injection',
          result: 'BLOCKED',
          details: {},
          ipAddress: '192.168.1.3',
          userAgent: 'Mozilla/5.0',
          timestamp: now.toISOString(),
          severity: 'HIGH'
        }
      ];

      const alerts: SecurityAlert[] = [
        {
          alertId: 'alert-1',
          ruleId: 'rule-1',
          ruleName: 'Auth Failures',
          eventCount: 3,
          threshold: 2,
          timeWindow: '10 minutes',
          triggeredAt: now.toISOString(),
          severity: 'MEDIUM',
          escalationLevel: 'MEDIUM',
          events: [],
          status: 'ACTIVE'
        },
        {
          alertId: 'alert-2',
          ruleId: 'rule-2',
          ruleName: 'Security Violation',
          eventCount: 1,
          threshold: 1,
          timeWindow: '5 minutes',
          triggeredAt: now.toISOString(),
          severity: 'HIGH',
          escalationLevel: 'CRITICAL',
          events: [],
          status: 'ACTIVE'
        }
      ];

      events.forEach(event => dashboardService.addSecurityEvent(event));
      alerts.forEach(alert => dashboardService.addSecurityAlert(alert));
    });

    it('should generate dashboard metrics', () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const endTime = new Date().toISOString();

      const metrics = dashboardService.getDashboardMetrics(startTime, endTime);

      expect(metrics).toBeDefined();
      expect(metrics.overview).toBeDefined();
      expect(metrics.overview.totalEvents).toBeGreaterThan(0);
      expect(metrics.overview.totalAlerts).toBeGreaterThan(0);
      expect(metrics.eventsByType).toBeDefined();
      expect(metrics.eventsBySeverity).toBeDefined();
      expect(metrics.topUsers).toBeDefined();
      expect(metrics.topIpAddresses).toBeDefined();
    });

    it('should aggregate events by type correctly', () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const metrics = dashboardService.getDashboardMetrics(startTime, endTime);

      expect(metrics.eventsByType.AUTH).toBe(2);
      expect(metrics.eventsByType.AUTHZ).toBe(1);
      expect(metrics.eventsByType.SECURITY_VIOLATION).toBe(1);
    });

    it('should aggregate events by severity correctly', () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const metrics = dashboardService.getDashboardMetrics(startTime, endTime);

      expect(metrics.eventsBySeverity.LOW).toBe(2);
      expect(metrics.eventsBySeverity.MEDIUM).toBe(1);
      expect(metrics.eventsBySeverity.HIGH).toBe(1);
    });

    it('should calculate top users with failure rates', () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const metrics = dashboardService.getDashboardMetrics(startTime, endTime);

      expect(metrics.topUsers.length).toBeGreaterThan(0);
      const user1 = metrics.topUsers.find(u => u.userId === 'user1');
      expect(user1).toBeDefined();
      expect(user1!.eventCount).toBe(2);
      expect(user1!.failureRate).toBe(50); // 1 failure out of 2 events
    });

    it('should calculate top IP addresses', () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const metrics = dashboardService.getDashboardMetrics(startTime, endTime);

      expect(metrics.topIpAddresses.length).toBeGreaterThan(0);
      const ip1 = metrics.topIpAddresses.find(ip => ip.ipAddress === '192.168.1.1');
      expect(ip1).toBeDefined();
      expect(ip1!.eventCount).toBe(2);
      expect(ip1!.uniqueUsers).toBe(1);
    });

    it('should generate time series data', () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const metrics = dashboardService.getDashboardMetrics(startTime, endTime);

      expect(metrics.timeSeriesData).toBeDefined();
      expect(Array.isArray(metrics.timeSeriesData)).toBe(true);
      expect(metrics.timeSeriesData.length).toBeGreaterThan(0);
      
      const dataPoint = metrics.timeSeriesData[0];
      expect(dataPoint.timestamp).toBeDefined();
      expect(dataPoint.eventCount).toBeDefined();
      expect(dataPoint.alertCount).toBeDefined();
      expect(dataPoint.severityBreakdown).toBeDefined();
    });

    it('should calculate compliance metrics', () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const metrics = dashboardService.getDashboardMetrics(startTime, endTime);

      expect(metrics.complianceMetrics).toBeDefined();
      expect(metrics.complianceMetrics.dataRetentionCompliance).toBeGreaterThan(0);
      expect(metrics.complianceMetrics.auditTrailCompleteness).toBeGreaterThan(0);
      expect(metrics.complianceMetrics.encryptionCompliance).toBeGreaterThan(0);
      expect(metrics.complianceMetrics.accessControlCompliance).toBeGreaterThan(0);
    });
  });

  describe('Security Reports', () => {
    beforeEach(() => {
      // Add test data
      const now = new Date();
      const events: SecurityEvent[] = [
        {
          eventId: 'event-1',
          userId: 'user1',
          eventType: 'AUTH',
          action: 'login',
          result: 'SUCCESS',
          details: {},
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: now.toISOString(),
          severity: 'LOW'
        },
        {
          eventId: 'event-2',
          userId: 'user1',
          eventType: 'AUTH',
          action: 'login',
          result: 'FAILURE',
          details: {},
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: now.toISOString(),
          severity: 'MEDIUM'
        }
      ];

      const alerts: SecurityAlert[] = [
        {
          alertId: 'alert-1',
          ruleId: 'rule-1',
          ruleName: 'Auth Failures',
          eventCount: 3,
          threshold: 2,
          timeWindow: '10 minutes',
          triggeredAt: now.toISOString(),
          severity: 'MEDIUM',
          escalationLevel: 'HIGH',
          events: [],
          status: 'ACTIVE'
        }
      ];

      events.forEach(event => dashboardService.addSecurityEvent(event));
      alerts.forEach(alert => dashboardService.addSecurityAlert(alert));
    });

    it('should generate security report', () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
      const endTime = new Date().toISOString();

      const report = dashboardService.generateSecurityReport('DAILY', startTime, endTime);

      expect(report).toBeDefined();
      expect(report.reportId).toBeDefined();
      expect(report.reportType).toBe('DAILY');
      expect(report.generatedAt).toBeDefined();
      expect(report.timeRange.start).toBe(startTime);
      expect(report.timeRange.end).toBe(endTime);
      expect(report.summary).toBeDefined();
      expect(report.sections).toBeDefined();
    });

    it('should generate report summary correctly', () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const report = dashboardService.generateSecurityReport('DAILY', startTime, endTime);

      expect(report.summary.totalEvents).toBeGreaterThan(0);
      expect(report.summary.totalAlerts).toBeGreaterThan(0);
      expect(report.summary.securityIncidents).toBeGreaterThan(0); // HIGH escalation alert
      expect(report.summary.complianceScore).toBeGreaterThan(0);
    });

    it('should generate executive summary', () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const report = dashboardService.generateSecurityReport('DAILY', startTime, endTime);

      expect(report.sections.executiveSummary).toBeDefined();
      expect(typeof report.sections.executiveSummary).toBe('string');
      expect(report.sections.executiveSummary.length).toBeGreaterThan(0);
    });

    it('should analyze security events', () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const report = dashboardService.generateSecurityReport('DAILY', startTime, endTime);

      expect(report.sections.securityEvents).toBeDefined();
      expect(report.sections.securityEvents.totalEvents).toBeGreaterThan(0);
      expect(report.sections.securityEvents.topEventTypes).toBeDefined();
      expect(report.sections.securityEvents.failureRates).toBeDefined();
      expect(report.sections.securityEvents.failureRates.authentication).toBe(50); // 1 failure out of 2 auth events
    });

    it('should analyze alerts', () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const report = dashboardService.generateSecurityReport('DAILY', startTime, endTime);

      expect(report.sections.alertAnalysis).toBeDefined();
      expect(report.sections.alertAnalysis.totalAlerts).toBeGreaterThan(0);
      expect(report.sections.alertAnalysis.alertsByEscalation).toBeDefined();
      expect(report.sections.alertAnalysis.alertsByEscalation.HIGH).toBe(1);
    });

    it('should assess compliance status', () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const report = dashboardService.generateSecurityReport('DAILY', startTime, endTime);

      expect(report.sections.complianceStatus).toBeDefined();
      expect(report.sections.complianceStatus.overallScore).toBeGreaterThan(0);
      expect(report.sections.complianceStatus.categories).toBeDefined();
      expect(Array.isArray(report.sections.complianceStatus.categories)).toBe(true);
    });

    it('should generate recommendations', () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const report = dashboardService.generateSecurityReport('DAILY', startTime, endTime);

      expect(report.sections.recommendations).toBeDefined();
      expect(Array.isArray(report.sections.recommendations)).toBe(true);
      expect(report.sections.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Security Trends', () => {
    it('should get security trends', () => {
      const trends = dashboardService.getSecurityTrends(7); // 7 days

      expect(trends).toBeDefined();
      expect(trends.eventTrends).toBeDefined();
      expect(trends.severityTrends).toBeDefined();
      expect(trends.userActivityTrends).toBeDefined();
      expect(trends.threatTrends).toBeDefined();
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies', () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      };

      const anomalies = dashboardService.detectAnomalies(timeRange);

      expect(anomalies).toBeDefined();
      expect(Array.isArray(anomalies)).toBe(true);
      // Anomaly detection is simplified in this implementation
    });
  });

  describe('Time Range Filtering', () => {
    it('should filter events by time range correctly', () => {
      const now = new Date();
      const pastEvent: SecurityEvent = {
        eventId: 'past-event',
        userId: 'user1',
        eventType: 'AUTH',
        action: 'login',
        result: 'SUCCESS',
        details: {},
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        severity: 'LOW'
      };

      const recentEvent: SecurityEvent = {
        eventId: 'recent-event',
        userId: 'user2',
        eventType: 'AUTH',
        action: 'login',
        result: 'SUCCESS',
        details: {},
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        severity: 'LOW'
      };

      dashboardService.addSecurityEvent(pastEvent);
      dashboardService.addSecurityEvent(recentEvent);

      // Get metrics for last hour only
      const startTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const endTime = now.toISOString();

      const metrics = dashboardService.getDashboardMetrics(startTime, endTime);

      // Should only include the recent event
      expect(metrics.overview.totalEvents).toBe(1);
    });
  });
});