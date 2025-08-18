export interface DataRetentionPolicy {
  dataType: string;
  retentionPeriodDays: number;
  archivalPeriodDays?: number;
  deletionMethod: 'soft' | 'hard';
  complianceRequirement?: string;
}

export interface DataClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted';
  categories: string[];
  handlingRequirements: string[];
  retentionPolicy: DataRetentionPolicy;
}

export interface DataLifecycleEvent {
  eventId: string;
  dataType: string;
  recordId: string;
  userId?: string;
  action: 'created' | 'accessed' | 'modified' | 'archived' | 'deleted';
  timestamp: string;
  metadata: Record<string, any>;
}

export interface CleanupResult {
  dataType: string;
  recordsProcessed: number;
  recordsArchived: number;
  recordsDeleted: number;
  errors: string[];
  executionTime: number;
}

export interface DataMinimizationRule {
  dataType: string;
  requiredFields: string[];
  optionalFields: string[];
  prohibitedFields: string[];
  collectionPurpose: string;
  legalBasis: string;
}