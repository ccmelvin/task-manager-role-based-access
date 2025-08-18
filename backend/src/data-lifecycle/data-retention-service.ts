import { DataLifecycleEvent, DataRetentionPolicy } from './types';

export class DataRetentionService {
  private retentionPolicies: Map<string, DataRetentionPolicy> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    // Task data retention policy
    this.retentionPolicies.set('tasks', {
      dataType: 'tasks',
      retentionPeriodDays: 2555, // 7 years for business records
      archivalPeriodDays: 1825, // 5 years before archival
      deletionMethod: 'soft',
      complianceRequirement: 'Business Records Retention'
    });

    // User activity logs
    this.retentionPolicies.set('user_activity', {
      dataType: 'user_activity',
      retentionPeriodDays: 365, // 1 year for activity logs
      deletionMethod: 'hard',
      complianceRequirement: 'Privacy Regulation Compliance'
    });

    // Security events
    this.retentionPolicies.set('security_events', {
      dataType: 'security_events',
      retentionPeriodDays: 2555, // 7 years for security audit
      archivalPeriodDays: 1095, // 3 years before archival
      deletionMethod: 'soft',
      complianceRequirement: 'Security Audit Requirements'
    });

    // User profile data
    this.retentionPolicies.set('user_profiles', {
      dataType: 'user_profiles',
      retentionPeriodDays: 90, // 90 days after account deletion
      deletionMethod: 'hard',
      complianceRequirement: 'GDPR Right to be Forgotten'
    });
  }

  getRetentionPolicy(dataType: string): DataRetentionPolicy | undefined {
    return this.retentionPolicies.get(dataType);
  }

  setRetentionPolicy(policy: DataRetentionPolicy): void {
    this.retentionPolicies.set(policy.dataType, policy);
  }

  calculateExpirationDate(dataType: string, createdAt: Date): Date | null {
    const policy = this.getRetentionPolicy(dataType);
    if (!policy) return null;

    const expirationDate = new Date(createdAt);
    expirationDate.setDate(expirationDate.getDate() + policy.retentionPeriodDays);
    return expirationDate;
  }

  calculateArchivalDate(dataType: string, createdAt: Date): Date | null {
    const policy = this.getRetentionPolicy(dataType);
    if (!policy || !policy.archivalPeriodDays) return null;

    const archivalDate = new Date(createdAt);
    archivalDate.setDate(archivalDate.getDate() + policy.archivalPeriodDays);
    return archivalDate;
  }

  shouldArchive(dataType: string, createdAt: Date): boolean {
    const archivalDate = this.calculateArchivalDate(dataType, createdAt);
    if (!archivalDate) return false;
    
    return new Date() >= archivalDate;
  }

  shouldDelete(dataType: string, createdAt: Date): boolean {
    const expirationDate = this.calculateExpirationDate(dataType, createdAt);
    if (!expirationDate) return false;
    
    return new Date() >= expirationDate;
  }

  async logLifecycleEvent(event: Omit<DataLifecycleEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const lifecycleEvent: DataLifecycleEvent = {
      ...event,
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString()
    };

    // Log to CloudWatch or your preferred logging service
    console.log('Data Lifecycle Event:', JSON.stringify(lifecycleEvent));
    
    // In a real implementation, you would store this in a dedicated audit table
    // await this.auditService.logEvent(lifecycleEvent);
  }

  private generateEventId(): string {
    return `lifecycle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getAllPolicies(): DataRetentionPolicy[] {
    return Array.from(this.retentionPolicies.values());
  }
}