export interface DataDeletionRequest {
  requestId: string;
  userId: string;
  requestType: 'full_deletion' | 'partial_deletion';
  dataTypes: string[];
  reason: string;
  requestedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: string;
  verificationToken?: string;
}

export interface DataExportRequest {
  requestId: string;
  userId: string;
  dataTypes: string[];
  format: 'json' | 'csv' | 'xml';
  requestedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: string;
}

export interface ConsentRecord {
  consentId: string;
  userId: string;
  purpose: string;
  dataTypes: string[];
  legalBasis: 'consent' | 'contract' | 'legitimate_interest' | 'legal_obligation';
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  version: string;
  metadata: Record<string, any>;
}

export interface PrivacySettings {
  userId: string;
  dataMinimization: boolean;
  marketingConsent: boolean;
  analyticsConsent: boolean;
  thirdPartySharing: boolean;
  dataRetentionPreference: 'minimum' | 'standard' | 'extended';
  updatedAt: string;
}

export interface DataPortabilityPackage {
  userId: string;
  generatedAt: string;
  format: string;
  data: {
    profile: any;
    tasks: any[];
    preferences: any;
    activityLog: any[];
  };
  metadata: {
    totalRecords: number;
    dataTypes: string[];
    exportVersion: string;
  };
}