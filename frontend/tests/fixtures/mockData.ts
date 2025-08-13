import { Task, UserProfile } from '../../src/types';

export const mockUsers: UserProfile[] = [
  {
    email: 'admin@example.com',
    role: 'Admin'
  },
  {
    email: 'manager@example.com',
    role: 'Manager'
  },
  {
    email: 'user@example.com',
    role: 'User'
  }
];

export const mockTasks: Task[] = [
  {
    taskId: '1',
    title: 'Setup AWS Infrastructure',
    description: 'Deploy CDK stack and configure services',
    status: 'in-progress',
    assignedTo: 'admin@example.com',
    createdBy: 'admin@example.com',
    deadline: '2025-07-01',
    attachments: [],
    priority: 'high',
    createdAt: '2025-06-27T10:00:00Z',
    updatedAt: '2025-06-27T10:00:00Z'
  },
  {
    taskId: '2',
    title: 'Implement User Authentication',
    description: 'Set up AWS Cognito for user management',
    status: 'completed',
    assignedTo: 'manager@example.com',
    createdBy: 'admin@example.com',
    deadline: '2025-06-30',
    attachments: [],
    priority: 'medium',
    createdAt: '2025-06-25T09:00:00Z',
    updatedAt: '2025-06-28T15:30:00Z'
  },
  {
    taskId: '3',
    title: 'Create Task Management UI',
    description: 'Build React components for task CRUD operations',
    status: 'pending',
    assignedTo: 'user@example.com',
    createdBy: 'manager@example.com',
    deadline: '2025-07-05',
    attachments: [],
    priority: 'medium',
    createdAt: '2025-06-26T14:00:00Z',
    updatedAt: '2025-06-26T14:00:00Z'
  },
  {
    taskId: '4',
    title: 'Write Unit Tests',
    description: 'Add comprehensive test coverage for all components',
    status: 'in-progress',
    assignedTo: 'user@example.com',
    createdBy: 'admin@example.com',
    deadline: '2025-07-10',
    attachments: [],
    priority: 'low',
    createdAt: '2025-06-27T11:00:00Z',
    updatedAt: '2025-06-27T16:45:00Z'
  }
];

export const newTaskData = {
  title: 'New Test Task',
  description: 'This is a test task created by Playwright',
  deadline: '2025-08-15',
  priority: 'high' as Task['priority'],
  assignedTo: 'admin@example.com'
};

export const updatedTaskData = {
  title: 'Updated Test Task',
  description: 'This task has been updated by Playwright tests',
  status: 'completed' as Task['status']
};
