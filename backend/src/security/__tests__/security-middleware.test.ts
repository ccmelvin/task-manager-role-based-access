import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SecurityMiddleware } from '../security-middleware';

// Mock the dependencies
jest.mock('../security-headers');
jest.mock('../../cors');

describe('SecurityMiddleware', () => {
  let middleware: SecurityMiddleware;
  let mockEvent: APIGatewayProxyEvent;
  let mockLambdaContext: any;

  beforeEach(() => {
    // Reset singleton instance
    (SecurityMiddleware as any).instance = undefined;
    middleware = SecurityMiddleware.getInstance();

    // Mock the security services
    const mockSecurityHeadersService = {
      generateSecurityHeaders: jest.fn().mockReturnValue({
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff'
      }),
      getErrorSecurityHeaders: jest.fn().mockReturnValue({
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex'
      })
    };
    
    const mockCorsService = {
      getCorsHeaders: jest.fn().mockReturnValue({
        'Access-Control-Allow-Origin': 'https://example.com'
      }),
      validatePreflightRequest: jest.fn().mockReturnValue({ isValid: true })
    };

    (middleware as any).securityHeadersService = mockSecurityHeadersService;
    (middleware as any).corsService = mockCorsService;

    // Mock event
    mockEvent = {
      httpMethod: 'GET',
      path: '/test',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; test)',
        'Origin': 'https://example.com'
      },
      requestContext: {
        identity: {
          sourceIp: '192.168.1.1'
        }
      } as any,
      body: null,
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      stageVariables: null,
      resource: ''
    };

    // Mock Lambda context
    mockLambdaContext = {
      awsRequestId: 'test-request-id'
    };

    // Mock console.log to avoid test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Security Context Extraction', () => {
    it('should extract security context from event', () => {
      const context = middleware.extractSecurityContext(mockEvent, 'test-id');

      expect(context.requestId).toBe('test-id');
      expect(context.userAgent).toBe('Mozilla/5.0 (compatible; test)');
      expect(context.ipAddress).toBe('192.168.1.1');
      expect(context.origin).toBe('https://example.com');
      expect(context.timestamp).toBeDefined();
    });

    it('should handle missing headers gracefully', () => {
      const eventWithoutHeaders = { ...mockEvent, headers: {} };
      const context = middleware.extractSecurityContext(eventWithoutHeaders, 'test-id');

      expect(context.requestId).toBe('test-id');
      expect(context.userAgent).toBeUndefined();
      expect(context.origin).toBeUndefined();
    });
  });

  describe('Request Security Validation', () => {
    it('should validate secure requests', () => {
      const context = middleware.extractSecurityContext(mockEvent, 'test-id');
      const result = middleware.validateRequestSecurity(mockEvent, context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject requests with excessive payload size', () => {
      const largeBody = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const eventWithLargeBody = { ...mockEvent, body: largeBody };
      const context = middleware.extractSecurityContext(eventWithLargeBody, 'test-id');
      
      const result = middleware.validateRequestSecurity(eventWithLargeBody, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Request payload exceeds maximum allowed size');
    });

    it('should detect suspicious headers', () => {
      const eventWithSuspiciousHeaders = {
        ...mockEvent,
        headers: {
          ...mockEvent.headers,
          'X-Forwarded-Host': 'malicious.com'
        }
      };
      const context = middleware.extractSecurityContext(eventWithSuspiciousHeaders, 'test-id');
      
      const result = middleware.validateRequestSecurity(eventWithSuspiciousHeaders, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Suspicious header detected: X-Forwarded-Host');
    });

    it('should detect missing or suspicious User-Agent', () => {
      const eventWithoutUserAgent = {
        ...mockEvent,
        headers: { ...mockEvent.headers }
      };
      delete eventWithoutUserAgent.headers['User-Agent'];
      
      const context = middleware.extractSecurityContext(eventWithoutUserAgent, 'test-id');
      const result = middleware.validateRequestSecurity(eventWithoutUserAgent, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing or suspicious User-Agent header');
    });

    it('should detect attack patterns in headers', () => {
      const eventWithAttackPattern = {
        ...mockEvent,
        headers: {
          ...mockEvent.headers,
          'X-Custom-Header': '<script>alert("xss")</script>'
        }
      };
      const context = middleware.extractSecurityContext(eventWithAttackPattern, 'test-id');
      
      const result = middleware.validateRequestSecurity(eventWithAttackPattern, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Potential attack pattern detected in headers');
    });
  });

  describe('Secure Response Creation', () => {
    it('should create secure success response', () => {
      const context = middleware.extractSecurityContext(mockEvent, 'test-id');
      const response = middleware.createSecureSuccessResponse(
        200,
        { message: 'success' },
        context
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers).toBeDefined();
      expect(response.headers!['X-Request-ID']).toBe('test-id');
      expect(response.headers!['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('success');
      expect(body.requestId).toBe('test-id');
    });

    it('should create secure error response', () => {
      const context = middleware.extractSecurityContext(mockEvent, 'test-id');
      const response = middleware.createSecureErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid input',
        context,
        [{ field: 'email', message: 'Required' }]
      );

      expect(response.statusCode).toBe(400);
      expect(response.headers).toBeDefined();
      expect(response.headers!['X-Request-ID']).toBe('test-id');
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Invalid input');
      expect(body.error.details).toHaveLength(1);
      expect(body.requestId).toBe('test-id');
    });
  });

  describe('Preflight Request Handling', () => {
    it('should handle valid preflight requests', () => {
      const preflightEvent = {
        ...mockEvent,
        httpMethod: 'OPTIONS',
        headers: {
          ...mockEvent.headers,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      };

      // Mock CORS service validation
      const mockCorsService = {
        validatePreflightRequest: jest.fn().mockReturnValue({ isValid: true }),
        getCorsHeaders: jest.fn().mockReturnValue({
          'Access-Control-Allow-Origin': 'https://example.com',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        })
      };
      
      (middleware as any).corsService = mockCorsService;

      const context = middleware.extractSecurityContext(preflightEvent, 'test-id');
      const response = middleware.handlePreflightRequest(preflightEvent, context);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(response.headers!['Content-Length']).toBe('0');
    });

    it('should reject invalid preflight requests', () => {
      const preflightEvent = {
        ...mockEvent,
        httpMethod: 'OPTIONS',
        headers: {
          ...mockEvent.headers
          // Missing required preflight headers
        }
      };

      const context = middleware.extractSecurityContext(preflightEvent, 'test-id');
      const response = middleware.handlePreflightRequest(preflightEvent, context);

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_PREFLIGHT');
    });

    it('should reject preflight requests that violate CORS policy', () => {
      const preflightEvent = {
        ...mockEvent,
        httpMethod: 'OPTIONS',
        headers: {
          ...mockEvent.headers,
          'Origin': 'https://malicious.com',
          'Access-Control-Request-Method': 'POST'
        }
      };

      // Mock CORS service validation failure
      const mockCorsService = {
        validatePreflightRequest: jest.fn().mockReturnValue({ 
          isValid: false, 
          error: 'Origin not allowed' 
        })
      };
      
      (middleware as any).corsService = mockCorsService;

      const context = middleware.extractSecurityContext(preflightEvent, 'test-id');
      const response = middleware.handlePreflightRequest(preflightEvent, context);

      expect(response.statusCode).toBe(403);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CORS_VIOLATION');
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events', () => {
      const context = middleware.extractSecurityContext(mockEvent, 'test-id');
      
      middleware.logSecurityEvent('CORS_VIOLATION', context, {
        origin: 'https://malicious.com'
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"eventType":"CORS_VIOLATION"')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"severity":"MEDIUM"')
      );
    });

    it('should set appropriate severity levels', () => {
      const context = middleware.extractSecurityContext(mockEvent, 'test-id');
      
      middleware.logSecurityEvent('SECURITY_HEADER_APPLIED', context);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"severity":"LOW"')
      );
    });
  });

  describe('Middleware Wrapper', () => {
    it('should wrap handler with security middleware', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'success' })
      });

      // Mock security services
      const mockSecurityHeadersService = {
        generateSecurityHeaders: jest.fn().mockReturnValue({
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff'
        })
      };
      
      const mockCorsService = {
        getCorsHeaders: jest.fn().mockReturnValue({
          'Access-Control-Allow-Origin': 'https://example.com'
        })
      };

      (middleware as any).securityHeadersService = mockSecurityHeadersService;
      (middleware as any).corsService = mockCorsService;

      const wrappedHandler = middleware.createMiddleware()(mockHandler);
      const response = await wrappedHandler(mockEvent, mockLambdaContext);

      expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockLambdaContext);
      expect(response.statusCode).toBe(200);
      expect(response.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': 'https://example.com'
      });
    });

    it('should handle handler errors gracefully', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));

      const wrappedHandler = middleware.createMiddleware()(mockHandler);
      const response = await wrappedHandler(mockEvent, mockLambdaContext);

      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle preflight requests in middleware', async () => {
      const mockHandler = jest.fn();
      const preflightEvent = { ...mockEvent, httpMethod: 'OPTIONS' };

      // Mock CORS service
      const mockCorsService = {
        validatePreflightRequest: jest.fn().mockReturnValue({ isValid: true }),
        getCorsHeaders: jest.fn().mockReturnValue({})
      };
      
      (middleware as any).corsService = mockCorsService;

      const wrappedHandler = middleware.createMiddleware()(mockHandler);
      const response = await wrappedHandler(preflightEvent, mockLambdaContext);

      expect(mockHandler).not.toHaveBeenCalled(); // Handler should not be called for preflight
      expect(response.statusCode).toBe(204);
    });

    it('should reject requests that fail security validation', async () => {
      const mockHandler = jest.fn();
      const maliciousEvent = {
        ...mockEvent,
        headers: {
          'User-Agent': 'x', // Too short
          'X-Forwarded-Host': 'malicious.com'
        }
      };

      const wrappedHandler = middleware.createMiddleware()(mockHandler);
      const response = await wrappedHandler(maliciousEvent, mockLambdaContext);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('SECURITY_VIOLATION');
    });
  });

  describe('Header Application', () => {
    it('should apply security headers to response', () => {
      const baseResponse: APIGatewayProxyResult = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: '{"message": "test"}'
      };

      // Mock security headers service
      const mockSecurityHeadersService = {
        generateSecurityHeaders: jest.fn().mockReturnValue({
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff'
        })
      };
      
      (middleware as any).securityHeadersService = mockSecurityHeadersService;

      const response = middleware.applySecurityHeaders(baseResponse, {
        enableRateLimit: true,
        rateLimitHeaders: {
          limit: 100,
          remaining: 99,
          reset: 1234567890
        }
      });

      expect(response.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '99',
        'X-RateLimit-Reset': '1234567890'
      });
    });

    it('should apply CORS headers to response', () => {
      const baseResponse: APIGatewayProxyResult = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: '{"message": "test"}'
      };

      // Mock CORS service
      const mockCorsService = {
        getCorsHeaders: jest.fn().mockReturnValue({
          'Access-Control-Allow-Origin': 'https://example.com',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
        })
      };
      
      (middleware as any).corsService = mockCorsService;

      const response = middleware.applyCorsHeaders(baseResponse, 'https://example.com');

      expect(response.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://example.com',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
      });
    });
  });
});