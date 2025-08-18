import React, { useCallback, useState } from 'react';
import { useValidation } from '../hooks/useValidation';
import { Task } from '../types';
import { taskCreationSchema } from '../utils/validationSchemas';
import ValidatedInput from './ValidatedInput';
import ValidatedTextArea from './ValidatedTextArea';

interface TaskFormProps {
  onSubmit: (taskData: Partial<Task>) => void;
  onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline: '',
    priority: 'medium' as Task['priority'],
    assignedTo: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    errors,
    isValid,
    isValidating,
    sanitizedData,
    getFieldError,
    getFieldErrors,
    isFieldValid,
    isFieldTouched,
    handleFieldChange,
    handleFieldBlur,
    validateForm,
    clearValidation
  } = useValidation(taskCreationSchema, {
    validateOnChange: true,
    validateOnBlur: true,
    sanitizeOnChange: true,
    debounceMs: 300
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const validationResult = validateForm(formData);
      
      if (validationResult.isValid && validationResult.sanitizedData) {
        // Use sanitized data for submission
        await onSubmit(validationResult.sanitizedData);
        
        // Clear form on successful submission
        setFormData({
          title: '',
          description: '',
          deadline: '',
          priority: 'medium',
          assignedTo: '',
        });
        clearValidation();
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onSubmit, clearValidation]);

  const handleInputChange = useCallback((name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    handleFieldChange(name, value);
  }, [handleFieldChange]);

  const handleInputBlur = useCallback((name: string, value: string) => {
    handleFieldBlur(name, value);
  }, [handleFieldBlur]);

  const handleSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    handleFieldChange(name, value);
  }, [handleFieldChange]);

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Convert date input to ISO string
  const handleDateChange = useCallback((name: string, value: string) => {
    if (value) {
      try {
        const date = new Date(value + 'T00:00:00.000Z');
        const isoString = date.toISOString();
        setFormData(prev => ({
          ...prev,
          [name]: isoString
        }));
        handleFieldChange(name, isoString);
      } catch {
        handleInputChange(name, value);
      }
    } else {
      handleInputChange(name, value);
    }
  }, [handleFieldChange, handleInputChange]);

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Task</h3>
        
        {/* Form Validation Summary */}
        {Object.keys(errors).length > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800">Please fix the following errors:</h4>
                <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                  {Object.entries(errors).map(([field, fieldErrors]) => (
                    <li key={field}>
                      {field}: {fieldErrors[0]?.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Title Field */}
          <ValidatedInput
            name="title"
            type="text"
            value={formData.title}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            label="Task Title"
            placeholder="Enter a descriptive title for your task"
            required
            maxLength={200}
            error={getFieldError('title')}
            errors={getFieldErrors('title')}
            isValid={isFieldValid('title') && isFieldTouched('title')}
            isValidating={isValidating}
            autoComplete="off"
          />

          {/* Description Field */}
          <ValidatedTextArea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            label="Description"
            placeholder="Provide additional details about the task (optional)"
            rows={4}
            maxLength={2000}
            error={getFieldError('description')}
            errors={getFieldErrors('description')}
            isValid={isFieldValid('description') && (isFieldTouched('description') || formData.description.length > 0)}
            isValidating={isValidating}
            resize="vertical"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Deadline Field */}
            <ValidatedInput
              name="deadline"
              type="date"
              value={formatDateForInput(formData.deadline)}
              onChange={handleDateChange}
              onBlur={(name, value) => handleDateChange(name, value)}
              label="Deadline"
              required
              error={getFieldError('deadline')}
              errors={getFieldErrors('deadline')}
              isValid={isFieldValid('deadline') && isFieldTouched('deadline')}
              isValidating={isValidating}
              min={new Date().toISOString().split('T')[0]} // Prevent past dates
            />

            {/* Priority Field */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleSelectChange}
                className={`
                  mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200
                  ${getFieldError('priority') 
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300'
                  }
                `}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              {getFieldError('priority') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('priority')}</p>
              )}
            </div>
          </div>

          {/* Assigned To Field */}
          <ValidatedInput
            name="assignedTo"
            type="text"
            value={formData.assignedTo}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            label="Assign To"
            placeholder="Enter user ID or leave empty to assign to yourself"
            maxLength={100}
            error={getFieldError('assignedTo')}
            errors={getFieldErrors('assignedTo')}
            isValid={isFieldValid('assignedTo') && (isFieldTouched('assignedTo') || formData.assignedTo.length > 0)}
            isValidating={isValidating}
            autoComplete="off"
          />

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isValid || Object.keys(errors).length > 0}
              className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;