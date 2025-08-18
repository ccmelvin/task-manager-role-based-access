/**
 * Tests for ErrorClassifier
 */

import { ErrorClassifier } from '../error-classifier';

describe('ErrorClassifier', () => {
  describe('classify', () => {
    it('should classify authentication errors correctly', () => {
      const classification = ErrorClassifier.classify('AUTH_INVALID_TOKEN');
      
      expect(classification.category).toBe('AUTHENTICATION');
      expect(classification.severity).toBe('MEDIUM');
      expect(classification.userMessage).toBe('Authentication failed. Please log in again.');
      expect(classification.shouldLog).toBe(true);
      expect(classification.shouldAlert).toBe(false);
    });

    it('should classify authorization errors correctly', () => {
      const classification = ErrorClassifier.classify('AUTHZ_INSUFFICIENT_PERMISSIONS');
      
      expect(classification.category).toBe('AUTHORIZATION');
      expect(classification.severity).toBe('MEDIUM');
      expect(classification.userMessage).toBe('You do not have permission to perform this action.');
      expect(classification.shouldLog).toBe(true);
      expect(classification.shouldAlert).toBe(false);
    });

    it('should classify validation errors correctly', () => {
      const classification = ErrorClassifier.classify('VALIDATION_REQUIRED_FIELD');
      
      expect(classification.category).toBe('VALIDATION');
      expect(classification.severity).toBe('LOW');
      expect(classification.userMessage).toBe('Required field is missing.');
      expect(classification.shouldLog).toBe(false);
      expect(classification.shouldAlert).toBe(false);
    });

    it('should classify security violations correctly', () => {
      const classification = ErrorClassifier.classify('SECURITY_SUSPICIOUS_ACTIVITY');
      
      expect(classification.category).toBe('SECURITY_VIOLATION');
      expect(classification.severity).toBe('CRITICAL');
      expect(classification.userMessage).toBe('Security violation detected.');
      expect(classification.shouldLog).toBe(true);
      expect(classification.shouldAlert).toBe(true);
    });

    it('should return default classification for unknown error codes', () => {
      const classification = ErrorClassifier.classify('UNKNOWN_CODE_12345');
      
      expect(classification.category).toBe('SYSTEM');
      expect(classification.severity).toBe('MEDIUM');
      expect(classification.userMessage).toBe('An unexpected error occurred. Please try again later.');
      expect(classification.shouldLog).toBe(true);
      expect(classification.shouldAlert).toBe(false);
    });
  });

  describe('classifyFromError', () => {
    it('should classify ValidationError correctly', () => {
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      
      const classification = ErrorClassifier.classifyFromError(error);
      expect(classification.category).toBe('VALIDATION');
    });

    it('should classify UnauthorizedError correctly', () => {
      const error = new Error('Unauthorized access');
      error.name = 'UnauthorizedError';
      
      const classification = ErrorClassifier.classifyFromError(error);
      expect(classification.category).toBe('AUTHENTICATION');
    });

    it('should classify ForbiddenError correctly', () => {
      const error = new Error('Forbidden action');
      error.name = 'ForbiddenError';
      
      const classification = ErrorClassifier.classifyFromError(error);
      expect(classification.category).toBe('AUTHORIZATION');
    });

    it('should classify timeout errors correctly', () => {
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';
      
      const classification = ErrorClassifier.classifyFromError(error);
      expect(classification.category).toBe('SYSTEM');
      expect(classification.severity).toBe('MEDIUM');
    });

    it('should classify database errors correctly', () => {
      const error = new Error('DynamoDB connection failed');
      
      const classification = ErrorClassifier.classifyFromError(error);
      expect(classification.category).toBe('SYSTEM');
      expect(classification.severity).toBe('HIGH');
    });

    it('should detect potential security violations', () => {
      const maliciousError = new Error('<script>alert("xss")</script>');
      
      const classification = ErrorClassifier.classifyFromError(maliciousError);
      expect(classification.category).toBe('SECURITY_VIOLATION');
      expect(classification.severity).toBe('CRITICAL');
    });

    it('should detect SQL injection attempts', () => {
      const sqlInjectionError = new Error('union select * from users');
      
      const classification = ErrorClassifier.classifyFromError(sqlInjectionError);
      expect(classification.category).toBe('SECURITY_VIOLATION');
    });

    it('should detect path traversal attempts', () => {
      const pathTraversalError = new Error('../../etc/passwd');
      
      const classification = ErrorClassifier.classifyFromError(pathTraversalError);
      expect(classification.category).toBe('SECURITY_VIOLATION');
    });

    it('should return default classification for generic errors', () => {
      const error = new Error('Something went wrong');
      
      const classification = ErrorClassifier.classifyFromError(error);
      expect(classification.category).toBe('SYSTEM');
    });
  });

  describe('getErrorCodesByCategory', () => {
    it('should return authentication error codes', () => {
      const authCodes = ErrorClassifier.getErrorCodesByCategory('AUTHENTICATION');
      
      expect(authCodes).toContain('AUTH_INVALID_TOKEN');
      expect(authCodes).toContain('AUTH_TOKEN_EXPIRED');
      expect(authCodes).toContain('AUTH_MISSING_TOKEN');
      expect(authCodes).toContain('AUTH_INVALID_CREDENTIALS');
    });

    it('should return authorization error codes', () => {
      const authzCodes = ErrorClassifier.getErrorCodesByCategory('AUTHORIZATION');
      
      expect(authzCodes).toContain('AUTHZ_INSUFFICIENT_PERMISSIONS');
      expect(authzCodes).toContain('AUTHZ_RESOURCE_ACCESS_DENIED');
      expect(authzCodes).toContain('AUTHZ_ROLE_VALIDATION_FAILED');
    });

    it('should return security violation error codes', () => {
      const securityCodes = ErrorClassifier.getErrorCodesByCategory('SECURITY_VIOLATION');
      
      expect(securityCodes).toContain('SECURITY_SUSPICIOUS_ACTIVITY');
      expect(securityCodes).toContain('SECURITY_BRUTE_FORCE');
      expect(securityCodes).toContain('VALIDATION_MALICIOUS_INPUT');
    });
  });

  describe('getAlertableErrorCodes', () => {
    it('should return error codes that should trigger alerts', () => {
      const alertableCodes = ErrorClassifier.getAlertableErrorCodes();
      
      expect(alertableCodes).toContain('AUTHZ_ROLE_VALIDATION_FAILED');
      expect(alertableCodes).toContain('SYSTEM_DATABASE_ERROR');
      expect(alertableCodes).toContain('SECURITY_SUSPICIOUS_ACTIVITY');
      expect(alertableCodes).toContain('SECURITY_BRUTE_FORCE');
      expect(alertableCodes).toContain('VALIDATION_MALICIOUS_INPUT');
      
      // Should not contain low-severity errors
      expect(alertableCodes).not.toContain('VALIDATION_REQUIRED_FIELD');
      expect(alertableCodes).not.toContain('AUTH_TOKEN_EXPIRED');
    });
  });
});