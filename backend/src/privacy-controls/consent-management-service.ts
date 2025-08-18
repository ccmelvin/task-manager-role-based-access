import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { ConsentRecord, PrivacySettings } from './types';

export class ConsentManagementService {
  private dynamoClient: DynamoDBClient;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  async recordConsent(
    userId: string,
    purpose: string,
    dataTypes: string[],
    legalBasis: ConsentRecord['legalBasis'],
    granted: boolean,
    version: string = '1.0',
    metadata: Record<string, any> = {}
  ): Promise<ConsentRecord> {
    const consent: ConsentRecord = {
      consentId: this.generateConsentId(),
      userId,
      purpose,
      dataTypes,
      legalBasis,
      granted,
      grantedAt: granted ? new Date().toISOString() : undefined,
      revokedAt: !granted ? new Date().toISOString() : undefined,
      version,
      metadata: {
        ...metadata,
        ipAddress: metadata.ipAddress || 'unknown',
        userAgent: metadata.userAgent || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    await this.storeConsentRecord(consent);
    await this.updatePrivacySettings(userId, purpose, granted);

    return consent;
  }

  async revokeConsent(userId: string, purpose: string, reason?: string): Promise<boolean> {
    const existingConsent = await this.getLatestConsent(userId, purpose);
    
    if (!existingConsent || !existingConsent.granted) {
      return false;
    }

    // Create a new consent record showing revocation
    const revokedConsent: ConsentRecord = {
      ...existingConsent,
      consentId: this.generateConsentId(),
      granted: false,
      revokedAt: new Date().toISOString(),
      metadata: {
        ...existingConsent.metadata,
        revocationReason: reason || 'User requested',
        revokedAt: new Date().toISOString()
      }
    };

    await this.storeConsentRecord(revokedConsent);
    await this.updatePrivacySettings(userId, purpose, false);

    return true;
  }

  async getConsentStatus(userId: string, purpose: string): Promise<ConsentRecord | null> {
    return this.getLatestConsent(userId, purpose);
  }

  async getAllUserConsents(userId: string): Promise<ConsentRecord[]> {
    const tableName = process.env.CONSENT_RECORDS_TABLE_NAME || 'ConsentRecords';
    
    const queryParams = {
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId
      }),
      ScanIndexForward: false // Get most recent first
    };

    const queryCommand = new QueryCommand(queryParams);
    const response = await this.dynamoClient.send(queryCommand);

    if (response.Items) {
      return response.Items.map(item => unmarshall(item) as ConsentRecord);
    }

    return [];
  }

  async updatePrivacySettings(userId: string, purpose: string, granted: boolean): Promise<void> {
    const settings = await this.getPrivacySettings(userId) || this.createDefaultPrivacySettings(userId);
    
    // Update specific consent settings
    switch (purpose) {
      case 'marketing':
        settings.marketingConsent = granted;
        break;
      case 'analytics':
        settings.analyticsConsent = granted;
        break;
      case 'third_party_sharing':
        settings.thirdPartySharing = granted;
        break;
    }

    settings.updatedAt = new Date().toISOString();
    await this.storePrivacySettings(settings);
  }

  async getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    const tableName = process.env.PRIVACY_SETTINGS_TABLE_NAME || 'PrivacySettings';
    
    const queryParams = {
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId
      })
    };

    const queryCommand = new QueryCommand(queryParams);
    const response = await this.dynamoClient.send(queryCommand);

    if (response.Items && response.Items.length > 0) {
      return unmarshall(response.Items[0]) as PrivacySettings;
    }

    return null;
  }

  async setPrivacySettings(settings: PrivacySettings): Promise<void> {
    settings.updatedAt = new Date().toISOString();
    await this.storePrivacySettings(settings);
  }

  private async getLatestConsent(userId: string, purpose: string): Promise<ConsentRecord | null> {
    const tableName = process.env.CONSENT_RECORDS_TABLE_NAME || 'ConsentRecords';
    
    const queryParams = {
      TableName: tableName,
      IndexName: 'UserPurposeIndex',
      KeyConditionExpression: 'userId = :userId AND purpose = :purpose',
      ExpressionAttributeValues: marshall({
        ':userId': userId,
        ':purpose': purpose
      }),
      ScanIndexForward: false, // Get most recent first
      Limit: 1
    };

    const queryCommand = new QueryCommand(queryParams);
    const response = await this.dynamoClient.send(queryCommand);

    if (response.Items && response.Items.length > 0) {
      return unmarshall(response.Items[0]) as ConsentRecord;
    }

    return null;
  }

  private async storeConsentRecord(consent: ConsentRecord): Promise<void> {
    const tableName = process.env.CONSENT_RECORDS_TABLE_NAME || 'ConsentRecords';
    
    const putParams = {
      TableName: tableName,
      Item: marshall(consent)
    };

    // In a real implementation, you would use PutItemCommand
    console.log('Storing consent record:', consent.consentId);
  }

  private async storePrivacySettings(settings: PrivacySettings): Promise<void> {
    const tableName = process.env.PRIVACY_SETTINGS_TABLE_NAME || 'PrivacySettings';
    
    const putParams = {
      TableName: tableName,
      Item: marshall(settings)
    };

    // In a real implementation, you would use PutItemCommand
    console.log('Storing privacy settings for user:', settings.userId);
  }

  private createDefaultPrivacySettings(userId: string): PrivacySettings {
    return {
      userId,
      dataMinimization: true,
      marketingConsent: false,
      analyticsConsent: false,
      thirdPartySharing: false,
      dataRetentionPreference: 'standard',
      updatedAt: new Date().toISOString()
    };
  }

  private generateConsentId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async validateConsentForDataProcessing(userId: string, purpose: string, dataTypes: string[]): Promise<boolean> {
    const consent = await this.getConsentStatus(userId, purpose);
    
    if (!consent) {
      return false;
    }

    // Check if consent is granted and covers the required data types
    if (!consent.granted) {
      return false;
    }

    // Check if all required data types are covered by the consent
    const hasAllDataTypes = dataTypes.every(dataType => consent.dataTypes.includes(dataType));
    
    return hasAllDataTypes;
  }

  async getConsentAuditTrail(userId: string): Promise<ConsentRecord[]> {
    const allConsents = await this.getAllUserConsents(userId);
    
    // Return all consent records for audit purposes
    return allConsents.sort((a, b) => {
      const aTime = a.grantedAt || a.revokedAt || '';
      const bTime = b.grantedAt || b.revokedAt || '';
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  async cleanupExpiredConsents(): Promise<void> {
    // In a real implementation, this would clean up old consent records
    // based on data retention policies
    console.log('Cleaning up expired consent records');
  }
}