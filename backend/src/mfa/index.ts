export { MFAService } from './mfa-service';

export interface MFASetupResult {
  secretCode: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAStatus {
  enabled: boolean;
  preferredMethod: 'SMS' | 'TOTP' | 'NONE';
  phoneNumberVerified: boolean;
  totpEnabled: boolean;
  backupCodesGenerated: boolean;
}

export interface MFAPreferences {
  smsEnabled: boolean;
  totpEnabled: boolean;
  preferredMethod: 'SMS' | 'TOTP';
}