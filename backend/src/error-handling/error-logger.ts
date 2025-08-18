/**
 * Comprehensive error logging service with structured logging and sensitive data sanitization
 */

import { DetailedError, ErrorCategory, ErrorContext, ErrorSeverity } from './types';

export interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
  requestId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  errorCode?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  context?: Record<string, any>;
  stackTrace?: string;
  duration?: number;
}

export interface SecurityAuditEntry extends LogEntry {
  securityEvent: 'AUTHENTICATION_FAILURE' | 'AUTHORIZATION_FAILURE' | 'SUSPICIOUS_ACTIVITY' | 'SECURITY_VIOLATION' | 'BRUTE_FORCE_ATTEMPT';
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionTaken?: string;
  additionalMetadata?: Record<string, any>;
}

export class ErrorLogger {
  private static readonly SENSITIVE_PATTERNS = [
    /password[=:]\s*[^\s,}]+/gi,
    /token[=:]\s*[^\s,}]+/gi,
    /key[=:]\s*[^\s,}]+/gi,
    /secret[=:]\s*[^\s,}]+/gi,
    /authorization:\s*[^\s,}]+/gi,
    /bearer\s+[^\s,}]+/gi,
    /api[_-]?key[=:]\s*[^\s,}]+/gi,
    /access[_-]?token[=:]\s*[^\s,}]+/gi,
    /refresh[_-]?token[=:]\s*[^\s,}]+/gi,
    /session[_-]?id[=:]\s*[^\s,}]+/gi,
    /cookie[=:]\s*[^\s,}]+/gi
  ];

  private static readonly PII_PATTERNS = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email (partial masking)
    /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g // Phone numbers
  ];

  /**
   * Log a detailed error with structured format
   */
  static logError(detailedError: DetailedError, duration?: number): void {
    const logEntry: LogEntry = {
      timestamp: detailedError.timestamp,
      level: this.getSeverityLogLevel(detailedError.severity),
      message: this.sanitizeMessage(detailedError.internalDetails),
      requestId: detailedError.requestId,
      userId: detailedError.userId,
      ipAddress: detailedError.ipAddress,
      userAgent: this.sanitizeUserAgent(detailedError.userAgent),
      endpoint: detailedError.context?.endpoint,
      method: detailedError.context?.method,
      errorCode: detailedError.error.code,
      category: detailedError.category,
      severity: detailedError.severity,
      context: this.sanitizeContext(detailedError.context),
      stackTrace: this.sanitizeStackTrace(detailedError.stackTrace),
      duration
    };

    this.writeLog(logEntry);

    // Log security events separately for audit trail
    if (this.isSecurityRelated(detailedError.category)) {
      this.logSecurityEvent(detailedError);
    }
  }

  /**
   * Log a security-related event for audit trail
   */
  static logSecurityEvent(detailedError: DetailedError, actionTaken?: string): void {
    const securityEvent = this.mapToSecurityEvent(detailedError.error.code);
    const threatLevel = this.mapSeverityToThreatLevel(detailedError.severity);

    const auditEntry: SecurityAuditEntry = {
      timestamp: detailedError.timestamp,
      level: 'ERROR',
      message: `Security event: ${securityEvent}`,
      requestId: detailedError.requestId,
      userId: detailedError.userId,
      ipAddress: detailedError.ipAddress,
      userAgent: this.sanitizeUserAgent(detailedError.userAgent),
      endpoint: detailedError.context?.endpoint,
      method: detailedError.context?.method,
      errorCode: detailedError.error.code,
      category: detailedError.category,
      severity: detailedError.severity,
      securityEvent,
      threatLevel,
      actionTaken,
      additionalMetadata: {
        userMessage: detailedError.error.message,
        context: this.sanitizeContext(detailedError.context)
      }
    };

    this.writeSecurityLog(auditEntry);
  }

  /**
   * Log general application events
   */
  static logInfo(message: string, context: ErrorContext, additionalData?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: context.timestamp,
      level: 'INFO',
      message: this.sanitizeMessage(message),
      requestId: context.requestId,
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: this.sanitizeUserAgent(context.userAgent),
      endpoint: context.endpoint,
      method: context.method,
      context: this.sanitizeContext(additionalData)
    };

    this.writeLog(logEntry);
  }

  /**
   * Log warning events
   */
  static logWarning(message: string, context: ErrorContext, additionalData?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: context.timestamp,
      level: 'WARN',
      message: this.sanitizeMessage(message),
      requestId: context.requestId,
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: this.sanitizeUserAgent(context.userAgent),
      endpoint: context.endpoint,
      method: context.method,
      context: this.sanitizeContext(additionalData)
    };

    this.writeLog(logEntry);
  }

  /**
   * Sanitize message content to remove sensitive information
   */
  private static sanitizeMessage(message: string): string {
    if (!message) return message;

    let sanitized = message;

    // Remove sensitive patterns
    this.SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match) => {
        // Handle bearer tokens specially
        if (match.toLowerCase().includes('bearer')) {
          return 'bearer ***';
        }
        
        // Handle key=value patterns
        if (match.includes('=') || match.includes(':')) {
          const key = match.split(/[=:]/)[0];
          return `${key}=***`;
        }
        
        return '***';
      });
    });

    // Mask PII
    this.PII_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match) => {
        if (match.includes('@')) {
          // Email: show first char and domain
          const [local, domain] = match.split('@');
          return `${local[0]}***@${domain}`;
        } else if (match.length > 4) {
          // Other PII: show first and last 2 chars
          return `${match.substring(0, 2)}***${match.substring(match.length - 2)}`;
        }
        return '***';
      });
    });

    return sanitized;
  }

  /**
   * Sanitize context object to remove sensitive information
   */
  private static sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };
    
    // Remove or mask sensitive fields
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization', 'cookie',
      'apiKey', 'accessToken', 'refreshToken', 'sessionId', 'jwt'
    ];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });

    // Sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeContext(sanitized[key]);
      } else if (typeof sanitized[key] === 'string') {
        sanitized[key] = this.sanitizeMessage(sanitized[key]);
      }
    });

    // Truncate long strings to prevent log bloat
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
        sanitized[key] = sanitized[key].substring(0, 1000) + '... [truncated]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize stack trace to remove sensitive information
   */
  private static sanitizeStackTrace(stackTrace?: string): string | undefined {
    if (!stackTrace) return undefined;

    // Remove file paths that might contain sensitive information
    let sanitized = stackTrace.replace(/\/[^\s]*\/([^\/\s]+)/g, '.../$1');
    
    // Remove sensitive patterns from stack trace
    sanitized = this.sanitizeMessage(sanitized);

    return sanitized;
  }

  /**
   * Sanitize user agent to remove potentially sensitive information
   */
  private static sanitizeUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    // Keep basic browser info but remove detailed version info that might be sensitive
    return userAgent.replace(/\d+\.\d+\.\d+\.\d+/g, 'x.x.x.x');
  }

  /**
   * Convert error severity to log level
   */
  private static getSeverityLogLevel(severity: ErrorSeverity): 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'ERROR';
      case 'MEDIUM':
        return 'WARN';
      case 'LOW':
        return 'INFO';
      default:
        return 'ERROR';
    }
  }

  /**
   * Check if error category is security-related
   */
  private static isSecurityRelated(category: ErrorCategory): boolean {
    return ['AUTHENTICATION', 'AUTHORIZATION', 'SECURITY_VIOLATION'].includes(category);
  }

  /**
   * Map error code to security event type
   */
  private static mapToSecurityEvent(errorCode: string): SecurityAuditEntry['securityEvent'] {
    if (errorCode.startsWith('AUTH_')) {
      return 'AUTHENTICATION_FAILURE';
    } else if (errorCode.startsWith('AUTHZ_')) {
      return 'AUTHORIZATION_FAILURE';
    } else if (errorCode.includes('BRUTE_FORCE')) {
      return 'BRUTE_FORCE_ATTEMPT';
    } else if (errorCode.includes('SECURITY_') || errorCode.includes('SUSPICIOUS')) {
      return 'SECURITY_VIOLATION';
    } else {
      return 'SUSPICIOUS_ACTIVITY';
    }
  }

  /**
   * Map error severity to threat level
   */
  private static mapSeverityToThreatLevel(severity: ErrorSeverity): SecurityAuditEntry['threatLevel'] {
    switch (severity) {
      case 'CRITICAL':
        return 'CRITICAL';
      case 'HIGH':
        return 'HIGH';
      case 'MEDIUM':
        return 'MEDIUM';
      case 'LOW':
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  /**
   * Write log entry to appropriate destination
   */
  private static writeLog(logEntry: LogEntry): void {
    // In a real implementation, this would write to CloudWatch, file system, or other log destination
    // For now, we'll use console with structured format
    const logMessage = JSON.stringify(logEntry, null, 2);
    
    switch (logEntry.level) {
      case 'ERROR':
        console.error(`[ERROR] ${logEntry.timestamp} - ${logEntry.message}`, logEntry);
        break;
      case 'WARN':
        console.warn(`[WARN] ${logEntry.timestamp} - ${logEntry.message}`, logEntry);
        break;
      case 'INFO':
        console.info(`[INFO] ${logEntry.timestamp} - ${logEntry.message}`, logEntry);
        break;
      case 'DEBUG':
        console.debug(`[DEBUG] ${logEntry.timestamp} - ${logEntry.message}`, logEntry);
        break;
    }
  }

  /**
   * Write security audit log entry
   */
  private static writeSecurityLog(auditEntry: SecurityAuditEntry): void {
    // In a real implementation, this would write to a dedicated security log system
    // This might be a separate CloudWatch log group, SIEM system, or security monitoring service
    console.error(`[SECURITY-AUDIT] ${auditEntry.timestamp} - ${auditEntry.securityEvent}`, auditEntry);
    
    // Trigger alerts for high-severity security events
    if (auditEntry.threatLevel === 'CRITICAL' || auditEntry.threatLevel === 'HIGH') {
      this.triggerSecurityAlert(auditEntry);
    }
  }

  /**
   * Trigger security alert for critical events
   */
  private static triggerSecurityAlert(auditEntry: SecurityAuditEntry): void {
    // In a real implementation, this would integrate with alerting systems like:
    // - AWS SNS for notifications
    // - PagerDuty for incident management
    // - Slack/Teams for team notifications
    // - SIEM systems for security operations
    
    console.error(`[SECURITY-ALERT] Critical security event detected:`, {
      event: auditEntry.securityEvent,
      threatLevel: auditEntry.threatLevel,
      userId: auditEntry.userId,
      ipAddress: auditEntry.ipAddress,
      timestamp: auditEntry.timestamp,
      requestId: auditEntry.requestId
    });
  }

  /**
   * Create performance log entry
   */
  static logPerformance(
    operation: string,
    duration: number,
    context: ErrorContext,
    metadata?: Record<string, any>
  ): void {
    const logEntry: LogEntry = {
      timestamp: context.timestamp,
      level: duration > 5000 ? 'WARN' : 'INFO', // Warn if operation takes more than 5 seconds
      message: `Performance: ${operation} completed in ${duration}ms`,
      requestId: context.requestId,
      userId: context.userId,
      endpoint: context.endpoint,
      method: context.method,
      duration,
      context: this.sanitizeContext(metadata)
    };

    this.writeLog(logEntry);
  }
}