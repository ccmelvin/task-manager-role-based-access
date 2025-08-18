import { SecurityEvent } from './types';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  eventType?: SecurityEvent['eventType'];
  action?: string;
  severity: SecurityEvent['severity'][];
  threshold: number;
  timeWindowMinutes: number;
  enabled: boolean;
  escalationLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  notificationChannels: string[];
}

export interface SecurityAlert {
  alertId: string;
  ruleId: string;
  ruleName: string;
  eventCount: number;
  threshold: number;
  timeWindow: string;
  triggeredAt: string;
  severity: SecurityEvent['severity'];
  escalationLevel: AlertRule['escalationLevel'];
  events: SecurityEvent[];
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface NotificationChannel {
  id: string;
  type: 'EMAIL' | 'SMS' | 'SLACK' | 'SNS';
  configuration: Record<string, any>;
  enabled: boolean;
}

export class SecurityAlertingService {
  private static instance: SecurityAlertingService;
  private alertRules: Map<string, AlertRule> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private activeAlerts: Map<string, SecurityAlert> = new Map();
  private eventBuffer: SecurityEvent[] = [];

  private constructor() {
    this.initializeDefaultRules();
    this.initializeDefaultChannels();
  }

  public static getInstance(): SecurityAlertingService {
    if (!SecurityAlertingService.instance) {
      SecurityAlertingService.instance = new SecurityAlertingService();
    }
    return SecurityAlertingService.instance;
  }

  /**
   * Process a security event and check for alert conditions
   */
  public async processSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Add event to buffer for analysis
      this.eventBuffer.push(event);
      
      // Clean old events from buffer (keep last 24 hours)
      this.cleanEventBuffer();
      
      // Check all alert rules
      for (const rule of this.alertRules.values()) {
        if (rule.enabled && this.eventMatchesRule(event, rule)) {
          await this.evaluateAlertRule(rule);
        }
      }
    } catch (error) {
      console.error('Error processing security event for alerting:', error);
    }
  }

  /**
   * Create a new alert rule
   */
  public createAlertRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const alertRule: AlertRule = {
      ...rule,
      id: this.generateId()
    };
    
    this.alertRules.set(alertRule.id, alertRule);
    return alertRule;
  }

  /**
   * Update an existing alert rule
   */
  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      return null;
    }

    const updatedRule = { ...rule, ...updates };
    this.alertRules.set(ruleId, updatedRule);
    return updatedRule;
  }

  /**
   * Delete an alert rule
   */
  public deleteAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  /**
   * Get all alert rules
   */
  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => alert.status === 'ACTIVE');
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): SecurityAlert | null {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return null;
    }

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date().toISOString();
    
    return alert;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): SecurityAlert | null {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return null;
    }

    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
    
    return alert;
  }

  /**
   * Create a notification channel
   */
  public createNotificationChannel(channel: Omit<NotificationChannel, 'id'>): NotificationChannel {
    const notificationChannel: NotificationChannel = {
      ...channel,
      id: this.generateId()
    };
    
    this.notificationChannels.set(notificationChannel.id, notificationChannel);
    return notificationChannel;
  }

  /**
   * Get all notification channels
   */
  public getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values());
  }

  private initializeDefaultRules(): void {
    // Failed authentication attempts
    this.alertRules.set('auth-failures', {
      id: 'auth-failures',
      name: 'Multiple Authentication Failures',
      description: 'Alert when there are multiple failed authentication attempts',
      eventType: 'AUTH',
      severity: ['MEDIUM', 'HIGH'],
      threshold: 5,
      timeWindowMinutes: 15,
      enabled: true,
      escalationLevel: 'MEDIUM',
      notificationChannels: ['default-email']
    });

    // Security violations
    this.alertRules.set('security-violations', {
      id: 'security-violations',
      name: 'Security Violations Detected',
      description: 'Alert on any security violation',
      eventType: 'SECURITY_VIOLATION',
      severity: ['HIGH', 'CRITICAL'],
      threshold: 1,
      timeWindowMinutes: 5,
      enabled: true,
      escalationLevel: 'HIGH',
      notificationChannels: ['default-email', 'security-team']
    });

    // Authorization failures
    this.alertRules.set('authz-failures', {
      id: 'authz-failures',
      name: 'Authorization Failures',
      description: 'Alert on repeated authorization failures',
      eventType: 'AUTHZ',
      severity: ['MEDIUM', 'HIGH'],
      threshold: 10,
      timeWindowMinutes: 30,
      enabled: true,
      escalationLevel: 'MEDIUM',
      notificationChannels: ['default-email']
    });

    // Critical system events
    this.alertRules.set('critical-events', {
      id: 'critical-events',
      name: 'Critical Security Events',
      description: 'Alert on any critical security event',
      severity: ['CRITICAL'],
      threshold: 1,
      timeWindowMinutes: 1,
      enabled: true,
      escalationLevel: 'CRITICAL',
      notificationChannels: ['default-email', 'security-team', 'on-call']
    });
  }

  private initializeDefaultChannels(): void {
    this.notificationChannels.set('default-email', {
      id: 'default-email',
      type: 'EMAIL',
      configuration: {
        recipients: ['security@company.com'],
        subject: 'Security Alert: {{ruleName}}'
      },
      enabled: true
    });

    this.notificationChannels.set('security-team', {
      id: 'security-team',
      type: 'SLACK',
      configuration: {
        webhook: process.env.SECURITY_SLACK_WEBHOOK,
        channel: '#security-alerts'
      },
      enabled: true
    });

    this.notificationChannels.set('on-call', {
      id: 'on-call',
      type: 'SNS',
      configuration: {
        topicArn: process.env.SECURITY_SNS_TOPIC_ARN
      },
      enabled: true
    });
  }

  private eventMatchesRule(event: SecurityEvent, rule: AlertRule): boolean {
    // Check event type
    if (rule.eventType && event.eventType !== rule.eventType) {
      return false;
    }

    // Check action
    if (rule.action && event.action !== rule.action) {
      return false;
    }

    // Check severity
    if (!rule.severity.includes(event.severity)) {
      return false;
    }

    return true;
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    const timeWindowStart = new Date(Date.now() - rule.timeWindowMinutes * 60 * 1000);
    
    // Count matching events in time window
    const matchingEvents = this.eventBuffer.filter(event => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= timeWindowStart && this.eventMatchesRule(event, rule);
    });

    if (matchingEvents.length >= rule.threshold) {
      await this.triggerAlert(rule, matchingEvents);
    }
  }

  private async triggerAlert(rule: AlertRule, events: SecurityEvent[]): Promise<void> {
    // Check if there's already an active alert for this rule
    const existingAlert = Array.from(this.activeAlerts.values())
      .find(alert => alert.ruleId === rule.id && alert.status === 'ACTIVE');

    if (existingAlert) {
      // Update existing alert with new events
      existingAlert.eventCount = events.length;
      existingAlert.events = events;
      return;
    }

    // Create new alert
    const alert: SecurityAlert = {
      alertId: this.generateId(),
      ruleId: rule.id,
      ruleName: rule.name,
      eventCount: events.length,
      threshold: rule.threshold,
      timeWindow: `${rule.timeWindowMinutes} minutes`,
      triggeredAt: new Date().toISOString(),
      severity: this.getHighestSeverity(events),
      escalationLevel: rule.escalationLevel,
      events,
      status: 'ACTIVE'
    };

    this.activeAlerts.set(alert.alertId, alert);

    // Send notifications
    await this.sendNotifications(alert, rule);

    // Log the alert
    console.log(`SECURITY ALERT TRIGGERED: ${alert.ruleName}`, {
      alertId: alert.alertId,
      eventCount: alert.eventCount,
      threshold: alert.threshold,
      escalationLevel: alert.escalationLevel
    });
  }

  private async sendNotifications(alert: SecurityAlert, rule: AlertRule): Promise<void> {
    for (const channelId of rule.notificationChannels) {
      const channel = this.notificationChannels.get(channelId);
      if (!channel || !channel.enabled) {
        continue;
      }

      try {
        await this.sendNotification(alert, channel);
      } catch (error) {
        console.error(`Failed to send notification via channel ${channelId}:`, error);
      }
    }
  }

  private async sendNotification(alert: SecurityAlert, channel: NotificationChannel): Promise<void> {
    const message = this.formatAlertMessage(alert);

    switch (channel.type) {
      case 'EMAIL':
        await this.sendEmailNotification(alert, channel, message);
        break;
      case 'SLACK':
        await this.sendSlackNotification(alert, channel, message);
        break;
      case 'SNS':
        await this.sendSNSNotification(alert, channel, message);
        break;
      case 'SMS':
        await this.sendSMSNotification(alert, channel, message);
        break;
      default:
        console.warn(`Unknown notification channel type: ${channel.type}`);
    }
  }

  private async sendEmailNotification(alert: SecurityAlert, channel: NotificationChannel, message: string): Promise<void> {
    // Implementation would use AWS SES or similar service
    console.log(`EMAIL NOTIFICATION: ${channel.configuration.recipients.join(', ')}`, message);
  }

  private async sendSlackNotification(alert: SecurityAlert, channel: NotificationChannel, message: string): Promise<void> {
    // Implementation would use Slack webhook
    console.log(`SLACK NOTIFICATION: ${channel.configuration.channel}`, message);
  }

  private async sendSNSNotification(alert: SecurityAlert, channel: NotificationChannel, message: string): Promise<void> {
    // Implementation would use AWS SNS
    console.log(`SNS NOTIFICATION: ${channel.configuration.topicArn}`, message);
  }

  private async sendSMSNotification(alert: SecurityAlert, channel: NotificationChannel, message: string): Promise<void> {
    // Implementation would use AWS SNS SMS
    console.log(`SMS NOTIFICATION:`, message);
  }

  private formatAlertMessage(alert: SecurityAlert): string {
    return `
🚨 SECURITY ALERT: ${alert.ruleName}

Alert ID: ${alert.alertId}
Severity: ${alert.severity}
Escalation Level: ${alert.escalationLevel}
Event Count: ${alert.eventCount} (threshold: ${alert.threshold})
Time Window: ${alert.timeWindow}
Triggered At: ${alert.triggeredAt}

Recent Events:
${alert.events.slice(0, 5).map(event => 
  `- ${event.timestamp}: ${event.eventType} - ${event.action} (${event.result})`
).join('\n')}

Please investigate immediately.
    `.trim();
  }

  private getHighestSeverity(events: SecurityEvent[]): SecurityEvent['severity'] {
    const severityOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    
    return events.reduce((highest, event) => {
      return severityOrder[event.severity] > severityOrder[highest] ? event.severity : highest;
    }, 'LOW' as SecurityEvent['severity']);
  }

  private cleanEventBuffer(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    this.eventBuffer = this.eventBuffer.filter(event => new Date(event.timestamp) > cutoffTime);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}