import React, { useEffect, useState } from 'react';
import MFASetup from './MFASetup';

interface MFAStatus {
  enabled: boolean;
  preferredMethod: 'SMS' | 'TOTP' | 'NONE';
  phoneNumberVerified: boolean;
  totpEnabled: boolean;
  backupCodesGenerated: boolean;
}

interface MFAManagementProps {
  className?: string;
}

const MFAManagement: React.FC<MFAManagementProps> = ({ className = '' }) => {
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock API call - replace with actual API call
      const mockStatus: MFAStatus = {
        enabled: false,
        preferredMethod: 'NONE',
        phoneNumberVerified: false,
        totpEnabled: false,
        backupCodesGenerated: false
      };

      setMfaStatus(mockStatus);
    } catch (err) {
      setError('Failed to load MFA status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupComplete = (success: boolean) => {
    setShowSetup(false);
    if (success) {
      loadMFAStatus(); // Reload status after successful setup
    }
  };

  const handleDisableMFA = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock API call - replace with actual API call
      console.log('Disabling MFA...');
      
      // Update local state
      setMfaStatus(prev => prev ? {
        ...prev,
        enabled: false,
        preferredMethod: 'NONE',
        totpEnabled: false
      } : null);
      
      setShowDisableConfirm(false);
    } catch (err) {
      setError('Failed to disable MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewBackupCodes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock API call - replace with actual API call
      const newCodes = [
        '12345678', '87654321', '11223344', '44332211', '55667788',
        '88776655', '99001122', '22110099', '33445566', '66554433'
      ];

      // Show new backup codes in a modal or alert
      alert(`New backup codes generated:\n${newCodes.join('\n')}\n\nSave these codes securely!`);
    } catch (err) {
      setError('Failed to generate new backup codes');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !mfaStatus) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className={className}>
        <MFASetup
          onComplete={handleSetupComplete}
          onCancel={() => setShowSetup(false)}
        />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Two-Factor Authentication</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {mfaStatus && (
        <div className="space-y-4">
          {/* MFA Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Status</h3>
              <p className="text-sm text-gray-600">
                {mfaStatus.enabled ? (
                  <span className="text-green-600 font-medium">
                    ✓ Enabled ({mfaStatus.preferredMethod})
                  </span>
                ) : (
                  <span className="text-red-600 font-medium">
                    ✗ Disabled
                  </span>
                )}
              </p>
            </div>
            <div className={`w-3 h-3 rounded-full ${
              mfaStatus.enabled ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
          </div>

          {/* MFA Methods */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">Authentication Methods</h3>
            
            {/* TOTP */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium text-gray-800">Authenticator App (TOTP)</h4>
                <p className="text-sm text-gray-600">
                  Use Google Authenticator, Authy, or similar apps
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${
                  mfaStatus.totpEnabled ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {mfaStatus.totpEnabled ? 'Enabled' : 'Disabled'}
                </span>
                {mfaStatus.preferredMethod === 'TOTP' && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    Preferred
                  </span>
                )}
              </div>
            </div>

            {/* SMS */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium text-gray-800">SMS Text Message</h4>
                <p className="text-sm text-gray-600">
                  Receive codes via text message
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${
                  mfaStatus.phoneNumberVerified ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {mfaStatus.phoneNumberVerified ? 'Available' : 'Not Setup'}
                </span>
                {mfaStatus.preferredMethod === 'SMS' && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    Preferred
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t">
            <div className="flex flex-wrap gap-3">
              {!mfaStatus.enabled ? (
                <button
                  onClick={() => setShowSetup(true)}
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Enable Two-Factor Authentication
                </button>
              ) : (
                <>
                  <button
                    onClick={generateNewBackupCodes}
                    disabled={isLoading}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Generate New Backup Codes
                  </button>
                  <button
                    onClick={() => setShowDisableConfirm(true)}
                    disabled={isLoading}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Disable MFA
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="font-medium text-blue-800 mb-2">Security Recommendation</h4>
            <p className="text-sm text-blue-700">
              {mfaStatus.enabled ? (
                "Great! Two-factor authentication is protecting your account. Keep your backup codes in a safe place."
              ) : (
                "Enable two-factor authentication to add an extra layer of security to your account. This helps protect against unauthorized access even if your password is compromised."
              )}
            </p>
          </div>
        </div>
      )}

      {/* Disable MFA Confirmation Modal */}
      {showDisableConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Disable Two-Factor Authentication?</h3>
            <p className="text-gray-600 mb-6">
              This will make your account less secure. You'll only need your password to sign in.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleDisableMFA}
                disabled={isLoading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Disabling...' : 'Yes, Disable MFA'}
              </button>
              <button
                onClick={() => setShowDisableConfirm(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MFAManagement;