/**
 * Frontend Validation Schemas
 * Mirrors backend validation schemas for consistent client-side validation
 */

import { ValidationSchema } from './validation';

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
                message: 'Deadline must be a valid future date'
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
                value: /^[a-zA-Z0-9\-_@.]+$/,
                message: 'Assigned user contains invalid characters'
            },
            {
                type: 'length',
                value: { min: 1, max: 100 },
                message: 'Assigned user must be between 1 and 100 characters'
            }
        ]
    }
];

// Task Update Schema
export const taskUpdateSchema: ValidationSchema[] = [
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
                message: 'Deadline must be a valid future date'
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
                value: /^[a-zA-Z0-9\-_@.]+$/,
                message: 'Assigned user contains invalid characters'
            },
            {
                type: 'length',
                value: { min: 1, max: 100 },
                message: 'Assigned user must be between 1 and 100 characters'
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

// Field length limits for sanitization
export const fieldLengthLimits = {
    title: 200,
    description: 2000,
    assignedTo: 100,
    email: 254,
    password: 128
};