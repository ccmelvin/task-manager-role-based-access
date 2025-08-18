import { CorsConfigService } from '../cors-config';

describe('CorsConfigService', () => {
  let corsService: CorsConfigService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Reset singleton instance
    (CorsConfigService as any).instance = undefined;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Environment Detection', () => {
    it('should detect development environment by default', () => {
      delete process.env.NODE_ENV;
      delete process.env.STAGE;
      
      corsService = CorsConfigService.getInstance();
      expect(corsService.getCurrentEnvironment()).toBe('development');
    });

    it('should detect production environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      
      corsService = CorsConfigService.getInstance();
      expect(corsService.getCurrentEnvironment()).toBe('production');
    });

    it('should detect production environment from STAGE', () => {
      process.env.STAGE = 'production';
      
      corsService = CorsConfigService.getInstance();
      expect(corsService.getCurrentEnvironment()).toBe('production');
    });

    it('should detect staging environment', () => {
      process.env.NODE_ENV = 'staging';
      
      corsService = CorsConfigService.getInstance();
      expect(corsService.getCurrentEnvironment()).toBe('staging');
    });
  });

  describe('CORS Configuration Loading', () => {
    it('should load default development configuration', () => {
      process.env.NODE_ENV = 'development';
      
      corsService = CorsConfigService.getInstance();
      const config = corsService.getCurrentCorsConfig();
      
      expect(config.allowedOrigins).toContain('http://localhost:3000');
      expect(config.allowCredentials).toBe(true);
      expect(config.allowedMethods).toContain('GET');
      expect(config.allowedMethods).toContain('POST');
    });

    it('should load production origins from environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.PRODUCTION_ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
      
      corsService = CorsConfigService.getInstance();
      const config = corsService.getCurrentCorsConfig();
      
      expect(config.allowedOrigins).toEqual(['https://example.com', 'https://app.example.com']);
    });

    it('should load staging origins from environment variables', () => {
      process.env.NODE_ENV = 'staging';
      process.env.STAGING_ALLOWED_ORIGINS = 'https://staging.example.com';
      
      corsService = CorsConfigService.getInstance();
      const config = corsService.getCurrentCorsConfig();
      
      expect(config.allowedOrigins).toEqual(['https://staging.example.com']);
    });

    it('should filter out invalid origins from environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.PRODUCTION_ALLOWED_ORIGINS = 'https://valid.com,invalid-url,ftp://invalid.com';
      
      corsService = CorsConfigService.getInstance();
      const config = corsService.getCurrentCorsConfig();
      
      expect(config.allowedOrigins).toEqual(['https://valid.com']);
    });

    it('should throw error for production without configured origins', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.PRODUCTION_ALLOWED_ORIGINS;
      
      corsService = CorsConfigService.getInstance();
      
      expect(() => corsService.getCurrentCorsConfig()).toThrow(
        'No allowed origins configured for production environment'
      );
    });
  });

  describe('Origin Validation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      corsService = CorsConfigService.getInstance();
    });

    it('should allow configured origins', () => {
      expect(corsService.isOriginAllowed('http://localhost:3000')).toBe(true);
    });

    it('should reject non-configured origins', () => {
      expect(corsService.isOriginAllowed('https://malicious.com')).toBe(false);
    });

    it('should handle origins with trailing slashes', () => {
      expect(corsService.isOriginAllowed('http://localhost:3000/')).toBe(true);
    });

    it('should be case sensitive for origins', () => {
      expect(corsService.isOriginAllowed('HTTP://LOCALHOST:3000')).toBe(false);
    });
  });

  describe('CORS Headers Generation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      corsService = CorsConfigService.getInstance();
    });

    it('should generate correct CORS headers for valid origin', () => {
      const headers = corsService.getCorsHeaders('http://localhost:3000');
      
      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Access-Control-Max-Age']).toBe('86400');
    });

    it('should not set origin header for invalid origin', () => {
      const headers = corsService.getCorsHeaders('https://malicious.com');
      
      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should include exposed headers when configured', () => {
      const headers = corsService.getCorsHeaders('http://localhost:3000');
      
      expect(headers['Access-Control-Expose-Headers']).toContain('X-RateLimit-Limit');
    });
  });

  describe('Preflight Validation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      corsService = CorsConfigService.getInstance();
    });

    it('should validate successful preflight request', () => {
      const result = corsService.validatePreflightRequest(
        'http://localhost:3000',
        'POST',
        ['Content-Type', 'Authorization']
      );
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject preflight with invalid origin', () => {
      const result = corsService.validatePreflightRequest(
        'https://malicious.com',
        'POST',
        ['Content-Type']
      );
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Origin');
    });

    it('should reject preflight with invalid method', () => {
      const result = corsService.validatePreflightRequest(
        'http://localhost:3000',
        'TRACE',
        ['Content-Type']
      );
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Method');
    });

    it('should reject preflight with invalid headers', () => {
      const result = corsService.validatePreflightRequest(
        'http://localhost:3000',
        'POST',
        ['Content-Type', 'X-Custom-Header']
      );
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Headers not allowed');
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      corsService = CorsConfigService.getInstance();
    });

    it('should allow updating CORS configuration', () => {
      corsService.updateCorsConfig('development', {
        allowedOrigins: ['https://new-origin.com']
      });
      
      const config = corsService.getCurrentCorsConfig();
      expect(config.allowedOrigins).toEqual(['https://new-origin.com']);
    });

    it('should throw error for invalid environment', () => {
      expect(() => {
        corsService.updateCorsConfig('invalid', {});
      }).toThrow('Invalid environment: invalid');
    });
  });

  describe('Multiple Environment Configurations', () => {
    it('should return different configurations for different environments', () => {
      process.env.PRODUCTION_ALLOWED_ORIGINS = 'https://prod.com';
      process.env.STAGING_ALLOWED_ORIGINS = 'https://staging.com';
      
      corsService = CorsConfigService.getInstance();
      
      const prodConfig = corsService.getCorsConfigForEnvironment('production');
      const stagingConfig = corsService.getCorsConfigForEnvironment('staging');
      const devConfig = corsService.getCorsConfigForEnvironment('development');
      
      expect(prodConfig.allowedOrigins).toEqual(['https://prod.com']);
      expect(stagingConfig.allowedOrigins).toEqual(['https://staging.com']);
      expect(devConfig.allowedOrigins).toContain('http://localhost:3000');
    });
  });
});