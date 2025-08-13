import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  },
  {
    taskId: '2',
    title: 'Test Task 2',
    description: 'Second test task',
    status: 'in-progress',
    assignedTo: 'user2@example.com',
    createdBy: 'admin@example.com',
    deadline: '2025-12-25',
    attachments: [],
    priority: 'medium',
    createdAt: '2025-08-13T09:00:00Z',
    updatedAt: '2025-08-13T11:00:00Z'
  },
  {
    taskId: '3',
    title: 'Test Task 3',
    description: 'Third test task',
    status: 'completed',
    assignedTo: 'user3@example.com',
    createdBy: 'manager@example.com',
    deadline: '2025-12-20',
    attachments: [],
    priority: 'low',
    createdAt: '2025-08-13T08:00:00Z',
    updatedAt: '2025-08-13T12:00:00Z'
  }
];

const mockOnUpdateTask = jest.fn();

describe('TaskList Component', () => {
  beforeEach(() => {
    mockOnUpdateTask.mockClear();
  });

  test('renders task list with tasks', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    // Check that all tasks are rendered
    expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    expect(screen.getByText('Test Task 2')).toBeInTheDocument();
    expect(screen.getByText('Test Task 3')).toBeInTheDocument();
  });

  test('displays task details correctly', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    // Check task details
    expect(screen.getByText('First test task')).toBeInTheDocument();
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  test('shows status selectors for admin users', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    // Admin should see status selectors
    const statusSelects = screen.getAllByRole('combobox');
    expect(statusSelects).toHaveLength(mockTasks.length);
  });

  test('shows status selectors for contributor users', () => {
    render(<TaskList tasks={mockTasks} userRole="Contributor" onUpdateTask={mockOnUpdateTask} />);
    
    // Contributor should see status selectors
    const statusSelects = screen.getAllByRole('combobox');
    expect(statusSelects).toHaveLength(mockTasks.length);
  });

  test('hides status selectors for regular users', () => {
    render(<TaskList tasks={mockTasks} userRole="User" onUpdateTask={mockOnUpdateTask} />);
    
    // Regular users should not see status selectors
    const statusSelects = screen.queryAllByRole('combobox');
    expect(statusSelects).toHaveLength(0);
  });

  test('calls onUpdateTask when status is changed', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    // Find the first status selector and change it
    const statusSelects = screen.getAllByRole('combobox');
    fireEvent.change(statusSelects[0], { target: { value: 'completed' } });
    
    // Check that onUpdateTask was called
    expect(mockOnUpdateTask).toHaveBeenCalledWith('1', { status: 'completed' });
  });

  test('displays correct status colors', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    // Check for status color classes
    const pendingStatus = screen.getByText('pending');
    const inProgressStatus = screen.getByText('in-progress');
    const completedStatus = screen.getByText('completed');
    
    expect(pendingStatus).toHaveClass('bg-gray-100', 'text-gray-800');
    expect(inProgressStatus).toHaveClass('bg-yellow-100', 'text-yellow-800');
    expect(completedStatus).toHaveClass('bg-green-100', 'text-green-800');
  });

  test('displays correct priority colors', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    // Check for priority color classes
    const highPriority = screen.getByText('high');
    const mediumPriority = screen.getByText('medium');
    const lowPriority = screen.getByText('low');
    
    expect(highPriority).toHaveClass('bg-red-100', 'text-red-800');
    expect(mediumPriority).toHaveClass('bg-orange-100', 'text-orange-800');
    expect(lowPriority).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  test('formats deadline correctly', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    // Check that deadlines are formatted
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
  });

  test('shows empty state when no tasks', () => {
    render(<TaskList tasks={[]} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    // Should show empty state message
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
  });

  test('displays assigned user information', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    // Check assigned user display
    expect(screen.getByText(/Assigned to: user1@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Assigned to: user2@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Assigned to: user3@example.com/)).toBeInTheDocument();
  });

  test('handles multiple status changes', () => {
    render(<TaskList tasks={mockTasks} userRole="Admin" onUpdateTask={mockOnUpdateTask} />);
    
    const statusSelects = screen.getAllByRole('combobox');
    
    // Change multiple task statuses
    fireEvent.change(statusSelects[0], { target: { value: 'in-progress' } });
    fireEvent.change(statusSelects[1], { target: { value: 'completed' } });
    
    // Check that onUpdateTask was called for both
    expect(mockOnUpdateTask).toHaveBeenCalledWith('1', { status: 'in-progress' });
    expect(mockOnUpdateTask).toHaveBeenCalledWith('2', { status: 'completed' });
    expect(mockOnUpdateTask).toHaveBeenCalledTimes(2);
  });
});
