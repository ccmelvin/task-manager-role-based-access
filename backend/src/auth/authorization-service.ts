import { v4 as uuidv4 } from 'uuid';
import { ROLE_HIERARCHY, getUserRoles, resolveUserRole } from './role-hierarchy';
import {
    AuthorizationContext,
    AuthorizationResult,
    Permission,
    PermissionCondition,
    SecurityEvent,
    UserRole
} from './types';

export class AuthorizationService {
  private static instance: AuthorizationService;

  private constructor() {}

  public static getInstance(): AuthorizationService {
    if (!AuthorizationService.instance) {
      AuthorizationService.instance = new AuthorizationService();
    }
    return AuthorizationService.instance;
  }

  /**
   * Validates if a user has permission to perform an action on a resource
   */
  public async validatePermission(
    context: AuthorizationContext,
    resource: string,
    action: string,
    resourceData?: Record<string, any>
  ): Promise<AuthorizationResult> {
    try {
      // Resolve user's effective role
      const effectiveRole = resolveUserRole(context.groups);
      const allUserRoles = getUserRoles(context.groups);

      // Log authorization attempt
      await this.logSecurityEvent({
        eventId: uuidv4(),
        userId: context.userId,
        eventType: 'AUTHZ',
        action: `${action}:${resource}`,
        resource,
        result: 'SUCCESS', // Will be updated based on result
        details: {
          effectiveRole,
          allUserRoles,
          requestedAction: action,
          requestedResource: resource,
        },
        timestamp: new Date().toISOString(),
        severity: 'LOW',
      });

      // Check permissions for all user roles (highest role wins)
      for (const role of allUserRoles.sort((a, b) => 
        ROLE_HIERARCHY[b].priority - ROLE_HIERARCHY[a].priority
      )) {
        const roleHierarchy = ROLE_HIERARCHY[role];
        
        for (const permission of roleHierarchy.permissions) {
          if (this.matchesPermission(permission, resource, action)) {
            // Check conditions if they exist
            if (permission.conditions && resourceData) {
              const conditionsMet = await this.evaluateConditions(
                permission.conditions,
                context,
                resourceData
              );
              
              if (conditionsMet) {
                return {
                  allowed: true,
                  appliedRole: role,
                };
              }
            } else if (!permission.conditions) {
              // No conditions, permission granted
              return {
                allowed: true,
                appliedRole: role,
              };
            }
          }
        }
      }

      // Log authorization failure
      await this.logSecurityEvent({
        eventId: uuidv4(),
        userId: context.userId,
        eventType: 'AUTHZ',
        action: `${action}:${resource}`,
        resource,
        result: 'BLOCKED',
        details: {
          effectiveRole,
          allUserRoles,
          requestedAction: action,
          requestedResource: resource,
          reason: 'No matching permissions found',
        },
        timestamp: new Date().toISOString(),
        severity: 'MEDIUM',
      });

      return {
        allowed: false,
        reason: 'Insufficient permissions',
        appliedRole: effectiveRole,
      };

    } catch (error) {
      // Log authorization error
      await this.logSecurityEvent({
        eventId: uuidv4(),
        userId: context.userId,
        eventType: 'AUTHZ',
        action: `${action}:${resource}`,
        resource,
        result: 'FAILURE',
        details: {
          error: (error as Error).message,
          requestedAction: action,
          requestedResource: resource,
        },
        timestamp: new Date().toISOString(),
        severity: 'HIGH',
      });

      return {
        allowed: false,
        reason: 'Authorization error occurred',
      };
    }
  }

  /**
   * Checks if a permission matches the requested resource and action
   */
  private matchesPermission(permission: Permission, resource: string, action: string): boolean {
    return permission.resource === resource && permission.actions.includes(action);
  }

  /**
   * Evaluates permission conditions against the context and resource data
   */
  private async evaluateConditions(
    conditions: PermissionCondition[],
    context: AuthorizationContext,
    resourceData: Record<string, any>
  ): Promise<boolean> {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context, resourceData)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluates a single permission condition
   */
  private evaluateCondition(
    condition: PermissionCondition,
    context: AuthorizationContext,
    resourceData: Record<string, any>
  ): boolean {
    const fieldValue = resourceData[condition.field];
    let expectedValue = condition.value;

    // Replace template variables
    if (typeof expectedValue === 'string' && expectedValue.includes('${userId}')) {
      expectedValue = expectedValue.replace('${userId}', context.userId);
    }

    switch (condition.operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
      case 'owns':
        return fieldValue === context.userId;
      case 'assigned_to':
        return fieldValue === context.userId;
      default:
        return false;
    }
  }

  /**
   * Gets all permissions for a user based on their roles
   */
  public getUserPermissions(groups: string[]): Permission[] {
    const userRoles = getUserRoles(groups);
    const permissions: Permission[] = [];

    for (const role of userRoles) {
      const roleHierarchy = ROLE_HIERARCHY[role];
      permissions.push(...roleHierarchy.permissions);
    }

    return permissions;
  }

  /**
   * Checks if a user has a specific role
   */
  public hasRole(groups: string[], role: UserRole): boolean {
    const userRoles = getUserRoles(groups);
    return userRoles.includes(role);
  }

  /**
   * Gets the effective (highest priority) role for a user
   */
  public getEffectiveRole(groups: string[]): UserRole {
    return resolveUserRole(groups);
  }

  /**
   * Logs security events for audit trails
   */
  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    // In a real implementation, this would write to CloudWatch, DynamoDB, or another logging service
    // For now, we'll log to console with structured format
    console.log(JSON.stringify({
      timestamp: event.timestamp,
      level: 'SECURITY',
      eventType: event.eventType,
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      result: event.result,
      severity: event.severity,
      details: event.details,
    }));
  }
}