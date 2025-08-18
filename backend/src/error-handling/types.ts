/**
 * Error handling types for secure error responses and logging
 */

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ErrorCategory = 'AUTHENTICATION' | 'AUTHORIZATION' | 'VALIDATION' | 'SYSTEM' | 'EXTERNAL' | 'SECURITY_VIOLATION';

/**
 * Secure error response interface for client-facing errors
 * Contains only safe information that can be exposed to users
 */
export interface SecureErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ValidationError[];
  };
  requestId: string;
  timestamp: string;
}

/**
 * Validation error details for field-specific errors
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Detailed error interface for internal logging and debugging
 * Contains sensitive information that should never be exposed to clients
 */
export interface DetailedError extends SecureErrorResponse {
  internalDetails: string;
  stackTrace?: string;
  context: Record<string, any>;
  severity: ErrorSeverity;
  category: ErrorCategory;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Error classification configuration
 */
export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  shouldLog: boolean;
  shouldAlert: boolean;
}

/**
 * Error context for tracking request information
 */
export interface ErrorContext {
  requestId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  timestamp: string;
}