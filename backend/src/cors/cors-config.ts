/**
 * Environment-specific CORS configuration service
 * Implements secure CORS policies based on deployment environment
 */

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number;
  exposedHeaders?: string[];
}

export interface EnvironmentCorsSettings {
  development: CorsConfig;
  staging: CorsConfig;
  production: CorsConfig;
}

/**
 * Default CORS configurations for different environments
 */
const DEFAULT_CORS_SETTINGS: EnvironmentCorsSettings = {
  development: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token'
    ],
    allowCredentials: true,
    maxAge: 86400, // 24 hours
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
  },
  staging: {
    allowedOrigins: [], // Will be populated from environment variables
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token'
    ],
    allowCredentials: true,
    maxAge: 86400,
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
  },
  production: {
    allowedOrigins: [], // Will be populated from environment variables
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token'
    ],
    allowCredentials: true,
    maxAge: 86400,
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
  }
};

/**
 * CORS Configuration Service
 * Manages environment-specific CORS policies and origin validation
 */
export class CorsConfigService {
  private static instance: CorsConfigService;
  private currentEnvironment: string;
  private corsSettings: EnvironmentCorsSettings;

  private constructor() {
    this.currentEnvironment = this.determineEnvironment();
    this.corsSettings = this.loadCorsSettings();
  }

  public static getInstance(): CorsConfigService {
    if (!CorsConfigService.instance) {
      CorsConfigService.instance = new CorsConfigService();
    }
    return CorsConfigService.instance;
  }

  /**
   * Determine the current deployment environment
   */
  private determineEnvironment(): string {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    const stage = process.env.STAGE?.toLowerCase();
    
    // Check explicit environment variables first
    if (stage === 'production' || nodeEnv === 'production') {
      return 'production';
    }
    
    if (stage === 'staging' || stage === 'stage' || nodeEnv === 'staging') {
      return 'staging';
    }
    
    // Default to development for local development
    return 'development';
  }

  /**
   * Load CORS settings from environment variables and defaults
   */
  private loadCorsSettings(): EnvironmentCorsSettings {
    const settings = JSON.parse(JSON.stringify(DEFAULT_CORS_SETTINGS)); // Deep clone
    
    // Load production origins from environment variables
    const productionOrigins = this.parseEnvironmentOrigins('PRODUCTION_ALLOWED_ORIGINS');
    if (productionOrigins.length > 0) {
      settings.production.allowedOrigins = productionOrigins;
    }
    
    // Load staging origins from environment variables
    const stagingOrigins = this.parseEnvironmentOrigins('STAGING_ALLOWED_ORIGINS');
    if (stagingOrigins.length > 0) {
      settings.staging.allowedOrigins = stagingOrigins;
    }
    
    // Allow override of development origins if needed
    const developmentOrigins = this.parseEnvironmentOrigins('DEVELOPMENT_ALLOWED_ORIGINS');
    if (developmentOrigins.length > 0) {
      settings.development.allowedOrigins = developmentOrigins;
    }
    
    return settings;
  }

  /**
   * Parse comma-separated origins from environment variables
   */
  private parseEnvironmentOrigins(envVar: string): string[] {
    const origins = process.env[envVar];
    if (!origins) {
      return [];
    }
    
    return origins
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0)
      .filter(origin => this.isValidOrigin(origin));
  }

  /**
   * Validate that an origin string is properly formatted
   */
  private isValidOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      // Only allow http and https protocols
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Get the current CORS configuration for the active environment
   */
  public getCurrentCorsConfig(): CorsConfig {
    const config = this.corsSettings[this.currentEnvironment as keyof EnvironmentCorsSettings];
    
    if (!config) {
      throw new Error(`No CORS configuration found for environment: ${this.currentEnvironment}`);
    }
    
    // Validate that production/staging environments have origins configured
    if ((this.currentEnvironment === 'production' || this.currentEnvironment === 'staging') && 
        config.allowedOrigins.length === 0) {
      throw new Error(`No allowed origins configured for ${this.currentEnvironment} environment. Please set ${this.currentEnvironment.toUpperCase()}_ALLOWED_ORIGINS environment variable.`);
    }
    
    return config;
  }

  /**
   * Get CORS configuration for a specific environment
   */
  public getCorsConfigForEnvironment(environment: string): CorsConfig {
    const config = this.corsSettings[environment as keyof EnvironmentCorsSettings];
    
    if (!config) {
      throw new Error(`No CORS configuration found for environment: ${environment}`);
    }
    
    return config;
  }

  /**
   * Get the current environment name
   */
  public getCurrentEnvironment(): string {
    return this.currentEnvironment;
  }

  /**
   * Check if an origin is allowed for the current environment
   */
  public isOriginAllowed(origin: string): boolean {
    const config = this.getCurrentCorsConfig();
    
    // Normalize the origin (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    return config.allowedOrigins.some(allowedOrigin => {
      const normalizedAllowed = allowedOrigin.replace(/\/$/, '');
      return normalizedAllowed === normalizedOrigin;
    });
  }

  /**
   * Get CORS headers for HTTP responses
   */
  public getCorsHeaders(requestOrigin?: string): Record<string, string> {
    const config = this.getCurrentCorsConfig();
    const headers: Record<string, string> = {};
    
    // Set Access-Control-Allow-Origin
    if (requestOrigin && this.isOriginAllowed(requestOrigin)) {
      headers['Access-Control-Allow-Origin'] = requestOrigin;
    } else if (config.allowedOrigins.length === 1) {
      // If only one origin is allowed, use it directly
      headers['Access-Control-Allow-Origin'] = config.allowedOrigins[0];
    } else {
      // For multiple origins, we need to validate against the request origin
      // If no valid origin, don't set the header (will cause CORS failure)
      if (requestOrigin && this.isOriginAllowed(requestOrigin)) {
        headers['Access-Control-Allow-Origin'] = requestOrigin;
      }
    }
    
    // Set other CORS headers
    headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');
    headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
    headers['Access-Control-Max-Age'] = config.maxAge.toString();
    
    if (config.allowCredentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
    
    if (config.exposedHeaders && config.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ');
    }
    
    return headers;
  }

  /**
   * Validate CORS preflight request
   */
  public validatePreflightRequest(
    origin: string,
    method: string,
    requestedHeaders: string[]
  ): { isValid: boolean; error?: string } {
    const config = this.getCurrentCorsConfig();
    
    // Check origin
    if (!this.isOriginAllowed(origin)) {
      return {
        isValid: false,
        error: `Origin '${origin}' is not allowed`
      };
    }
    
    // Check method
    if (!config.allowedMethods.includes(method.toUpperCase())) {
      return {
        isValid: false,
        error: `Method '${method}' is not allowed`
      };
    }
    
    // Check headers
    const allowedHeadersLower = config.allowedHeaders.map(h => h.toLowerCase());
    const invalidHeaders = requestedHeaders.filter(header => 
      !allowedHeadersLower.includes(header.toLowerCase())
    );
    
    if (invalidHeaders.length > 0) {
      return {
        isValid: false,
        error: `Headers not allowed: ${invalidHeaders.join(', ')}`
      };
    }
    
    return { isValid: true };
  }

  /**
   * Update CORS configuration (for testing purposes)
   */
  public updateCorsConfig(environment: string, config: Partial<CorsConfig>): void {
    if (!this.corsSettings[environment as keyof EnvironmentCorsSettings]) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    this.corsSettings[environment as keyof EnvironmentCorsSettings] = {
      ...this.corsSettings[environment as keyof EnvironmentCorsSettings],
      ...config
    };
  }
}