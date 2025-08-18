export interface SecurityEvent {
  eventId: string;
  userId?: string;
  eventType: "AUTH" | "AUTHZ" | "DATA_ACCESS" | "SECURITY_VIOLATION" | "SYSTEM";
  action: string;
  resource?: string;
  result: "SUCCESS" | "FAILURE" | "BLOCKED";
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requestId?: string;
  sessionId?: string;
}

export interface SecurityEventFilter {
  eventType?: SecurityEvent['eventType'];
  severity?: SecurityEvent['severity'];
  userId?: string;
  startTime?: string;
  endTime?: string;
  result?: SecurityEvent['result'];
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  failureRate: number;
  topUsers: Array<{ userId: string; eventCount: number }>;
  timeRange: {
    start: string;
    end: string;
  };
}

export interface LogRetentionPolicy {
  retentionDays: number;
  archiveAfterDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}