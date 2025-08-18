import { SecurityAlertingService } from './security-alerting';
import { SecurityDashboardService } from './security-dashboard';
import { SecurityEventLogger } from './security-event-logger';

export * from './security-alerting';
export { SecurityAlertingService } from './security-alerting';
export * from './security-dashboard';
export { SecurityDashboardService } from './security-dashboard';
export { SecurityEventLogger } from './security-event-logger';
export * from './types';

// Convenience functions to get singleton instances
export const getSecurityLogger = () => SecurityEventLogger.getInstance();
export const getSecurityAlerting = () => SecurityAlertingService.getInstance();
export const getSecurityDashboard = () => SecurityDashboardService.getInstance();