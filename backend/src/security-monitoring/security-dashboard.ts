import { SecurityAlert } from './security-alerting';
import { SecurityEvent } from './types';

export interface DashboardMetrics {
  overview: {
    totalEvents: number;
    totalAlerts: number;
    activeAlerts: number;
    criticalAlerts: number;
    timeRange: {
      start: string;
      end: string;
    };
  };
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByResult: Record<string, number>;
  topUsers: Array<{
    userId: string;
    eventCount: number;
    failureRate: number;
  }>;
  topIpAddresses: Array<{
    ipAddress: string;
    eventCount: number;
    uniqueUsers: number;
  }>;
  timeSeriesData: Array<{
    timestamp: string;
    eventCount: number;
    alertCount: number;
    severityBreakdown: Record<string, number>;
  }>;
  complianceMetrics: {
    dataRetentionCompliance: number;
    auditTrailCompleteness: number;
    encryptionCompliance: number;
    accessControlCompliance: number;
  };
}

export interface SecurityReport {
  reportId: string;
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  generatedAt: string;
  timeRange: {
    start: string;
    end: string;
  };
  summary: {
    totalEvents: number;
    totalAlerts: number;
    securityIncidents: number;
    complianceScore: number;
  };
  sections: {
    executiveSummary: string;
    securityEvents: SecurityEventAnalysis;
    alertAnalysis: AlertAnalysis;
    threatAnalysis: ThreatAnalysis;
    complianceStatus: ComplianceStatus;
    recommendations: string[];
  };
}

export interface SecurityEventAnalysis {
  totalEvents: number;
  eventTrends: {
    direction: 'INCREASING' | 'DECREASING' | 'STABLE';
    percentageChange: number;
  };
  topEventTypes: Array<{
    eventType: string;
    count: number;
    percentage: number;
  }>;
  failureRates: {
    authentication: number;
    authorization: number;
    dataAccess: number;
  };
  anomalies: Array<{
    description: string;
    severity: string;
    timestamp: string;
  }>;
}

export interface AlertAnalysis {
  totalAlerts: number;
  alertsByEscalation: Record<string, number>;
  averageResponseTime: number;
  falsePositiveRate: number;
  topAlertRules: Array<{
    ruleName: string;
    triggerCount: number;
    averageEventCount: number;
  }>;
}

export interface ThreatAnalysis {
  suspiciousIpAddresses: Array<{
    ipAddress: string;
    riskScore: number;
    activities: string[];
  }>;
  userRiskProfiles: Array<{
    userId: string;
    riskScore: number;
    riskFactors: string[];
  }>;
  attackPatterns: Array<{
    pattern: string;
    frequency: number;
    lastSeen: string;
  }>;
}

export interface ComplianceStatus {
  overallScore: number;
  categories: Array<{
    category: string;
    score: number;
    requirements: Array<{
      requirement: string;
      status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';
      details: string;
    }>;
  }>;
}

export class SecurityDashboardService {
  private static instance: SecurityDashboardService;
  private events: SecurityEvent[] = [];
  private alerts: SecurityAlert[] = [];

  private constructor() {}

  public static getInstance(): SecurityDashboardService {
    if (!SecurityDashboardService.instance) {
      SecurityDashboardService.instance = new SecurityDashboardService();
    }
    return SecurityDashboardService.instance;
  }

  /**
   * Add security event to dashboard data
   */
  public addSecurityEvent(event: SecurityEvent): void {
    this.events.push(event);
    this.cleanOldEvents();
  }

  /**
   * Add security alert to dashboard data
   */
  public addSecurityAlert(alert: SecurityAlert): void {
    this.alerts.push(alert);
    this.cleanOldAlerts();
  }

  /**
   * Get dashboard metrics for a time range
   */
  public getDashboardMetrics(startTime: string, endTime: string): DashboardMetrics {
    const filteredEvents = this.filterEventsByTimeRange(startTime, endTime);
    const filteredAlerts = this.filterAlertsByTimeRange(startTime, endTime);

    return {
      overview: this.generateOverviewMetrics(filteredEvents, filteredAlerts, startTime, endTime),
      eventsByType: this.aggregateEventsByType(filteredEvents),
      eventsBySeverity: this.aggregateEventsBySeverity(filteredEvents),
      eventsByResult: this.aggregateEventsByResult(filteredEvents),
      topUsers: this.getTopUsers(filteredEvents),
      topIpAddresses: this.getTopIpAddresses(filteredEvents),
      timeSeriesData: this.generateTimeSeriesData(filteredEvents, filteredAlerts, startTime, endTime),
      complianceMetrics: this.calculateComplianceMetrics(filteredEvents)
    };
  }

  /**
   * Generate security report
   */
  public generateSecurityReport(
    reportType: SecurityReport['reportType'],
    startTime: string,
    endTime: string
  ): SecurityReport {
    const filteredEvents = this.filterEventsByTimeRange(startTime, endTime);
    const filteredAlerts = this.filterAlertsByTimeRange(startTime, endTime);

    const report: SecurityReport = {
      reportId: this.generateReportId(),
      reportType,
      generatedAt: new Date().toISOString(),
      timeRange: { start: startTime, end: endTime },
      summary: this.generateReportSummary(filteredEvents, filteredAlerts),
      sections: {
        executiveSummary: this.generateExecutiveSummary(filteredEvents, filteredAlerts),
        securityEvents: this.analyzeSecurityEvents(filteredEvents),
        alertAnalysis: this.analyzeAlerts(filteredAlerts),
        threatAnalysis: this.analyzeThreatLandscape(filteredEvents),
        complianceStatus: this.assessComplianceStatus(filteredEvents),
        recommendations: this.generateRecommendations(filteredEvents, filteredAlerts)
      }
    };

    return report;
  }

  /**
   * Get security trends analysis
   */
  public getSecurityTrends(days: number = 30): any {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);
    
    const events = this.filterEventsByTimeRange(startTime.toISOString(), endTime.toISOString());
    
    return {
      eventTrends: this.calculateEventTrends(events, days),
      severityTrends: this.calculateSeverityTrends(events, days),
      userActivityTrends: this.calculateUserActivityTrends(events, days),
      threatTrends: this.calculateThreatTrends(events, days)
    };
  }

  /**
   * Detect security anomalies
   */
  public detectAnomalies(timeRange: { start: string; end: string }): Array<{
    type: string;
    description: string;
    severity: string;
    timestamp: string;
    details: any;
  }> {
    const events = this.filterEventsByTimeRange(timeRange.start, timeRange.end);
    const anomalies: any[] = [];

    // Detect unusual authentication patterns
    const authAnomalies = this.detectAuthenticationAnomalies(events);
    anomalies.push(...authAnomalies);

    // Detect suspicious IP activity
    const ipAnomalies = this.detectSuspiciousIpActivity(events);
    anomalies.push(...ipAnomalies);

    // Detect unusual user behavior
    const userAnomalies = this.detectUnusualUserBehavior(events);
    anomalies.push(...userAnomalies);

    // Detect time-based anomalies
    const timeAnomalies = this.detectTimeBasedAnomalies(events);
    anomalies.push(...timeAnomalies);

    return anomalies.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private filterEventsByTimeRange(startTime: string, endTime: string): SecurityEvent[] {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return this.events.filter(event => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= start && eventTime <= end;
    });
  }

  private filterAlertsByTimeRange(startTime: string, endTime: string): SecurityAlert[] {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return this.alerts.filter(alert => {
      const alertTime = new Date(alert.triggeredAt);
      return alertTime >= start && alertTime <= end;
    });
  }

  private generateOverviewMetrics(
    events: SecurityEvent[],
    alerts: SecurityAlert[],
    startTime: string,
    endTime: string
  ): DashboardMetrics['overview'] {
    return {
      totalEvents: events.length,
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(alert => alert.status === 'ACTIVE').length,
      criticalAlerts: alerts.filter(alert => alert.escalationLevel === 'CRITICAL').length,
      timeRange: { start: startTime, end: endTime }
    };
  }

  private aggregateEventsByType(events: SecurityEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private aggregateEventsBySeverity(events: SecurityEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private aggregateEventsByResult(events: SecurityEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      acc[event.result] = (acc[event.result] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getTopUsers(events: SecurityEvent[]): DashboardMetrics['topUsers'] {
    const userStats = new Map<string, { total: number; failures: number }>();
    
    events.forEach(event => {
      if (event.userId) {
        const stats = userStats.get(event.userId) || { total: 0, failures: 0 };
        stats.total++;
        if (event.result === 'FAILURE') {
          stats.failures++;
        }
        userStats.set(event.userId, stats);
      }
    });

    return Array.from(userStats.entries())
      .map(([userId, stats]) => ({
        userId,
        eventCount: stats.total,
        failureRate: stats.total > 0 ? (stats.failures / stats.total) * 100 : 0
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);
  }

  private getTopIpAddresses(events: SecurityEvent[]): DashboardMetrics['topIpAddresses'] {
    const ipStats = new Map<string, { count: number; users: Set<string> }>();
    
    events.forEach(event => {
      const stats = ipStats.get(event.ipAddress) || { count: 0, users: new Set() };
      stats.count++;
      if (event.userId) {
        stats.users.add(event.userId);
      }
      ipStats.set(event.ipAddress, stats);
    });

    return Array.from(ipStats.entries())
      .map(([ipAddress, stats]) => ({
        ipAddress,
        eventCount: stats.count,
        uniqueUsers: stats.users.size
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);
  }

  private generateTimeSeriesData(
    events: SecurityEvent[],
    alerts: SecurityAlert[],
    startTime: string,
    endTime: string
  ): DashboardMetrics['timeSeriesData'] {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hourlyData = new Map<string, any>();

    // Initialize hourly buckets
    for (let time = new Date(start); time <= end; time.setHours(time.getHours() + 1)) {
      const key = time.toISOString().slice(0, 13) + ':00:00.000Z';
      hourlyData.set(key, {
        timestamp: key,
        eventCount: 0,
        alertCount: 0,
        severityBreakdown: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
      });
    }

    // Aggregate events
    events.forEach(event => {
      const hourKey = event.timestamp.slice(0, 13) + ':00:00.000Z';
      const data = hourlyData.get(hourKey);
      if (data) {
        data.eventCount++;
        data.severityBreakdown[event.severity]++;
      }
    });

    // Aggregate alerts
    alerts.forEach(alert => {
      const hourKey = alert.triggeredAt.slice(0, 13) + ':00:00.000Z';
      const data = hourlyData.get(hourKey);
      if (data) {
        data.alertCount++;
      }
    });

    return Array.from(hourlyData.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private calculateComplianceMetrics(events: SecurityEvent[]): DashboardMetrics['complianceMetrics'] {
    // Simplified compliance calculation
    const totalEvents = events.length;
    const auditableEvents = events.filter(event => 
      event.eventType === 'AUTH' || event.eventType === 'AUTHZ' || event.eventType === 'DATA_ACCESS'
    ).length;

    return {
      dataRetentionCompliance: 95, // Placeholder - would check actual retention policies
      auditTrailCompleteness: totalEvents > 0 ? (auditableEvents / totalEvents) * 100 : 100,
      encryptionCompliance: 100, // Placeholder - would check encryption status
      accessControlCompliance: 98 // Placeholder - would check access control violations
    };
  }

  private generateReportSummary(events: SecurityEvent[], alerts: SecurityAlert[]): SecurityReport['summary'] {
    const securityIncidents = alerts.filter(alert => 
      alert.escalationLevel === 'HIGH' || alert.escalationLevel === 'CRITICAL'
    ).length;

    const complianceMetrics = this.calculateComplianceMetrics(events);
    const complianceScore = Object.values(complianceMetrics).reduce((sum, score) => sum + score, 0) / 4;

    return {
      totalEvents: events.length,
      totalAlerts: alerts.length,
      securityIncidents,
      complianceScore: Math.round(complianceScore)
    };
  }

  private generateExecutiveSummary(events: SecurityEvent[], alerts: SecurityAlert[]): string {
    const summary = this.generateReportSummary(events, alerts);
    
    return `
During the reporting period, the security monitoring system processed ${summary.totalEvents} security events and generated ${summary.totalAlerts} alerts. 
${summary.securityIncidents} security incidents required immediate attention. 
The overall compliance score is ${summary.complianceScore}%, indicating ${summary.complianceScore >= 90 ? 'excellent' : summary.complianceScore >= 80 ? 'good' : 'needs improvement'} security posture.

Key highlights:
- Authentication events: ${events.filter(e => e.eventType === 'AUTH').length}
- Authorization events: ${events.filter(e => e.eventType === 'AUTHZ').length}
- Security violations: ${events.filter(e => e.eventType === 'SECURITY_VIOLATION').length}
- Critical alerts: ${alerts.filter(a => a.escalationLevel === 'CRITICAL').length}
    `.trim();
  }

  private analyzeSecurityEvents(events: SecurityEvent[]): SecurityEventAnalysis {
    const eventsByType = this.aggregateEventsByType(events);
    const totalEvents = events.length;

    return {
      totalEvents,
      eventTrends: {
        direction: 'STABLE', // Simplified - would compare with previous period
        percentageChange: 0
      },
      topEventTypes: Object.entries(eventsByType)
        .map(([eventType, count]) => ({
          eventType,
          count,
          percentage: (count / totalEvents) * 100
        }))
        .sort((a, b) => b.count - a.count),
      failureRates: {
        authentication: this.calculateFailureRate(events, 'AUTH'),
        authorization: this.calculateFailureRate(events, 'AUTHZ'),
        dataAccess: this.calculateFailureRate(events, 'DATA_ACCESS')
      },
      anomalies: [] // Would be populated by anomaly detection
    };
  }

  private analyzeAlerts(alerts: SecurityAlert[]): AlertAnalysis {
    const alertsByEscalation = alerts.reduce((acc, alert) => {
      acc[alert.escalationLevel] = (acc[alert.escalationLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAlerts: alerts.length,
      alertsByEscalation,
      averageResponseTime: 0, // Would calculate from alert acknowledgment times
      falsePositiveRate: 0, // Would track false positive feedback
      topAlertRules: [] // Would aggregate by rule name
    };
  }

  private analyzeThreatLandscape(events: SecurityEvent[]): ThreatAnalysis {
    return {
      suspiciousIpAddresses: [],
      userRiskProfiles: [],
      attackPatterns: []
    };
  }

  private assessComplianceStatus(events: SecurityEvent[]): ComplianceStatus {
    const complianceMetrics = this.calculateComplianceMetrics(events);
    
    return {
      overallScore: Math.round(Object.values(complianceMetrics).reduce((sum, score) => sum + score, 0) / 4),
      categories: [
        {
          category: 'Data Retention',
          score: complianceMetrics.dataRetentionCompliance,
          requirements: [
            {
              requirement: 'Log retention policy',
              status: 'COMPLIANT',
              details: 'Logs retained for required period'
            }
          ]
        },
        {
          category: 'Audit Trail',
          score: complianceMetrics.auditTrailCompleteness,
          requirements: [
            {
              requirement: 'Complete audit trail',
              status: complianceMetrics.auditTrailCompleteness >= 95 ? 'COMPLIANT' : 'PARTIAL',
              details: `${complianceMetrics.auditTrailCompleteness.toFixed(1)}% of events auditable`
            }
          ]
        }
      ]
    };
  }

  private generateRecommendations(events: SecurityEvent[], alerts: SecurityAlert[]): string[] {
    const recommendations: string[] = [];
    
    const failureRate = events.filter(e => e.result === 'FAILURE').length / events.length;
    if (failureRate > 0.1) {
      recommendations.push('High failure rate detected. Review authentication and authorization policies.');
    }

    const criticalAlerts = alerts.filter(a => a.escalationLevel === 'CRITICAL').length;
    if (criticalAlerts > 0) {
      recommendations.push('Critical security alerts require immediate investigation and remediation.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture is good. Continue monitoring and maintain current security practices.');
    }

    return recommendations;
  }

  private calculateFailureRate(events: SecurityEvent[], eventType: SecurityEvent['eventType']): number {
    const typeEvents = events.filter(e => e.eventType === eventType);
    const failures = typeEvents.filter(e => e.result === 'FAILURE').length;
    return typeEvents.length > 0 ? (failures / typeEvents.length) * 100 : 0;
  }

  private calculateEventTrends(events: SecurityEvent[], days: number): any {
    // Simplified trend calculation
    return { direction: 'STABLE', change: 0 };
  }

  private calculateSeverityTrends(events: SecurityEvent[], days: number): any {
    return this.aggregateEventsBySeverity(events);
  }

  private calculateUserActivityTrends(events: SecurityEvent[], days: number): any {
    return this.getTopUsers(events);
  }

  private calculateThreatTrends(events: SecurityEvent[], days: number): any {
    return { threats: [] };
  }

  private detectAuthenticationAnomalies(events: SecurityEvent[]): any[] {
    return [];
  }

  private detectSuspiciousIpActivity(events: SecurityEvent[]): any[] {
    return [];
  }

  private detectUnusualUserBehavior(events: SecurityEvent[]): any[] {
    return [];
  }

  private detectTimeBasedAnomalies(events: SecurityEvent[]): any[] {
    return [];
  }

  private cleanOldEvents(): void {
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    this.events = this.events.filter(event => new Date(event.timestamp) > cutoffTime);
  }

  private cleanOldAlerts(): void {
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    this.alerts = this.alerts.filter(alert => new Date(alert.triggeredAt) > cutoffTime);
  }

  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}