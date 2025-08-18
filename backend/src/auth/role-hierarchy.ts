import { Permission, RoleHierarchy, UserRole } from './types';

// Define permissions for each resource and action
const TASK_PERMISSIONS: Permission[] = [
  {
    resource: 'task',
    actions: ['create', 'read', 'update', 'delete'],
  },
  {
    resource: 'task',
    actions: ['read', 'update'],
    conditions: [
      { field: 'assignedTo', operator: 'equals', value: '${userId}' },
    ],
  },
  {
    resource: 'task',
    actions: ['read', 'update'],
    conditions: [
      { field: 'createdBy', operator: 'equals', value: '${userId}' },
    ],
  },
];

const USER_PERMISSIONS: Permission[] = [
  {
    resource: 'user',
    actions: ['read', 'update'],
    conditions: [
      { field: 'userId', operator: 'equals', value: '${userId}' },
    ],
  },
];

const ADMIN_PERMISSIONS: Permission[] = [
  {
    resource: 'task',
    actions: ['create', 'read', 'update', 'delete'],
  },
  {
    resource: 'user',
    actions: ['create', 'read', 'update', 'delete'],
  },
  {
    resource: 'system',
    actions: ['configure', 'monitor', 'audit'],
  },
];

// Role hierarchy configuration with Admin > Contributor > Viewer precedence
export const ROLE_HIERARCHY: Record<UserRole, RoleHierarchy> = {
  Admin: {
    role: 'Admin',
    permissions: ADMIN_PERMISSIONS,
    priority: 100,
  },
  Contributor: {
    role: 'Contributor',
    permissions: [
      {
        resource: 'task',
        actions: ['create', 'read', 'update'],
      },
      {
        resource: 'task',
        actions: ['read', 'update'],
        conditions: [
          { field: 'assignedTo', operator: 'equals', value: '${userId}' },
        ],
      },
      {
        resource: 'task',
        actions: ['read', 'update'],
        conditions: [
          { field: 'createdBy', operator: 'equals', value: '${userId}' },
        ],
      },
      ...USER_PERMISSIONS,
    ],
    priority: 50,
  },
  Viewer: {
    role: 'Viewer',
    permissions: [
      {
        resource: 'task',
        actions: ['read'],
        conditions: [
          { field: 'assignedTo', operator: 'equals', value: '${userId}' },
        ],
      },
      ...USER_PERMISSIONS,
    ],
    priority: 10,
  },
};

/**
 * Determines the effective role for a user based on their groups and role hierarchy
 */
export function resolveUserRole(groups: string[]): UserRole {
  if (!groups || groups.length === 0) {
    return 'Viewer'; // Default to most restrictive role
  }

  // Map Cognito groups to roles
  const roleMapping: Record<string, UserRole> = {
    'admin': 'Admin',
    'admins': 'Admin',
    'contributor': 'Contributor',
    'contributors': 'Contributor',
    'viewer': 'Viewer',
    'viewers': 'Viewer',
  };

  // Find all roles the user belongs to
  const userRoles: UserRole[] = groups
    .map(group => roleMapping[group.toLowerCase()])
    .filter(role => role !== undefined);

  if (userRoles.length === 0) {
    return 'Viewer'; // Default to most restrictive role
  }

  // Return the role with highest priority
  return userRoles.reduce((highestRole, currentRole) => {
    const currentPriority = ROLE_HIERARCHY[currentRole].priority;
    const highestPriority = ROLE_HIERARCHY[highestRole].priority;
    return currentPriority > highestPriority ? currentRole : highestRole;
  });
}

/**
 * Gets all roles a user has based on their groups
 */
export function getUserRoles(groups: string[]): UserRole[] {
  if (!groups || groups.length === 0) {
    return ['Viewer'];
  }

  const roleMapping: Record<string, UserRole> = {
    'admin': 'Admin',
    'admins': 'Admin',
    'contributor': 'Contributor',
    'contributors': 'Contributor',
    'viewer': 'Viewer',
    'viewers': 'Viewer',
  };

  const userRoles: UserRole[] = groups
    .map(group => roleMapping[group.toLowerCase()])
    .filter(role => role !== undefined);

  return userRoles.length > 0 ? userRoles : ['Viewer'];
}