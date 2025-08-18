import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SNSClient } from '@aws-sdk/client-sns';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AccountSecurityService } from '../account-security-service';

// Mock AWS SDK clients
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-secrets-manager');
jest.mock('@aws-sdk/client-sns');

describe('AccountSecurityService', () => {
  let service: AccountSecurityService;
  let mockDynamoClient: jest.Mocked<DynamoDBDocumentClient>;
  let mockSecretsClient: jest.Mocked<SecretsManagerClient>;
  let mockSnsClient: jest.Mocked<SNSClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.DATABASE_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
    process.env.SECURITY_NOTIFICATIONS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:security-alerts';

    // Create service instance
    service = new AccountSecurityService();

    // Get mocked clients
    mockDynamoClient = DynamoDBDocumentClient.prototype as jest.Mocked<DynamoDBDocumentClient>;
    mockSecretsClient = SecretsManagerClient.prototype as jest.Mocked<SecretsManagerClient>;
    mockSnsClient = SNSClient.prototype as jest.Mocked<SNSClient>;
  });

  describe('recordSecurityEvent', () => {
    it('should record a failed login event and increment failed attempts', async () => {
      // Mock secrets response
      mockSecretsClient.send = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          userProfilesTableName: 'test-user-profiles'
        })
      });

      // Mock existing security profile
      mockDynamoClient.send = jest.fn()
        .mockResolvedValueOnce({
          Item: {
            userId: 'test-user',
            securityProfile: {
              userId: 'test-user',
              failedLoginAttempts: 2,
              suspiciousActivityScore: 0,
              knownIpAddresses: [],
              knownDevices: [],
              securityNotificationsEnabled: true,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z'
            }
          }
        })
        .mockResolvedValueOnce({}) // Update command
        .mockResolvedValueOnce({}); // Put command for event log

      const event = {
        userId: 'test-user',
        eventType: 'FAILED_LOGIN' as const,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        timestamp: '2025-01-01T12:00:00Z'
      };

      await service.recordSecurityEvent(event);

      // Verify DynamoDB calls
      expect(mockDynamoClient.send).toHaveBeenCalledTimes(3);
    });

    it('should lock account after max failed attempts', async () => {
      // Mock secrets response
      mockSecretsClient.send = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          userProfilesTableName: 'test-user-profiles'
        })
      });

      // Mock existing security profile with 4 failed attempts (max is 5)
      mockDynamoClient.send = jest.fn()
        .mockResolvedValueOnce({
          Item: {
            userId: 'test-user',
            securityProfile: {
              userId: 'test-user',
              failedLoginAttempts: 4,
              suspiciousActivityScore: 0,
              knownIpAddresses: [],
              knownDevices: [],
              securityNotificationsEnabled: true,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z'
            }
          }
        })
        .mockResolvedValueOnce({}) // Update command
        .mockResolvedValueOnce({}); // Put command for event log

      // Mock SNS notification
      mockSnsClient.send = jest.fn().mockResolvedValue({});

      const event = {
        userId: 'test-user',
        eventType: 'FAILED_LOGIN' as const,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        timestamp: '2025-01-01T12:00:00Z'
      };

      await service.recordSecurityEvent(event);

      // Verify SNS notification was sent
      expect(mockSnsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Subject: 'Security Alert: ACCOUNT_LOCKED for user test-user'
          })
        })
      );
    });

    it('should reset failed attempts on successful login', async () => {
      // Mock secrets response
      mockSecretsClient.send = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          userProfilesTableName: 'test-user-profiles'
        })
      });

      // Mock existing security profile with failed attempts
      mockDynamoClient.send = jest.fn()
        .mockResolvedValueOnce({
          Item: {
            userId: 'test-user',
            securityProfile: {
              userId: 'test-user',
              failedLoginAttempts: 3,
              suspiciousActivityScore: 0,
              knownIpAddresses: [],
              knownDevices: [],
              securityNotificationsEnabled: true,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z'
            }
          }
        })
        .mockResolvedValueOnce({}) // Update command
        .mockResolvedValueOnce({}); // Put command for event log

      const event = {
        userId: 'test-user',
        eventType: 'SUCCESSFUL_LOGIN' as const,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        timestamp: '2025-01-01T12:00:00Z'
      };

      await service.recordSecurityEvent(event);

      // Verify the update was called (failed attempts should be reset to 0)
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            UpdateExpression: 'SET securityProfile = :profile'
          })
        })
      );
    });
  });

  describe('isAccountLocked', () => {
    it('should return false for unlocked account', async () => {
      // Mock secrets response
      mockSecretsClient.send = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          userProfilesTableName: 'test-user-profiles'
        })
      });

      // Mock security profile without lockout
      mockDynamoClient.send = jest.fn().mockResolvedValue({
        Item: {
          userId: 'test-user',
          securityProfile: {
            userId: 'test-user',
            failedLoginAttempts: 2,
            suspiciousActivityScore: 0,
            knownIpAddresses: [],
            knownDevices: [],
            securityNotificationsEnabled: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z'
          }
        }
      });

      const isLocked = await service.isAccountLocked('test-user');
      expect(isLocked).toBe(false);
    });

    it('should return true for locked account within lockout period', async () => {
      // Mock secrets response
      mockSecretsClient.send = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          userProfilesTableName: 'test-user-profiles'
        })
      });

      // Mock security profile with future lockout
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 1);

      mockDynamoClient.send = jest.fn().mockResolvedValue({
        Item: {
          userId: 'test-user',
          securityProfile: {
            userId: 'test-user',
            failedLoginAttempts: 5,
            accountLockedUntil: futureTime.toISOString(),
            suspiciousActivityScore: 0,
            knownIpAddresses: [],
            knownDevices: [],
            securityNotificationsEnabled: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z'
          }
        }
      });

      const isLocked = await service.isAccountLocked('test-user');
      expect(isLocked).toBe(true);
    });

    it('should clear expired lockout and return false', async () => {
      // Mock secrets response
      mockSecretsClient.send = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          userProfilesTableName: 'test-user-profiles'
        })
      });

      // Mock security profile with past lockout
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 1);

      mockDynamoClient.send = jest.fn()
        .mockResolvedValueOnce({
          Item: {
            userId: 'test-user',
            securityProfile: {
              userId: 'test-user',
              failedLoginAttempts: 5,
              accountLockedUntil: pastTime.toISOString(),
              suspiciousActivityScore: 0,
              knownIpAddresses: [],
              knownDevices: [],
              securityNotificationsEnabled: true,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z'
            }
          }
        })
        .mockResolvedValueOnce({}); // Clear lockout update

      const isLocked = await service.isAccountLocked('test-user');
      expect(isLocked).toBe(false);

      // Verify lockout was cleared
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            UpdateExpression: expect.stringContaining('REMOVE securityProfile.accountLockedUntil')
          })
        })
      );
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should return higher score for unknown IP and device', async () => {
      // Mock secrets response
      mockSecretsClient.send = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          userProfilesTableName: 'test-user-profiles'
        })
      });

      // Mock security profile with known IPs and devices
      mockDynamoClient.send = jest.fn().mockResolvedValue({
        Item: {
          userId: 'test-user',
          securityProfile: {
            userId: 'test-user',
            failedLoginAttempts: 0,
            suspiciousActivityScore: 0,
            knownIpAddresses: ['192.168.1.100'],
            knownDevices: ['known-device-fingerprint'],
            securityNotificationsEnabled: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z'
          }
        }
      });

      const score = await service.detectSuspiciousActivity(
        'test-user',
        '10.0.0.1', // Unknown IP
        'Unknown User Agent' // Unknown device
      );

      // Should get points for unknown IP (3) + unknown device (2) = 5
      expect(score).toBeGreaterThanOrEqual(5);
    });

    it('should return lower score for known IP and device', async () => {
      // Mock secrets response
      mockSecretsClient.send = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          userProfilesTableName: 'test-user-profiles'
        })
      });

      // Create a known device fingerprint
      const crypto = require('crypto');
      const knownUserAgent = 'Mozilla/5.0 Known Browser';
      const knownDeviceFingerprint = crypto.createHash('sha256').update(knownUserAgent).digest('hex').substring(0, 16);

      // Mock security profile with known IPs and devices
      mockDynamoClient.send = jest.fn().mockResolvedValue({
        Item: {
          userId: 'test-user',
          securityProfile: {
            userId: 'test-user',
            failedLoginAttempts: 0,
            suspiciousActivityScore: 0,
            knownIpAddresses: ['192.168.1.100'],
            knownDevices: [knownDeviceFingerprint],
            securityNotificationsEnabled: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z'
          }
        }
      });

      const score = await service.detectSuspiciousActivity(
        'test-user',
        '192.168.1.100', // Known IP
        knownUserAgent // Known device
      );

      // Should get minimal points (maybe 1 for off-hours if applicable)
      expect(score).toBeLessThan(3);
    });
  });

  describe('sendSecurityNotification', () => {
    it('should send SNS notification for security events', async () => {
      mockSnsClient.send = jest.fn().mockResolvedValue({});

      await service.sendSecurityNotification('test-user', 'ACCOUNT_LOCKED', {
        reason: 'Too many failed attempts'
      });

      expect(mockSnsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TopicArn: process.env.SECURITY_NOTIFICATIONS_TOPIC_ARN,
            Subject: 'Security Alert: ACCOUNT_LOCKED for user test-user'
          })
        })
      );
    });

    it('should handle missing topic ARN gracefully', async () => {
      delete process.env.SECURITY_NOTIFICATIONS_TOPIC_ARN;
      
      // Should not throw error
      await expect(service.sendSecurityNotification('test-user', 'TEST_EVENT', {}))
        .resolves.not.toThrow();
    });
  });
});