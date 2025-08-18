import React from 'react';

interface PasswordStrengthValidatorProps {
  password: string;
  showValidation?: boolean;
  className?: string;
}

interface ValidationRule {
  test: (password: string) => boolean;
  message: string;
  passed: boolean;
}

const PasswordStrengthValidator: React.FC<PasswordStrengthValidatorProps> = ({
  password,
  showValidation = true,
  className = ''
}) => {
  const validationRules: ValidationRule[] = [
    {
      test: (pwd) => pwd.length >= 12,
      message: 'At least 12 characters long',
      passed: password.length >= 12
    },
    {
      test: (pwd) => /[a-z]/.test(pwd),
      message: 'Contains lowercase letters',
      passed: /[a-z]/.test(password)
    },
    {
      test: (pwd) => /[A-Z]/.test(pwd),
      message: 'Contains uppercase letters',
      passed: /[A-Z]/.test(password)
    },
    {
      test: (pwd) => /\d/.test(pwd),
      message: 'Contains numbers',
      passed: /\d/.test(password)
    },
    {
      test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
      message: 'Contains special characters (!@#$%^&*)',
      passed: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    }
  ];

  const passedRules = validationRules.filter(rule => rule.passed).length;
  const totalRules = validationRules.length;
  const strengthPercentage = (passedRules / totalRules) * 100;

  const getStrengthColor = () => {
    if (strengthPercentage < 40) return 'bg-red-500';
    if (strengthPercentage < 70) return 'bg-yellow-500';
    if (strengthPercentage < 90) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (strengthPercentage < 40) return 'Weak';
    if (strengthPercentage < 70) return 'Fair';
    if (strengthPercentage < 90) return 'Good';
    return 'Strong';
  };

  const isPasswordValid = () => {
    return validationRules.every(rule => rule.passed);
  };

  if (!showValidation || !password) {
    return null;
  }

  return (
    <div className={`mt-2 ${className}`}>
      {/* Password Strength Bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">Password Strength</span>
          <span className={`text-sm font-medium ${
            strengthPercentage < 40 ? 'text-red-600' :
            strengthPercentage < 70 ? 'text-yellow-600' :
            strengthPercentage < 90 ? 'text-blue-600' : 'text-green-600'
          }`}>
            {getStrengthText()}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${strengthPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Validation Rules */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</p>
        {validationRules.map((rule, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
              rule.passed ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {rule.passed && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${
              rule.passed ? 'text-green-700' : 'text-gray-600'
            }`}>
              {rule.message}
            </span>
          </div>
        ))}
      </div>

      {/* Overall Validation Status */}
      {password && (
        <div className={`mt-3 p-2 rounded-md ${
          isPasswordValid() 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <p className={`text-sm ${
            isPasswordValid() ? 'text-green-800' : 'text-yellow-800'
          }`}>
            {isPasswordValid() 
              ? '✓ Password meets all security requirements'
              : `⚠ Password must meet all ${totalRules} requirements above`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthValidator;