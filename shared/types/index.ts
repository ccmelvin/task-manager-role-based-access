export interface Task {
  taskId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo: string;
  createdBy: string;
  deadline: string;
  attachments: string[];
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  role: 'Admin' | 'Contributor' | 'Viewer';
  permissions: string[];
  createdAt: string;
}

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  groups: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}