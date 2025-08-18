/**
 * Security Headers Service
 * Provides comprehensive security headers for HTTP responses
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: CSPConfig;
  strictTransportSecurity?: HSTSConfig;
  frameOptions?: FrameOptionsConfig;
  contentTypeOptions?: boolean;
  xssProtection?: XSSProtectionConfig;
  referrerPolicy?: ReferrerPolicyConfig;
  permissionsPolicy?: PermissionsPolicyConfig;
  cacheControl?: CacheControlConfig;
  customHeaders?: Record<string, string>;
}

export interface CSPConfig {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  frameSrc?: string[];
  childSrc?: string[];
  workerSrc?: string[];
  manifestSrc?: string[];
  baseUri?: string[];
  formAction?: string[];
  frameAncestors?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
  reportTo?: string;
}

export interface HSTSConfig {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

export interface FrameOptionsConfig {
  policy: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  allowFrom?: string;
}

export interface XSSProtectionConfig {
  enabled: boolean;
  mode?: 'block' | 'report';
  reportUri?: string;
}

export interface ReferrerPolicyConfig {
  policy: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 
          'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
}

export interface PermissionsPolicyConfig {
  geolocation?: string[];
  microphone?: string[];
  camera?: string[];
  payment?: string[];
  usb?: string[];
  magnetometer?: string[];
  gyroscope?: string[];
  speaker?: string[];
  fullscreen?: string[];
  displayCapture?: string[];
  documentDomain?: string[];
  encryptedMedia?: string[];
  executionWhileNotRendered?: string[];
  executionWhileOutOfViewport?: string[];
  gamepad?: string[];
  hid?: string[];
  identityCredentialsGet?: string[];
  idleDetection?: string[];
  localFonts?: string[];
  midi?: string[];
  otp?: string[];
  pictureInPicture?: string[];
  publickeyCredentialsGet?: string[];
  screenWakeLock?: string[];
  serial?: string[];
  storageAccess?: string[];
  webShare?: string[];
  xrSpacialTracking?: string[];
}

export interface CacheControlConfig {
  noStore?: boolean;
  noCache?: boolean;
  mustRevalidate?: boolean;
  proxyRevalidate?: boolean;
  maxAge?: number;
  sMaxAge?: number;
  private?: boolean;
  public?: boolean;
}

/**
 * Security Headers Service
 * Manages and generates security headers for HTTP responses
 */
export class SecurityHeadersService {
  private static instance: SecurityHeadersService;
  private defaultConfig: SecurityHeadersConfig;

  private constructor() {
    this.defaultConfig = this.getDefaultSecurityConfig();
  }

  public static getInstance(): SecurityHeadersService {
    if (!SecurityHeadersService.instance) {
      SecurityHeadersService.instance = new SecurityHeadersService();
    }
    return SecurityHeadersService.instance;
  }

  /**
   * Get default security configuration based on environment
   */
  private getDefaultSecurityConfig(): SecurityHeadersConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';

    return {
      contentSecurityPolicy: {
        defaultSrc: ["'none'"],
        scriptSrc: isDevelopment ? ["'self'", "'unsafe-eval'"] : ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: isProduction,
        blockAllMixedContent: isProduction
      },
      strictTransportSecurity: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: isProduction
      },
      frameOptions: {
        policy: 'DENY'
      },
      contentTypeOptions: true,
      xssProtection: {
        enabled: true,
        mode: 'block'
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      },
      permissionsPolicy: {
        geolocation: [],
        microphone: [],
        camera: [],
        payment: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        speaker: [],
        fullscreen: ["'self'"],
        displayCapture: [],
        documentDomain: [],
        encryptedMedia: [],
        gamepad: [],
        hid: [],
        idleDetection: [],
        midi: [],
        pictureInPicture: [],
        screenWakeLock: [],
        serial: [],
        storageAccess: [],
        webShare: []
      },
      cacheControl: {
        noStore: true,
        noCache: true,
        mustRevalidate: true,
        proxyRevalidate: true,
        private: true
      }
    };
  }

  /**
   * Generate security headers based on configuration
   */
  public generateSecurityHeaders(config?: Partial<SecurityHeadersConfig>): Record<string, string> {
    const mergedConfig = this.mergeConfigs(this.defaultConfig, config || {});
    const headers: Record<string, string> = {};

    // Content Security Policy
    if (mergedConfig.contentSecurityPolicy) {
      headers['Content-Security-Policy'] = this.buildCSPHeader(mergedConfig.contentSecurityPolicy);
    }

    // Strict Transport Security
    if (mergedConfig.strictTransportSecurity) {
      headers['Strict-Transport-Security'] = this.buildHSTSHeader(mergedConfig.strictTransportSecurity);
    }

    // X-Frame-Options
    if (mergedConfig.frameOptions) {
      headers['X-Frame-Options'] = this.buildFrameOptionsHeader(mergedConfig.frameOptions);
    }

    // X-Content-Type-Options
    if (mergedConfig.contentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // X-XSS-Protection
    if (mergedConfig.xssProtection) {
      headers['X-XSS-Protection'] = this.buildXSSProtectionHeader(mergedConfig.xssProtection);
    }

    // Referrer-Policy
    if (mergedConfig.referrerPolicy) {
      headers['Referrer-Policy'] = mergedConfig.referrerPolicy.policy;
    }

    // Permissions-Policy
    if (mergedConfig.permissionsPolicy) {
      headers['Permissions-Policy'] = this.buildPermissionsPolicyHeader(mergedConfig.permissionsPolicy);
    }

    // Cache-Control
    if (mergedConfig.cacheControl) {
      headers['Cache-Control'] = this.buildCacheControlHeader(mergedConfig.cacheControl);
    }

    // Pragma (for HTTP/1.0 compatibility)
    if (mergedConfig.cacheControl?.noCache) {
      headers['Pragma'] = 'no-cache';
    }

    // Expires (for HTTP/1.0 compatibility)
    if (mergedConfig.cacheControl?.noStore || mergedConfig.cacheControl?.noCache) {
      headers['Expires'] = '0';
    }

    // Custom headers
    if (mergedConfig.customHeaders) {
      Object.assign(headers, mergedConfig.customHeaders);
    }

    return headers;
  }

  /**
   * Build Content Security Policy header value
   */
  private buildCSPHeader(config: CSPConfig): string {
    const directives: string[] = [];

    // Add each directive
    if (config.defaultSrc) directives.push(`default-src ${config.defaultSrc.join(' ')}`);
    if (config.scriptSrc) directives.push(`script-src ${config.scriptSrc.join(' ')}`);
    if (config.styleSrc) directives.push(`style-src ${config.styleSrc.join(' ')}`);
    if (config.imgSrc) directives.push(`img-src ${config.imgSrc.join(' ')}`);
    if (config.connectSrc) directives.push(`connect-src ${config.connectSrc.join(' ')}`);
    if (config.fontSrc) directives.push(`font-src ${config.fontSrc.join(' ')}`);
    if (config.objectSrc) directives.push(`object-src ${config.objectSrc.join(' ')}`);
    if (config.mediaSrc) directives.push(`media-src ${config.mediaSrc.join(' ')}`);
    if (config.frameSrc) directives.push(`frame-src ${config.frameSrc.join(' ')}`);
    if (config.childSrc) directives.push(`child-src ${config.childSrc.join(' ')}`);
    if (config.workerSrc) directives.push(`worker-src ${config.workerSrc.join(' ')}`);
    if (config.manifestSrc) directives.push(`manifest-src ${config.manifestSrc.join(' ')}`);
    if (config.baseUri) directives.push(`base-uri ${config.baseUri.join(' ')}`);
    if (config.formAction) directives.push(`form-action ${config.formAction.join(' ')}`);
    if (config.frameAncestors) directives.push(`frame-ancestors ${config.frameAncestors.join(' ')}`);

    // Add boolean directives
    if (config.upgradeInsecureRequests) directives.push('upgrade-insecure-requests');
    if (config.blockAllMixedContent) directives.push('block-all-mixed-content');

    // Add reporting directives
    if (config.reportUri) directives.push(`report-uri ${config.reportUri}`);
    if (config.reportTo) directives.push(`report-to ${config.reportTo}`);

    return directives.join('; ');
  }

  /**
   * Build Strict Transport Security header value
   */
  private buildHSTSHeader(config: HSTSConfig): string {
    let header = `max-age=${config.maxAge}`;
    
    if (config.includeSubDomains) {
      header += '; includeSubDomains';
    }
    
    if (config.preload) {
      header += '; preload';
    }
    
    return header;
  }

  /**
   * Build X-Frame-Options header value
   */
  private buildFrameOptionsHeader(config: FrameOptionsConfig): string {
    if (config.policy === 'ALLOW-FROM' && config.allowFrom) {
      return `ALLOW-FROM ${config.allowFrom}`;
    }
    return config.policy;
  }

  /**
   * Build X-XSS-Protection header value
   */
  private buildXSSProtectionHeader(config: XSSProtectionConfig): string {
    if (!config.enabled) {
      return '0';
    }

    let header = '1';
    
    if (config.mode === 'block') {
      header += '; mode=block';
    } else if (config.mode === 'report' && config.reportUri) {
      header += `; report=${config.reportUri}`;
    }
    
    return header;
  }

  /**
   * Build Permissions-Policy header value
   */
  private buildPermissionsPolicyHeader(config: PermissionsPolicyConfig): string {
    const policies: string[] = [];

    Object.entries(config).forEach(([feature, allowlist]) => {
      if (Array.isArray(allowlist)) {
        if (allowlist.length === 0) {
          policies.push(`${feature}=()`);
        } else {
          const formattedAllowlist = allowlist.map(origin => 
            origin === '*' ? '*' : `"${origin}"`
          ).join(' ');
          policies.push(`${feature}=(${formattedAllowlist})`);
        }
      }
    });

    return policies.join(', ');
  }

  /**
   * Build Cache-Control header value
   */
  private buildCacheControlHeader(config: CacheControlConfig): string {
    const directives: string[] = [];

    if (config.noStore) directives.push('no-store');
    if (config.noCache) directives.push('no-cache');
    if (config.mustRevalidate) directives.push('must-revalidate');
    if (config.proxyRevalidate) directives.push('proxy-revalidate');
    if (config.private) directives.push('private');
    if (config.public) directives.push('public');
    if (config.maxAge !== undefined) directives.push(`max-age=${config.maxAge}`);
    if (config.sMaxAge !== undefined) directives.push(`s-maxage=${config.sMaxAge}`);

    return directives.join(', ');
  }

  /**
   * Merge configuration objects
   */
  private mergeConfigs(
    defaultConfig: SecurityHeadersConfig,
    userConfig: Partial<SecurityHeadersConfig>
  ): SecurityHeadersConfig {
    const merged = { ...defaultConfig };

    Object.keys(userConfig).forEach(key => {
      const configKey = key as keyof SecurityHeadersConfig;
      const userValue = userConfig[configKey];
      
      if (userValue !== undefined) {
        if (typeof userValue === 'object' && !Array.isArray(userValue) && userValue !== null) {
          const defaultValue = merged[configKey];
          if (typeof defaultValue === 'object' && !Array.isArray(defaultValue) && defaultValue !== null) {
            merged[configKey] = { ...defaultValue, ...userValue } as any;
          } else {
            merged[configKey] = userValue as any;
          }
        } else {
          merged[configKey] = userValue as any;
        }
      }
    });

    return merged;
  }

  /**
   * Get security headers for API responses
   */
  public getApiSecurityHeaders(requestOrigin?: string): Record<string, string> {
    const config: Partial<SecurityHeadersConfig> = {
      contentSecurityPolicy: {
        defaultSrc: ["'none'"],
        connectSrc: ["'self'"]
      },
      cacheControl: {
        noStore: true,
        noCache: true,
        mustRevalidate: true,
        private: true
      }
    };

    return this.generateSecurityHeaders(config);
  }

  /**
   * Get security headers for static content
   */
  public getStaticContentSecurityHeaders(): Record<string, string> {
    const config: Partial<SecurityHeadersConfig> = {
      cacheControl: {
        public: true,
        maxAge: 31536000, // 1 year
        mustRevalidate: true
      }
    };

    return this.generateSecurityHeaders(config);
  }

  /**
   * Get security headers for error responses
   */
  public getErrorSecurityHeaders(): Record<string, string> {
    const config: Partial<SecurityHeadersConfig> = {
      cacheControl: {
        noStore: true,
        noCache: true,
        mustRevalidate: true,
        private: true
      },
      customHeaders: {
        'X-Robots-Tag': 'noindex, nofollow, nosnippet, noarchive'
      }
    };

    return this.generateSecurityHeaders(config);
  }

  /**
   * Validate security headers configuration
   */
  public validateConfig(config: SecurityHeadersConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate HSTS configuration
    if (config.strictTransportSecurity) {
      if (config.strictTransportSecurity.maxAge < 0) {
        errors.push('HSTS max-age must be non-negative');
      }
      if (config.strictTransportSecurity.maxAge < 31536000) {
        errors.push('HSTS max-age should be at least 1 year (31536000 seconds) for security');
      }
    }

    // Validate CSP configuration
    if (config.contentSecurityPolicy) {
      if (config.contentSecurityPolicy.defaultSrc?.includes("'unsafe-eval'")) {
        errors.push("CSP default-src should not include 'unsafe-eval'");
      }
      if (config.contentSecurityPolicy.scriptSrc?.includes("'unsafe-inline'")) {
        errors.push("CSP script-src should not include 'unsafe-inline'");
      }
    }

    // Validate Frame Options
    if (config.frameOptions?.policy === 'ALLOW-FROM' && !config.frameOptions.allowFrom) {
      errors.push('Frame Options ALLOW-FROM policy requires allowFrom URL');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Update default configuration
   */
  public updateDefaultConfig(config: Partial<SecurityHeadersConfig>): void {
    this.defaultConfig = this.mergeConfigs(this.defaultConfig, config);
  }
}