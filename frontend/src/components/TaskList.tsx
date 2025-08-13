import React from 'react';
import { Task } from '../types';

interface TaskListProps {
  tasks: Task[];
  userRole: string;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, userRole, onUpdateTask }) => {
  const handleStatusChange = (taskId: string, status: Task['status']) => {
    onUpdateTask(taskId, { status });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12" data-testid="empty-state">
        <p className="text-gray-500">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md" data-testid="task-list">
      <ul className="divide-y divide-gray-200">
        {tasks.map((task) => (
          <li key={task.taskId} className="px-6 py-4" data-testid="task-item">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900" data-testid="task-title">
                    {task.title}
                  </h3>
                  <div className="flex space-x-2">
                    <span 
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}
                      data-testid="task-priority"
                    >
                      {task.priority}
                    </span>
                    <span 
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}
                      data-testid="task-status"
                    >
                      {task.status}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-600" data-testid="task-description">
                  {task.description}
                </p>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <span data-testid="task-deadline">
                    Due: {new Date(task.deadline).toLocaleDateString()}
                  </span>
                  <span className="mx-2">•</span>
                  <span data-testid="assigned-user">
                    Assigned to: {task.assignedTo}
                  </span>
                </div>
              </div>
              {(userRole === 'Admin' || userRole === 'Contributor') && (
                <div className="ml-4">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.taskId, e.target.value as Task['status'])}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                    data-testid="status-select"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskList;
