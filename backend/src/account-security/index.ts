export { AccountSecurityService } from './account-security-service';

export interface AccountSecurityEvent {
  userId: string;
  eventType: 'FAILED_LOGIN' | 'SUCCESSFUL_LOGIN' | 'PASSWORD_RESET' | 'SUSPICIOUS_ACTIVITY';
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface AccountSecurityProfile {
  userId: string;
  failedLoginAttempts: number;
  lastFailedLogin?: string;
  accountLockedUntil?: string;
  suspiciousActivityScore: number;
  lastSuccessfulLogin?: string;
  knownIpAddresses: string[];
  knownDevices: string[];
  securityNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}