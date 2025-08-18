// Mock uuid first
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

// Mock the CognitoJwtVerifier
const mockVerify = jest.fn();
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn().mockReturnValue({
      verify: mockVerify,
    }),
  },
}));

import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import { handler } from '../authorizer';

// Mock console.log to capture security logs
const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

// Helper function to safely access context
const getContext = (result: APIGatewayAuthorizerResult) => {
  if (!result.context) throw new Error('Context is missing');
  return result.context;
};

describe('Authorizer Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USER_POOL_ID = 'test-user-pool-id';
  });

  afterEach(() => {
    consoleSpy.mockClear();
  });

  const createMockEvent = (token?: string): APIGatewayRequestAuthorizerEvent => ({
    type: 'REQUEST',
    methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/GET/tasks',
    resource: '/tasks',
    path: '/tasks',
    httpMethod: 'GET',
    headers: token ? { Authorization: `Bearer ${token}`, 'User-Agent': 'test-user-agent' } : { 'User-Agent': 'test-user-agent' },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      resourceId: 'resource-id',
      resourcePath: '/tasks',
      httpMethod: 'GET',
      requestId: 'request-id',
      protocol: 'HTTP/1.1',
      path: '/test/tasks',
      stage: 'test',
      requestTimeEpoch: 1234567890,
      requestTime: '01/Jan/1970:00:00:00 +0000',
      authorizer: undefined,
      identity: {
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        sourceIp: '127.0.0.1',
        principalOrgId: null,
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: 'test-user-agent',
        user: null,
        apiKey: null,
        apiKeyId: null,
        clientCert: null,
      },
      accountId: '123456789012',
      apiId: 'abcdef123',
    },
  });

  it('should authorize user with admin role', async () => {
    const mockPayload = {
      sub: 'admin-user-123',
      email: 'admin@example.com',
      'cognito:groups': ['admin'],
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent('valid-token');
    const result = await handler(event);
    const context = getContext(result);

    expect(result.principalId).toBe('admin-user-123');
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(context.userId).toBe('admin-user-123');
    expect(context.email).toBe('admin@example.com');
    expect(context.role).toBe('Admin');
    expect(JSON.parse(context.groups as string)).toEqual(['admin']);
    expect(JSON.parse(context.allRoles as string)).toEqual(['Admin']);

    // Verify security logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"eventType":"AUTH"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"result":"SUCCESS"')
    );
  });

  it('should authorize user with contributor role', async () => {
    const mockPayload = {
      sub: 'contributor-user-123',
      email: 'contributor@example.com',
      'cognito:groups': ['contributor'],
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent('valid-token');
    const result = await handler(event);
    const context = getContext(result);

    expect(context.role).toBe('Contributor');
    expect(JSON.parse(context.allRoles as string)).toEqual(['Contributor']);
  });

  it('should authorize user with viewer role', async () => {
    const mockPayload = {
      sub: 'viewer-user-123',
      email: 'viewer@example.com',
      'cognito:groups': ['viewer'],
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent('valid-token');
    const result = await handler(event);
    const context = getContext(result);

    expect(context.role).toBe('Viewer');
    expect(JSON.parse(context.allRoles as string)).toEqual(['Viewer']);
  });

  it('should handle user with multiple roles and use highest priority', async () => {
    const mockPayload = {
      sub: 'multi-role-user-123',
      email: 'multi@example.com',
      'cognito:groups': ['contributor', 'admin', 'viewer'],
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent('valid-token');
    const result = await handler(event);
    const context = getContext(result);

    expect(context.role).toBe('Admin'); // Highest priority role
    expect(JSON.parse(context.allRoles as string)).toContain('Admin');
    expect(JSON.parse(context.allRoles as string)).toContain('Contributor');
    expect(JSON.parse(context.allRoles as string)).toContain('Viewer');
  });

  it('should default to Viewer role for user with no groups', async () => {
    const mockPayload = {
      sub: 'no-groups-user-123',
      email: 'nogroups@example.com',
      'cognito:groups': [],
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent('valid-token');
    const result = await handler(event);
    const context = getContext(result);

    expect(context.role).toBe('Viewer');
    expect(JSON.parse(context.allRoles as string)).toEqual(['Viewer']);
  });

  it('should handle malformed group information gracefully', async () => {
    const mockPayload = {
      sub: 'malformed-user-123',
      email: 'malformed@example.com',
      'cognito:groups': ['invalid-group', null, undefined, 123],
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent('valid-token');
    const result = await handler(event);
    const context = getContext(result);

    expect(context.role).toBe('Viewer'); // Default role
    expect(JSON.parse(context.groups as string)).toEqual(['invalid-group']); // Only valid strings
  });

  it('should handle missing groups gracefully', async () => {
    const mockPayload = {
      sub: 'no-groups-user-123',
      email: 'nogroups@example.com',
      // No 'cognito:groups' property
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent('valid-token');
    const result = await handler(event);
    const context = getContext(result);

    expect(context.role).toBe('Viewer');
    expect(JSON.parse(context.groups as string)).toEqual([]);
  });

  it('should throw error when no token is provided', async () => {
    const event = createMockEvent(); // No token

    await expect(handler(event)).rejects.toThrow('Unauthorized');

    // Verify failure logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"result":"FAILURE"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"error":"No token provided"')
    );
  });

  it('should throw error when token verification fails', async () => {
    mockVerify.mockRejectedValue(new Error('Invalid token'));

    const event = createMockEvent('invalid-token');

    await expect(handler(event)).rejects.toThrow('Unauthorized');

    // Verify failure logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"result":"FAILURE"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"eventType":"AUTH_FAILURE"')
    );
  });

  it('should handle case-insensitive authorization header', async () => {
    const mockPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      'cognito:groups': ['admin'],
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent();
    event.headers = { authorization: 'Bearer valid-token' }; // lowercase 'authorization'

    const result = await handler(event);
    const context = getContext(result);

    expect(result.principalId).toBe('user-123');
    expect(context.role).toBe('Admin');
  });

  it('should include request context in logs', async () => {
    const mockPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      'cognito:groups': ['admin'],
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent('valid-token');
    await handler(event);

    // Check that IP address and user agent are logged
    const logCalls = consoleSpy.mock.calls.map(call => call[0]);
    const authLog = logCalls.find(log => log.includes('"eventType":"AUTH"'));
    
    expect(authLog).toContain('"ipAddress":"127.0.0.1"');
    expect(authLog).toContain('"userAgent":"test-user-agent"');
  });

  it('should include authEventId in context for request correlation', async () => {
    const mockPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      'cognito:groups': ['admin'],
    };
    mockVerify.mockResolvedValue(mockPayload);

    const event = createMockEvent('valid-token');
    const result = await handler(event);
    const context = getContext(result);

    expect(context.authEventId).toBeDefined();
    expect(typeof context.authEventId).toBe('string');
    expect((context.authEventId as string).length).toBeGreaterThan(0);
  });
});