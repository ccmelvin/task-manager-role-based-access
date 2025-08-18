import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ConsentManagementService } from '../consent-management-service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: jest.fn((obj) => obj),
  unmarshall: jest.fn((obj) => obj)
}));

describe('ConsentManagementService', () => {
  let service: ConsentManagementService;
  let mockDynamoClient: jest.Mocked<DynamoDBClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoClient = new DynamoDBClient({}) as jest.Mocked<DynamoDBClient>;
    service = new ConsentManagementService();
    
    // Replace the internal DynamoDB client with our mock
    (service as any).dynamoClient = mockDynamoClient;
  });

  describe('recordConsent', () => {
    it('should record granted consent', async () => {
      jest.spyOn(service as any, 'storeConsentRecord').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'updatePrivacySettings').mockResolvedValue(undefined);

      const consent = await service.recordConsent(
        'user123',
        'marketing',
        ['email', 'profile'],
        'consent',
        true,
        '1.0',
        { ipAddress: '192.168.1.1' }
      );

      expect(consent.userId).toBe('user123');
      expect(consent.purpose).toBe('marketing');
      expect(consent.granted).toBe(true);
      expect(consent.grantedAt).toBeDefined();
      expect(consent.revokedAt).toBeUndefined();
      expect(consent.metadata.ipAddress).toBe('192.168.1.1');
    });

    it('should record revoked consent', async () => {
      jest.spyOn(service as any, 'storeConsentRecord').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'updatePrivacySettings').mockResolvedValue(undefined);

      const consent = await service.recordConsent(
        'user123',
        'analytics',
        ['usage_data'],
        'consent',
        false
      );

      expect(consent.granted).toBe(false);
      expect(consent.grantedAt).toBeUndefined();
      expect(consent.revokedAt).toBeDefined();
    });
  });

  describe('revokeConsent', () => {
    it('should revoke existing granted consent', async () => {
      const existingConsent = {
        consentId: 'consent123',
        userId: 'user123',
        purpose: 'marketing',
        granted: true,
        dataTypes: ['email'],
        legalBasis: 'consent' as const,
        version: '1.0',
        metadata: {}
      };

      jest.spyOn(service as any, 'getLatestConsent').mockResolvedValue(existingConsent);
      jest.spyOn(service as any, 'storeConsentRecord').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'updatePrivacySettings').mockResolvedValue(undefined);

      const result = await service.revokeConsent('user123', 'marketing', 'User requested');
      expect(result).toBe(true);
    });

    it('should return false when no existing consent found', async () => {
      jest.spyOn(service as any, 'getLatestConsent').mockResolvedValue(null);

      const result = await service.revokeConsent('user123', 'marketing');
      expect(result).toBe(false);
    });

    it('should return false when consent is already revoked', async () => {
      const existingConsent = {
        consentId: 'consent123',
        userId: 'user123',
        purpose: 'marketing',
        granted: false,
        dataTypes: ['email'],
        legalBasis: 'consent' as const,
        version: '1.0',
        metadata: {}
      };

      jest.spyOn(service as any, 'getLatestConsent').mockResolvedValue(existingConsent);

      const result = await service.revokeConsent('user123', 'marketing');
      expect(result).toBe(false);
    });
  });

  describe('validateConsentForDataProcessing', () => {
    it('should return true when valid consent exists', async () => {
      const consent = {
        consentId: 'consent123',
        userId: 'user123',
        purpose: 'analytics',
        granted: true,
        dataTypes: ['usage_data', 'performance_data'],
        legalBasis: 'consent' as const,
        version: '1.0',
        metadata: {}
      };

      jest.spyOn(service, 'getConsentStatus').mockResolvedValue(consent);

      const result = await service.validateConsentForDataProcessing(
        'user123',
        'analytics',
        ['usage_data']
      );
      expect(result).toBe(true);
    });

    it('should return false when consent is not granted', async () => {
      const consent = {
        consentId: 'consent123',
        userId: 'user123',
        purpose: 'analytics',
        granted: false,
        dataTypes: ['usage_data'],
        legalBasis: 'consent' as const,
        version: '1.0',
        metadata: {}
      };

      jest.spyOn(service, 'getConsentStatus').mockResolvedValue(consent);

      const result = await service.validateConsentForDataProcessing(
        'user123',
        'analytics',
        ['usage_data']
      );
      expect(result).toBe(false);
    });

    it('should return false when required data types are not covered', async () => {
      const consent = {
        consentId: 'consent123',
        userId: 'user123',
        purpose: 'analytics',
        granted: true,
        dataTypes: ['usage_data'],
        legalBasis: 'consent' as const,
        version: '1.0',
        metadata: {}
      };

      jest.spyOn(service, 'getConsentStatus').mockResolvedValue(consent);

      const result = await service.validateConsentForDataProcessing(
        'user123',
        'analytics',
        ['usage_data', 'location_data']
      );
      expect(result).toBe(false);
    });

    it('should return false when no consent exists', async () => {
      jest.spyOn(service, 'getConsentStatus').mockResolvedValue(null);

      const result = await service.validateConsentForDataProcessing(
        'user123',
        'analytics',
        ['usage_data']
      );
      expect(result).toBe(false);
    });
  });

  describe('privacy settings', () => {
    it('should create default privacy settings', () => {
      const settings = (service as any).createDefaultPrivacySettings('user123');
      
      expect(settings.userId).toBe('user123');
      expect(settings.dataMinimization).toBe(true);
      expect(settings.marketingConsent).toBe(false);
      expect(settings.analyticsConsent).toBe(false);
      expect(settings.thirdPartySharing).toBe(false);
      expect(settings.dataRetentionPreference).toBe('standard');
    });

    it('should update privacy settings based on consent purpose', async () => {
      const mockSettings = {
        userId: 'user123',
        dataMinimization: true,
        marketingConsent: false,
        analyticsConsent: false,
        thirdPartySharing: false,
        dataRetentionPreference: 'standard' as const,
        updatedAt: new Date().toISOString()
      };

      jest.spyOn(service, 'getPrivacySettings').mockResolvedValue(mockSettings);
      jest.spyOn(service as any, 'storePrivacySettings').mockResolvedValue(undefined);

      await service.updatePrivacySettings('user123', 'marketing', true);

      // Verify that storePrivacySettings was called with updated settings
      expect((service as any).storePrivacySettings).toHaveBeenCalledWith(
        expect.objectContaining({
          marketingConsent: true
        })
      );
    });
  });

  describe('utility methods', () => {
    it('should generate unique consent IDs', () => {
      const id1 = (service as any).generateConsentId();
      const id2 = (service as any).generateConsentId();
      
      expect(id1).toMatch(/^consent_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^consent_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });
});