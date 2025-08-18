export type UserRole = 'Admin' | 'Contributor' | 'Viewer';

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'owns' | 'assigned_to';
  value: any;
}

export interface RoleHierarchy {
  role: UserRole;
  permissions: Permission[];
  inheritsFrom?: UserRole[];
  priority: number;
}

export interface AuthorizationContext {
  userId: string;
  email: string;
  roles: UserRole[];
  groups: string[];
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  appliedRole?: UserRole;
}

export interface SecurityEvent {
  eventId: string;
  userId?: string;
  eventType: 'AUTH' | 'AUTHZ' | 'DATA_ACCESS' | 'SECURITY_VIOLATION';
  action: string;
  resource?: string;
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}