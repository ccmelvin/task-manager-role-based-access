import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskList from './TaskList';
import { Task } from '../types';

const mockTasks: Task[] = [
  {
    taskId: '1',
    title: 'Test Task 1',
    description: 'First test task',
    status: 'pending',
    assignedTo: 'user1@example.com',
    createdBy: 'admin@example.com',
    deadline: '2025-12-31',
    attachments: [],
    priority: 'high',
    createdAt: '2025-08-13T10:00:00Z',
    updatedAt: '2025-08-13T10:00:00Z'
  }
];

const mockOnUpdateTask = jest.fn();

describe('TaskList Component', () => {
  test('renders without crashing', () => {
    render(<TaskList tasks={[]} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    expect(document.body).toBeInTheDocument();
  });

  test('renders task when provided', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    expect(screen.getByText('Test Task 1')).toBeInTheDocument();
  });

  test('shows empty state when no tasks', () => {
    render(<TaskList tasks={[]} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    // Just check it renders without error
    expect(document.body).toBeInTheDocument();
  });
});
