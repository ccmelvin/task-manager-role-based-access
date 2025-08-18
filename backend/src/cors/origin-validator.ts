/**
 * Origin validation service for CORS security
 * Provides advanced origin validation and security checks
 */

export interface OriginValidationResult {
  isValid: boolean;
  reason?: string;
  securityRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface OriginValidationOptions {
  allowLocalhost?: boolean;
  allowPrivateNetworks?: boolean;
  requireHttps?: boolean;
  maxSubdomainDepth?: number;
  blockedDomains?: string[];
}

/**
 * Origin Validator Service
 * Provides comprehensive origin validation for CORS security
 */
export class OriginValidator {
  private static instance: OriginValidator;
  private blockedDomains: Set<string>;
  private suspiciousTlds: Set<string>;

  private constructor() {
    // Initialize blocked domains (common malicious or suspicious domains)
    this.blockedDomains = new Set([
      'localhost.evil.com',
      'evil.localhost.com',
      'malicious.com',
      'phishing.com',
      // Add more as needed
    ]);

    // Suspicious TLDs that might indicate malicious intent
    this.suspiciousTlds = new Set([
      '.tk', '.ml', '.ga', '.cf', // Free TLDs often used for malicious purposes
      '.bit', '.onion' // Special use domains
    ]);
  }

  public static getInstance(): OriginValidator {
    if (!OriginValidator.instance) {
      OriginValidator.instance = new OriginValidator();
    }
    return OriginValidator.instance;
  }

  /**
   * Validate an origin against security policies
   */
  public validateOrigin(
    origin: string,
    options: OriginValidationOptions = {}
  ): OriginValidationResult {
    const defaultOptions: OriginValidationOptions = {
      allowLocalhost: true,
      allowPrivateNetworks: false,
      requireHttps: false,
      maxSubdomainDepth: 3,
      blockedDomains: [],
      ...options
    };

    try {
      // Basic URL validation
      const url = new URL(origin);

      // Protocol validation
      const protocolResult = this.validateProtocol(url, defaultOptions);
      if (!protocolResult.isValid) {
        return protocolResult;
      }

      // Hostname validation
      const hostnameResult = this.validateHostname(url, defaultOptions);
      if (!hostnameResult.isValid) {
        return hostnameResult;
      }

      // Domain validation
      const domainResult = this.validateDomain(url, defaultOptions);
      if (!domainResult.isValid) {
        return domainResult;
      }

      // Security checks
      const securityResult = this.performSecurityChecks(url, defaultOptions);
      if (!securityResult.isValid) {
        return securityResult;
      }

      return { isValid: true };

    } catch (error) {
      return {
        isValid: false,
        reason: 'Invalid URL format',
        securityRisk: 'MEDIUM'
      };
    }
  }

  /**
   * Validate the protocol of the origin
   */
  private validateProtocol(
    url: URL,
    options: OriginValidationOptions
  ): OriginValidationResult {
    const allowedProtocols = ['http:', 'https:'];

    if (!allowedProtocols.includes(url.protocol)) {
      return {
        isValid: false,
        reason: `Protocol '${url.protocol}' is not allowed`,
        securityRisk: 'HIGH'
      };
    }

    // Check HTTPS requirement
    if (options.requireHttps && url.protocol !== 'https:') {
      return {
        isValid: false,
        reason: 'HTTPS is required',
        securityRisk: 'MEDIUM'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate the hostname of the origin
   */
  private validateHostname(
    url: URL,
    options: OriginValidationOptions
  ): OriginValidationResult {
    const hostname = url.hostname.toLowerCase();

    // Check for localhost
    if (this.isLocalhost(hostname)) {
      if (!options.allowLocalhost) {
        return {
          isValid: false,
          reason: 'Localhost origins are not allowed',
          securityRisk: 'LOW'
        };
      }
      return { isValid: true };
    }

    // Check for private network addresses
    if (this.isPrivateNetwork(hostname)) {
      if (!options.allowPrivateNetworks) {
        return {
          isValid: false,
          reason: 'Private network origins are not allowed',
          securityRisk: 'MEDIUM'
        };
      }
      return { isValid: true };
    }

    // Check for IP addresses (generally not allowed for CORS)
    if (this.isIpAddress(hostname)) {
      return {
        isValid: false,
        reason: 'IP address origins are not allowed',
        securityRisk: 'HIGH'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate the domain of the origin
   */
  private validateDomain(
    url: URL,
    options: OriginValidationOptions
  ): OriginValidationResult {
    const hostname = url.hostname.toLowerCase();

    // Check blocked domains
    const allBlockedDomains = new Set([
      ...this.blockedDomains,
      ...(options.blockedDomains || [])
    ]);

    if (allBlockedDomains.has(hostname)) {
      return {
        isValid: false,
        reason: 'Domain is blocked',
        securityRisk: 'HIGH'
      };
    }

    // Check for suspicious TLDs
    const hasSuspiciousTld = Array.from(this.suspiciousTlds).some(tld =>
      hostname.endsWith(tld)
    );

    if (hasSuspiciousTld) {
      return {
        isValid: false,
        reason: 'Suspicious top-level domain',
        securityRisk: 'HIGH'
      };
    }

    // Check subdomain depth
    if (options.maxSubdomainDepth) {
      const subdomainDepth = this.getSubdomainDepth(hostname);
      if (subdomainDepth > options.maxSubdomainDepth) {
        return {
          isValid: false,
          reason: `Subdomain depth exceeds maximum (${options.maxSubdomainDepth})`,
          securityRisk: 'MEDIUM'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Perform additional security checks
   */
  private performSecurityChecks(
    url: URL,
    options: OriginValidationOptions
  ): OriginValidationResult {
    const hostname = url.hostname.toLowerCase();

    // Check for homograph attacks (similar looking characters)
    if (this.containsSuspiciousCharacters(hostname)) {
      return {
        isValid: false,
        reason: 'Domain contains suspicious characters',
        securityRisk: 'HIGH'
      };
    }

    // Check for port scanning attempts
    if (url.port && this.isSuspiciousPort(url.port)) {
      return {
        isValid: false,
        reason: 'Suspicious port number',
        securityRisk: 'MEDIUM'
      };
    }

    return { isValid: true };
  }

  /**
   * Check if hostname is localhost
   */
  private isLocalhost(hostname: string): boolean {
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0',
      '[::1]' // IPv6 localhost with brackets
    ];

    return localhostPatterns.includes(hostname) ||
      hostname.startsWith('127.') ||
      hostname.endsWith('.localhost');
  }

  /**
   * Check if hostname is in private network range
   */
  private isPrivateNetwork(hostname: string): boolean {
    // Check for private IP ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^fc00:/, // IPv6 private
      /^fe80:/ // IPv6 link-local
    ];

    return privateRanges.some(pattern => pattern.test(hostname));
  }

  /**
   * Check if hostname is an IP address
   */
  private isIpAddress(hostname: string): boolean {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

    return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname);
  }

  /**
   * Get the depth of subdomains
   */
  private getSubdomainDepth(hostname: string): number {
    const parts = hostname.split('.');
    // Subtract 2 for the main domain (e.g., example.com)
    return Math.max(0, parts.length - 2);
  }

  /**
   * Check for suspicious characters that might indicate homograph attacks
   */
  private containsSuspiciousCharacters(hostname: string): boolean {
    // Check for mixed scripts or suspicious Unicode characters
    const suspiciousPatterns = [
      /[\u0400-\u04FF]/, // Cyrillic
      /[\u0370-\u03FF]/, // Greek
      /[\u0590-\u05FF]/, // Hebrew
      /[\u0600-\u06FF]/, // Arabic
      /[\u4E00-\u9FFF]/, // CJK
      /[\u3040-\u309F]/, // Hiragana
      /[\u30A0-\u30FF]/, // Katakana
    ];

    // Allow these characters only if the entire domain uses them consistently
    const hasLatin = /[a-zA-Z]/.test(hostname);
    const hasNonLatin = suspiciousPatterns.some(pattern => pattern.test(hostname));

    // Mixed scripts are suspicious
    return hasLatin && hasNonLatin;
  }

  /**
   * Check if port number is suspicious
   */
  private isSuspiciousPort(port: string): boolean {
    const portNum = parseInt(port, 10);

    // Common malicious or unusual ports
    const suspiciousPorts = [
      1337, 31337, // Leet speak ports often used by attackers
      4444, 5555, 6666, 7777, 8888, 9999, // Sequential ports
      12345, 54321, // Common backdoor ports
    ];

    return suspiciousPorts.includes(portNum) ||
      portNum > 65535 ||
      portNum < 1;
  }

  /**
   * Add a domain to the blocked list
   */
  public blockDomain(domain: string): void {
    this.blockedDomains.add(domain.toLowerCase());
  }

  /**
   * Remove a domain from the blocked list
   */
  public unblockDomain(domain: string): void {
    this.blockedDomains.delete(domain.toLowerCase());
  }

  /**
   * Get all blocked domains
   */
  public getBlockedDomains(): string[] {
    return Array.from(this.blockedDomains);
  }

  /**
   * Validate multiple origins at once
   */
  public validateOrigins(
    origins: string[],
    options: OriginValidationOptions = {}
  ): { valid: string[]; invalid: Array<{ origin: string; result: OriginValidationResult }> } {
    const valid: string[] = [];
    const invalid: Array<{ origin: string; result: OriginValidationResult }> = [];

    for (const origin of origins) {
      const result = this.validateOrigin(origin, options);
      if (result.isValid) {
        valid.push(origin);
      } else {
        invalid.push({ origin, result });
      }
    }

    return { valid, invalid };
  }
}