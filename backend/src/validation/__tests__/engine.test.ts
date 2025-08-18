/**
 * Validation Engine Tests
 * Comprehensive test suite for validation scenarios and edge cases
 */

import { ValidationEngine } from '../engine';
import { authenticationSchema, taskCreationSchema, taskUpdateSchema } from '../schemas';
import { ValidationSchema } from '../types';

describe('ValidationEngine', () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = ValidationEngine.getInstance();
  });

  describe('Basic Validation', () => {
    test('should validate required fields', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'name',
          type: 'string',
          required: true,
          constraints: []
        }
      ];

      const result = engine.validate({}, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('REQUIRED_FIELD_MISSING');
      expect(result.errors[0].field).toBe('name');
    });

    test('should validate optional fields', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'name',
          type: 'string',
          required: false,
          constraints: []
        }
      ];

      const result = engine.validate({}, schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect unexpected fields', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'name',
          type: 'string',
          required: true,
          constraints: []
        }
      ];

      const result = engine.validate({ name: 'test', unexpected: 'value' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNEXPECTED_FIELD')).toBe(true);
    });
  });

  describe('Type Validation', () => {
    test('should validate string type', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'name',
          type: 'string',
          required: true,
          constraints: []
        }
      ];

      const result = engine.validate({ name: 123 }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    test('should validate number type', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'age',
          type: 'number',
          required: true,
          constraints: []
        }
      ];

      const result = engine.validate({ age: 'not-a-number' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    test('should validate date type', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'date',
          type: 'date',
          required: true,
          constraints: []
        }
      ];

      const result = engine.validate({ date: 'invalid-date' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    test('should validate array type', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'items',
          type: 'array',
          required: true,
          constraints: []
        }
      ];

      const result = engine.validate({ items: 'not-an-array' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });
  });

  describe('Constraint Validation', () => {
    test('should validate length constraints', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'name',
          type: 'string',
          required: true,
          constraints: [
            {
              type: 'length',
              value: { min: 2, max: 10 },
              message: 'Name must be between 2 and 10 characters'
            }
          ]
        }
      ];

      // Too short
      let result = engine.validate({ name: 'a' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('LENGTH_TOO_SHORT');

      // Too long
      result = engine.validate({ name: 'this-is-too-long' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('LENGTH_TOO_LONG');

      // Valid length
      result = engine.validate({ name: 'valid' }, schema);
      expect(result.isValid).toBe(true);
    });

    test('should validate pattern constraints', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'username',
          type: 'string',
          required: true,
          constraints: [
            {
              type: 'pattern',
              value: /^[a-zA-Z0-9_]+$/,
              message: 'Username can only contain letters, numbers, and underscores'
            }
          ]
        }
      ];

      // Invalid pattern
      let result = engine.validate({ username: 'user@name' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('PATTERN_MISMATCH');

      // Valid pattern
      result = engine.validate({ username: 'user_name123' }, schema);
      expect(result.isValid).toBe(true);
    });

    test('should validate email constraints', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'email',
          type: 'email',
          required: true,
          constraints: [
            {
              type: 'email',
              value: true,
              message: 'Must be a valid email'
            }
          ]
        }
      ];

      // Invalid email
      let result = engine.validate({ email: 'invalid-email' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_EMAIL');

      // Valid email
      result = engine.validate({ email: 'user@example.com' }, schema);
      expect(result.isValid).toBe(true);
    });

    test('should validate enum constraints', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'status',
          type: 'string',
          required: true,
          constraints: [
            {
              type: 'enum',
              value: ['active', 'inactive', 'pending'],
              message: 'Status must be active, inactive, or pending'
            }
          ]
        }
      ];

      // Invalid enum value
      let result = engine.validate({ status: 'unknown' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_ENUM_VALUE');

      // Valid enum value
      result = engine.validate({ status: 'active' }, schema);
      expect(result.isValid).toBe(true);
    });

    test('should validate date constraints', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'deadline',
          type: 'date',
          required: true,
          constraints: [
            {
              type: 'date',
              value: { format: 'ISO', futureOnly: true },
              message: 'Deadline must be a future date in ISO format'
            }
          ]
        }
      ];

      // Past date
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
      let result = engine.validate({ deadline: pastDate }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('DATE_NOT_FUTURE');

      // Future date
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      result = engine.validate({ deadline: futureDate }, schema);
      expect(result.isValid).toBe(true);
    });

    test('should validate URL constraints', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'website',
          type: 'string',
          required: true,
          constraints: [
            {
              type: 'url',
              value: true,
              message: 'Must be a valid URL'
            }
          ]
        }
      ];

      // Invalid URL
      let result = engine.validate({ website: 'not-a-url' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_URL');

      // Valid URL
      result = engine.validate({ website: 'https://example.com' }, schema);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Custom Validation', () => {
    test('should support custom validators', () => {
      // Register custom validator
      engine.registerCustomValidator('isEven', (value) => {
        return Number(value) % 2 === 0 || 'Value must be even';
      });

      const schema: ValidationSchema[] = [
        {
          field: 'number',
          type: 'number',
          required: true,
          constraints: [
            {
              type: 'custom',
              value: 'isEven',
              message: 'Number must be even'
            }
          ]
        }
      ];

      // Odd number
      let result = engine.validate({ number: 3 }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CUSTOM_VALIDATION_FAILED');

      // Even number
      result = engine.validate({ number: 4 }, schema);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Nested Validation', () => {
    test('should validate array items', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'attachments',
          type: 'array',
          required: true,
          constraints: [],
          nested: [
            {
              field: 'url',
              type: 'string',
              required: true,
              constraints: [
                {
                  type: 'url',
                  value: true,
                  message: 'Must be a valid URL'
                }
              ]
            }
          ]
        }
      ];

      const result = engine.validate({
        attachments: [
          { url: 'https://example.com' },
          { url: 'invalid-url' }
        ]
      }, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('attachments[1].url');
      expect(result.errors[0].code).toBe('INVALID_URL');
    });
  });

  describe('Task Schema Validation', () => {
    test('should validate task creation data', () => {
      const validTask = {
        title: 'Test Task',
        description: 'A test task description',
        deadline: new Date(Date.now() + 86400000).toISOString(),
        priority: 'medium',
        assignedTo: 'user123'
      };

      const result = engine.validate(validTask, taskCreationSchema);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData).toBeDefined();
    });

    test('should reject invalid task creation data', () => {
      const invalidTask = {
        title: '', // Too short
        deadline: 'invalid-date',
        priority: 'invalid-priority',
        assignedTo: 'user@invalid'
      };

      const result = engine.validate(invalidTask, taskCreationSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate task update data', () => {
      const validUpdate = {
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Updated Task',
        status: 'in-progress'
      };

      const result = engine.validate(validUpdate, taskUpdateSchema);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Authentication Schema Validation', () => {
    test('should validate strong password', () => {
      const validAuth = {
        email: 'user@example.com',
        password: 'StrongPass123!'
      };

      const result = engine.validate(validAuth, authenticationSchema);
      expect(result.isValid).toBe(true);
    });

    test('should reject weak password', () => {
      const invalidAuth = {
        email: 'user@example.com',
        password: 'weak'
      };

      const result = engine.validate(invalidAuth, authenticationSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'password')).toBe(true);
    });
  });

  describe('Data Sanitization', () => {
    test('should sanitize valid data', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'name',
          type: 'string',
          required: true,
          constraints: []
        },
        {
          field: 'age',
          type: 'number',
          required: true,
          constraints: []
        }
      ];

      const result = engine.validate({ name: '  John Doe  ', age: '25' }, schema);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.name).toBe('John Doe'); // Trimmed
      expect(result.sanitizedData?.age).toBe(25); // Converted to number
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined values', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'optional',
          type: 'string',
          required: false,
          constraints: []
        }
      ];

      let result = engine.validate({ optional: null }, schema);
      expect(result.isValid).toBe(true);

      result = engine.validate({ optional: undefined }, schema);
      expect(result.isValid).toBe(true);

      result = engine.validate({}, schema);
      expect(result.isValid).toBe(true);
    });

    test('should handle empty strings for required fields', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'required',
          type: 'string',
          required: true,
          constraints: []
        }
      ];

      const result = engine.validate({ required: '' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('REQUIRED_FIELD_MISSING');
    });

    test('should handle complex nested structures', () => {
      const schema: ValidationSchema[] = [
        {
          field: 'user',
          type: 'object',
          required: true,
          constraints: [],
          nested: [
            {
              field: 'name',
              type: 'string',
              required: true,
              constraints: [
                {
                  type: 'length',
                  value: { min: 1 },
                  message: 'Name is required'
                }
              ]
            },
            {
              field: 'contacts',
              type: 'array',
              required: false,
              constraints: [],
              nested: [
                {
                  field: 'email',
                  type: 'email',
                  required: true,
                  constraints: [
                    {
                      type: 'email',
                      value: true,
                      message: 'Must be valid email'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];

      const result = engine.validate({
        user: {
          name: 'John',
          contacts: [
            { email: 'john@example.com' },
            { email: 'invalid-email' }
          ]
        }
      }, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'user.contacts[1].email')).toBe(true);
    });
  });
});