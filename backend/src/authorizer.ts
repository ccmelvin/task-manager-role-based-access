import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getUserRoles, resolveUserRole } from './auth/role-hierarchy';
import { ErrorContext, ErrorLogger, SecureErrorHandler } from './error-handling';
import { CognitoConfig, getSecretsManager } from './secrets';

let verifier: any = null;
let cognitoConfig: CognitoConfig | null = null;
let accountSecurityService: AccountSecurityService | null = null;

/**
 * Initialize Cognito JWT verifier and account security service with secrets
 */
async function initializeVerifier(): Promise<void> {
  if (verifier && cognitoConfig && accountSecurityService) {
    return; // Already initialized
  }

  const secretArn = process.env.COGNITO_SECRET_ARN;
  if (!secretArn) {
    throw new Error('COGNITO_SECRET_ARN environment variable is required');
  }

  const secretsManager = getSecretsManager();
  cognitoConfig = await secretsManager.getCognitoConfig(secretArn);

  verifier = CognitoJwtVerifier.create({
    userPoolId: cognitoConfig.userPoolId,
    tokenUse: 'access',
    clientId: null,
  });

  // Initialize account security service
  accountSecurityService = new AccountSecurityService();
}

interface AuthorizationLog {
  eventId: string;
  userId: string;
  email: string;
  groups: string[];
  effectiveRole: string;
  allRoles: string[];
  result: 'SUCCESS' | 'FAILURE';
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  error?: string;
}

export const handler = async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  const eventId = uuidv4();
  const timestamp = new Date().toISOString();
  const ipAddress = event.requestContext?.identity?.sourceIp;
  const userAgent = event.headers?.['User-Agent'];

  // Create error context for secure error handling
  const errorContext: ErrorContext = SecureErrorHandler.createErrorContext(
    eventId,
    undefined, // userId not known yet
    ipAddress,
    userAgent,
    event.resource,
    event.httpMethod
  );

  try {
    // Initialize verifier with secrets
    await initializeVerifier();
    // Extract and validate token
    const token = event.headers?.Authorization?.replace('Bearer ', '') || 
                  event.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      const detailedError = SecureErrorHandler.createDetailedError(
        'AUTH_MISSING_TOKEN',
        'No authorization token provided in request headers',
        errorContext,
        undefined,
        { 
          headers: Object.keys(event.headers || {}),
          resource: event.resource,
          method: event.httpMethod
        }
      );

      ErrorLogger.logError(detailedError);
      
      await logAuthorizationEvent({
        eventId,
        userId: 'unknown',
        email: 'unknown',
        groups: [],
        effectiveRole: 'none',
        allRoles: [],
        result: 'FAILURE',
        timestamp,
        ipAddress,
        userAgent,
        error: 'No token provided',
      });
      
      throw new Error('Unauthorized');
    }

    let payload;
    let userId: string;
    let email: string;
    
    try {
      // Verify JWT token
      payload = await verifier.verify(token);
      userId = payload.sub as string;
      email = payload.email as string;
      
      // Update error context with user information
      errorContext.userId = userId;

      // Check if account is locked before proceeding
      if (accountSecurityService) {
        const isLocked = await accountSecurityService.isAccountLocked(userId);
        if (isLocked) {
          // Record failed login attempt due to account lockout
          await accountSecurityService.recordSecurityEvent({
            userId,
            eventType: 'FAILED_LOGIN',
            ipAddress: ipAddress || 'unknown',
            userAgent: userAgent || 'unknown',
            timestamp,
            details: { reason: 'account_locked' }
          });

          const detailedError = SecureErrorHandler.createDetailedError(
            'AUTH_ACCOUNT_LOCKED',
            'Account is temporarily locked due to security policy',
            errorContext,
            undefined,
            { 
              userId,
              email,
              lockoutReason: 'Too many failed login attempts'
            }
          );

          ErrorLogger.logSecurityEvent(detailedError, 'Account lockout access attempt');
          
          await logAuthorizationEvent({
            eventId,
            userId,
            email,
            groups: [],
            effectiveRole: 'none',
            allRoles: [],
            result: 'FAILURE',
            timestamp,
            ipAddress,
            userAgent,
            error: 'Account locked',
          });
          
          throw new Error('Unauthorized');
        }

        // Detect suspicious activity
        const suspiciousScore = await accountSecurityService.detectSuspiciousActivity(
          userId,
          ipAddress || 'unknown',
          userAgent || 'unknown'
        );

        // If suspicious activity detected, record it but don't block (yet)
        if (suspiciousScore > 5) {
          await accountSecurityService.recordSecurityEvent({
            userId,
            eventType: 'SUSPICIOUS_ACTIVITY',
            ipAddress: ipAddress || 'unknown',
            userAgent: userAgent || 'unknown',
            timestamp,
            details: { score: suspiciousScore }
          });

          ErrorLogger.logWarning(
            'Suspicious activity detected during authentication',
            errorContext,
            { 
              userId,
              email,
              suspiciousScore,
              ipAddress,
              userAgent
            }
          );
        }
      }
      
    } catch (tokenError) {
      const detailedError = SecureErrorHandler.createDetailedError(
        'AUTH_INVALID_TOKEN',
        `Token verification failed: ${(tokenError as Error).message}`,
        errorContext,
        tokenError as Error,
        { 
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 10) + '...',
          verificationError: (tokenError as Error).name
        }
      );

      ErrorLogger.logError(detailedError);

      // Try to extract userId from token payload for security event recording
      // (even if token is invalid, we might be able to get the user ID)
      let failedUserId = 'unknown';
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payloadBase64 = tokenParts[1];
          const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
          const tokenPayload = JSON.parse(payloadJson);
          failedUserId = tokenPayload.sub || 'unknown';
        }
      } catch {
        // Ignore errors in token parsing for security event logging
      }

      // Record failed login attempt if we have account security service
      if (accountSecurityService && failedUserId !== 'unknown') {
        try {
          await accountSecurityService.recordSecurityEvent({
            userId: failedUserId,
            eventType: 'FAILED_LOGIN',
            ipAddress: ipAddress || 'unknown',
            userAgent: userAgent || 'unknown',
            timestamp,
            details: { 
              reason: 'invalid_token',
              tokenError: (tokenError as Error).name
            }
          });
        } catch (securityError) {
          // Don't let security event recording failure affect the main flow
          ErrorLogger.logWarning(
            'Failed to record security event for invalid token',
            errorContext,
            { securityError: (securityError as Error).message }
          );
        }
      }
      
      await logAuthorizationEvent({
        eventId,
        userId: failedUserId,
        email: 'unknown',
        groups: [],
        effectiveRole: 'none',
        allRoles: [],
        result: 'FAILURE',
        timestamp,
        ipAddress,
        userAgent,
        error: 'Invalid token',
      });
      
      throw new Error('Unauthorized');
    }

    const groups = payload['cognito:groups'] || [];

    // Handle malformed or missing group information
    let processedGroups: string[] = [];
    try {
      if (Array.isArray(groups)) {
        processedGroups = groups.filter(group => typeof group === 'string');
      } else if (typeof groups === 'string') {
        processedGroups = [groups];
      }
    } catch (groupError) {
      const detailedError = SecureErrorHandler.createDetailedError(
        'AUTHZ_ROLE_VALIDATION_FAILED',
        `Error processing user groups: ${(groupError as Error).message}`,
        errorContext,
        groupError as Error,
        { 
          userId,
          email,
          rawGroups: groups,
          groupsType: typeof groups
        }
      );

      ErrorLogger.logError(detailedError);
      
      // Continue with empty groups array rather than failing
      processedGroups = [];
      
      ErrorLogger.logWarning(
        'User groups processing failed, continuing with empty groups',
        errorContext,
        { userId, email, rawGroups: groups }
      );
    }

    // Resolve user roles using role hierarchy logic
    const effectiveRole = resolveUserRole(processedGroups);
    const allUserRoles = getUserRoles(processedGroups);

    // Record successful login event for security tracking
    if (accountSecurityService) {
      await accountSecurityService.recordSecurityEvent({
        userId,
        eventType: 'SUCCESSFUL_LOGIN',
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        timestamp,
        details: { 
          effectiveRole,
          groups: processedGroups,
          authEventId: eventId
        }
      });
    }

    // Log successful authorization
    ErrorLogger.logInfo(
      'User authorization successful',
      errorContext,
      { 
        userId,
        email,
        effectiveRole,
        groupCount: processedGroups.length,
        roleCount: allUserRoles.length
      }
    );

    await logAuthorizationEvent({
      eventId,
      userId,
      email,
      groups: processedGroups,
      effectiveRole,
      allRoles: allUserRoles,
      result: 'SUCCESS',
      timestamp,
      ipAddress,
      userAgent,
    });

    return {
      principalId: userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn,
        }],
      },
      context: {
        userId,
        email,
        role: effectiveRole,
        allRoles: JSON.stringify(allUserRoles),
        groups: JSON.stringify(processedGroups),
        authEventId: eventId,
      },
    };
  } catch (error) {
    // Handle any unexpected errors with secure error handling
    const { detailedError } = SecureErrorHandler.handleUnknownError(
      error as Error,
      errorContext,
      { 
        authEventId: eventId,
        resource: event.resource,
        method: event.httpMethod
      }
    );

    ErrorLogger.logError(detailedError);

    // Log authorization failure (legacy format for backward compatibility)
    await logAuthorizationEvent({
      eventId,
      userId: errorContext.userId || 'unknown',
      email: 'unknown',
      groups: [],
      effectiveRole: 'none',
      allRoles: [],
      result: 'FAILURE',
      timestamp,
      ipAddress,
      userAgent,
      error: 'Authorization failed',
    });

    // Always throw generic error to prevent information disclosure
    throw new Error('Unauthorized');
  }
};

/**
 * Logs authorization decisions for audit trails
 * This function is kept for backward compatibility but now uses the new ErrorLogger
 */
async function logAuthorizationEvent(logData: AuthorizationLog): Promise<void> {
  const errorContext: ErrorContext = {
    requestId: logData.eventId,
    userId: logData.userId !== 'unknown' ? logData.userId : undefined,
    ipAddress: logData.ipAddress,
    userAgent: logData.userAgent,
    timestamp: logData.timestamp
  };

  if (logData.result === 'SUCCESS') {
    // Log successful authorization as info
    ErrorLogger.logInfo(
      'User authorization completed successfully',
      errorContext,
      {
        email: logData.email,
        groups: logData.groups,
        effectiveRole: logData.effectiveRole,
        allRoles: logData.allRoles
      }
    );
  } else {
    // Log failed authorization as security event
    const detailedError = SecureErrorHandler.createDetailedError(
      'AUTH_INVALID_CREDENTIALS',
      `Authorization failed: ${logData.error || 'Unknown error'}`,
      errorContext,
      undefined,
      {
        email: logData.email,
        groups: logData.groups,
        effectiveRole: logData.effectiveRole,
        allRoles: logData.allRoles,
        failureReason: logData.error
      }
    );

    ErrorLogger.logSecurityEvent(detailedError, 'Access denied');
  }

  // Keep legacy log format for backward compatibility with existing monitoring
  const legacyLogEntry = {
    timestamp: logData.timestamp,
    level: 'SECURITY',
    eventType: 'AUTH',
    eventId: logData.eventId,
    userId: logData.userId,
    email: logData.email,
    result: logData.result,
    details: {
      groups: logData.groups,
      effectiveRole: logData.effectiveRole,
      allRoles: logData.allRoles,
      ipAddress: logData.ipAddress,
      userAgent: logData.userAgent,
      error: logData.error,
    },
    severity: logData.result === 'FAILURE' ? 'HIGH' : 'LOW',
  };

  console.log(JSON.stringify(legacyLogEntry));
}