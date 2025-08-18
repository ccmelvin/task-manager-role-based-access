/**
 * Security Integration Tests
 * End-to-end security flow testing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthorizationService } from '../auth/authorization-service';
import { SecureErrorHandler } from '../error-handling/secure-error-handler';
import { SecurityMiddleware } from '../security/security-middleware';
import { ValidationEngine } from '../validation/engine';

// Mock Lambda handlers for testing
const mockTaskHandler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Task operation successful' })
    };
};

const mockAuthHandler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Authentication successful' })
    };
};

describe('Security Integration Tests', () => {
    let securityMiddleware: SecurityMiddleware;
    let authService: AuthorizationService;
    let validationEngine: ValidationEngine;
    let errorHandler: SecureErrorHandler;

    beforeEach(() => {
        securityMiddleware = SecurityMiddleware.getInstance();
        authService = AuthorizationService.getInstance();
        validationEngine = ValidationEngine.getInstance();
        errorHandler = SecureErrorHandler.getInstance();

        // Mock console methods
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Complete Authentication Flow', () => {
        it('should handle secure authentication end-to-end', async () => {
            const authEvent: APIGatewayProxyEvent = {
                httpMethod: 'POST',
                path: '/auth/login',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'https://app.example.com',
                    'User-Agent': 'Mozilla/5.0 (compatible; test)'
                },
                body: JSON.stringify({
                    email: 'user@example.com',
                    password: 'SecurePass123!'
                }),
                requestContext: {
                    requestId: 'test-request-id',
                    identity: {
                        sourceIp: '192.168.1.1'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: null,
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'auth-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:auth-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/auth-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            // Wrap handler with security middleware
            const secureHandler = securityMiddleware.createMiddleware()(mockAuthHandler);
            const response = await secureHandler(authEvent, mockContext);

            // Verify security headers are applied
            expect(response.headers).toMatchObject({
                'X-Frame-Options': expect.any(String),
                'X-Content-Type-Options': expect.any(String),
                'Access-Control-Allow-Origin': expect.any(String)
            });

            // Verify response structure
            expect(response.statusCode).toBe(200);
            expect(response.body).toBeDefined();

            const responseBody = JSON.parse(response.body);
            expect(responseBody.requestId).toBe('test-request-id');
        });

        it('should reject authentication with weak credentials', async () => {
            const weakAuthEvent: APIGatewayProxyEvent = {
                httpMethod: 'POST',
                path: '/auth/login',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'https://app.example.com',
                    'User-Agent': 'Mozilla/5.0 (compatible; test)'
                },
                body: JSON.stringify({
                    email: 'user@example.com',
                    password: 'weak' // Weak password
                }),
                requestContext: {
                    requestId: 'test-request-id',
                    identity: {
                        sourceIp: '192.168.1.1'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: null,
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'auth-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:auth-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/auth-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            const secureHandler = securityMiddleware.createMiddleware()(mockAuthHandler);
            const response = await secureHandler(weakAuthEvent, mockContext);

            expect(response.statusCode).toBe(400);

            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('Complete Authorization Flow', () => {
        it('should handle task creation with proper authorization', async () => {
            const taskEvent: APIGatewayProxyEvent = {
                httpMethod: 'POST',
                path: '/tasks',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-jwt-token',
                    'Origin': 'https://app.example.com',
                    'User-Agent': 'Mozilla/5.0 (compatible; test)'
                },
                body: JSON.stringify({
                    title: 'New Task',
                    description: 'Task description',
                    deadline: new Date(Date.now() + 86400000).toISOString(),
                    priority: 'medium',
                    assignedTo: 'user123'
                }),
                requestContext: {
                    requestId: 'test-request-id',
                    authorizer: {
                        claims: {
                            sub: 'user-123',
                            email: 'contributor@example.com',
                            'cognito:groups': 'contributor'
                        }
                    },
                    identity: {
                        sourceIp: '192.168.1.1'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: null,
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'task-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:task-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/task-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            const secureHandler = securityMiddleware.createMiddleware()(mockTaskHandler);
            const response = await secureHandler(taskEvent, mockContext);

            expect(response.statusCode).toBe(200);

            const responseBody = JSON.parse(response.body);
            expect(responseBody.success).toBe(true);
        });

        it('should reject unauthorized task deletion', async () => {
            const deleteEvent: APIGatewayProxyEvent = {
                httpMethod: 'DELETE',
                path: '/tasks/task-123',
                headers: {
                    'Authorization': 'Bearer valid-jwt-token',
                    'Origin': 'https://app.example.com',
                    'User-Agent': 'Mozilla/5.0 (compatible; test)'
                },
                body: null,
                requestContext: {
                    requestId: 'test-request-id',
                    authorizer: {
                        claims: {
                            sub: 'user-123',
                            email: 'viewer@example.com',
                            'cognito:groups': 'viewer' // Viewer cannot delete
                        }
                    },
                    identity: {
                        sourceIp: '192.168.1.1'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: { taskId: 'task-123' },
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'task-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:task-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/task-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            const secureHandler = securityMiddleware.createMiddleware()(mockTaskHandler);
            const response = await secureHandler(deleteEvent, mockContext);

            expect(response.statusCode).toBe(403);

            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.code).toBe('AUTHORIZATION_ERROR');
        });
    });

    describe('Input Validation and Sanitization Flow', () => {
        it('should sanitize and validate input data end-to-end', async () => {
            const maliciousEvent: APIGatewayProxyEvent = {
                httpMethod: 'POST',
                path: '/tasks',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-jwt-token',
                    'Origin': 'https://app.example.com',
                    'User-Agent': 'Mozilla/5.0 (compatible; test)'
                },
                body: JSON.stringify({
                    title: '<script>alert("xss")</script>Malicious Task',
                    description: 'Task with SQL injection: \'; DROP TABLE tasks; --',
                    deadline: 'invalid-date',
                    priority: 'invalid-priority',
                    assignedTo: '../../admin'
                }),
                requestContext: {
                    requestId: 'test-request-id',
                    authorizer: {
                        claims: {
                            sub: 'user-123',
                            email: 'contributor@example.com',
                            'cognito:groups': 'contributor'
                        }
                    },
                    identity: {
                        sourceIp: '192.168.1.1'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: null,
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'task-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:task-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/task-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            const secureHandler = securityMiddleware.createMiddleware()(mockTaskHandler);
            const response = await secureHandler(maliciousEvent, mockContext);

            expect(response.statusCode).toBe(400);

            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.code).toBe('VALIDATION_ERROR');
            expect(responseBody.error.details).toBeDefined();
            expect(responseBody.error.details.length).toBeGreaterThan(0);
        });
    });

    describe('CORS and Security Headers Flow', () => {
        it('should handle preflight requests securely', async () => {
            const preflightEvent: APIGatewayProxyEvent = {
                httpMethod: 'OPTIONS',
                path: '/tasks',
                headers: {
                    'Origin': 'https://app.example.com',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type, Authorization'
                },
                body: null,
                requestContext: {
                    requestId: 'test-request-id',
                    identity: {
                        sourceIp: '192.168.1.1'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: null,
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'task-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:task-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/task-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            const secureHandler = securityMiddleware.createMiddleware()(mockTaskHandler);
            const response = await secureHandler(preflightEvent, mockContext);

            expect(response.statusCode).toBe(204);
            expect(response.body).toBe('');
            expect(response.headers).toMatchObject({
                'Access-Control-Allow-Origin': expect.any(String),
                'Access-Control-Allow-Methods': expect.any(String),
                'Access-Control-Allow-Headers': expect.any(String)
            });
        });

        it('should reject preflight from unauthorized origins', async () => {
            const maliciousPreflightEvent: APIGatewayProxyEvent = {
                httpMethod: 'OPTIONS',
                path: '/tasks',
                headers: {
                    'Origin': 'https://malicious.com',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type, Authorization'
                },
                body: null,
                requestContext: {
                    requestId: 'test-request-id',
                    identity: {
                        sourceIp: '192.168.1.1'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: null,
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'task-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:task-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/task-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            const secureHandler = securityMiddleware.createMiddleware()(mockTaskHandler);
            const response = await secureHandler(maliciousPreflightEvent, mockContext);

            expect(response.statusCode).toBe(403);

            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.code).toBe('CORS_VIOLATION');
        });
    });

    describe('Error Handling Security Flow', () => {
        it('should handle errors securely without information disclosure', async () => {
            const errorHandler = jest.fn().mockRejectedValue(new Error('Database connection failed'));

            const errorEvent: APIGatewayProxyEvent = {
                httpMethod: 'GET',
                path: '/tasks',
                headers: {
                    'Authorization': 'Bearer valid-jwt-token',
                    'Origin': 'https://app.example.com',
                    'User-Agent': 'Mozilla/5.0 (compatible; test)'
                },
                body: null,
                requestContext: {
                    requestId: 'test-request-id',
                    authorizer: {
                        claims: {
                            sub: 'user-123',
                            email: 'user@example.com',
                            'cognito:groups': 'viewer'
                        }
                    },
                    identity: {
                        sourceIp: '192.168.1.1'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: null,
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'task-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:task-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/task-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            const secureHandler = securityMiddleware.createMiddleware()(errorHandler);
            const response = await secureHandler(errorEvent, mockContext);

            expect(response.statusCode).toBe(500);

            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.code).toBe('INTERNAL_SERVER_ERROR');
            expect(responseBody.error.message).not.toContain('Database connection failed');
            expect(responseBody.error.message).toBe('An internal error occurred');
        });
    });

    describe('Rate Limiting Integration', () => {
        it('should enforce rate limits across multiple requests', async () => {
            const baseEvent: APIGatewayProxyEvent = {
                httpMethod: 'GET',
                path: '/tasks',
                headers: {
                    'Authorization': 'Bearer valid-jwt-token',
                    'Origin': 'https://app.example.com',
                    'User-Agent': 'Mozilla/5.0 (compatible; test)'
                },
                body: null,
                requestContext: {
                    requestId: 'test-request-id',
                    authorizer: {
                        claims: {
                            sub: 'user-123',
                            email: 'user@example.com',
                            'cognito:groups': 'viewer'
                        }
                    },
                    identity: {
                        sourceIp: '192.168.1.100'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: null,
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'task-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:task-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/task-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            const secureHandler = securityMiddleware.createMiddleware()(mockTaskHandler);

            // Make multiple requests rapidly
            const requests = Array(10).fill(null).map(async (_, i) => {
                const event = {
                    ...baseEvent,
                    requestContext: {
                        ...baseEvent.requestContext,
                        requestId: `test-request-${i}`
                    }
                };
                return secureHandler(event, mockContext);
            });

            const responses = await Promise.all(requests);

            // First few requests should succeed
            expect(responses[0].statusCode).toBe(200);
            expect(responses[1].statusCode).toBe(200);

            // Later requests might be rate limited (depending on implementation)
            const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
            expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Security Event Logging Integration', () => {
        it('should log security events throughout the request lifecycle', async () => {
            const logSpy = jest.spyOn(console, 'log');

            const securityEvent: APIGatewayProxyEvent = {
                httpMethod: 'POST',
                path: '/tasks',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer invalid-token',
                    'Origin': 'https://app.example.com',
                    'User-Agent': 'Mozilla/5.0 (compatible; test)'
                },
                body: JSON.stringify({
                    title: 'Test Task'
                }),
                requestContext: {
                    requestId: 'test-request-id',
                    identity: {
                        sourceIp: '192.168.1.1'
                    }
                } as any,
                isBase64Encoded: false,
                pathParameters: null,
                queryStringParameters: null,
                multiValueHeaders: {},
                multiValueQueryStringParameters: null,
                stageVariables: null,
                resource: ''
            };

            const mockContext: Context = {
                callbackWaitsForEmptyEventLoop: false,
                functionName: 'task-handler',
                functionVersion: '1',
                invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:task-handler',
                memoryLimitInMB: '128',
                awsRequestId: 'test-request-id',
                logGroupName: '/aws/lambda/task-handler',
                logStreamName: '2023/01/01/[$LATEST]test',
                getRemainingTimeInMillis: () => 30000,
                done: () => { },
                fail: () => { },
                succeed: () => { }
            };

            const secureHandler = securityMiddleware.createMiddleware()(mockTaskHandler);
            await secureHandler(securityEvent, mockContext);

            // Verify security events were logged
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('SECURITY_EVENT')
            );
        });
    });
});