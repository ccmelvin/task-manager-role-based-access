import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

interface AccountSecurityEvent {
  userId: string;
  eventType: 'FAILED_LOGIN' | 'SUCCESSFUL_LOGIN' | 'PASSWORD_RESET' | 'SUSPICIOUS_ACTIVITY';
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  details?: Record<string, any>;
}

interface AccountSecurityProfile {
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

interface SecurityConfiguration {
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  suspiciousActivityThreshold: number;
  ipWhitelistEnabled: boolean;
  deviceTrackingEnabled: boolean;
  notificationTopicArn: string;
}

export class AccountSecurityService {
  private dynamoClient: DynamoDBDocumentClient;
  private secretsClient: SecretsManagerClient;
  private snsClient: SNSClient;
  private securityConfig: SecurityConfiguration;

  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.dynamoClient = DynamoDBDocumentClient.from(client);
    this.secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
    this.snsClient = new SNSClient({ region: process.env.AWS_REGION });
    
    this.securityConfig = {
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 30,
      suspiciousActivityThreshold: 10,
      ipWhitelistEnabled: false,
      deviceTrackingEnabled: true,
      notificationTopicArn: process.env.SECURITY_NOTIFICATIONS_TOPIC_ARN || ''
    };
  }

  /**
   * Record a security event and update account security profile
   */
  async recordSecurityEvent(event: AccountSecurityEvent): Promise<void> {
    try {
      // Get current security profile
      const profile = await this.getAccountSecurityProfile(event.userId);
      
      // Update profile based on event type
      const updatedProfile = await this.updateSecurityProfile(profile, event);
      
      // Save updated profile
      await this.saveSecurityProfile(updatedProfile);
      
      // Log the security event
      await this.logSecurityEvent(event);
      
      // Check for security violations and send notifications
      await this.checkSecurityViolations(updatedProfile, event);
      
    } catch (error) {
      console.error('Error recording security event:', error);
      throw error;
    }
  }

  /**
   * Check if account is currently locked
   */
  async isAccountLocked(userId: string): Promise<boolean> {
    try {
      const profile = await this.getAccountSecurityProfile(userId);
      
      if (!profile.accountLockedUntil) {
        return false;
      }
      
      const lockoutExpiry = new Date(profile.accountLockedUntil);
      const now = new Date();
      
      if (now > lockoutExpiry) {
        // Lockout has expired, clear it
        await this.clearAccountLockout(userId);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking account lock status:', error);
      return false; // Default to not locked on error
    }
  }

  /**
   * Detect suspicious activity based on various factors
   */
  async detectSuspiciousActivity(userId: string, ipAddress: string, userAgent: string): Promise<number> {
    try {
      const profile = await this.getAccountSecurityProfile(userId);
      let suspiciousScore = 0;
      
      // Check for unknown IP address
      if (!profile.knownIpAddresses.includes(ipAddress)) {
        suspiciousScore += 3;
      }
      
      // Check for unusual user agent
      const deviceFingerprint = this.generateDeviceFingerprint(userAgent);
      if (!profile.knownDevices.includes(deviceFingerprint)) {
        suspiciousScore += 2;
      }
      
      // Check for rapid login attempts from different IPs
      const recentEvents = await this.getRecentSecurityEvents(userId, 60); // Last 60 minutes
      const uniqueIps = new Set(recentEvents.map(event => event.ipAddress));
      if (uniqueIps.size > 3) {
        suspiciousScore += 5;
      }
      
      // Check for login attempts outside normal hours (if we have historical data)
      const currentHour = new Date().getHours();
      if (currentHour < 6 || currentHour > 22) {
        suspiciousScore += 1;
      }
      
      return suspiciousScore;
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      return 0;
    }
  }

  /**
   * Send security notification
   */
  async sendSecurityNotification(userId: string, eventType: string, details: Record<string, any>): Promise<void> {
    try {
      if (!this.securityConfig.notificationTopicArn) {
        console.warn('Security notifications topic ARN not configured');
        return;
      }

      const message = {
        userId,
        eventType,
        timestamp: new Date().toISOString(),
        details
      };

      await this.snsClient.send(new PublishCommand({
        TopicArn: this.securityConfig.notificationTopicArn,
        Message: JSON.stringify(message),
        Subject: `Security Alert: ${eventType} for user ${userId}`
      }));

    } catch (error) {
      console.error('Error sending security notification:', error);
      // Don't throw error as this is not critical for the main flow
    }
  }

  /**
   * Get account security profile
   */
  private async getAccountSecurityProfile(userId: string): Promise<AccountSecurityProfile> {
    try {
      const secrets = await this.getSecrets();
      
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: secrets.userProfilesTableName,
        Key: { userId }
      }));

      if (result.Item?.securityProfile) {
        return result.Item.securityProfile;
      }

      // Create default security profile
      const defaultProfile: AccountSecurityProfile = {
        userId,
        failedLoginAttempts: 0,
        suspiciousActivityScore: 0,
        knownIpAddresses: [],
        knownDevices: [],
        securityNotificationsEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return defaultProfile;
    } catch (error) {
      console.error('Error getting security profile:', error);
      throw error;
    }
  }

  /**
   * Update security profile based on event
   */
  private async updateSecurityProfile(profile: AccountSecurityProfile, event: AccountSecurityEvent): Promise<AccountSecurityProfile> {
    const updatedProfile = { ...profile };
    updatedProfile.updatedAt = new Date().toISOString();

    switch (event.eventType) {
      case 'FAILED_LOGIN':
        updatedProfile.failedLoginAttempts += 1;
        updatedProfile.lastFailedLogin = event.timestamp;
        
        // Lock account if max attempts reached
        if (updatedProfile.failedLoginAttempts >= this.securityConfig.maxFailedAttempts) {
          const lockoutExpiry = new Date();
          lockoutExpiry.setMinutes(lockoutExpiry.getMinutes() + this.securityConfig.lockoutDurationMinutes);
          updatedProfile.accountLockedUntil = lockoutExpiry.toISOString();
        }
        break;

      case 'SUCCESSFUL_LOGIN':
        // Reset failed attempts on successful login
        updatedProfile.failedLoginAttempts = 0;
        updatedProfile.lastSuccessfulLogin = event.timestamp;
        updatedProfile.accountLockedUntil = undefined;
        
        // Add IP to known addresses if not already present
        if (!updatedProfile.knownIpAddresses.includes(event.ipAddress)) {
          updatedProfile.knownIpAddresses.push(event.ipAddress);
          // Keep only last 10 known IPs
          if (updatedProfile.knownIpAddresses.length > 10) {
            updatedProfile.knownIpAddresses = updatedProfile.knownIpAddresses.slice(-10);
          }
        }
        
        // Add device fingerprint
        const deviceFingerprint = this.generateDeviceFingerprint(event.userAgent);
        if (!updatedProfile.knownDevices.includes(deviceFingerprint)) {
          updatedProfile.knownDevices.push(deviceFingerprint);
          // Keep only last 5 known devices
          if (updatedProfile.knownDevices.length > 5) {
            updatedProfile.knownDevices = updatedProfile.knownDevices.slice(-5);
          }
        }
        break;

      case 'SUSPICIOUS_ACTIVITY':
        updatedProfile.suspiciousActivityScore += event.details?.score || 1;
        break;

      case 'PASSWORD_RESET':
        // Reset failed attempts on password reset
        updatedProfile.failedLoginAttempts = 0;
        updatedProfile.accountLockedUntil = undefined;
        break;
    }

    return updatedProfile;
  }

  /**
   * Save security profile to database
   */
  private async saveSecurityProfile(profile: AccountSecurityProfile): Promise<void> {
    try {
      const secrets = await this.getSecrets();
      
      await this.dynamoClient.send(new UpdateCommand({
        TableName: secrets.userProfilesTableName,
        Key: { userId: profile.userId },
        UpdateExpression: 'SET securityProfile = :profile',
        ExpressionAttributeValues: {
          ':profile': profile
        }
      }));
    } catch (error) {
      console.error('Error saving security profile:', error);
      throw error;
    }
  }

  /**
   * Log security event to database
   */
  private async logSecurityEvent(event: AccountSecurityEvent): Promise<void> {
    try {
      const secrets = await this.getSecrets();
      
      const eventRecord = {
        eventId: `${event.userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...event,
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
      };

      await this.dynamoClient.send(new PutCommand({
        TableName: `${secrets.userProfilesTableName}-SecurityEvents`,
        Item: eventRecord
      }));
    } catch (error) {
      console.error('Error logging security event:', error);
      // Don't throw error as this is not critical for the main flow
    }
  }

  /**
   * Check for security violations and send notifications
   */
  private async checkSecurityViolations(profile: AccountSecurityProfile, event: AccountSecurityEvent): Promise<void> {
    try {
      // Check for account lockout
      if (profile.accountLockedUntil) {
        await this.sendSecurityNotification(profile.userId, 'ACCOUNT_LOCKED', {
          reason: 'Too many failed login attempts',
          lockoutUntil: profile.accountLockedUntil,
          ipAddress: event.ipAddress
        });
      }

      // Check for suspicious activity threshold
      if (profile.suspiciousActivityScore >= this.securityConfig.suspiciousActivityThreshold) {
        await this.sendSecurityNotification(profile.userId, 'SUSPICIOUS_ACTIVITY_DETECTED', {
          score: profile.suspiciousActivityScore,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent
        });
      }

      // Check for login from new IP
      if (event.eventType === 'SUCCESSFUL_LOGIN' && !profile.knownIpAddresses.includes(event.ipAddress)) {
        await this.sendSecurityNotification(profile.userId, 'LOGIN_FROM_NEW_IP', {
          ipAddress: event.ipAddress,
          userAgent: event.userAgent
        });
      }
    } catch (error) {
      console.error('Error checking security violations:', error);
      // Don't throw error as this is not critical for the main flow
    }
  }

  /**
   * Clear account lockout
   */
  private async clearAccountLockout(userId: string): Promise<void> {
    try {
      const secrets = await this.getSecrets();
      
      await this.dynamoClient.send(new UpdateCommand({
        TableName: secrets.userProfilesTableName,
        Key: { userId },
        UpdateExpression: 'REMOVE securityProfile.accountLockedUntil SET securityProfile.updatedAt = :timestamp',
        ExpressionAttributeValues: {
          ':timestamp': new Date().toISOString()
        }
      }));
    } catch (error) {
      console.error('Error clearing account lockout:', error);
      throw error;
    }
  }

  /**
   * Generate device fingerprint from user agent
   */
  private generateDeviceFingerprint(userAgent: string): string {
    // Simple device fingerprinting based on user agent
    // In production, you might want to use more sophisticated fingerprinting
    const hash = require('crypto').createHash('sha256');
    hash.update(userAgent);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Get recent security events for a user
   */
  private async getRecentSecurityEvents(userId: string, minutesBack: number): Promise<AccountSecurityEvent[]> {
    try {
      const secrets = await this.getSecrets();
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesBack);
      
      // This would require a GSI on userId and timestamp
      // For now, return empty array as this is a complex query
      return [];
    } catch (error) {
      console.error('Error getting recent security events:', error);
      return [];
    }
  }

  /**
   * Get secrets from AWS Secrets Manager
   */
  private async getSecrets(): Promise<any> {
    try {
      const result = await this.secretsClient.send(new GetSecretValueCommand({
        SecretId: process.env.DATABASE_SECRET_ARN
      }));
      
      return JSON.parse(result.SecretString || '{}');
    } catch (error) {
      console.error('Error getting secrets:', error);
      throw error;
    }
  }
}