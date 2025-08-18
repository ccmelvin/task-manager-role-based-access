import React, { useState } from 'react';

interface MFASetupProps {
  onComplete: (success: boolean) => void;
  onCancel: () => void;
}

interface MFASetupData {
  secretCode: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

const MFASetup: React.FC<MFASetupProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);

  const startMFASetup = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock API call - replace with actual API call
      const mockSetupData: MFASetupData = {
        secretCode: 'JBSWY3DPEHPK3PXP',
        qrCodeUrl: 'otpauth://totp/Task%20Manager:demo@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Task%20Manager',
        backupCodes: [
          '12345678', '87654321', '11223344', '44332211', '55667788',
          '88776655', '99001122', '22110099', '33445566', '66554433'
        ]
      };

      setSetupData(mockSetupData);
      setStep('verify');
    } catch (err) {
      setError('Failed to setup MFA. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMFACode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Mock API call - replace with actual API call
      const isValid = verificationCode === '123456'; // Mock validation
      
      if (isValid) {
        setStep('backup');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError('Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const completeMFASetup = () => {
    if (!backupCodesSaved) {
      setError('Please confirm that you have saved your backup codes');
      return;
    }
    onComplete(true);
  };

  const generateQRCode = (url: string) => {
    // In a real implementation, you would use a QR code library
    // For now, we'll show the URL and instructions
    return (
      <div className="text-center">
        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <p className="text-sm text-gray-600 mb-2">QR Code would appear here</p>
          <p className="text-xs text-gray-500 break-all">{url}</p>
        </div>
        <p className="text-sm text-gray-600">
          Scan this QR code with your authenticator app, or manually enter the secret code
        </p>
      </div>
    );
  };

  if (step === 'setup') {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Setup Two-Factor Authentication</h2>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Two-factor authentication adds an extra layer of security to your account. 
            You'll need an authenticator app like Google Authenticator or Authy.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <h3 className="font-medium text-blue-800 mb-2">What you'll need:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• An authenticator app on your phone</li>
              <li>• A secure place to store backup codes</li>
              <li>• A few minutes to complete setup</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={startMFASetup}
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Setting up...' : 'Start Setup'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Scan QR Code</h2>
        
        {setupData && (
          <div className="mb-6">
            {generateQRCode(setupData.qrCodeUrl)}
            
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm font-medium text-gray-700 mb-1">Manual entry code:</p>
              <p className="text-sm font-mono text-gray-600 break-all">{setupData.secretCode}</p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter verification code from your authenticator app:
          </label>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
            maxLength={6}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={verifyMFACode}
            disabled={isLoading || verificationCode.length !== 6}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>
          <button
            onClick={() => setStep('setup')}
            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (step === 'backup') {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Save Backup Codes</h2>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Save these backup codes in a secure location. You can use them to access your account 
            if you lose access to your authenticator app.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <p className="text-sm text-yellow-800 font-medium mb-2">⚠ Important:</p>
            <p className="text-sm text-yellow-700">
              Each backup code can only be used once. Store them securely and don't share them with anyone.
            </p>
          </div>

          {setupData && (
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                {setupData.backupCodes.map((code, index) => (
                  <div key={index} className="bg-white p-2 rounded border text-center">
                    {code}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={backupCodesSaved}
              onChange={(e) => setBackupCodesSaved(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">
              I have saved these backup codes in a secure location
            </span>
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={completeMFASetup}
            disabled={!backupCodesSaved}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Complete Setup
          </button>
          <button
            onClick={() => setStep('verify')}
            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default MFASetup;