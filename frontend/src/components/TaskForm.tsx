import React, { useState } from 'react';
import { Task } from '../types';

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

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.deadline) {
      newErrors.deadline = 'Deadline is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg" data-testid="task-form">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Task</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700">
              Title *
            </label>
            <input
              id="task-title"
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              data-testid="task-title-input"
              aria-required="true"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600" data-testid="task-title-error">
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-gray-700">
              Description *
            </label>
            <textarea
              id="task-description"
              name="description"
              rows={3}
              required
              value={formData.description}
              onChange={handleChange}
              className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              data-testid="task-description-input"
              aria-required="true"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600" data-testid="task-description-error">
                {errors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="task-deadline" className="block text-sm font-medium text-gray-700">
                Deadline *
              </label>
              <input
                id="task-deadline"
                type="date"
                name="deadline"
                required
                value={formData.deadline}
                onChange={handleChange}
                className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.deadline ? 'border-red-500' : 'border-gray-300'
                }`}
                data-testid="task-deadline-input"
                aria-required="true"
              />
              {errors.deadline && (
                <p className="mt-1 text-sm text-red-600" data-testid="task-deadline-error">
                  {errors.deadline}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700">
                Priority
              </label>
              <select
                id="task-priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                data-testid="task-priority-select"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="task-assigned" className="block text-sm font-medium text-gray-700">
              Assign To (Email)
            </label>
            <input
              id="task-assigned"
              type="email"
              name="assignedTo"
              value={formData.assignedTo}
              onChange={handleChange}
              placeholder="Leave empty to assign to yourself"
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              data-testid="task-assigned-input"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              data-testid="cancel-task-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700"
              data-testid="submit-task-button"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;
