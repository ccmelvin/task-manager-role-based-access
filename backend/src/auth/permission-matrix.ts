import { Permission } from './types';

/**
 * Permission matrix defining resource-action mappings for the task management system
 */
export const PERMISSION_MATRIX: Record<string, Permission[]> = {
  // Task resource permissions
  task: [
    // Admin permissions - full access to all tasks
    {
      resource: 'task',
      actions: ['create', 'read', 'update', 'delete'],
      // No conditions means unrestricted access for this permission
    },
    
    // Contributor permissions - can create, read and update tasks they own or are assigned to
    {
      resource: 'task',
      actions: ['create'],
      // Contributors can always create tasks
    },
    {
      resource: 'task',
      actions: ['read', 'update'],
      conditions: [
        { field: 'createdBy', operator: 'equals', value: '${userId}' },
      ],
    },
    {
      resource: 'task',
      actions: ['read', 'update'],
      conditions: [
        { field: 'assignedTo', operator: 'equals', value: '${userId}' },
      ],
    },
    
    // Viewer permissions - can only read tasks assigned to them
    {
      resource: 'task',
      actions: ['read'],
      conditions: [
        { field: 'assignedTo', operator: 'equals', value: '${userId}' },
      ],
    },
  ],

  // User resource permissions
  user: [
    // Admin permissions - full user management
    {
      resource: 'user',
      actions: ['create', 'read', 'update', 'delete'],
    },
    
    // All users can read and update their own profile
    {
      resource: 'user',
      actions: ['read', 'update'],
      conditions: [
        { field: 'userId', operator: 'equals', value: '${userId}' },
      ],
    },
  ],

  // System resource permissions (admin only)
  system: [
    {
      resource: 'system',
      actions: ['configure', 'monitor', 'audit'],
      // Only available to Admin role through role hierarchy
    },
  ],
};

/**
 * Gets all permissions for a specific resource
 */
export function getResourcePermissions(resource: string): Permission[] {
  return PERMISSION_MATRIX[resource] || [];
}

/**
 * Gets all available resources in the permission matrix
 */
export function getAvailableResources(): string[] {
  return Object.keys(PERMISSION_MATRIX);
}

/**
 * Checks if a resource exists in the permission matrix
 */
export function isValidResource(resource: string): boolean {
  return resource in PERMISSION_MATRIX;
}

/**
 * Gets all available actions for a specific resource
 */
export function getResourceActions(resource: string): string[] {
  const permissions = getResourcePermissions(resource);
  const actions = new Set<string>();
  
  permissions.forEach(permission => {
    permission.actions.forEach(action => actions.add(action));
  });
  
  return Array.from(actions);
}