/**
 * Secure error handler for creating safe error responses and managing error context
 */

import { v4 as uuidv4 } from 'uuid';
import { ErrorClassifier } from './error-classifier';
import {
    DetailedError,
    ErrorCategory,
    ErrorContext,
    ErrorSeverity,
    SecureErrorResponse,
    ValidationError
} from './types';

export class SecureErrorHandler {
  /**
   * Create a secure error response that's safe to send to clients
   */
  static createSecureResponse(
    errorCode: string,
    context: ErrorContext,
    validationErrors?: ValidationError[]
  ): SecureErrorResponse {
    const classification = ErrorClassifier.classify(errorCode);
    
    return {
      error: {
        code: errorCode,
        message: classification.userMessage,
        details: validationErrors
      },
      requestId: context.requestId,
      timestamp: context.timestamp
    };
  }

  /**
   * Create a detailed error for internal logging
   */
  static createDetailedError(
    errorCode: string,
    internalDetails: string,
    context: ErrorContext,
    originalError?: Error,
    additionalContext?: Record<string, any>
  ): DetailedError {
    const classification = ErrorClassifier.classify(errorCode);
    const secureResponse = this.createSecureResponse(errorCode, context);

    return {
      ...secureResponse,
      internalDetails: this.sanitizeInternalDetails(internalDetails),
      stackTrace: originalError?.stack,
      context: this.sanitizeContext({
        ...additionalContext,
        originalErrorName: originalError?.name,
        originalErrorMessage: originalError?.message
      }),
      severity: classification.severity,
      category: classification.category,
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    };
  }

  /**
   * Create error context from request information
   */
  static createErrorContext(
    requestId?: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    endpoint?: string,
    method?: string
  ): ErrorContext {
    return {
      requestId: requestId || uuidv4(),
      userId,
      ipAddress,
      userAgent,
      endpoint,
      method,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle an unknown error and classify it appropriately
   */
  static handleUnknownError(
    error: Error,
    context: ErrorContext,
    additionalContext?: Record<string, any>
  ): { secureResponse: SecureErrorResponse; detailedError: DetailedError } {
    const classification = ErrorClassifier.classifyFromError(error);
    
    // Determine error code based on classification and error specifics
    let errorCode = 'UNKNOWN_ERROR';
    if (classification.category === 'AUTHENTICATION') {
      errorCode = 'AUTH_INVALID_TOKEN';
    } else if (classification.category === 'AUTHORIZATION') {
      errorCode = 'AUTHZ_INSUFFICIENT_PERMISSIONS';
    } else if (classification.category === 'VALIDATION') {
      errorCode = 'VALIDATION_INVALID_FORMAT';
    } else if (classification.category === 'SECURITY_VIOLATION') {
      errorCode = 'SECURITY_SUSPICIOUS_ACTIVITY';
    } else if (classification.category === 'SYSTEM') {
      // More specific system error classification
      if (error.message.includes('timeout') || error.name === 'TimeoutError') {
        errorCode = 'SYSTEM_TIMEOUT';
      } else if (error.message.includes('database') || error.message.includes('DynamoDB')) {
        errorCode = 'SYSTEM_DATABASE_ERROR';
      } else {
        errorCode = 'UNKNOWN_ERROR';
      }
    }

    const secureResponse = this.createSecureResponse(errorCode, context);
    const detailedError = this.createDetailedError(
      errorCode,
      `Unhandled error: ${error.message}`,
      context,
      error,
      additionalContext
    );

    return { secureResponse, detailedError };
  }

  /**
   * Create validation error response
   */
  static createValidationErrorResponse(
    validationErrors: ValidationError[],
    context: ErrorContext
  ): SecureErrorResponse {
    return {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed for one or more fields.',
        details: validationErrors
      },
      requestId: context.requestId,
      timestamp: context.timestamp
    };
  }

  /**
   * Create authentication error response (generic to prevent user enumeration)
   */
  static createAuthenticationErrorResponse(context: ErrorContext): SecureErrorResponse {
    return this.createSecureResponse('AUTH_INVALID_CREDENTIALS', context);
  }

  /**
   * Create authorization error response
   */
  static createAuthorizationErrorResponse(
    action: string,
    resource: string,
    context: ErrorContext
  ): SecureErrorResponse {
    const detailedError = this.createDetailedError(
      'AUTHZ_INSUFFICIENT_PERMISSIONS',
      `User ${context.userId} attempted ${action} on ${resource}`,
      context,
      undefined,
      { action, resource }
    );

    return this.createSecureResponse('AUTHZ_INSUFFICIENT_PERMISSIONS', context);
  }

  /**
   * Sanitize internal details to remove sensitive information
   */
  private static sanitizeInternalDetails(details: string): string {
    // Remove potential sensitive patterns
    return details
      .replace(/password[=:]\s*[^\s,}]+/gi, 'password=***')
      .replace(/token[=:]\s*[^\s,}]+/gi, 'token=***')
      .replace(/key[=:]\s*[^\s,}]+/gi, 'key=***')
      .replace(/secret[=:]\s*[^\s,}]+/gi, 'secret=***')
      .replace(/authorization:\s*[^\s,}]+/gi, 'authorization: ***')
      .replace(/bearer\s+[^\s,}]+/gi, 'bearer ***');
  }

  /**
   * Sanitize context object to remove sensitive information
   */
  private static sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized = { ...context };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    }

    // Truncate long strings to prevent log bloat
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
        sanitized[key] = sanitized[key].substring(0, 1000) + '... [truncated]';
      }
    });

    return sanitized;
  }

  /**
   * Check if an error should trigger an alert
   */
  static shouldAlert(errorCode: string): boolean {
    const classification = ErrorClassifier.classify(errorCode);
    return classification.shouldAlert;
  }

  /**
   * Check if an error should be logged
   */
  static shouldLog(errorCode: string): boolean {
    const classification = ErrorClassifier.classify(errorCode);
    return classification.shouldLog;
  }

  /**
   * Get error severity
   */
  static getErrorSeverity(errorCode: string): ErrorSeverity {
    const classification = ErrorClassifier.classify(errorCode);
    return classification.severity;
  }

  /**
   * Get error category
   */
  static getErrorCategory(errorCode: string): ErrorCategory {
    const classification = ErrorClassifier.classify(errorCode);
    return classification.category;
  }
}