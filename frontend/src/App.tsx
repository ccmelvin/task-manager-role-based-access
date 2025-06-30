import React, { useState, useEffect } from 'react';
// Temporarily commented out AWS imports
// import { Amplify } from 'aws-amplify';
// import { getCurrentUser, signOut } from 'aws-amplify/auth';
// import { Authenticator } from '@aws-amplify/ui-react';
import TaskList from './components/TaskList';
import TaskForm from './components/TaskForm';
import { Task, UserProfile } from './types';
// import '@aws-amplify/ui-react/styles.css';

// Mock user for demo purposes
const mockUser = {
  email: 'demo@example.com',
  role: 'Admin'
};

// Mock tasks data
const mockTasks: Task[] = [
  {
    taskId: '1',
    title: 'Setup AWS Infrastructure',
    description: 'Deploy CDK stack and configure services',
    status: 'in-progress',
    assignedTo: 'demo@example.com',
    createdBy: 'demo@example.com',
    deadline: '2025-07-01',
    attachments: [],
    priority: 'high',
    createdAt: '2025-06-27T10:00:00Z',
    updatedAt: '2025-06-27T10:00:00Z'
  },
  {
    taskId: '2',
    title: 'Implement Authentication',
    description: 'Configure Cognito user pools and groups',
    status: 'pending',
    assignedTo: 'demo@example.com',
    createdBy: 'demo@example.com',
    deadline: '2025-06-30',
    attachments: [],
    priority: 'medium',
    createdAt: '2025-06-27T09:00:00Z',
    updatedAt: '2025-06-27T09:00:00Z'
  },
  {
    taskId: '3',
    title: 'Test Role-Based Access',
    description: 'Verify different user roles work correctly',
    status: 'completed',
    assignedTo: 'demo@example.com',
    createdBy: 'demo@example.com',
    deadline: '2025-06-28',
    attachments: [],
    priority: 'low',
    createdAt: '2025-06-26T15:00:00Z',
    updatedAt: '2025-06-27T12:00:00Z'
  }
];

function App() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [userRole, setUserRole] = useState<string>(mockUser.role);
  const [showForm, setShowForm] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(true); // Mock signed in state

  const handleCreateTask = async (taskData: Partial<Task>) => {
    // Mock task creation
    const newTask: Task = {
      taskId: Date.now().toString(),
      title: taskData.title || '',
      description: taskData.description || '',
      status: taskData.status || 'pending',
      assignedTo: taskData.assignedTo || mockUser.email,
      createdBy: mockUser.email,
      deadline: taskData.deadline || '',
      attachments: taskData.attachments || [],
      priority: taskData.priority || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setTasks([...tasks, newTask]);
    setShowForm(false);
    console.log('Mock: Created new task', newTask);
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    // Mock task update
    setTasks(tasks.map(task => 
      task.taskId === taskId 
        ? { ...task, ...updates, updatedAt: new Date().toISOString() }
        : task
    ));
    console.log('Mock: Updated task', taskId, updates);
  };

  const handleSignOut = () => {
    setIsSignedIn(false);
    console.log('Mock: User signed out');
  };

  const handleSignIn = () => {
    setIsSignedIn(true);
    console.log('Mock: User signed in');
  };

  // Mock authentication wrapper
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Task Manager - Demo Mode</h2>
          <p className="text-gray-600 mb-4">
            This is a demo version. AWS authentication is disabled.
          </p>
          <button
            onClick={handleSignIn}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Continue as Demo User
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Task Manager</h1>
              <p className="text-sm text-orange-600 mt-1">
                🚧 Demo Mode - AWS services disabled
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                User: {mockUser.email}
              </span>
              <span className="text-sm text-gray-600">
                Role: {userRole}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Sign Out (Demo)
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {(userRole === 'Admin' || userRole === 'Contributor') && (
            <div className="mb-6">
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                {showForm ? 'Cancel' : 'Create Task'}
              </button>
            </div>
          )}

          {showForm && (
            <div className="mb-6">
              <TaskForm onSubmit={handleCreateTask} onCancel={() => setShowForm(false)} />
            </div>
          )}

          <TaskList
            tasks={tasks}
            userRole={userRole}
            onUpdateTask={handleUpdateTask}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
