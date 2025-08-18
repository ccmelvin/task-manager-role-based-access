import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { MFAService } from '../mfa-service';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-cognito-identity-provider');
jest.mock('@aws-sdk/client-secrets-manager');

describe('MFAService', () => {
  let service: MFAService;
  let mockCognitoClient: jest.Mocked<CognitoIdentityProviderClient>;
  let mockSecretsClient: jest.Mocked<SecretsManagerClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.COGNITO_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:cognito-secret';

    // Create service instance
    service = new MFAService();

    // Get mocked clients
    mockCognitoClient = CognitoIdentityProviderClient.prototype as jest.Mocked<CognitoIdentityProviderClient>;
    mockSecretsClient = SecretsManagerClient.prototype as jest.Mocked<SecretsManagerClient>;
  });

  describe('setupTOTP', () => {
    it('should successfully setup TOTP and return setup data', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockSecretCode = 'JBSWY3DPEHPK3PXP';

      // Mock AssociateSoftwareTokenCommand response
      mockCognitoClient.send = jest.fn()
        .mockResolvedValueOnce({
          SecretCode: mockSecretCode
        })
        .mockResolvedValueOnce({
          Username: 'testuser',
          UserAttributes: [
            { Name: 'email', Value: 'test@example.com' }
          ]
        });

      const result = await service.setupTOTP(mockAccessToken);

      expect(result).toEqual({
        secretCode: mockSecretCode,
        qrCodeUrl: expect.stringContaining('otpauth://totp/'),
        backupCodes: expect.arrayContaining([expect.any(String)])
      });

      expect(result.backupCodes).toHaveLength(10);
      expect(result.qrCodeUrl).toContain(mockSecretCode);
      expect(result.qrCodeUrl).toContain('test@example.com');
    });

    it('should throw error when secret code is not returned', async () => {
      const mockAccessToken = 'mock-access-token';

      // Mock AssociateSoftwareTokenCommand response without SecretCode
      mockCognitoClient.send = jest.fn().mockResolvedValue({});

      await expect(service.setupTOTP(mockAccessToken)).rejects.toThrow('Failed to generate TOTP secret');
    });

    it('should handle Cognito errors gracefully', async () => {
      const mockAccessToken = 'mock-access-token';

      // Mock AssociateSoftwareTokenCommand to throw error
      mockCognitoClient.send = jest.fn().mockRejectedValue(new Error('Cognito error'));

      await expect(service.setupTOTP(mockAccessToken)).rejects.toThrow('Failed to setup TOTP authentication');
    });
  });

  describe('verifyTOTP', () => {
    it('should successfully verify TOTP code and enable MFA', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockTotpCode = '123456';

      // Mock VerifySoftwareTokenCommand and SetUserMFAPreferenceCommand responses
      mockCognitoClient.send = jest.fn()
        .mockResolvedValueOnce({
          Status: 'SUCCESS'
        })
        .mockResolvedValueOnce({}); // SetUserMFAPreferenceCommand

      const result = await service.verifyTOTP(mockAccessToken, mockTotpCode);

      expect(result).toBe(true);
      expect(mockCognitoClient.send).toHaveBeenCalledTimes(2);
    });

    it('should return false for invalid TOTP code', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockTotpCode = '123456';

      // Mock VerifySoftwareTokenCommand response with failure
      mockCognitoClient.send = jest.fn().mockResolvedValue({
        Status: 'FAILURE'
      });

      const result = await service.verifyTOTP(mockAccessToken, mockTotpCode);

      expect(result).toBe(false);
      expect(mockCognitoClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle verification errors gracefully', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockTotpCode = '123456';

      // Mock VerifySoftwareTokenCommand to throw error
      mockCognitoClient.send = jest.fn().mockRejectedValue(new Error('Verification error'));

      const result = await service.verifyTOTP(mockAccessToken, mockTotpCode);

      expect(result).toBe(false);
    });
  });

  describe('setMFAPreference', () => {
    it('should successfully set MFA preferences', async () => {
      const mockAccessToken = 'mock-access-token';
      const preferences = {
        smsEnabled: false,
        totpEnabled: true,
        preferredMethod: 'TOTP' as const
      };

      mockCognitoClient.send = jest.fn().mockResolvedValue({});

      await service.setMFAPreference(mockAccessToken, preferences);

      expect(mockCognitoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            AccessToken: mockAccessToken,
            SoftwareTokenMfaSettings: {
              Enabled: true,
              PreferredMfa: true
            },
            SMSMfaSettings: {
              Enabled: false,
              PreferredMfa: false
            }
          })
        })
      );
    });

    it('should handle preference setting errors', async () => {
      const mockAccessToken = 'mock-access-token';
      const preferences = {
        smsEnabled: true,
        totpEnabled: false,
        preferredMethod: 'SMS' as const
      };

      mockCognitoClient.send = jest.fn().mockRejectedValue(new Error('Preference error'));

      await expect(service.setMFAPreference(mockAccessToken, preferences))
        .rejects.toThrow('Failed to update MFA preferences');
    });
  });

  describe('getMFAStatus', () => {
    it('should return correct MFA status for TOTP-enabled user', async () => {
      const mockAccessToken = 'mock-access-token';

      mockCognitoClient.send = jest.fn().mockResolvedValue({
        MFAOptions: [
          { DeliveryMedium: 'SOFTWARE_TOKEN_MFA' }
        ],
        UserAttributes: [
          { Name: 'phone_number_verified', Value: 'false' }
        ],
        PreferredMfaSetting: 'SOFTWARE_TOKEN_MFA'
      });

      const status = await service.getMFAStatus(mockAccessToken);

      expect(status).toEqual({
        enabled: true,
        preferredMethod: 'TOTP',
        phoneNumberVerified: false,
        totpEnabled: true,
        backupCodesGenerated: false
      });
    });

    it('should return correct MFA status for SMS-enabled user', async () => {
      const mockAccessToken = 'mock-access-token';

      mockCognitoClient.send = jest.fn().mockResolvedValue({
        MFAOptions: [
          { DeliveryMedium: 'SMS' }
        ],
        UserAttributes: [
          { Name: 'phone_number_verified', Value: 'true' }
        ],
        PreferredMfaSetting: 'SMS_MFA'
      });

      const status = await service.getMFAStatus(mockAccessToken);

      expect(status).toEqual({
        enabled: true,
        preferredMethod: 'SMS',
        phoneNumberVerified: true,
        totpEnabled: false,
        backupCodesGenerated: false
      });
    });

    it('should return correct MFA status for user with no MFA', async () => {
      const mockAccessToken = 'mock-access-token';

      mockCognitoClient.send = jest.fn().mockResolvedValue({
        MFAOptions: [],
        UserAttributes: [],
        PreferredMfaSetting: undefined
      });

      const status = await service.getMFAStatus(mockAccessToken);

      expect(status).toEqual({
        enabled: false,
        preferredMethod: 'NONE',
        phoneNumberVerified: false,
        totpEnabled: false,
        backupCodesGenerated: false
      });
    });

    it('should handle status retrieval errors', async () => {
      const mockAccessToken = 'mock-access-token';

      mockCognitoClient.send = jest.fn().mockRejectedValue(new Error('Status error'));

      await expect(service.getMFAStatus(mockAccessToken))
        .rejects.toThrow('Failed to get MFA status');
    });
  });

  describe('disableMFA', () => {
    it('should successfully disable MFA', async () => {
      const mockAccessToken = 'mock-access-token';

      mockCognitoClient.send = jest.fn().mockResolvedValue({});

      await service.disableMFA(mockAccessToken);

      expect(mockCognitoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            AccessToken: mockAccessToken,
            SoftwareTokenMfaSettings: {
              Enabled: false,
              PreferredMfa: false
            },
            SMSMfaSettings: {
              Enabled: false,
              PreferredMfa: false
            }
          })
        })
      );
    });

    it('should handle disable MFA errors', async () => {
      const mockAccessToken = 'mock-access-token';

      mockCognitoClient.send = jest.fn().mockRejectedValue(new Error('Disable error'));

      await expect(service.disableMFA(mockAccessToken))
        .rejects.toThrow('Failed to disable MFA');
    });
  });

  describe('adminSetMFAPreference', () => {
    it('should successfully set MFA preferences as admin', async () => {
      const userPoolId = 'us-east-1_123456789';
      const username = 'testuser';
      const preferences = {
        smsEnabled: true,
        totpEnabled: false,
        preferredMethod: 'SMS' as const
      };

      mockCognitoClient.send = jest.fn().mockResolvedValue({});

      await service.adminSetMFAPreference(userPoolId, username, preferences);

      expect(mockCognitoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            UserPoolId: userPoolId,
            Username: username,
            SoftwareTokenMfaSettings: {
              Enabled: false,
              PreferredMfa: false
            },
            SMSMfaSettings: {
              Enabled: true,
              PreferredMfa: true
            }
          })
        })
      );
    });

    it('should handle admin preference setting errors', async () => {
      const userPoolId = 'us-east-1_123456789';
      const username = 'testuser';
      const preferences = {
        smsEnabled: false,
        totpEnabled: true,
        preferredMethod: 'TOTP' as const
      };

      mockCognitoClient.send = jest.fn().mockRejectedValue(new Error('Admin error'));

      await expect(service.adminSetMFAPreference(userPoolId, username, preferences))
        .rejects.toThrow('Failed to update MFA preferences (admin)');
    });
  });
});