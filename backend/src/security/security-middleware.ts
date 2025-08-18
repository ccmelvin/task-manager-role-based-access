/**
 * Security Middleware
 * Provides middleware functions for applying security headers and policies
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CorsConfigService } from '../cors';
import { SecurityHeadersConfig, SecurityHeadersService } from './security-headers';

export interface SecurityMiddlewareOptions {
  securityHeaders?: Partial<SecurityHeadersConfig>;
  enableCors?: boolean;
  enableRateLimit?: boolean;
  rateLimitHeaders?: RateLimitHeaders;
}

export interface RateLimitHeaders {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface SecurityContext {
  requestId: string;
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
  origin?: string;
}

/**
 * Security Middleware Service
 * Provides middleware functions for Lambda responses
 */
export class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  private securityHeadersService: SecurityHeadersService;
  private corsService: CorsConfigService;

  private constructor() {
    this.securityHeadersService = SecurityHeadersService.getInstance();
    this.corsService = CorsConfigService.getInstance();
  }

  public static getInstance(): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware();
    }
    return SecurityMiddleware.instance;
  }

  /**
   * Apply security headers to Lambda response
   */
  public applySecurityHeaders(
    response: APIGatewayProxyResult,
    options: SecurityMiddlewareOptions = {}
  ): APIGatewayProxyResult {
    const securityHeaders = this.securityHeadersService.generateSecurityHeaders(options.securityHeaders);
    
    // Merge with existing headers
    const headers = {
      ...response.headers,
      ...securityHeaders
    };

    // Add rate limiting headers if enabled
    if (options.enableRateLimit && options.rateLimitHeaders) {
      headers['X-RateLimit-Limit'] = options.rateLimitHeaders.limit.toString();
      headers['X-RateLimit-Remaining'] = options.rateLimitHeaders.remaining.toString();
      headers['X-RateLimit-Reset'] = options.rateLimitHeaders.reset.toString();
      
      if (options.rateLimitHeaders.retryAfter) {
        headers['Retry-After'] = options.rateLimitHeaders.retryAfter.toString();
      }
    }

    return {
      ...response,
      headers
    };
  }

  /**
   * Apply CORS headers to Lambda response
   */
  public applyCorsHeaders(
    response: APIGatewayProxyResult,
    requestOrigin?: string
  ): APIGatewayProxyResult {
    const corsHeaders = this.corsService.getCorsHeaders(requestOrigin);
    
    return {
      ...response,
      headers: {
        ...response.headers,
        ...corsHeaders
      }
    };
  }

  /**
   * Create a secure response with all security measures applied
   */
  public createSecureResponse(
    statusCode: number,
    body: any,
    context: SecurityContext,
    options: SecurityMiddlewareOptions = {}
  ): APIGatewayProxyResult {
    // Create base response
    let response: APIGatewayProxyResult = {
      statusCode,
      headers: {
        'Content-Type': 'application/json'
      },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    };

    // Apply CORS headers if enabled
    if (options.enableCors !== false) {
      response = this.applyCorsHeaders(response, context.origin);
    }

    // Apply security headers
    response = this.applySecurityHeaders(response, options);

    // Add request tracking headers
    response.headers!['X-Request-ID'] = context.requestId;
    response.headers!['X-Timestamp'] = context.timestamp;

    return response;
  }

  /**
   * Create a secure error response
   */
  public createSecureErrorResponse(
    statusCode: number,
    errorCode: string,
    message: string,
    context: SecurityContext,
    details?: any[]
  ): APIGatewayProxyResult {
    const errorBody = {
      error: {
        code: errorCode,
        message,
        details
      },
      requestId: context.requestId,
      timestamp: context.timestamp
    };

    // Use error-specific security headers
    const errorSecurityHeaders = this.securityHeadersService.getErrorSecurityHeaders();
    
    const options: SecurityMiddlewareOptions = {
      securityHeaders: {
        customHeaders: errorSecurityHeaders
      },
      enableRateLimit: true,
      rateLimitHeaders: {
        limit: 100,
        remaining: 99,
        reset: Math.floor(Date.now() / 1000) + 3600
      }
    };

    return this.createSecureResponse(statusCode, errorBody, context, options);
  }

  /**
   * Create a secure success response
   */
  public createSecureSuccessResponse(
    statusCode: number,
    data: any,
    context: SecurityContext,
    options: SecurityMiddlewareOptions = {}
  ): APIGatewayProxyResult {
    const successBody = {
      success: true,
      data,
      requestId: context.requestId
    };

    const defaultOptions: SecurityMiddlewareOptions = {
      enableRateLimit: true,
      rateLimitHeaders: {
        limit: 100,
        remaining: 99,
        reset: Math.floor(Date.now() / 1000) + 3600
      },
      ...options
    };

    return this.createSecureResponse(statusCode, successBody, context, defaultOptions);
  }

  /**
   * Handle preflight CORS requests
   */
  public handlePreflightRequest(
    event: APIGatewayProxyEvent,
    context: SecurityContext
  ): APIGatewayProxyResult {
    const origin = event.headers?.Origin || event.headers?.origin;
    const method = event.headers?.['Access-Control-Request-Method'];
    const requestedHeaders = event.headers?.['Access-Control-Request-Headers']?.split(',').map(h => h.trim()) || [];

    if (!origin || !method) {
      return this.createSecureErrorResponse(
        400,
        'INVALID_PREFLIGHT',
        'Invalid preflight request',
        context
      );
    }

    // Validate preflight request
    const validation = this.corsService.validatePreflightRequest(origin, method, requestedHeaders);
    
    if (!validation.isValid) {
      return this.createSecureErrorResponse(
        403,
        'CORS_VIOLATION',
        validation.error || 'CORS policy violation',
        context
      );
    }

    // Create successful preflight response
    const response: APIGatewayProxyResult = {
      statusCode: 204,
      headers: {
        'Content-Length': '0'
      },
      body: ''
    };

    // Apply CORS headers
    const corsResponse = this.applyCorsHeaders(response, origin);
    
    // Apply security headers (minimal for preflight)
    const securityOptions: SecurityMiddlewareOptions = {
      securityHeaders: {
        cacheControl: {
          public: true,
          maxAge: 86400 // 24 hours
        }
      }
    };

    return this.applySecurityHeaders(corsResponse, securityOptions);
  }

  /**
   * Extract security context from API Gateway event
   */
  public extractSecurityContext(event: APIGatewayProxyEvent, requestId: string): SecurityContext {
    return {
      requestId,
      timestamp: new Date().toISOString(),
      userAgent: event.headers?.['User-Agent'] || event.headers?.['user-agent'],
      ipAddress: event.requestContext?.identity?.sourceIp,
      origin: event.headers?.Origin || event.headers?.origin
    };
  }

  /**
   * Validate request security
   */
  public validateRequestSecurity(
    event: APIGatewayProxyEvent,
    context: SecurityContext
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check request size
    const maxRequestSize = 1024 * 1024; // 1MB
    const requestSize = event.body ? Buffer.byteLength(event.body, 'utf8') : 0;
    
    if (requestSize > maxRequestSize) {
      errors.push('Request payload exceeds maximum allowed size');
    }

    // Check for suspicious headers
    const suspiciousHeaders = [
      'X-Forwarded-Host',
      'X-Original-URL',
      'X-Rewrite-URL'
    ];

    suspiciousHeaders.forEach(header => {
      if (event.headers?.[header] || event.headers?.[header.toLowerCase()]) {
        errors.push(`Suspicious header detected: ${header}`);
      }
    });

    // Check User-Agent
    if (!context.userAgent || context.userAgent.length < 10) {
      errors.push('Missing or suspicious User-Agent header');
    }

    // Check for common attack patterns in headers
    const headerValues = Object.values(event.headers || {}).join(' ');
    const attackPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /\.\./,
      /\/etc\/passwd/i,
      /cmd\.exe/i
    ];

    attackPatterns.forEach(pattern => {
      if (pattern.test(headerValues)) {
        errors.push('Potential attack pattern detected in headers');
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Log security event
   */
  public logSecurityEvent(
    eventType: 'CORS_VIOLATION' | 'RATE_LIMIT_EXCEEDED' | 'SUSPICIOUS_REQUEST' | 'SECURITY_HEADER_APPLIED',
    context: SecurityContext,
    details?: Record<string, any>
  ): void {
    const logEntry = {
      timestamp: context.timestamp,
      level: 'SECURITY',
      eventType,
      requestId: context.requestId,
      details: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        origin: context.origin,
        ...details
      },
      severity: eventType === 'SECURITY_HEADER_APPLIED' ? 'LOW' : 'MEDIUM'
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Create middleware wrapper for Lambda functions
   */
  public createMiddleware(options: SecurityMiddlewareOptions = {}) {
    return (handler: (event: APIGatewayProxyEvent, context: any) => Promise<APIGatewayProxyResult>) => {
      return async (event: APIGatewayProxyEvent, lambdaContext: any): Promise<APIGatewayProxyResult> => {
        const requestId = lambdaContext.awsRequestId || 'unknown';
        const securityContext = this.extractSecurityContext(event, requestId);

        try {
          // Handle preflight requests
          if (event.httpMethod === 'OPTIONS') {
            return this.handlePreflightRequest(event, securityContext);
          }

          // Validate request security
          const validation = this.validateRequestSecurity(event, securityContext);
          if (!validation.isValid) {
            this.logSecurityEvent('SUSPICIOUS_REQUEST', securityContext, {
              errors: validation.errors
            });
            
            return this.createSecureErrorResponse(
              400,
              'SECURITY_VIOLATION',
              'Request failed security validation',
              securityContext
            );
          }

          // Execute the handler
          const response = await handler(event, lambdaContext);

          // Apply security measures to response
          const secureResponse = this.applySecurityHeaders(response, options);
          const finalResponse = options.enableCors !== false 
            ? this.applyCorsHeaders(secureResponse, securityContext.origin)
            : secureResponse;

          // Log security event
          this.logSecurityEvent('SECURITY_HEADER_APPLIED', securityContext, {
            statusCode: response.statusCode,
            headersApplied: Object.keys(finalResponse.headers || {})
          });

          return finalResponse;

        } catch (error) {
          // Log error and return secure error response
          console.error('Middleware error:', error);
          
          return this.createSecureErrorResponse(
            500,
            'INTERNAL_SERVER_ERROR',
            'An internal server error occurred',
            securityContext
          );
        }
      };
    };
  }
}