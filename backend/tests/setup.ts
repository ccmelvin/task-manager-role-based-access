/**
 * Test setup for backend Lambda functions
 */

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

// Set test environment variables
process.env.TASKS_TABLE = 'test-tasks-table';
process.env.AWS_REGION = 'us-east-1';

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Mock UUID for consistent testing
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Mock current time for consistent testing
const mockDate = new Date('2025-08-13T12:00:00.000Z');
global.Date = class extends Date {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(mockDate);
    } else {
      super(...args);
    }
  }
  
  static now() {
    return mockDate.getTime();
  }
} as any;
