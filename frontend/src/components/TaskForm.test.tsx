import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TaskForm from './TaskForm';

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

describe('TaskForm Component', () => {
  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnCancel.mockClear();
  });

  test('renders form with all required fields', () => {
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Check for form title
    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    
    // Check for all form fields
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Deadline/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Priority/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Assign To/)).toBeInTheDocument();
    
    // Check for buttons
    expect(screen.getByText('Create Task')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('shows required field indicators', () => {
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Check for required field asterisks
    expect(screen.getByText(/Title \*/)).toBeInTheDocument();
    expect(screen.getByText(/Description \*/)).toBeInTheDocument();
    expect(screen.getByText(/Deadline \*/)).toBeInTheDocument();
  });

  test('has proper form field attributes', () => {
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Check for required attributes
    const titleInput = screen.getByLabelText(/Title/);
    const descInput = screen.getByLabelText(/Description/);
    const deadlineInput = screen.getByLabelText(/Deadline/);
    
    expect(titleInput).toHaveAttribute('required');
    expect(titleInput).toHaveAttribute('aria-required', 'true');
    
    expect(descInput).toHaveAttribute('required');
    expect(descInput).toHaveAttribute('aria-required', 'true');
    
    expect(deadlineInput).toHaveAttribute('required');
    expect(deadlineInput).toHaveAttribute('aria-required', 'true');
  });

  test('allows user to fill form fields', async () => {
    const user = userEvent.setup();
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Fill form fields
    await user.type(screen.getByLabelText(/Title/), 'Test Task Title');
    await user.type(screen.getByLabelText(/Description/), 'Test task description');
    await user.type(screen.getByLabelText(/Deadline/), '2025-12-31');
    await user.selectOptions(screen.getByLabelText(/Priority/), 'high');
    await user.type(screen.getByLabelText(/Assign To/), 'test@example.com');
    
    // Check that values were entered
    expect(screen.getByDisplayValue('Test Task Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test task description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2025-12-31')).toBeInTheDocument();
    expect(screen.getByLabelText(/Priority/)).toHaveValue('high');
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Fill required fields
    await user.type(screen.getByLabelText(/Title/), 'Test Task');
    await user.type(screen.getByLabelText(/Description/), 'Test description');
    await user.type(screen.getByLabelText(/Deadline/), '2025-12-31');
    
    // Submit form
    await user.click(screen.getByText('Create Task'));
    
    // Check that onSubmit was called with correct data
    expect(mockOnSubmit).toHaveBeenCalledWith({
      title: 'Test Task',
      description: 'Test description',
      deadline: '2025-12-31',
      priority: 'medium', // default value
      assignedTo: ''
    });
  });

  test('shows validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Try to submit empty form
    await user.click(screen.getByText('Create Task'));
    
    // Check for validation error messages
    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
      expect(screen.getByText('Description is required')).toBeInTheDocument();
      expect(screen.getByText('Deadline is required')).toBeInTheDocument();
    });
    
    // onSubmit should not have been called
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('shows error styling on invalid fields', async () => {
    const user = userEvent.setup();
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Submit empty form to trigger validation
    await user.click(screen.getByText('Create Task'));
    
    await waitFor(() => {
      // Check that inputs have error styling
      const titleInput = screen.getByLabelText(/Title/);
      const descInput = screen.getByLabelText(/Description/);
      const deadlineInput = screen.getByLabelText(/Deadline/);
      
      expect(titleInput).toHaveClass('border-red-500');
      expect(descInput).toHaveClass('border-red-500');
      expect(deadlineInput).toHaveClass('border-red-500');
    });
  });

  test('clears validation errors when user starts typing', async () => {
    const user = userEvent.setup();
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Submit empty form to trigger validation
    await user.click(screen.getByText('Create Task'));
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
    
    // Start typing in title field
    await user.type(screen.getByLabelText(/Title/), 'Test');
    
    // Error should disappear
    await waitFor(() => {
      expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
    });
  });

  test('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test('has default priority value', () => {
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    const prioritySelect = screen.getByLabelText(/Priority/);
    expect(prioritySelect).toHaveValue('medium');
  });

  test('allows changing priority', async () => {
    const user = userEvent.setup();
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    const prioritySelect = screen.getByLabelText(/Priority/);
    
    await user.selectOptions(prioritySelect, 'high');
    expect(prioritySelect).toHaveValue('high');
    
    await user.selectOptions(prioritySelect, 'low');
    expect(prioritySelect).toHaveValue('low');
  });

  test('has proper form accessibility', () => {
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Check that all inputs have proper labels
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Deadline/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Priority/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Assign To/)).toBeInTheDocument();
    
    // Check that buttons are properly labeled
    expect(screen.getByRole('button', { name: /Create Task/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
  });

  test('handles email input type for assignment field', () => {
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    const assignInput = screen.getByLabelText(/Assign To/);
    expect(assignInput).toHaveAttribute('type', 'email');
  });

  test('shows placeholder text for assignment field', () => {
    render(<TaskForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    const assignInput = screen.getByLabelText(/Assign To/);
    expect(assignInput).toHaveAttribute('placeholder', 'Leave empty to assign to yourself');
  });
});
