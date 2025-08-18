/**
 * Validation Schema System Types
 * Defines interfaces for comprehensive input validation
 */

export type ValidationConstraintType = 
  | 'length' 
  | 'pattern' 
  | 'range' 
  | 'custom' 
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
  | 'array' 
  | 'object';

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
  nested?: ValidationSchema[]; // For object and array validation
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface SchemaRegistry {
  taskCreation: ValidationSchema[];
  taskUpdate: ValidationSchema[];
  userProfile: ValidationSchema[];
  authentication: ValidationSchema[];
  taskQuery: ValidationSchema[];
  taskPath: ValidationSchema[];
  requestHeaders: ValidationSchema[];
}

// Custom validation function type
export type CustomValidationFunction = (value: any, context?: any) => boolean | string;

// Validation context for custom validations
export interface ValidationContext {
  userId?: string;
  userRole?: string;
  requestData?: any;
}