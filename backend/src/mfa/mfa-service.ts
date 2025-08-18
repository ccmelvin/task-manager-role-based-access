import {
    AdminSetUserMFAPreferenceCommand,
    AssociateSoftwareTokenCommand,
    CognitoIdentityProviderClient,
    GetUserCommand,
    SetUserMFAPreferenceCommand,
    VerifySoftwareTokenCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

interface MFASetupResult {
  secretCode: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

interface MFAStatus {
  enabled: boolean;
  preferredMethod: 'SMS' | 'TOTP' | 'NONE';
  phoneNumberVerified: boolean;
  totpEnabled: boolean;
  backupCodesGenerated: boolean;
}

interface MFAPreferences {
  smsEnabled: boolean;
  totpEnabled: boolean;
  preferredMethod: 'SMS' | 'TOTP';
}

export class MFAService {
  private cognitoClient: CognitoIdentityProviderClient;
  private secretsClient: SecretsManagerClient;

  constructor() {
    this.cognitoClient = new CognitoIdentityProviderClient({ 
      region: process.env.AWS_REGION 
    });
    this.secretsClient = new SecretsManagerClient({ 
      region: process.env.AWS_REGION 
    });
  }

  /**
   * Initiate TOTP setup for a user
   */
  async setupTOTP(accessToken: string): Promise<MFASetupResult> {
    try {
      // Associate software token (TOTP) with user
      const associateCommand = new AssociateSoftwareTokenCommand({
        AccessToken: accessToken
      });

      const associateResult = await this.cognitoClient.send(associateCommand);
      const secretCode = associateResult.SecretCode;

      if (!secretCode) {
        throw new Error('Failed to generate TOTP secret');
      }

      // Generate QR code URL for authenticator apps
      const userInfo = await this.getUserInfo(accessToken);
      const appName = 'Task Manager';
      const accountName = userInfo.email || userInfo.username;
      
      const qrCodeUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(accountName)}?secret=${secretCode}&issuer=${encodeURIComponent(appName)}`;

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      return {
        secretCode,
        qrCodeUrl,
        backupCodes
      };
    } catch (error) {
      console.error('Error setting up TOTP:', error);
      throw new Error('Failed to setup TOTP authentication');
    }
  }

  /**
   * Verify TOTP setup with user-provided code
   */
  async verifyTOTP(accessToken: string, totpCode: string): Promise<boolean> {
    try {
      const verifyCommand = new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: totpCode
      });

      const result = await this.cognitoClient.send(verifyCommand);
      
      if (result.Status === 'SUCCESS') {
        // Enable TOTP as preferred MFA method
        await this.setMFAPreference(accessToken, {
          smsEnabled: false,
          totpEnabled: true,
          preferredMethod: 'TOTP'
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error verifying TOTP:', error);
      return false;
    }
  }

  /**
   * Set user MFA preferences
   */
  async setMFAPreference(accessToken: string, preferences: MFAPreferences): Promise<void> {
    try {
      const command = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SMSMfaSettings: {
          Enabled: preferences.smsEnabled,
          PreferredMfa: preferences.preferredMethod === 'SMS'
        },
        SoftwareTokenMfaSettings: {
          Enabled: preferences.totpEnabled,
          PreferredMfa: preferences.preferredMethod === 'TOTP'
        }
      });

      await this.cognitoClient.send(command);
    } catch (error) {
      console.error('Error setting MFA preference:', error);
      throw new Error('Failed to update MFA preferences');
    }
  }

  /**
   * Get user MFA status
   */
  async getMFAStatus(accessToken: string): Promise<MFAStatus> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken
      });

      const result = await this.cognitoClient.send(command);
      
      const mfaOptions = result.MFAOptions || [];
      const userAttributes = result.UserAttributes || [];
      
      const phoneNumberVerified = userAttributes.find(
        attr => attr.Name === 'phone_number_verified'
      )?.Value === 'true';

      const totpEnabled = mfaOptions.some(option => option.DeliveryMedium === 'SOFTWARE_TOKEN_MFA');
      const smsEnabled = mfaOptions.some(option => option.DeliveryMedium === 'SMS');

      let preferredMethod: 'SMS' | 'TOTP' | 'NONE' = 'NONE';
      if (result.PreferredMfaSetting === 'SOFTWARE_TOKEN_MFA') {
        preferredMethod = 'TOTP';
      } else if (result.PreferredMfaSetting === 'SMS_MFA') {
        preferredMethod = 'SMS';
      }

      return {
        enabled: totpEnabled || smsEnabled,
        preferredMethod,
        phoneNumberVerified,
        totpEnabled,
        backupCodesGenerated: false // This would need to be tracked separately
      };
    } catch (error) {
      console.error('Error getting MFA status:', error);
      throw new Error('Failed to get MFA status');
    }
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(accessToken: string): Promise<void> {
    try {
      const command = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SMSMfaSettings: {
          Enabled: false,
          PreferredMfa: false
        },
        SoftwareTokenMfaSettings: {
          Enabled: false,
          PreferredMfa: false
        }
      });

      await this.cognitoClient.send(command);
    } catch (error) {
      console.error('Error disabling MFA:', error);
      throw new Error('Failed to disable MFA');
    }
  }

  /**
   * Generate backup codes for MFA recovery
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // Generate 8-digit backup codes
      const code = Math.random().toString().slice(2, 10);
      codes.push(code);
    }
    return codes;
  }

  /**
   * Get user information from access token
   */
  private async getUserInfo(accessToken: string): Promise<{ email?: string; username: string }> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken
      });

      const result = await this.cognitoClient.send(command);
      const userAttributes = result.UserAttributes || [];
      
      const email = userAttributes.find(attr => attr.Name === 'email')?.Value;
      const username = result.Username || 'unknown';

      return { email, username };
    } catch (error) {
      console.error('Error getting user info:', error);
      return { username: 'unknown' };
    }
  }

  /**
   * Admin function to set MFA preference for a user (requires admin privileges)
   */
  async adminSetMFAPreference(
    userPoolId: string, 
    username: string, 
    preferences: MFAPreferences
  ): Promise<void> {
    try {
      const command = new AdminSetUserMFAPreferenceCommand({
        UserPoolId: userPoolId,
        Username: username,
        SMSMfaSettings: {
          Enabled: preferences.smsEnabled,
          PreferredMfa: preferences.preferredMethod === 'SMS'
        },
        SoftwareTokenMfaSettings: {
          Enabled: preferences.totpEnabled,
          PreferredMfa: preferences.preferredMethod === 'TOTP'
        }
      });

      await this.cognitoClient.send(command);
    } catch (error) {
      console.error('Error setting admin MFA preference:', error);
      throw new Error('Failed to update MFA preferences (admin)');
    }
  }

  /**
   * Get Cognito configuration from secrets
   */
  private async getCognitoConfig(): Promise<{ userPoolId: string; region: string }> {
    try {
      const result = await this.secretsClient.send(new GetSecretValueCommand({
        SecretId: process.env.COGNITO_SECRET_ARN
      }));
      
      return JSON.parse(result.SecretString || '{}');
    } catch (error) {
      console.error('Error getting Cognito config:', error);
      throw error;
    }
  }
}