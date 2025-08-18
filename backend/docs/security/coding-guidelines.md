# Security Best Practices and Coding Guidelines

## Overview

This document provides comprehensive security best practices and coding guidelines for the Task Management System. These guidelines ensure consistent security implementation across all components and help prevent common security vulnerabilities.

## General Security Principles

### 1. Defense in Depth

- Implement multiple layers of security controls
- Never rely on a single security mechanism
- Validate security at every layer of the application

### 2. Principle of Least Privilege

- Grant minimum necessary permissions
- Regularly review and audit access rights
- Implement role-based access control (RBAC)

### 3. Fail Securely

- Default to secure configurations
- Handle errors without exposing sensitive information
- Implement secure fallback mechanisms

### 4. Security by Design

- Consider security from the beginning of development
- Integrate security into the development lifecycle
- Conduct security reviews for all changes

## Authentication and Authorization

### 1. Authentication Best Practices

#### Password Security

```typescript
// ✅ Good: Strong password validation
const validatePassword = (password: string): ValidationResult => {
  const requirements = {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
  };

  const errors: string[] = [];

  if (password.length < requirements.minLength) {
    errors.push(
      `Password must be at least ${requirements.minLength} characters`
    );
  }

  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain uppercase letters");
  }

  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain lowercase letters");
  }

  if (requirements.requireNumbers && !/\d/.test(password)) {
    errors.push("Password must contain numbers");
  }

  if (
    requirements.requireSpecialChars &&
    !/[!@#$%^&*(),.?":{}|<>]/.test(password)
  ) {
    errors.push("Password must contain special characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ❌ Bad: Weak password validation
const weakPasswordCheck = (password: string): boolean => {
  return password.length >= 6; // Too weak!
};
```

#### Token Handling

```typescript
// ✅ Good: Secure JWT token validation
import jwt from "jsonwebtoken";
import { SecretsManager } from "aws-sdk";

const validateJWTToken = async (
  token: string
): Promise<DecodedToken | null> => {
  try {
    const secretsManager = new SecretsManager();
    const secret = await secretsManager
      .getSecretValue({
        SecretId: "taskmanager/jwt/secret",
      })
      .promise();

    const decoded = jwt.verify(token, secret.SecretString!) as DecodedToken;

    // Validate token expiration
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      throw new Error("Token expired");
    }

    // Validate issuer
    if (decoded.iss !== "taskmanager-api") {
      throw new Error("Invalid token issuer");
    }

    return decoded;
  } catch (error) {
    // Log security event without exposing details
    logger.warn("Token validation failed", {
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
};

// ❌ Bad: Insecure token handling
const badTokenValidation = (token: string): any => {
  return jwt.decode(token); // No verification!
};
```

### 2. Authorization Best Practices

#### Role-Based Access Control

```typescript
// ✅ Good: Comprehensive authorization check
interface AuthorizationContext {
  userId: string;
  roles: UserRole[];
  resource: string;
  action: string;
  resourceOwner?: string;
}

const authorizeAction = async (
  context: AuthorizationContext
): Promise<boolean> => {
  try {
    // Check if user has required role
    const hasRequiredRole = await checkRolePermissions(
      context.roles,
      context.resource,
      context.action
    );

    if (!hasRequiredRole) {
      await logSecurityEvent({
        type: "AUTHORIZATION_DENIED",
        userId: context.userId,
        resource: context.resource,
        action: context.action,
        reason: "INSUFFICIENT_ROLE",
      });
      return false;
    }

    // Check resource ownership for user-specific resources
    if (context.resourceOwner && context.resourceOwner !== context.userId) {
      const canAccessOthersResources = context.roles.includes(UserRole.ADMIN);
      if (!canAccessOthersResources) {
        await logSecurityEvent({
          type: "AUTHORIZATION_DENIED",
          userId: context.userId,
          resource: context.resource,
          action: context.action,
          reason: "RESOURCE_OWNERSHIP",
        });
        return false;
      }
    }

    await logSecurityEvent({
      type: "AUTHORIZATION_GRANTED",
      userId: context.userId,
      resource: context.resource,
      action: context.action,
    });

    return true;
  } catch (error) {
    logger.error("Authorization check failed", {
      error: error.message,
      context,
    });
    return false; // Fail securely
  }
};

// ❌ Bad: Simple role check without logging
const badAuthorization = (userRole: string, requiredRole: string): boolean => {
  return userRole === requiredRole; // Too simplistic!
};
```

## Input Validation and Sanitization

### 1. Input Validation

#### Schema-Based Validation

```typescript
// ✅ Good: Comprehensive input validation
import Joi from "joi";

const taskCreationSchema = Joi.object({
  title: Joi.string()
    .min(1)
    .max(200)
    .pattern(/^[a-zA-Z0-9\s\-_.,!?]+$/) // Allow safe characters only
    .required()
    .messages({
      "string.pattern.base": "Title contains invalid characters",
      "string.max": "Title must not exceed 200 characters",
    }),

  description: Joi.string()
    .max(2000)
    .pattern(/^[a-zA-Z0-9\s\-_.,!?\n\r]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Description contains invalid characters",
      "string.max": "Description must not exceed 2000 characters",
    }),

  dueDate: Joi.date().iso().min("now").max("2030-12-31").optional().messages({
    "date.min": "Due date cannot be in the past",
    "date.max": "Due date is too far in the future",
  }),

  priority: Joi.string().valid("LOW", "MEDIUM", "HIGH", "CRITICAL").required(),

  tags: Joi.array()
    .items(Joi.string().pattern(/^[a-zA-Z0-9\-_]+$/))
    .max(10)
    .optional(),
});

const validateTaskInput = (input: any): ValidationResult => {
  const { error, value } = taskCreationSchema.validate(input, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const validationErrors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return {
      isValid: false,
      errors: validationErrors,
      sanitizedData: null,
    };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedData: value,
  };
};

// ❌ Bad: No input validation
const createTaskWithoutValidation = (input: any) => {
  // Direct use of user input - dangerous!
  return {
    title: input.title,
    description: input.description,
  };
};
```

#### Custom Validation Functions

```typescript
// ✅ Good: Custom validation with security focus
const validateEmail = (email: string): boolean => {
  // Use strict email validation
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return false;
  }

  // Additional security checks
  if (email.length > 254) {
    // RFC 5321 limit
    return false;
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /<script/i,
    /on\w+=/i,
  ];

  return !suspiciousPatterns.some((pattern) => pattern.test(email));
};

const validateUserId = (userId: string): boolean => {
  // UUID v4 format validation
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
};
```

### 2. Input Sanitization

#### Text Sanitization

```typescript
// ✅ Good: Comprehensive text sanitization
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const purify = DOMPurify(window);

const sanitizeText = (input: string): string => {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  // Remove potentially dangerous patterns
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
  ];

  dangerousPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "");
  });

  return sanitized;
};

const sanitizeHtml = (input: string): string => {
  const config = {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
  };

  return purify.sanitize(input, config);
};

// ❌ Bad: No sanitization
const unsafeSanitization = (input: string): string => {
  return input; // Dangerous!
};
```

## Error Handling and Logging

### 1. Secure Error Handling

#### Error Response Patterns

```typescript
// ✅ Good: Secure error handling
interface SecureErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
  };
}

interface DetailedError {
  code: string;
  message: string;
  details: string;
  stack?: string;
  context: Record<string, any>;
}

const handleError = async (
  error: Error,
  context: RequestContext
): Promise<SecureErrorResponse> => {
  const requestId = context.requestId;
  const timestamp = new Date().toISOString();

  // Log detailed error server-side
  const detailedError: DetailedError = {
    code: error.name,
    message: error.message,
    details: error.stack || "",
    context: {
      userId: context.userId,
      endpoint: context.endpoint,
      method: context.method,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    },
  };

  await logSecurityEvent({
    type: "ERROR",
    severity: "HIGH",
    details: detailedError,
    requestId,
    timestamp,
  });

  // Return sanitized error to client
  const clientError: SecureErrorResponse = {
    error: {
      code: getPublicErrorCode(error),
      message: getPublicErrorMessage(error),
      timestamp,
      requestId,
    },
  };

  return clientError;
};

const getPublicErrorCode = (error: Error): string => {
  const errorCodeMap: Record<string, string> = {
    ValidationError: "VALIDATION_FAILED",
    UnauthorizedError: "UNAUTHORIZED",
    ForbiddenError: "FORBIDDEN",
    NotFoundError: "NOT_FOUND",
    ConflictError: "CONFLICT",
  };

  return errorCodeMap[error.name] || "INTERNAL_ERROR";
};

const getPublicErrorMessage = (error: Error): string => {
  const publicMessages: Record<string, string> = {
    ValidationError: "The provided data is invalid",
    UnauthorizedError: "Authentication required",
    ForbiddenError: "Access denied",
    NotFoundError: "Resource not found",
    ConflictError: "Resource conflict",
  };

  return publicMessages[error.name] || "An internal error occurred";
};

// ❌ Bad: Exposing internal details
const badErrorHandling = (error: Error) => {
  return {
    error: error.message, // Might expose sensitive info!
    stack: error.stack, // Definitely exposes internal details!
  };
};
```

### 2. Security Logging

#### Structured Security Logging

```typescript
// ✅ Good: Comprehensive security logging
interface SecurityEvent {
  eventId: string;
  timestamp: string;
  eventType: "AUTH" | "AUTHZ" | "DATA_ACCESS" | "SECURITY_VIOLATION" | "ERROR";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  action: string;
  resource?: string;
  result: "SUCCESS" | "FAILURE" | "BLOCKED";
  details: Record<string, any>;
  requestId: string;
}

const logSecurityEvent = async (
  event: Partial<SecurityEvent>
): Promise<void> => {
  const securityEvent: SecurityEvent = {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    eventType: event.eventType || "ERROR",
    severity: event.severity || "MEDIUM",
    userId: event.userId,
    sessionId: event.sessionId,
    ipAddress: event.ipAddress || "unknown",
    userAgent: event.userAgent || "unknown",
    action: event.action || "unknown",
    resource: event.resource,
    result: event.result || "FAILURE",
    details: sanitizeLogDetails(event.details || {}),
    requestId: event.requestId || generateRequestId(),
  };

  // Log to CloudWatch
  await cloudWatchLogger.log({
    logGroupName: "/taskmanager/security",
    logStreamName: `security-events-${new Date().toISOString().split("T")[0]}`,
    message: JSON.stringify(securityEvent),
  });

  // Trigger alerts for high-severity events
  if (
    securityEvent.severity === "HIGH" ||
    securityEvent.severity === "CRITICAL"
  ) {
    await triggerSecurityAlert(securityEvent);
  }
};

const sanitizeLogDetails = (
  details: Record<string, any>
): Record<string, any> => {
  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "key",
    "ssn",
    "creditCard",
  ];
  const sanitized = { ...details };

  Object.keys(sanitized).forEach((key) => {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = "[REDACTED]";
    }
  });

  return sanitized;
};

// ❌ Bad: Logging sensitive information
const badLogging = (user: any, password: string) => {
  console.log("User login attempt", { user, password }); // Exposes password!
};
```

## Database Security

### 1. Query Security

#### Parameterized Queries

```typescript
// ✅ Good: Secure DynamoDB queries
import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const secureQueryTasks = async (
  userId: string,
  status?: string
): Promise<Task[]> => {
  try {
    // Validate input parameters
    if (!validateUserId(userId)) {
      throw new ValidationError("Invalid user ID format");
    }

    if (status && !["PENDING", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      throw new ValidationError("Invalid status value");
    }

    const client = new DynamoDBClient({ region: "us-east-1" });

    // Use parameterized query
    const queryParams = {
      TableName: "TaskManagerTable",
      IndexName: "UserIdIndex",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: marshall({
        ":userId": userId,
        ...(status && { ":status": status }),
      }),
      ...(status && {
        FilterExpression: "#status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
      }),
    };

    const command = new QueryCommand(queryParams);
    const result = await client.send(command);

    // Log data access
    await logSecurityEvent({
      eventType: "DATA_ACCESS",
      userId,
      action: "QUERY_TASKS",
      resource: "tasks",
      result: "SUCCESS",
      details: {
        recordCount: result.Items?.length || 0,
        hasFilter: !!status,
      },
    });

    return result.Items?.map((item) => unmarshall(item) as Task) || [];
  } catch (error) {
    await logSecurityEvent({
      eventType: "DATA_ACCESS",
      userId,
      action: "QUERY_TASKS",
      resource: "tasks",
      result: "FAILURE",
      details: { error: error.message },
    });
    throw error;
  }
};

// ❌ Bad: Unsafe query construction
const unsafeQuery = async (userId: string, filter: string) => {
  // This is conceptually what NOT to do (DynamoDB doesn't have SQL injection,
  // but the principle applies to input validation)
  const query = `SELECT * FROM tasks WHERE userId = ${userId} AND ${filter}`;
  // Never construct queries with string concatenation!
};
```

### 2. Data Encryption

#### Encryption at Rest and in Transit

```typescript
// ✅ Good: Proper encryption handling
import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";

const encryptSensitiveData = async (
  data: string,
  keyId: string
): Promise<string> => {
  try {
    const client = new KMSClient({ region: "us-east-1" });

    const command = new EncryptCommand({
      KeyId: keyId,
      Plaintext: Buffer.from(data, "utf-8"),
    });

    const result = await client.send(command);
    return Buffer.from(result.CiphertextBlob!).toString("base64");
  } catch (error) {
    logger.error("Encryption failed", { error: error.message });
    throw new Error("Data encryption failed");
  }
};

const decryptSensitiveData = async (encryptedData: string): Promise<string> => {
  try {
    const client = new KMSClient({ region: "us-east-1" });

    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedData, "base64"),
    });

    const result = await client.send(command);
    return Buffer.from(result.Plaintext!).toString("utf-8");
  } catch (error) {
    logger.error("Decryption failed", { error: error.message });
    throw new Error("Data decryption failed");
  }
};

// ❌ Bad: Storing sensitive data in plain text
const storeSensitiveData = (data: string) => {
  return data; // No encryption!
};
```

## API Security

### 1. Rate Limiting

#### Request Rate Limiting

```typescript
// ✅ Good: Comprehensive rate limiting
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: (req: Request) => string;
}

const createRateLimiter = (config: RateLimitConfig) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return async (req: Request): Promise<boolean> => {
    const key = config.keyGenerator(req);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean up old entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < windowStart) {
        requests.delete(k);
      }
    }

    const current = requests.get(key) || {
      count: 0,
      resetTime: now + config.windowMs,
    };

    if (current.resetTime < now) {
      current.count = 0;
      current.resetTime = now + config.windowMs;
    }

    current.count++;
    requests.set(key, current);

    if (current.count > config.maxRequests) {
      await logSecurityEvent({
        eventType: "SECURITY_VIOLATION",
        severity: "MEDIUM",
        action: "RATE_LIMIT_EXCEEDED",
        details: {
          key,
          count: current.count,
          limit: config.maxRequests,
        },
      });
      return false;
    }

    return true;
  };
};

// Rate limiting configurations
const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per window
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => req.ip + ":auth",
});

const apiRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  keyGenerator: (req) => req.userId || req.ip,
});
```

### 2. CORS Security

#### Secure CORS Configuration

```typescript
// ✅ Good: Environment-specific CORS
interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number;
}

const getCorsConfig = (environment: string): CorsConfig => {
  const configs: Record<string, CorsConfig> = {
    development: {
      allowedOrigins: ["http://localhost:3000", "http://localhost:3001"],
      allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      allowCredentials: true,
      maxAge: 86400,
    },
    production: {
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [],
      allowedMethods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      allowCredentials: true,
      maxAge: 86400,
    },
  };

  return configs[environment] || configs.production;
};

const validateOrigin = (origin: string, allowedOrigins: string[]): boolean => {
  if (!origin) return false;

  // Exact match check
  if (allowedOrigins.includes(origin)) return true;

  // Pattern matching for subdomains (be very careful with this)
  const allowedPatterns = allowedOrigins.filter((o) => o.startsWith("*."));
  for (const pattern of allowedPatterns) {
    const domain = pattern.substring(2);
    if (origin.endsWith(`.${domain}`) || origin === domain) {
      return true;
    }
  }

  return false;
};

// ❌ Bad: Permissive CORS
const badCorsConfig = {
  allowedOrigins: ["*"], // Too permissive!
  allowCredentials: true, // Dangerous with wildcard origins!
};
```

## Frontend Security

### 1. XSS Prevention

#### Content Security Policy

```typescript
// ✅ Good: Strict CSP configuration
const generateCSPHeader = (nonce: string): string => {
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'", // Only for CSS-in-JS libraries
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.yourdomain.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];

  return cspDirectives.join("; ");
};

// React component with XSS protection
const SecureComponent: React.FC<{ userContent: string }> = ({
  userContent,
}) => {
  // ✅ Good: Sanitize user content
  const sanitizedContent = useMemo(() => {
    return DOMPurify.sanitize(userContent, {
      ALLOWED_TAGS: ["b", "i", "em", "strong"],
      ALLOWED_ATTR: [],
    });
  }, [userContent]);

  return <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
};

// ❌ Bad: Direct HTML injection
const UnsafeComponent: React.FC<{ userContent: string }> = ({
  userContent,
}) => {
  return (
    <div dangerouslySetInnerHTML={{ __html: userContent }} /> // XSS vulnerability!
  );
};
```

### 2. CSRF Protection

#### CSRF Token Implementation

```typescript
// ✅ Good: CSRF token validation
import crypto from "crypto";

const generateCSRFToken = (sessionId: string): string => {
  const secret = process.env.CSRF_SECRET || "default-secret";
  const timestamp = Date.now().toString();
  const data = `${sessionId}:${timestamp}`;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  const signature = hmac.digest("hex");

  return `${timestamp}:${signature}`;
};

const validateCSRFToken = (token: string, sessionId: string): boolean => {
  try {
    const [timestamp, signature] = token.split(":");
    const tokenAge = Date.now() - parseInt(timestamp);

    // Token expires after 1 hour
    if (tokenAge > 3600000) {
      return false;
    }

    const secret = process.env.CSRF_SECRET || "default-secret";
    const data = `${sessionId}:${timestamp}`;

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(data);
    const expectedSignature = hmac.digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    return false;
  }
};

// React hook for CSRF protection
const useCSRFProtection = () => {
  const [csrfToken, setCSRFToken] = useState<string>("");

  useEffect(() => {
    const fetchCSRFToken = async () => {
      try {
        const response = await fetch("/api/csrf-token", {
          credentials: "include",
        });
        const { token } = await response.json();
        setCSRFToken(token);
      } catch (error) {
        console.error("Failed to fetch CSRF token:", error);
      }
    };

    fetchCSRFToken();
  }, []);

  const makeSecureRequest = useCallback(
    async (url: string, options: RequestInit = {}) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          "X-CSRF-Token": csrfToken,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
    },
    [csrfToken]
  );

  return { csrfToken, makeSecureRequest };
};
```

## Infrastructure Security

### 1. Environment Configuration

#### Secure Environment Variables

```typescript
// ✅ Good: Secure configuration management
interface SecurityConfig {
  jwtSecret: string;
  encryptionKey: string;
  databaseUrl: string;
  corsOrigins: string[];
}

const loadSecurityConfig = async (): Promise<SecurityConfig> => {
  const secretsManager = new SecretsManager();

  try {
    // Load from AWS Secrets Manager
    const secrets = await secretsManager
      .getSecretValue({
        SecretId: "taskmanager/security/config",
      })
      .promise();

    const config = JSON.parse(secrets.SecretString!);

    // Validate required configuration
    const requiredKeys = ["jwtSecret", "encryptionKey", "databaseUrl"];
    for (const key of requiredKeys) {
      if (!config[key]) {
        throw new Error(`Missing required configuration: ${key}`);
      }
    }

    return {
      jwtSecret: config.jwtSecret,
      encryptionKey: config.encryptionKey,
      databaseUrl: config.databaseUrl,
      corsOrigins: config.corsOrigins || [],
    };
  } catch (error) {
    logger.error("Failed to load security configuration", {
      error: error.message,
    });
    throw new Error("Security configuration unavailable");
  }
};

// ❌ Bad: Hardcoded secrets
const badConfig = {
  jwtSecret: "hardcoded-secret", // Never do this!
  databasePassword: "password123", // Extremely dangerous!
};
```

### 2. IAM Security

#### Least Privilege IAM Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:region:account:table/TaskManagerTable",
        "arn:aws:dynamodb:region:account:table/TaskManagerTable/index/*"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "userId",
            "taskId",
            "title",
            "description",
            "status",
            "createdAt",
            "updatedAt"
          ]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": ["arn:aws:secretsmanager:region:account:secret:taskmanager/*"]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:region:account:log-group:/aws/lambda/taskmanager-*"
      ]
    }
  ]
}
```

## Security Testing

### 1. Unit Testing Security Functions

#### Security Test Examples

```typescript
// ✅ Good: Comprehensive security testing
describe("Security Functions", () => {
  describe("Input Validation", () => {
    it("should reject malicious input", () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        "../../etc/passwd",
        "DROP TABLE users;",
        "\x00\x01\x02",
      ];

      maliciousInputs.forEach((input) => {
        const result = validateTaskInput({ title: input });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Title contains invalid characters");
      });
    });

    it("should sanitize valid input", () => {
      const input = {
        title: "  Test Task  ",
        description: "This is a test\n\nwith multiple lines",
      };

      const result = validateTaskInput(input);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.title).toBe("Test Task");
    });
  });

  describe("Authorization", () => {
    it("should deny access without proper role", async () => {
      const context = {
        userId: "user-123",
        roles: [UserRole.VIEWER],
        resource: "tasks",
        action: "DELETE",
      };

      const result = await authorizeAction(context);
      expect(result).toBe(false);
    });

    it("should allow access with proper role", async () => {
      const context = {
        userId: "user-123",
        roles: [UserRole.ADMIN],
        resource: "tasks",
        action: "DELETE",
      };

      const result = await authorizeAction(context);
      expect(result).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should not expose sensitive information in errors", async () => {
      const error = new Error("Database connection failed: password=secret123");
      const context = { requestId: "req-123", userId: "user-123" };

      const result = await handleError(error, context);

      expect(result.error.message).not.toContain("password");
      expect(result.error.message).not.toContain("secret123");
      expect(result.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
```

### 2. Integration Testing

#### Security Integration Tests

```typescript
// ✅ Good: Security integration testing
describe("Security Integration Tests", () => {
  describe("Authentication Flow", () => {
    it("should prevent brute force attacks", async () => {
      const invalidCredentials = {
        username: "test@example.com",
        password: "wrongpassword",
      };

      // Attempt multiple failed logins
      const attempts = Array(6)
        .fill(null)
        .map(() => request(app).post("/auth/login").send(invalidCredentials));

      const responses = await Promise.all(attempts);

      // First 5 should return 401, 6th should return 429 (rate limited)
      responses.slice(0, 5).forEach((response) => {
        expect(response.status).toBe(401);
      });

      expect(responses[5].status).toBe(429);
    });
  });

  describe("CORS Protection", () => {
    it("should reject requests from unauthorized origins", async () => {
      const response = await request(app)
        .get("/api/tasks")
        .set("Origin", "https://malicious-site.com")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(403);
    });

    it("should allow requests from authorized origins", async () => {
      const response = await request(app)
        .get("/api/tasks")
        .set("Origin", "https://yourdomain.com")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
    });
  });
});
```

## Code Review Security Checklist

### Security Review Checklist

```markdown
## Security Code Review Checklist

### Authentication & Authorization

- [ ] All endpoints require proper authentication
- [ ] Authorization checks are performed before data access
- [ ] Role-based access control is properly implemented
- [ ] JWT tokens are properly validated
- [ ] Session management is secure

### Input Validation & Sanitization

- [ ] All user inputs are validated against schemas
- [ ] Input sanitization is applied consistently
- [ ] File uploads are properly validated
- [ ] SQL injection prevention (if applicable)
- [ ] XSS prevention measures are in place

### Error Handling & Logging

- [ ] Errors don't expose sensitive information
- [ ] Security events are properly logged
- [ ] Log data is sanitized of sensitive information
- [ ] Error responses are consistent and secure

### Data Protection

- [ ] Sensitive data is encrypted at rest
- [ ] Data transmission uses TLS
- [ ] Database queries use parameterized statements
- [ ] Data access is properly authorized

### Infrastructure Security

- [ ] Environment variables don't contain secrets
- [ ] IAM policies follow least privilege principle
- [ ] Network security groups are properly configured
- [ ] Security headers are implemented

### Frontend Security

- [ ] CSP headers are properly configured
- [ ] CSRF protection is implemented
- [ ] XSS prevention measures are in place
- [ ] Secure cookie settings are used
```

## Security Maintenance

### 1. Regular Security Updates

#### Dependency Management

```bash
# Weekly security audit
npm audit
npm audit fix

# Check for known vulnerabilities
npm install -g retire
retire

# Update dependencies
npm update
npm run test:security
```

### 2. Security Monitoring

#### Continuous Security Monitoring

```typescript
// ✅ Good: Automated security monitoring
const securityMonitoring = {
  // Monitor failed authentication attempts
  monitorFailedLogins: async () => {
    const threshold = 10;
    const timeWindow = 15 * 60 * 1000; // 15 minutes

    const failedLogins = await getFailedLoginCount(timeWindow);

    if (failedLogins > threshold) {
      await triggerSecurityAlert({
        type: "BRUTE_FORCE_ATTACK",
        severity: "HIGH",
        details: { count: failedLogins, timeWindow },
      });
    }
  },

  // Monitor privilege escalation attempts
  monitorPrivilegeEscalation: async () => {
    const suspiciousRoleChanges = await getSuspiciousRoleChanges();

    if (suspiciousRoleChanges.length > 0) {
      await triggerSecurityAlert({
        type: "PRIVILEGE_ESCALATION",
        severity: "CRITICAL",
        details: { changes: suspiciousRoleChanges },
      });
    }
  },
};

// Run monitoring every 5 minutes
setInterval(async () => {
  await securityMonitoring.monitorFailedLogins();
  await securityMonitoring.monitorPrivilegeEscalation();
}, 5 * 60 * 1000);
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-15  
**Next Review**: 2025-02-15  
**Owner**: Security Team  
**Approved By**: Security Architect
