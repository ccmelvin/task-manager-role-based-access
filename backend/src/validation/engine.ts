/**
 * Validation Engine
 * Core validation logic that processes schemas and validates input data
 */

import {
    CustomValidationFunction,
    ValidationContext,
    ValidationError,
    ValidationResult,
    ValidationSchema
} from './types';

export class ValidationEngine {
  private static instance: ValidationEngine;
  private customValidators: Map<string, CustomValidationFunction> = new Map();

  private constructor() {}

  public static getInstance(): ValidationEngine {
    if (!ValidationEngine.instance) {
      ValidationEngine.instance = new ValidationEngine();
    }
    return ValidationEngine.instance;
  }

  /**
   * Register a custom validation function
   */
  public registerCustomValidator(name: string, validator: CustomValidationFunction): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Validate data against a schema
   */
  public validate(
    data: any, 
    schema: ValidationSchema[], 
    context?: ValidationContext
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitizedData: any = {};

    // Check for required fields
    for (const fieldSchema of schema) {
      const value = data[fieldSchema.field];
      
      if (fieldSchema.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: fieldSchema.field,
          message: `${fieldSchema.field} is required`,
          code: 'REQUIRED_FIELD_MISSING',
          value
        });
        continue;
      }

      // Skip validation if field is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Validate field
      const fieldErrors = this.validateField(value, fieldSchema, context);
      errors.push(...fieldErrors);

      // If no errors, add to sanitized data
      if (fieldErrors.length === 0) {
        sanitizedData[fieldSchema.field] = this.sanitizeValue(value, fieldSchema);
      }
    }

    // Check for unexpected fields
    for (const key in data) {
      const fieldSchema = schema.find(s => s.field === key);
      if (!fieldSchema) {
        errors.push({
          field: key,
          message: `Unexpected field: ${key}`,
          code: 'UNEXPECTED_FIELD',
          value: data[key]
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }

  /**
   * Validate a single field against its schema
   */
  private validateField(
    value: any, 
    schema: ValidationSchema, 
    context?: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Type validation
    if (!this.validateType(value, schema.type)) {
      errors.push({
        field: schema.field,
        message: `${schema.field} must be of type ${schema.type}`,
        code: 'INVALID_TYPE',
        value
      });
      return errors; // Don't continue if type is wrong
    }

    // Constraint validation
    for (const constraint of schema.constraints) {
      const constraintError = this.validateConstraint(value, constraint, schema.field);
      if (constraintError) {
        errors.push(constraintError);
      }
    }

    // Nested validation for arrays and objects
    if (schema.nested && (schema.type === 'array' || schema.type === 'object')) {
      const nestedErrors = this.validateNested(value, schema, context);
      errors.push(...nestedErrors);
    }

    return errors;
  }

  /**
   * Validate value type
   */
  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return (typeof value === 'number' && !isNaN(value)) || 
               (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '');
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return typeof value === 'string' && !isNaN(Date.parse(value));
      case 'email':
        return typeof value === 'string';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Validate a constraint
   */
  private validateConstraint(
    value: any, 
    constraint: any, 
    fieldName: string
  ): ValidationError | null {
    switch (constraint.type) {
      case 'length':
        return this.validateLength(value, constraint, fieldName);
      case 'pattern':
        return this.validatePattern(value, constraint, fieldName);
      case 'range':
        return this.validateRange(value, constraint, fieldName);
      case 'email':
        return this.validateEmail(value, constraint, fieldName);
      case 'url':
        return this.validateUrl(value, constraint, fieldName);
      case 'date':
        return this.validateDate(value, constraint, fieldName);
      case 'enum':
        return this.validateEnum(value, constraint, fieldName);
      case 'custom':
        return this.validateCustom(value, constraint, fieldName);
      default:
        return null;
    }
  }

  private validateLength(value: any, constraint: any, fieldName: string): ValidationError | null {
    const length = Array.isArray(value) ? value.length : String(value).length;
    const { min, max } = constraint.value;

    if (min !== undefined && length < min) {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'LENGTH_TOO_SHORT',
        value
      };
    }

    if (max !== undefined && length > max) {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'LENGTH_TOO_LONG',
        value
      };
    }

    return null;
  }

  private validatePattern(value: any, constraint: any, fieldName: string): ValidationError | null {
    const pattern = constraint.value;
    if (!pattern.test(String(value))) {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'PATTERN_MISMATCH',
        value
      };
    }
    return null;
  }

  private validateRange(value: any, constraint: any, fieldName: string): ValidationError | null {
    const numValue = Number(value);
    const { min, max } = constraint.value;

    if (min !== undefined && numValue < min) {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'VALUE_TOO_SMALL',
        value
      };
    }

    if (max !== undefined && numValue > max) {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'VALUE_TOO_LARGE',
        value
      };
    }

    return null;
  }

  private validateEmail(value: any, constraint: any, fieldName: string): ValidationError | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(value))) {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'INVALID_EMAIL',
        value
      };
    }
    return null;
  }

  private validateUrl(value: any, constraint: any, fieldName: string): ValidationError | null {
    try {
      new URL(String(value));
      return null;
    } catch {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'INVALID_URL',
        value
      };
    }
  }

  private validateDate(value: any, constraint: any, fieldName: string): ValidationError | null {
    const dateValue = new Date(value);
    
    if (isNaN(dateValue.getTime())) {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'INVALID_DATE',
        value
      };
    }

    // Check ISO format if required
    if (constraint.value.format === 'ISO') {
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      if (!isoRegex.test(String(value))) {
        return {
          field: fieldName,
          message: constraint.message,
          code: 'INVALID_DATE_FORMAT',
          value
        };
      }
    }

    // Check if future date is required
    if (constraint.value.futureOnly && dateValue <= new Date()) {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'DATE_NOT_FUTURE',
        value
      };
    }

    return null;
  }

  private validateEnum(value: any, constraint: any, fieldName: string): ValidationError | null {
    if (!constraint.value.includes(value)) {
      return {
        field: fieldName,
        message: constraint.message,
        code: 'INVALID_ENUM_VALUE',
        value
      };
    }
    return null;
  }

  private validateCustom(value: any, constraint: any, fieldName: string): ValidationError | null {
    const validator = this.customValidators.get(constraint.value);
    if (!validator) {
      return {
        field: fieldName,
        message: 'Custom validator not found',
        code: 'CUSTOM_VALIDATOR_NOT_FOUND',
        value
      };
    }

    const result = validator(value);
    if (result !== true) {
      return {
        field: fieldName,
        message: typeof result === 'string' ? result : constraint.message,
        code: 'CUSTOM_VALIDATION_FAILED',
        value
      };
    }

    return null;
  }

  private validateNested(
    value: any, 
    schema: ValidationSchema, 
    context?: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (schema.type === 'array' && Array.isArray(value)) {
      value.forEach((item, index) => {
        if (schema.nested) {
          const nestedResult = this.validate(item, schema.nested, context);
          nestedResult.errors.forEach(error => {
            errors.push({
              ...error,
              field: `${schema.field}[${index}].${error.field}`
            });
          });
        }
      });
    } else if (schema.type === 'object' && schema.nested) {
      const nestedResult = this.validate(value, schema.nested, context);
      nestedResult.errors.forEach(error => {
        errors.push({
          ...error,
          field: `${schema.field}.${error.field}`
        });
      });
    }

    return errors;
  }

  /**
   * Sanitize value based on schema type
   */
  private sanitizeValue(value: any, schema: ValidationSchema): any {
    switch (schema.type) {
      case 'string':
        return String(value).trim();
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value).toISOString();
      case 'array':
        return Array.isArray(value) ? value : [value];
      default:
        return value;
    }
  }
}