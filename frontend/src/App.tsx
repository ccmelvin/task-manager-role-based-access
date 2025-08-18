import { useEffect, useState } from 'react';
// Temporarily commented out AWS imports
// import { Amplify } from 'aws-amplify';
// import { getCurrentUser, signOut } from 'aws-amplify/auth';
// import { Authenticator } from '@aws-amplify/ui-react';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import { AuthProvider } from './contexts/AuthContext';
import { Task } from './types';
import { applySecurityHeaders, setupSecurityMonitoring } from './utils/securityConfig';
import { sessionManager } from './utils/sessionManager';
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
  const [sessionWarning, setSessionWarning] = useState<{ show: boolean; remainingTime: number }>({
    show: false,
    remainingTime: 0
  });

  // Initialize security features
  useEffect(() => {
    // Apply security headers
    applySecurityHeaders();
    
    // Setup security monitoring
    setupSecurityMonitoring();
    
    // Setup session management
    sessionManager.addEventListener('warning', (event) => {
      setSessionWarning({
        show: true,
        remainingTime: event.remainingTime || 0
      });
    });

    sessionManager.addEventListener('expired', () => {
      handleSignOut();
      alert('Your session has expired. Please sign in again.');
    });

    // Start session if signed in
    if (isSignedIn) {
      sessionManager.startSession(mockUser.email);
    }

    return () => {
      sessionManager.endSession();
    };
  }, [isSignedIn]);

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
    sessionManager.endSession();
    setIsSignedIn(false);
    setSessionWarning({ show: false, remainingTime: 0 });
    console.log('Mock: User signed out');
  };

  const handleSignIn = () => {
    setIsSignedIn(true);
    sessionManager.startSession(mockUser.email);
    console.log('Mock: User signed in');
  };

  const handleExtendSession = () => {
    sessionManager.extendSession(15 * 60 * 1000); // Extend by 15 minutes
    setSessionWarning({ show: false, remainingTime: 0 });
  };

  const handleDismissWarning = () => {
    setSessionWarning({ show: false, remainingTime: 0 });
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
    <AuthProvider>
      <div className="min-h-screen bg-gray-100">
        {/* Session Warning Modal */}
        {sessionWarning.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <svg className="w-6 h-6 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">Session Expiring Soon</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Your session will expire in {Math.ceil(sessionWarning.remainingTime / 60000)} minutes due to inactivity.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleExtendSession}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Extend Session
                </button>
                <button
                  onClick={handleDismissWarning}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Task Manager</h1>
                <p className="text-sm text-orange-600 mt-1">
                  🚧 Demo Mode - AWS services disabled
                </p>
                <p className="text-xs text-green-600 mt-1">
                  ✅ Security features enabled: CSP, CSRF protection, session management
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
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
    </AuthProvider>
  );
}

export default App;
