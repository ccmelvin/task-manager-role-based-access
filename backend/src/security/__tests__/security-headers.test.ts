import { SecurityHeadersService } from '../security-headers';

describe('SecurityHeadersService', () => {
  let securityService: SecurityHeadersService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Reset singleton instance
    (SecurityHeadersService as any).instance = undefined;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default Configuration', () => {
    it('should create default development configuration', () => {
      process.env.NODE_ENV = 'development';
      securityService = SecurityHeadersService.getInstance();
      
      const headers = securityService.generateSecurityHeaders();
      
      expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
      expect(headers['Content-Security-Policy']).toContain("'unsafe-eval'"); // Development allows eval
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    });

    it('should create default production configuration', () => {
      process.env.NODE_ENV = 'production';
      securityService = SecurityHeadersService.getInstance();
      
      const headers = securityService.generateSecurityHeaders();
      
      expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
      expect(headers['Content-Security-Policy']).not.toContain("'unsafe-eval'"); // Production disallows eval
      expect(headers['Content-Security-Policy']).toContain('upgrade-insecure-requests');
      expect(headers['Strict-Transport-Security']).toContain('preload');
    });
  });

  describe('Content Security Policy', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should build CSP header with all directives', () => {
      const headers = securityService.generateSecurityHeaders({
        contentSecurityPolicy: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
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
          upgradeInsecureRequests: true,
          blockAllMixedContent: true,
          reportUri: 'https://example.com/csp-report'
        }
      });

      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain('block-all-mixed-content');
      expect(csp).toContain('report-uri https://example.com/csp-report');
    });

    it('should override default CSP with empty configuration', () => {
      // Create a service with no default CSP
      securityService.updateDefaultConfig({
        contentSecurityPolicy: undefined
      });
      
      const headers = securityService.generateSecurityHeaders({});

      expect(headers['Content-Security-Policy']).toBeUndefined();
    });
  });

  describe('Strict Transport Security', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should build HSTS header with all options', () => {
      const headers = securityService.generateSecurityHeaders({
        strictTransportSecurity: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      });

      expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains; preload');
    });

    it('should build HSTS header with minimal options', () => {
      const headers = securityService.generateSecurityHeaders({
        strictTransportSecurity: {
          maxAge: 86400,
          includeSubDomains: false,
          preload: false
        }
      });

      expect(headers['Strict-Transport-Security']).toBe('max-age=86400');
    });
  });

  describe('Frame Options', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should set DENY frame options', () => {
      const headers = securityService.generateSecurityHeaders({
        frameOptions: { policy: 'DENY' }
      });

      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    it('should set SAMEORIGIN frame options', () => {
      const headers = securityService.generateSecurityHeaders({
        frameOptions: { policy: 'SAMEORIGIN' }
      });

      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('should set ALLOW-FROM frame options', () => {
      const headers = securityService.generateSecurityHeaders({
        frameOptions: { 
          policy: 'ALLOW-FROM',
          allowFrom: 'https://trusted.com'
        }
      });

      expect(headers['X-Frame-Options']).toBe('ALLOW-FROM https://trusted.com');
    });
  });

  describe('XSS Protection', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should enable XSS protection with block mode', () => {
      const headers = securityService.generateSecurityHeaders({
        xssProtection: {
          enabled: true,
          mode: 'block'
        }
      });

      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should disable XSS protection', () => {
      const headers = securityService.generateSecurityHeaders({
        xssProtection: {
          enabled: false
        }
      });

      expect(headers['X-XSS-Protection']).toBe('0');
    });

    it('should enable XSS protection with report mode', () => {
      const headers = securityService.generateSecurityHeaders({
        xssProtection: {
          enabled: true,
          mode: 'report',
          reportUri: 'https://example.com/xss-report'
        }
      });

      expect(headers['X-XSS-Protection']).toBe('1; report=https://example.com/xss-report');
    });
  });

  describe('Permissions Policy', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should build permissions policy header', () => {
      const headers = securityService.generateSecurityHeaders({
        permissionsPolicy: {
          geolocation: [],
          microphone: [],
          camera: ["'self'"],
          fullscreen: ["'self'", "https://trusted.com"]
        }
      });

      const policy = headers['Permissions-Policy'];
      expect(policy).toContain('geolocation=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('camera=("\'self\'")');
      expect(policy).toContain('fullscreen=("\'self\'" "https://trusted.com")');
    });

    it('should handle wildcard permissions', () => {
      const headers = securityService.generateSecurityHeaders({
        permissionsPolicy: {
          geolocation: ['*']
        }
      });

      expect(headers['Permissions-Policy']).toContain('geolocation=(*)');
    });
  });

  describe('Cache Control', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should build cache control header with all directives', () => {
      const headers = securityService.generateSecurityHeaders({
        cacheControl: {
          noStore: true,
          noCache: true,
          mustRevalidate: true,
          proxyRevalidate: true,
          private: true,
          maxAge: 3600
        }
      });

      const cacheControl = headers['Cache-Control'];
      expect(cacheControl).toContain('no-store');
      expect(cacheControl).toContain('no-cache');
      expect(cacheControl).toContain('must-revalidate');
      expect(cacheControl).toContain('proxy-revalidate');
      expect(cacheControl).toContain('private');
      expect(cacheControl).toContain('max-age=3600');
    });

    it('should set Pragma and Expires for no-cache', () => {
      const headers = securityService.generateSecurityHeaders({
        cacheControl: {
          noCache: true
        }
      });

      expect(headers['Pragma']).toBe('no-cache');
      expect(headers['Expires']).toBe('0');
    });
  });

  describe('Custom Headers', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should include custom headers', () => {
      const headers = securityService.generateSecurityHeaders({
        customHeaders: {
          'X-Custom-Header': 'custom-value',
          'X-Another-Header': 'another-value'
        }
      });

      expect(headers['X-Custom-Header']).toBe('custom-value');
      expect(headers['X-Another-Header']).toBe('another-value');
    });
  });

  describe('Specialized Header Methods', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should generate API security headers', () => {
      const headers = securityService.getApiSecurityHeaders();
      
      expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
      expect(headers['Cache-Control']).toContain('no-store');
      expect(headers['Cache-Control']).toContain('private');
    });

    it('should generate static content security headers', () => {
      const headers = securityService.getStaticContentSecurityHeaders();
      
      expect(headers['Cache-Control']).toContain('public');
      expect(headers['Cache-Control']).toContain('max-age=31536000');
    });

    it('should generate error security headers', () => {
      const headers = securityService.getErrorSecurityHeaders();
      
      expect(headers['Cache-Control']).toContain('no-store');
      expect(headers['X-Robots-Tag']).toBe('noindex, nofollow, nosnippet, noarchive');
    });
  });

  describe('Configuration Validation', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should validate valid configuration', () => {
      const result = securityService.validateConfig({
        strictTransportSecurity: {
          maxAge: 31536000,
          includeSubDomains: true
        },
        contentSecurityPolicy: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"]
        }
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid HSTS configuration', () => {
      const result = securityService.validateConfig({
        strictTransportSecurity: {
          maxAge: -1
        }
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('HSTS max-age must be non-negative');
    });

    it('should warn about short HSTS max-age', () => {
      const result = securityService.validateConfig({
        strictTransportSecurity: {
          maxAge: 86400 // 1 day
        }
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('HSTS max-age should be at least 1 year (31536000 seconds) for security');
    });

    it('should detect unsafe CSP directives', () => {
      const result = securityService.validateConfig({
        contentSecurityPolicy: {
          defaultSrc: ["'unsafe-eval'"],
          scriptSrc: ["'unsafe-inline'"]
        }
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("CSP default-src should not include 'unsafe-eval'");
      expect(result.errors).toContain("CSP script-src should not include 'unsafe-inline'");
    });

    it('should validate frame options configuration', () => {
      const result = securityService.validateConfig({
        frameOptions: {
          policy: 'ALLOW-FROM'
          // Missing allowFrom
        }
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Frame Options ALLOW-FROM policy requires allowFrom URL');
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(() => {
      securityService = SecurityHeadersService.getInstance();
    });

    it('should update default configuration', () => {
      securityService.updateDefaultConfig({
        customHeaders: {
          'X-Test-Header': 'test-value'
        }
      });

      const headers = securityService.generateSecurityHeaders();
      expect(headers['X-Test-Header']).toBe('test-value');
    });

    it('should merge configurations correctly', () => {
      const headers = securityService.generateSecurityHeaders({
        contentSecurityPolicy: {
          scriptSrc: ["'self'", "https://trusted.com"]
        },
        customHeaders: {
          'X-Custom': 'value'
        }
      });

      expect(headers['Content-Security-Policy']).toContain("script-src 'self' https://trusted.com");
      expect(headers['X-Custom']).toBe('value');
      // Should still have default headers
      expect(headers['X-Frame-Options']).toBe('DENY');
    });
  });
});