/**
 * Validation Schema Definitions
 * Defines validation schemas for all API endpoints
 */

import { SchemaRegistry, ValidationSchema } from './types';

// Task Creation Schema
export const taskCreationSchema: ValidationSchema[] = [
  {
    field: 'title',
    type: 'string',
    required: true,
    constraints: [
      {
        type: 'length',
        value: { min: 1, max: 200 },
        message: 'Title must be between 1 and 200 characters'
      },
      {
        type: 'pattern',
        value: /^[a-zA-Z0-9\s\-_.,!?()]+$/,
        message: 'Title contains invalid characters'
      }
    ]
  },
  {
    field: 'description',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'length',
        value: { max: 2000 },
        message: 'Description must not exceed 2000 characters'
      }
    ]
  },
  {
    field: 'deadline',
    type: 'date',
    required: true,
    constraints: [
      {
        type: 'date',
        value: { format: 'ISO', futureOnly: true },
        message: 'Deadline must be a valid future date in ISO format'
      }
    ]
  },
  {
    field: 'priority',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'enum',
        value: ['low', 'medium', 'high'],
        message: 'Priority must be one of: low, medium, high'
      }
    ]
  },
  {
    field: 'assignedTo',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'pattern',
        value: /^[a-zA-Z0-9\-_]+$/,
        message: 'Assigned user ID contains invalid characters'
      },
      {
        type: 'length',
        value: { min: 1, max: 100 },
        message: 'Assigned user ID must be between 1 and 100 characters'
      }
    ]
  },
  {
    field: 'attachments',
    type: 'array',
    required: false,
    constraints: [
      {
        type: 'length',
        value: { max: 10 },
        message: 'Maximum 10 attachments allowed'
      }
    ],
    nested: [
      {
        field: 'attachment',
        type: 'string',
        required: true,
        constraints: [
          {
            type: 'url',
            value: true,
            message: 'Attachment must be a valid URL'
          },
          {
            type: 'length',
            value: { max: 500 },
            message: 'Attachment URL must not exceed 500 characters'
          }
        ]
      }
    ]
  }
];

// Task Update Schema (similar to creation but all fields optional except taskId)
export const taskUpdateSchema: ValidationSchema[] = [
  {
    field: 'taskId',
    type: 'string',
    required: true,
    constraints: [
      {
        type: 'pattern',
        value: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
        message: 'Task ID must be a valid UUID'
      }
    ]
  },
  {
    field: 'title',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'length',
        value: { min: 1, max: 200 },
        message: 'Title must be between 1 and 200 characters'
      },
      {
        type: 'pattern',
        value: /^[a-zA-Z0-9\s\-_.,!?()]+$/,
        message: 'Title contains invalid characters'
      }
    ]
  },
  {
    field: 'description',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'length',
        value: { max: 2000 },
        message: 'Description must not exceed 2000 characters'
      }
    ]
  },
  {
    field: 'status',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'enum',
        value: ['pending', 'in-progress', 'completed'],
        message: 'Status must be one of: pending, in-progress, completed'
      }
    ]
  },
  {
    field: 'deadline',
    type: 'date',
    required: false,
    constraints: [
      {
        type: 'date',
        value: { format: 'ISO', futureOnly: true },
        message: 'Deadline must be a valid future date in ISO format'
      }
    ]
  },
  {
    field: 'priority',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'enum',
        value: ['low', 'medium', 'high'],
        message: 'Priority must be one of: low, medium, high'
      }
    ]
  },
  {
    field: 'assignedTo',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'pattern',
        value: /^[a-zA-Z0-9\-_]+$/,
        message: 'Assigned user ID contains invalid characters'
      },
      {
        type: 'length',
        value: { min: 1, max: 100 },
        message: 'Assigned user ID must be between 1 and 100 characters'
      }
    ]
  }
];

// User Profile Schema
export const userProfileSchema: ValidationSchema[] = [
  {
    field: 'email',
    type: 'email',
    required: true,
    constraints: [
      {
        type: 'email',
        value: true,
        message: 'Must be a valid email address'
      },
      {
        type: 'length',
        value: { max: 254 },
        message: 'Email must not exceed 254 characters'
      }
    ]
  },
  {
    field: 'role',
    type: 'string',
    required: true,
    constraints: [
      {
        type: 'enum',
        value: ['Admin', 'Contributor', 'Viewer'],
        message: 'Role must be one of: Admin, Contributor, Viewer'
      }
    ]
  }
];

// Authentication Schema
export const authenticationSchema: ValidationSchema[] = [
  {
    field: 'email',
    type: 'email',
    required: true,
    constraints: [
      {
        type: 'email',
        value: true,
        message: 'Must be a valid email address'
      }
    ]
  },
  {
    field: 'password',
    type: 'string',
    required: true,
    constraints: [
      {
        type: 'length',
        value: { min: 8, max: 128 },
        message: 'Password must be between 8 and 128 characters'
      },
      {
        type: 'pattern',
        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      }
    ]
  }
];

// Query Parameters Schema for GET requests
export const taskQuerySchema: ValidationSchema[] = [
  {
    field: 'limit',
    type: 'number',
    required: false,
    constraints: [
      {
        type: 'range',
        value: { min: 1, max: 100 },
        message: 'Limit must be between 1 and 100'
      }
    ]
  },
  {
    field: 'offset',
    type: 'number',
    required: false,
    constraints: [
      {
        type: 'range',
        value: { min: 0, max: 10000 },
        message: 'Offset must be between 0 and 10000'
      }
    ]
  },
  {
    field: 'status',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'enum',
        value: ['pending', 'in-progress', 'completed'],
        message: 'Status filter must be one of: pending, in-progress, completed'
      }
    ]
  },
  {
    field: 'priority',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'enum',
        value: ['low', 'medium', 'high'],
        message: 'Priority filter must be one of: low, medium, high'
      }
    ]
  },
  {
    field: 'assignedTo',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'pattern',
        value: /^[a-zA-Z0-9\-_]+$/,
        message: 'Assigned user ID contains invalid characters'
      },
      {
        type: 'length',
        value: { min: 1, max: 100 },
        message: 'Assigned user ID must be between 1 and 100 characters'
      }
    ]
  }
];

// Path Parameters Schema
export const taskPathSchema: ValidationSchema[] = [
  {
    field: 'taskId',
    type: 'string',
    required: true,
    constraints: [
      {
        type: 'pattern',
        value: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
        message: 'Task ID must be a valid UUID'
      }
    ]
  }
];

// Request Headers Schema (for validation of custom headers)
export const requestHeadersSchema: ValidationSchema[] = [
  {
    field: 'Content-Type',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'enum',
        value: ['application/json', 'application/x-www-form-urlencoded'],
        message: 'Content-Type must be application/json or application/x-www-form-urlencoded'
      }
    ]
  },
  {
    field: 'User-Agent',
    type: 'string',
    required: false,
    constraints: [
      {
        type: 'length',
        value: { min: 10, max: 500 },
        message: 'User-Agent must be between 10 and 500 characters'
      },
      {
        type: 'pattern',
        value: /^[a-zA-Z0-9\s\-_.,;:()\[\]\/\\]+$/,
        message: 'User-Agent contains invalid characters'
      }
    ]
  }
];

// Schema Registry
export const schemaRegistry: SchemaRegistry = {
  taskCreation: taskCreationSchema,
  taskUpdate: taskUpdateSchema,
  userProfile: userProfileSchema,
  authentication: authenticationSchema,
  taskQuery: taskQuerySchema,
  taskPath: taskPathSchema,
  requestHeaders: requestHeadersSchema
};