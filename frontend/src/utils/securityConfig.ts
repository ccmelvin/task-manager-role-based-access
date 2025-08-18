/**
 * Security Configuration
 * Manages Content Security Policy and other security settings
 */

interface SecurityConfig {
    csp: {
        defaultSrc: string[];
        scriptSrc: string[];
        styleSrc: string[];
        fontSrc: string[];
        imgSrc: string[];
        connectSrc: string[];
        frameAncestors: string[];
        baseUri: string[];
        formAction: string[];
        upgradeInsecureRequests: boolean;
    };
    headers: {
        xContentTypeOptions: string;
        xFrameOptions: string;
        xXssProtection: string;
        referrerPolicy: string;
        permissionsPolicy: Record<string, string[]>;
    };
    session: {
        timeout: number;
        warningTime: number;
        checkInterval: number;
    };
    api: {
        timeout: number;
        retryAttempts: number;
        baseUrl: string;
    };
}

const getSecurityConfig = (): SecurityConfig => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'https://api.example.com';

    return {
        csp: {
            defaultSrc: ["'self'"],
            scriptSrc: isDevelopment
                ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", "localhost:*"]
                : ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: isDevelopment
                ? ["'self'", apiBaseUrl, `wss://${new URL(apiBaseUrl).host}`, "localhost:*", "ws://localhost:*"]
                : ["'self'", apiBaseUrl, `wss://${new URL(apiBaseUrl).host}`],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: !isDevelopment
        },
        headers: {
            xContentTypeOptions: "nosniff",
            xFrameOptions: "DENY",
            xXssProtection: "1; mode=block",
            referrerPolicy: "strict-origin-when-cross-origin",
            permissionsPolicy: {
                camera: [],
                microphone: [],
                geolocation: [],
                payment: [],
                usb: [],
                magnetometer: [],
                gyroscope: [],
                accelerometer: []
            }
        },
        session: {
            timeout: 30 * 60 * 1000, // 30 minutes
            warningTime: 5 * 60 * 1000, // 5 minutes before timeout
            checkInterval: 60 * 1000 // Check every minute
        },
        api: {
            timeout: 30000, // 30 seconds
            retryAttempts: 3,
            baseUrl: apiBaseUrl
        }
    };
};

/**
 * Generate CSP string from configuration
 */
export const generateCSPString = (config: SecurityConfig['csp']): string => {
    const directives: string[] = [];

    // Add each directive
    if (config.defaultSrc.length > 0) {
        directives.push(`default-src ${config.defaultSrc.join(' ')}`);
    }

    if (config.scriptSrc.length > 0) {
        directives.push(`script-src ${config.scriptSrc.join(' ')}`);
    }

    if (config.styleSrc.length > 0) {
        directives.push(`style-src ${config.styleSrc.join(' ')}`);
    }

    if (config.fontSrc.length > 0) {
        directives.push(`font-src ${config.fontSrc.join(' ')}`);
    }

    if (config.imgSrc.length > 0) {
        directives.push(`img-src ${config.imgSrc.join(' ')}`);
    }

    if (config.connectSrc.length > 0) {
        directives.push(`connect-src ${config.connectSrc.join(' ')}`);
    }

    if (config.frameAncestors.length > 0) {
        directives.push(`frame-ancestors ${config.frameAncestors.join(' ')}`);
    }

    if (config.baseUri.length > 0) {
        directives.push(`base-uri ${config.baseUri.join(' ')}`);
    }

    if (config.formAction.length > 0) {
        directives.push(`form-action ${config.formAction.join(' ')}`);
    }

    if (config.upgradeInsecureRequests) {
        directives.push('upgrade-insecure-requests');
    }

    return directives.join('; ');
};

/**
 * Generate Permissions Policy string
 */
export const generatePermissionsPolicyString = (permissions: Record<string, string[]>): string => {
    const policies: string[] = [];

    for (const [feature, allowlist] of Object.entries(permissions)) {
        if (allowlist.length === 0) {
            policies.push(`${feature}=()`);
        } else {
            policies.push(`${feature}=(${allowlist.join(' ')})`);
        }
    }

    return policies.join(', ');
};

/**
 * Apply security headers to document
 */
export const applySecurityHeaders = (): void => {
    const config = getSecurityConfig();

    // Update CSP meta tag if it exists
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (cspMeta) {
        cspMeta.setAttribute('content', generateCSPString(config.csp));
    }

    // Update Permissions Policy meta tag if it exists
    const permissionsMeta = document.querySelector('meta[http-equiv="Permissions-Policy"]');
    if (permissionsMeta) {
        permissionsMeta.setAttribute('content', generatePermissionsPolicyString(config.headers.permissionsPolicy));
    }
};

/**
 * Validate current security configuration
 */
export const validateSecurityConfig = (): { isValid: boolean; warnings: string[] } => {
    const config = getSecurityConfig();
    const warnings: string[] = [];

    // Check for development-specific security relaxations
    if (process.env.NODE_ENV === 'development') {
        if (config.csp.scriptSrc.includes("'unsafe-inline'")) {
            warnings.push("Unsafe inline scripts allowed in development mode");
        }
        if (config.csp.scriptSrc.includes("'unsafe-eval'")) {
            warnings.push("Unsafe eval allowed in development mode");
        }
    }

    // Check for HTTPS enforcement
    if (!config.csp.upgradeInsecureRequests && process.env.NODE_ENV === 'production') {
        warnings.push("HTTPS upgrade not enforced in production");
    }

    // Check API URL security
    if (config.api.baseUrl.startsWith('http://') && process.env.NODE_ENV === 'production') {
        warnings.push("API URL uses HTTP in production");
    }

    return {
        isValid: warnings.length === 0,
        warnings
    };
};

/**
 * Security monitoring and reporting
 */
export const setupSecurityMonitoring = (): void => {
    // CSP violation reporting
    document.addEventListener('securitypolicyviolation', (event) => {
        console.error('CSP Violation:', {
            directive: event.violatedDirective,
            blockedURI: event.blockedURI,
            lineNumber: event.lineNumber,
            columnNumber: event.columnNumber,
            sourceFile: event.sourceFile
        });

        // Report to monitoring service in production
        if (process.env.NODE_ENV === 'production') {
            // Send to monitoring service
            fetch('/api/security/csp-violation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    directive: event.violatedDirective,
                    blockedURI: event.blockedURI,
                    lineNumber: event.lineNumber,
                    columnNumber: event.columnNumber,
                    sourceFile: event.sourceFile,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent
                })
            }).catch(console.error);
        }
    });

    // Mixed content detection
    if ('securitypolicyviolation' in window) {
        console.log('CSP violation reporting enabled');
    }

    // Validate configuration on startup
    const validation = validateSecurityConfig();
    if (!validation.isValid) {
        console.warn('Security configuration warnings:', validation.warnings);
    }
};

export default getSecurityConfig;
export type { SecurityConfig };
