/**
 * Frontend Input Sanitization Service
 * Provides client-side sanitization to prevent XSS and improve data quality
 */

export interface SanitizationOptions {
    allowHtml?: boolean;
    maxLength?: number;
    trimWhitespace?: boolean;
    removeControlChars?: boolean;
    normalizeUnicode?: boolean;
}

export class SanitizationService {
    private static instance: SanitizationService;

    private constructor() { }

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
        }

        // Apply length limit if specified
        if (options.maxLength && sanitized.length > options.maxLength) {
            sanitized = sanitized.substring(0, options.maxLength);
        }

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

        // Remove other dangerous characters
        const dangerousCharsToRemove = ['`', '(', ')', '{', '}', '[', ']', '|', '*', '?', '~', '^'];

        dangerousCharsToRemove.forEach(char => {
            if (!allowedChars.includes(char)) {
                const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                sanitized = sanitized.replace(new RegExp(escapedChar, 'g'), '');
            }
        });

        return sanitized;
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