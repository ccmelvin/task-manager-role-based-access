import { v4 as uuidv4 } from 'uuid';
import { LogRetentionPolicy, SecurityEvent, SecurityEventFilter } from './types';

export class SecurityEventLogger {
  private static instance: SecurityEventLogger;
  private retentionPolicy: LogRetentionPolicy;

  private constructor() {
    this.retentionPolicy = {
      retentionDays: 365, // 1 year retention
      archiveAfterDays: 90, // Archive after 3 months
      compressionEnabled: true,
      encryptionEnabled: true
    };
  }

  public static getInstance(): SecurityEventLogger {
    if (!SecurityEventLogger.instance) {
      SecurityEventLogger.instance = new SecurityEventLogger();
    }
    return SecurityEventLogger.instance;
  }

  /**
   * Log a security event with structured data
   */
  public async logSecurityEvent(event: Omit<SecurityEvent, 'eventId' | 'timestamp'>): Promise<void> {
    // Determine severity based on event type, action, and result if not explicitly set to HIGH or CRITICAL
    const severity = (event.severity === 'HIGH' || event.severity === 'CRITICAL') 
      ? event.severity 
      : this.determineSeverity(event.eventType, event.action, event.result);

    const securityEvent: SecurityEvent = {
      ...event,
      severity,
      eventId: uuidv4(),
      timestamp: new Date().toISOString()
    };

    try {
      // Log to CloudWatch with structured format
      await this.logToCloudWatch(securityEvent);
      
      // Store in DynamoDB for querying and analysis
      await this.storeSecurityEvent(securityEvent);
      
      // Trigger alerts for high severity events
      if (securityEvent.severity === 'HIGH' || securityEvent.severity === 'CRITICAL') {
        await this.triggerSecurityAlert(securityEvent);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Fallback to console logging to ensure event is captured
      console.log('SECURITY_EVENT:', JSON.stringify(securityEvent));
    }
  }

  /**
   * Log authentication events
   */
  public async logAuthEvent(
    action: string,
    userId: string | undefined,
    result: SecurityEvent['result'],
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string,
    requestId?: string
  ): Promise<void> {
    const severity = this.determineSeverity('AUTH', action, result);
    
    await this.logSecurityEvent({
      userId,
      eventType: 'AUTH',
      action,
      result,
      details: this.sanitizeDetails(details),
      ipAddress,
      userAgent,
      severity,
      requestId
    });
  }

  /**
   * Log authorization events
   */
  public async logAuthzEvent(
    action: string,
    userId: string,
    resource: string,
    result: SecurityEvent['result'],
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string,
    requestId?: string
  ): Promise<void> {
    const severity = this.determineSeverity('AUTHZ', action, result);
    
    await this.logSecurityEvent({
      userId,
      eventType: 'AUTHZ',
      action,
      resource,
      result,
      details: this.sanitizeDetails(details),
      ipAddress,
      userAgent,
      severity,
      requestId
    });
  }

  /**
   * Log data access events
   */
  public async logDataAccessEvent(
    action: string,
    userId: string,
    resource: string,
    result: SecurityEvent['result'],
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string,
    requestId?: string
  ): Promise<void> {
    const severity = this.determineSeverity('DATA_ACCESS', action, result);
    
    await this.logSecurityEvent({
      userId,
      eventType: 'DATA_ACCESS',
      action,
      resource,
      result,
      details: this.sanitizeDetails(details),
      ipAddress,
      userAgent,
      severity,
      requestId
    });
  }

  /**
   * Log security violations
   */
  public async logSecurityViolation(
    action: string,
    userId: string | undefined,
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string,
    requestId?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      eventType: 'SECURITY_VIOLATION',
      action,
      result: 'BLOCKED',
      details: this.sanitizeDetails(details),
      ipAddress,
      userAgent,
      severity: 'HIGH', // Security violations are always high severity
      requestId
    });
  }

  /**
   * Query security events with filters
   */
  public async querySecurityEvents(filter: SecurityEventFilter, limit: number = 100): Promise<SecurityEvent[]> {
    // Implementation would query DynamoDB with appropriate filters
    // This is a placeholder for the actual implementation
    console.log('Querying security events with filter:', filter);
    return [];
  }

  /**
   * Get security metrics for a time period
   */
  public async getSecurityMetrics(startTime: string, endTime: string): Promise<any> {
    // Implementation would aggregate security events from DynamoDB
    // This is a placeholder for the actual implementation
    console.log('Getting security metrics for period:', startTime, 'to', endTime);
    return {};
  }

  private async logToCloudWatch(event: SecurityEvent): Promise<void> {
    // CloudWatch structured logging
    const logEntry = {
      timestamp: event.timestamp,
      level: this.mapSeverityToLogLevel(event.severity),
      message: `Security Event: ${event.eventType} - ${event.action}`,
      eventId: event.eventId,
      userId: event.userId,
      eventType: event.eventType,
      action: event.action,
      resource: event.resource,
      result: event.result,
      severity: event.severity,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      requestId: event.requestId,
      details: event.details
    };

    console.log(JSON.stringify(logEntry));
  }

  private async storeSecurityEvent(event: SecurityEvent): Promise<void> {
    // Store in DynamoDB for querying and analysis
    // Implementation would use AWS SDK to store the event
    console.log('Storing security event in DynamoDB:', event.eventId);
  }

  private async triggerSecurityAlert(event: SecurityEvent): Promise<void> {
    // Trigger SNS notification for high severity events
    console.log('Triggering security alert for event:', event.eventId);
  }

  private determineSeverity(
    eventType: SecurityEvent['eventType'],
    action: string,
    result: SecurityEvent['result']
  ): SecurityEvent['severity'] {
    // Failed authentication attempts
    if (eventType === 'AUTH' && result === 'FAILURE') {
      if (action.includes('login') || action.includes('authenticate')) {
        return 'MEDIUM';
      }
    }

    // Failed authorization attempts
    if (eventType === 'AUTHZ' && result === 'FAILURE') {
      return 'MEDIUM';
    }

    // Blocked security violations
    if (eventType === 'SECURITY_VIOLATION' && result === 'BLOCKED') {
      return 'HIGH';
    }

    // Successful privileged actions
    if (result === 'SUCCESS' && (action.includes('admin') || action.includes('delete'))) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Remove sensitive information from logs
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private mapSeverityToLogLevel(severity: SecurityEvent['severity']): string {
    switch (severity) {
      case 'CRITICAL':
        return 'ERROR';
      case 'HIGH':
        return 'WARN';
      case 'MEDIUM':
        return 'INFO';
      case 'LOW':
        return 'DEBUG';
      default:
        return 'INFO';
    }
  }

  public setRetentionPolicy(policy: Partial<LogRetentionPolicy>): void {
    this.retentionPolicy = { ...this.retentionPolicy, ...policy };
  }

  public getRetentionPolicy(): LogRetentionPolicy {
    return { ...this.retentionPolicy };
  }
}