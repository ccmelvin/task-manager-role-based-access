/**
 * Input Sanitization Service
 * Provides comprehensive sanitization functions to prevent XSS and injection attacks
 */

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
  removeControlChars?: boolean;
  normalizeUnicode?: boolean;
}

export interface DateValidationOptions {
  format?: 'ISO' | 'any';
  futureOnly?: boolean;
  pastOnly?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

export class SanitizationService {
  private static instance: SanitizationService;

  private constructor() {}

  public static getInstance(): SanitizationService {
    if (!SanitizationService.instance) {
      SanitizationService.instance = new SanitizationService();
    }
    return SanitizationService.instance;
  }

  /**
   * Sanitize text input to prevent XSS and injection attacks
   */
  public sanitizeText(input: string, options: SanitizationOptions = {}): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Trim whitespace if requested (default: true)
    if (options.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }

    // Remove control characters if requested (default: true)
    if (options.removeControlChars !== false) {
      sanitized = this.removeControlCharacters(sanitized);
    }

    // Normalize unicode if requested (default: true)
    if (options.normalizeUnicode !== false) {
      sanitized = this.normalizeUnicode(sanitized);
    }

    // Handle HTML content
    if (!options.allowHtml) {
      sanitized = this.escapeHtml(sanitized);
    } else {
      sanitized = this.sanitizeHtml(sanitized);
    }

    // Apply length limit if specified
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Sanitize HTML content while preserving safe tags
   */
  public sanitizeHtml(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove dangerous HTML tags and attributes
    let sanitized = input;

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove dangerous event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^>\s]+/gi, '');

    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Remove data: URLs (can be used for XSS)
    sanitized = sanitized.replace(/data:/gi, '');

    // Remove dangerous tags
    const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'];
    dangerousTags.forEach(tag => {
      const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
      const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi');
      sanitized = sanitized.replace(selfClosingRegex, '');
    });

    return sanitized;
  }

  /**
   * Escape HTML special characters
   */
  public escapeHtml(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    const htmlEscapes: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };

    return input.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
  }

  /**
   * Remove control characters that could be used for injection
   */
  public removeControlCharacters(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove control characters except tab, newline, and carriage return
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Normalize unicode characters
   */
  public normalizeUnicode(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    try {
      // Normalize to NFC (Canonical Decomposition, followed by Canonical Composition)
      return input.normalize('NFC');
    } catch (error) {
      // Fallback if normalization fails
      return input;
    }
  }

  /**
   * Sanitize special characters that could be used in injection attacks
   */
  public sanitizeSpecialCharacters(input: string, allowedChars: string[] = []): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Process in specific order to avoid breaking HTML entities
    const replacements = [
      { char: '&', replacement: '&amp;', condition: !allowedChars.includes('&') },
      { char: '<', replacement: '&lt;', condition: !allowedChars.includes('<') },
      { char: '>', replacement: '&gt;', condition: !allowedChars.includes('>') },
      { char: '"', replacement: '&quot;', condition: !allowedChars.includes('"') },
      { char: "'", replacement: '&#x27;', condition: !allowedChars.includes("'") }
    ];

    // Apply HTML entity replacements first
    replacements.forEach(({ char, replacement, condition }) => {
      if (condition) {
        sanitized = sanitized.replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
      }
    });

    // Remove other dangerous characters (but preserve semicolons for HTML entities)
    const dangerousCharsToRemove = ['`', '(', ')', '{', '}', '[', ']', '|', '*', '?', '~', '^', '$'];
    
    dangerousCharsToRemove.forEach(char => {
      if (!allowedChars.includes(char)) {
        const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        sanitized = sanitized.replace(new RegExp(escapedChar, 'g'), '');
      }
    });

    // Note: We don't remove semicolons here as they're needed for HTML entities

    return sanitized;
  }

  /**
   * Validate and sanitize date input
   */
  public validateAndSanitizeDate(input: string, options: DateValidationOptions = {}): { isValid: boolean; sanitizedDate?: string; error?: string } {
    if (typeof input !== 'string' || input.trim() === '') {
      return { isValid: false, error: 'Date input must be a non-empty string' };
    }

    const trimmedInput = input.trim();

    // Check ISO format if required
    if (options.format === 'ISO') {
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      if (!isoRegex.test(trimmedInput)) {
        return { isValid: false, error: 'Date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)' };
      }
    }

    // Parse the date
    const parsedDate = new Date(trimmedInput);
    
    if (isNaN(parsedDate.getTime())) {
      return { isValid: false, error: 'Invalid date format' };
    }

    // Check future/past constraints
    const now = new Date();
    
    if (options.futureOnly && parsedDate <= now) {
      return { isValid: false, error: 'Date must be in the future' };
    }

    if (options.pastOnly && parsedDate >= now) {
      return { isValid: false, error: 'Date must be in the past' };
    }

    // Check min/max date constraints
    if (options.minDate && parsedDate < options.minDate) {
      return { isValid: false, error: `Date must be after ${options.minDate.toISOString()}` };
    }

    if (options.maxDate && parsedDate > options.maxDate) {
      return { isValid: false, error: `Date must be before ${options.maxDate.toISOString()}` };
    }

    // Return sanitized ISO string
    return { 
      isValid: true, 
      sanitizedDate: parsedDate.toISOString() 
    };
  }

  /**
   * Apply length limits with proper truncation
   */
  public applyLengthLimit(input: string, maxLength: number, truncateAtWord: boolean = true): string {
    if (typeof input !== 'string' || maxLength <= 0) {
      return '';
    }

    if (input.length <= maxLength) {
      return input;
    }

    if (!truncateAtWord) {
      return input.substring(0, maxLength);
    }

    // Truncate at word boundary
    const truncated = input.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > maxLength * 0.6) { // Only truncate at word if we don't lose too much
      return truncated.substring(0, lastSpaceIndex);
    }

    return truncated;
  }

  /**
   * Validate pattern and sanitize accordingly
   */
  public validatePattern(input: string, pattern: RegExp, sanitizeOnFail: boolean = true): { isValid: boolean; sanitizedValue?: string; error?: string } {
    if (typeof input !== 'string') {
      return { isValid: false, error: 'Input must be a string' };
    }

    if (pattern.test(input)) {
      return { isValid: true, sanitizedValue: input };
    }

    if (sanitizeOnFail) {
      // Try to sanitize the input to match the pattern
      let sanitized = input.trim(); // Simple trim first
      
      if (pattern.test(sanitized)) {
        return { isValid: true, sanitizedValue: sanitized };
      }
      
      // If still doesn't match, try full sanitization
      sanitized = this.sanitizeText(input, { allowHtml: false, trimWhitespace: true });
      
      if (pattern.test(sanitized)) {
        return { isValid: true, sanitizedValue: sanitized };
      }
    }

    return { isValid: false, error: 'Input does not match required pattern' };
  }

  /**
   * Comprehensive sanitization for all text fields
   */
  public sanitizeAllTextFields(data: Record<string, any>, fieldLimits: Record<string, number> = {}): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        const maxLength = fieldLimits[key];
        sanitized[key] = this.sanitizeText(value, {
          allowHtml: false,
          maxLength,
          trimWhitespace: true,
          removeControlChars: true,
          normalizeUnicode: true
        });
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' 
            ? this.sanitizeText(item, { allowHtml: false, trimWhitespace: true })
            : item
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}