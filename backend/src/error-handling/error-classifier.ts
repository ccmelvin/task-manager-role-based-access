/**
 * Error classification service for categorizing and handling different error types
 */

import { ErrorCategory, ErrorClassification } from './types';

export class ErrorClassifier {
  private static readonly ERROR_CLASSIFICATIONS: Record<string, ErrorClassification> = {
    // Authentication Errors
    'AUTH_INVALID_TOKEN': {
      category: 'AUTHENTICATION',
      severity: 'MEDIUM',
      userMessage: 'Authentication failed. Please log in again.',
      shouldLog: true,
      shouldAlert: false
    },
    'AUTH_TOKEN_EXPIRED': {
      category: 'AUTHENTICATION',
      severity: 'LOW',
      userMessage: 'Your session has expired. Please log in again.',
      shouldLog: true,
      shouldAlert: false
    },
    'AUTH_MISSING_TOKEN': {
      category: 'AUTHENTICATION',
      severity: 'LOW',
      userMessage: 'Authentication required. Please log in.',
      shouldLog: true,
      shouldAlert: false
    },
    'AUTH_INVALID_CREDENTIALS': {
      category: 'AUTHENTICATION',
      severity: 'MEDIUM',
      userMessage: 'Invalid credentials provided.',
      shouldLog: true,
      shouldAlert: false
    },

    // Authorization Errors
    'AUTHZ_INSUFFICIENT_PERMISSIONS': {
      category: 'AUTHORIZATION',
      severity: 'MEDIUM',
      userMessage: 'You do not have permission to perform this action.',
      shouldLog: true,
      shouldAlert: false
    },
    'AUTHZ_RESOURCE_ACCESS_DENIED': {
      category: 'AUTHORIZATION',
      severity: 'MEDIUM',
      userMessage: 'Access to this resource is not allowed.',
      shouldLog: true,
      shouldAlert: false
    },
    'AUTHZ_ROLE_VALIDATION_FAILED': {
      category: 'AUTHORIZATION',
      severity: 'HIGH',
      userMessage: 'Authorization validation failed.',
      shouldLog: true,
      shouldAlert: true
    },

    // Validation Errors
    'VALIDATION_REQUIRED_FIELD': {
      category: 'VALIDATION',
      severity: 'LOW',
      userMessage: 'Required field is missing.',
      shouldLog: false,
      shouldAlert: false
    },
    'VALIDATION_INVALID_FORMAT': {
      category: 'VALIDATION',
      severity: 'LOW',
      userMessage: 'Invalid data format provided.',
      shouldLog: false,
      shouldAlert: false
    },
    'VALIDATION_LENGTH_EXCEEDED': {
      category: 'VALIDATION',
      severity: 'LOW',
      userMessage: 'Input exceeds maximum allowed length.',
      shouldLog: false,
      shouldAlert: false
    },
    'VALIDATION_MALICIOUS_INPUT': {
      category: 'SECURITY_VIOLATION',
      severity: 'HIGH',
      userMessage: 'Invalid input detected.',
      shouldLog: true,
      shouldAlert: true
    },

    // System Errors
    'SYSTEM_DATABASE_ERROR': {
      category: 'SYSTEM',
      severity: 'HIGH',
      userMessage: 'A system error occurred. Please try again later.',
      shouldLog: true,
      shouldAlert: true
    },
    'SYSTEM_SERVICE_UNAVAILABLE': {
      category: 'SYSTEM',
      severity: 'HIGH',
      userMessage: 'Service temporarily unavailable. Please try again later.',
      shouldLog: true,
      shouldAlert: true
    },
    'SYSTEM_TIMEOUT': {
      category: 'SYSTEM',
      severity: 'MEDIUM',
      userMessage: 'Request timed out. Please try again.',
      shouldLog: true,
      shouldAlert: false
    },

    // External Service Errors
    'EXTERNAL_SERVICE_ERROR': {
      category: 'EXTERNAL',
      severity: 'MEDIUM',
      userMessage: 'External service error. Please try again later.',
      shouldLog: true,
      shouldAlert: false
    },
    'EXTERNAL_RATE_LIMIT': {
      category: 'EXTERNAL',
      severity: 'LOW',
      userMessage: 'Rate limit exceeded. Please try again later.',
      shouldLog: true,
      shouldAlert: false
    },

    // Security Violations
    'SECURITY_SUSPICIOUS_ACTIVITY': {
      category: 'SECURITY_VIOLATION',
      severity: 'CRITICAL',
      userMessage: 'Security violation detected.',
      shouldLog: true,
      shouldAlert: true
    },
    'SECURITY_BRUTE_FORCE': {
      category: 'SECURITY_VIOLATION',
      severity: 'CRITICAL',
      userMessage: 'Too many failed attempts. Account temporarily locked.',
      shouldLog: true,
      shouldAlert: true
    },

    // Default/Unknown Errors
    'UNKNOWN_ERROR': {
      category: 'SYSTEM',
      severity: 'MEDIUM',
      userMessage: 'An unexpected error occurred. Please try again later.',
      shouldLog: true,
      shouldAlert: false
    }
  };

  /**
   * Classify an error based on its code or type
   */
  static classify(errorCode: string): ErrorClassification {
    return this.ERROR_CLASSIFICATIONS[errorCode] || this.ERROR_CLASSIFICATIONS['UNKNOWN_ERROR'];
  }

  /**
   * Classify an error based on the actual error object
   */
  static classifyFromError(error: Error): ErrorClassification {
    // Check for specific error types and patterns
    if (error.name === 'ValidationError') {
      return this.classify('VALIDATION_INVALID_FORMAT');
    }
    
    if (error.name === 'UnauthorizedError' || error.message.includes('Unauthorized')) {
      return this.classify('AUTH_INVALID_TOKEN');
    }
    
    if (error.name === 'ForbiddenError' || error.message.includes('Forbidden')) {
      return this.classify('AUTHZ_INSUFFICIENT_PERMISSIONS');
    }
    
    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      return this.classify('SYSTEM_TIMEOUT');
    }
    
    if (error.message.includes('database') || error.message.includes('DynamoDB')) {
      return this.classify('SYSTEM_DATABASE_ERROR');
    }

    // Check for potential security violations
    if (this.isPotentialSecurityViolation(error)) {
      return this.classify('SECURITY_SUSPICIOUS_ACTIVITY');
    }

    return this.classify('UNKNOWN_ERROR');
  }

  /**
   * Determine if an error might be a security violation
   */
  private static isPotentialSecurityViolation(error: Error): boolean {
    const suspiciousPatterns = [
      /script/i,
      /javascript/i,
      /eval\(/i,
      /document\./i,
      /window\./i,
      /<script/i,
      /onload=/i,
      /onerror=/i,
      /\.\.\/\.\.\//,  // Path traversal
      /union.*select/i, // SQL injection
      /drop.*table/i,   // SQL injection
    ];

    return suspiciousPatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.stack || '')
    );
  }

  /**
   * Get all error codes for a specific category
   */
  static getErrorCodesByCategory(category: ErrorCategory): string[] {
    return Object.entries(this.ERROR_CLASSIFICATIONS)
      .filter(([, classification]) => classification.category === category)
      .map(([code]) => code);
  }

  /**
   * Get all error codes that should trigger alerts
   */
  static getAlertableErrorCodes(): string[] {
    return Object.entries(this.ERROR_CLASSIFICATIONS)
      .filter(([, classification]) => classification.shouldAlert)
      .map(([code]) => code);
  }
}