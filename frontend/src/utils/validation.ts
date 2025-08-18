/**
 * Frontend Validation System
 * Mirrors backend validation schemas for client-side validation
 */

export type ValidationConstraintType =
    | 'length'
    | 'pattern'
    | 'range'
    | 'email'
    | 'url'
    | 'date'
    | 'enum';

export type ValidationFieldType =
    | 'string'
    | 'number'
    | 'date'
    | 'email'
    | 'boolean'
    | 'array';

export interface ValidationConstraint {
    type: ValidationConstraintType;
    value: any;
    message: string;
}

export interface ValidationSchema {
    field: string;
    type: ValidationFieldType;
    required: boolean;
    constraints: ValidationConstraint[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    sanitizedData?: any;
    sanitizedValue?: any;
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
    value?: any;
}

export class ValidationService {
    private static instance: ValidationService;

    private constructor() { }

    public static getInstance(): ValidationService {
        if (!ValidationService.instance) {
            ValidationService.instance = new ValidationService();
        }
        return ValidationService.instance;
    }

    /**
     * Validate data against a schema
     */
    public validate(data: Record<string, any>, schema: ValidationSchema[]): ValidationResult {
        const errors: ValidationError[] = [];
        const sanitizedData: Record<string, any> = {};

        for (const fieldSchema of schema) {
            const value = data[fieldSchema.field];
            const fieldResult = this.validateField(value, fieldSchema);

            if (!fieldResult.isValid) {
                errors.push(...fieldResult.errors);
            } else if (fieldResult.sanitizedValue !== undefined) {
                sanitizedData[fieldSchema.field] = fieldResult.sanitizedValue;
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitizedData: errors.length === 0 ? sanitizedData : undefined
        };
    }

    /**
     * Validate a single field
     */
    private validateField(value: any, schema: ValidationSchema): ValidationResult {
        const errors: ValidationError[] = [];

        // Check if required field is present
        if (schema.required && (value === undefined || value === null || value === '')) {
            errors.push({
                field: schema.field,
                message: `${schema.field} is required`,
                code: 'REQUIRED',
                value
            });
            return { isValid: false, errors };
        }

        // Skip validation if field is not required and empty
        if (!schema.required && (value === undefined || value === null || value === '')) {
            return { isValid: true, errors: [], sanitizedValue: value };
        }

        // Type validation and conversion
        const typeResult = this.validateType(value, schema.type, schema.field);
        if (!typeResult.isValid) {
            errors.push(...typeResult.errors);
            return { isValid: false, errors };
        }

        let sanitizedValue = typeResult.sanitizedValue;

        // Constraint validation
        for (const constraint of schema.constraints) {
            const constraintResult = this.validateConstraint(sanitizedValue, constraint, schema.field);
            if (!constraintResult.isValid) {
                errors.push(...constraintResult.errors);
            } else if (constraintResult.sanitizedValue !== undefined) {
                sanitizedValue = constraintResult.sanitizedValue;
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitizedValue: errors.length === 0 ? sanitizedValue : undefined
        };
    }

    /**
     * Validate field type
     */
    private validateType(value: any, type: ValidationFieldType, fieldName: string): ValidationResult {
        const errors: ValidationError[] = [];

        switch (type) {
            case 'string':
                if (typeof value !== 'string') {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be a string`,
                        code: 'INVALID_TYPE',
                        value
                    });
                }
                break;

            case 'number':
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be a valid number`,
                        code: 'INVALID_TYPE',
                        value
                    });
                } else {
                    return { isValid: true, errors: [], sanitizedValue: numValue };
                }
                break;

            case 'email':
                if (typeof value !== 'string') {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be a string`,
                        code: 'INVALID_TYPE',
                        value
                    });
                }
                break;

            case 'date':
                const dateValue = new Date(value);
                if (isNaN(dateValue.getTime())) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be a valid date`,
                        code: 'INVALID_TYPE',
                        value
                    });
                } else {
                    return { isValid: true, errors: [], sanitizedValue: dateValue.toISOString() };
                }
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be a boolean`,
                        code: 'INVALID_TYPE',
                        value
                    });
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be an array`,
                        code: 'INVALID_TYPE',
                        value
                    });
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitizedValue: value
        };
    }

    /**
     * Validate constraint
     */
    private validateConstraint(value: any, constraint: ValidationConstraint, fieldName: string): ValidationResult {
        const errors: ValidationError[] = [];

        switch (constraint.type) {
            case 'length':
                if (typeof value === 'string' || Array.isArray(value)) {
                    const length = value.length;
                    const { min, max } = constraint.value;

                    if (min !== undefined && length < min) {
                        errors.push({
                            field: fieldName,
                            message: constraint.message,
                            code: 'LENGTH_TOO_SHORT',
                            value
                        });
                    }

                    if (max !== undefined && length > max) {
                        // Truncate if too long
                        const truncated = typeof value === 'string'
                            ? value.substring(0, max)
                            : value.slice(0, max);

                        return {
                            isValid: true,
                            errors: [],
                            sanitizedValue: truncated
                        };
                    }
                }
                break;

            case 'pattern':
                if (typeof value === 'string') {
                    const regex = constraint.value instanceof RegExp ? constraint.value : new RegExp(constraint.value);
                    if (!regex.test(value)) {
                        errors.push({
                            field: fieldName,
                            message: constraint.message,
                            code: 'PATTERN_MISMATCH',
                            value
                        });
                    }
                }
                break;

            case 'range':
                if (typeof value === 'number') {
                    const { min, max } = constraint.value;

                    if (min !== undefined && value < min) {
                        errors.push({
                            field: fieldName,
                            message: constraint.message,
                            code: 'VALUE_TOO_SMALL',
                            value
                        });
                    }

                    if (max !== undefined && value > max) {
                        errors.push({
                            field: fieldName,
                            message: constraint.message,
                            code: 'VALUE_TOO_LARGE',
                            value
                        });
                    }
                }
                break;

            case 'email':
                if (typeof value === 'string') {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(value)) {
                        errors.push({
                            field: fieldName,
                            message: constraint.message,
                            code: 'INVALID_EMAIL',
                            value
                        });
                    }
                }
                break;

            case 'url':
                if (typeof value === 'string') {
                    try {
                        new URL(value);
                    } catch {
                        errors.push({
                            field: fieldName,
                            message: constraint.message,
                            code: 'INVALID_URL',
                            value
                        });
                    }
                }
                break;

            case 'date':
                if (typeof value === 'string') {
                    const dateValue = new Date(value);
                    if (isNaN(dateValue.getTime())) {
                        errors.push({
                            field: fieldName,
                            message: constraint.message,
                            code: 'INVALID_DATE',
                            value
                        });
                    } else {
                        const { format, futureOnly } = constraint.value;

                        if (format === 'ISO') {
                            const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
                            if (!isoRegex.test(value)) {
                                errors.push({
                                    field: fieldName,
                                    message: 'Date must be in ISO format',
                                    code: 'INVALID_DATE_FORMAT',
                                    value
                                });
                            }
                        }

                        if (futureOnly && dateValue <= new Date()) {
                            errors.push({
                                field: fieldName,
                                message: 'Date must be in the future',
                                code: 'DATE_NOT_FUTURE',
                                value
                            });
                        }
                    }
                }
                break;

            case 'enum':
                if (!constraint.value.includes(value)) {
                    errors.push({
                        field: fieldName,
                        message: constraint.message,
                        code: 'INVALID_ENUM_VALUE',
                        value
                    });
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitizedValue: value
        };
    }

    /**
     * Real-time validation for a single field
     */
    public validateSingleField(value: any, schema: ValidationSchema): ValidationResult {
        return this.validateField(value, schema);
    }
}