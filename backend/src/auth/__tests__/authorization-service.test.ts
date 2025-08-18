import { AuthorizationService } from '../authorization-service';
import { AuthorizationContext } from '../types';

describe('AuthorizationService', () => {
  let authService: AuthorizationService;

  beforeEach(() => {
    authService = AuthorizationService.getInstance();
    // Mock console.log to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validatePermission', () => {
    it('should allow Admin to perform any action on any resource', async () => {
      const context: AuthorizationContext = {
        userId: 'admin-user-1',
        email: 'admin@example.com',
        roles: ['Admin'],
        groups: ['admin'],
      };

      const result = await authService.validatePermission(context, 'task', 'delete');
      
      expect(result.allowed).toBe(true);
      expect(result.appliedRole).toBe('Admin');
    });

    it('should allow Contributor to create tasks', async () => {
      const context: AuthorizationContext = {
        userId: 'contributor-user-1',
        email: 'contributor@example.com',
        roles: ['Contributor'],
        groups: ['contributor'],
      };

      const result = await authService.validatePermission(context, 'task', 'create');
      
      expect(result.allowed).toBe(true);
      expect(result.appliedRole).toBe('Contributor');
    });

    it('should deny Viewer from creating tasks', async () => {
      const context: AuthorizationContext = {
        userId: 'viewer-user-1',
        email: 'viewer@example.com',
        roles: ['Viewer'],
        groups: ['viewer'],
      };

      const result = await authService.validatePermission(context, 'task', 'create');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Insufficient permissions');
    });

    it('should allow Viewer to read tasks assigned to them', async () => {
      const context: AuthorizationContext = {
        userId: 'viewer-user-1',
        email: 'viewer@example.com',
        roles: ['Viewer'],
        groups: ['viewer'],
      };

      const taskData = {
        taskId: 'task-1',
        assignedTo: 'viewer-user-1',
        createdBy: 'admin-user-1',
      };

      const result = await authService.validatePermission(
        context, 
        'task', 
        'read', 
        taskData
      );
      
      expect(result.allowed).toBe(true);
      expect(result.appliedRole).toBe('Viewer');
    });

    it('should deny Viewer from reading tasks not assigned to them', async () => {
      const context: AuthorizationContext = {
        userId: 'viewer-user-1',
        email: 'viewer@example.com',
        roles: ['Viewer'],
        groups: ['viewer'],
      };

      const taskData = {
        taskId: 'task-1',
        assignedTo: 'other-user',
        createdBy: 'admin-user-1',
      };

      const result = await authService.validatePermission(
        context, 
        'task', 
        'read', 
        taskData
      );
      
      expect(result.allowed).toBe(false);
    });

    it('should allow Contributor to update tasks they created', async () => {
      const context: AuthorizationContext = {
        userId: 'contributor-user-1',
        email: 'contributor@example.com',
        roles: ['Contributor'],
        groups: ['contributor'],
      };

      const taskData = {
        taskId: 'task-1',
        assignedTo: 'other-user',
        createdBy: 'contributor-user-1',
      };

      const result = await authService.validatePermission(
        context, 
        'task', 
        'update', 
        taskData
      );
      
      expect(result.allowed).toBe(true);
      expect(result.appliedRole).toBe('Contributor');
    });

    it('should deny Contributor from deleting tasks', async () => {
      const context: AuthorizationContext = {
        userId: 'contributor-user-1',
        email: 'contributor@example.com',
        roles: ['Contributor'],
        groups: ['contributor'],
      };

      const result = await authService.validatePermission(context, 'task', 'delete');
      
      expect(result.allowed).toBe(false);
    });

    it('should handle users with multiple roles and use highest priority', async () => {
      const context: AuthorizationContext = {
        userId: 'multi-role-user',
        email: 'multi@example.com',
        roles: ['Admin', 'Contributor'],
        groups: ['admin', 'contributor'],
      };

      const result = await authService.validatePermission(context, 'task', 'delete');
      
      expect(result.allowed).toBe(true);
      expect(result.appliedRole).toBe('Admin');
    });

    it('should default to Viewer role for users with no groups', async () => {
      const context: AuthorizationContext = {
        userId: 'no-groups-user',
        email: 'nogroups@example.com',
        roles: [],
        groups: [],
      };

      const result = await authService.validatePermission(context, 'task', 'create');
      
      expect(result.allowed).toBe(false);
      expect(result.appliedRole).toBe('Viewer');
    });

    it('should handle malformed group information gracefully', async () => {
      const context: AuthorizationContext = {
        userId: 'malformed-user',
        email: 'malformed@example.com',
        roles: [],
        groups: ['invalid-group', 'unknown-role'],
      };

      const result = await authService.validatePermission(context, 'task', 'read');
      
      expect(result.allowed).toBe(false);
      expect(result.appliedRole).toBe('Viewer');
    });
  });

  describe('getUserPermissions', () => {
    it('should return Admin permissions for admin groups', () => {
      const permissions = authService.getUserPermissions(['admin']);
      
      expect(permissions).toHaveLength(3);
      expect(permissions.some(p => p.resource === 'system')).toBe(true);
    });

    it('should return Contributor permissions for contributor groups', () => {
      const permissions = authService.getUserPermissions(['contributor']);
      
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === 'task' && p.actions.includes('create'))).toBe(true);
    });

    it('should return Viewer permissions for viewer groups', () => {
      const permissions = authService.getUserPermissions(['viewer']);
      
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.every(p => !p.actions.includes('create') || p.conditions)).toBe(true);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has the specified role', () => {
      expect(authService.hasRole(['admin'], 'Admin')).toBe(true);
      expect(authService.hasRole(['contributor'], 'Contributor')).toBe(true);
      expect(authService.hasRole(['viewer'], 'Viewer')).toBe(true);
    });

    it('should return false when user does not have the specified role', () => {
      expect(authService.hasRole(['viewer'], 'Admin')).toBe(false);
      expect(authService.hasRole(['contributor'], 'Admin')).toBe(false);
    });

    it('should handle multiple roles correctly', () => {
      expect(authService.hasRole(['admin', 'contributor'], 'Admin')).toBe(true);
      expect(authService.hasRole(['admin', 'contributor'], 'Contributor')).toBe(true);
      expect(authService.hasRole(['admin', 'contributor'], 'Viewer')).toBe(false);
    });
  });

  describe('getEffectiveRole', () => {
    it('should return highest priority role for multiple groups', () => {
      expect(authService.getEffectiveRole(['admin', 'contributor'])).toBe('Admin');
      expect(authService.getEffectiveRole(['contributor', 'viewer'])).toBe('Contributor');
      expect(authService.getEffectiveRole(['viewer'])).toBe('Viewer');
    });

    it('should return Viewer for empty or invalid groups', () => {
      expect(authService.getEffectiveRole([])).toBe('Viewer');
      expect(authService.getEffectiveRole(['invalid-group'])).toBe('Viewer');
    });

    it('should handle case-insensitive group names', () => {
      expect(authService.getEffectiveRole(['ADMIN'])).toBe('Admin');
      expect(authService.getEffectiveRole(['Contributor'])).toBe('Contributor');
      expect(authService.getEffectiveRole(['VIEWER'])).toBe('Viewer');
    });
  });
});