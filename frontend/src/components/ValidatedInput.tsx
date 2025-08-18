/**
 * Validated Input Component
 * Provides real-time validation feedback with security-focused input handling
 */

import React, { useCallback, useState } from 'react';
import { ValidationError } from '../utils/validation';

interface ValidatedInputProps {
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'tel' | 'url';
  value: string;
  onChange: (name: string, value: string) => void;
  onBlur?: (name: string, value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  error?: string;
  errors?: ValidationError[];
  isValid?: boolean;
  isValidating?: boolean;
  showValidationIcon?: boolean;
  maxLength?: number;
  pattern?: string;
  min?: string;
  max?: string;
  step?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling';
}

const ValidatedInput: React.FC<ValidatedInputProps> = ({
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  label,
  required = false,
  disabled = false,
  autoComplete,
  className = '',
  error,
  errors = [],
  isValid,
  isValidating = false,
  showValidationIcon = true,
  maxLength,
  pattern,
  min,
  max,
  step,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(name, newValue);
  }, [name, onChange]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (onBlur) {
      onBlur(name, e.target.value);
    }
  }, [name, onBlur]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Determine validation state
  const hasError = error || errors.length > 0;
  const showSuccess = isValid !== undefined && isValid && !hasError && value.length > 0;
  const showValidation = showValidationIcon && (hasError || showSuccess || isValidating);

  // Generate unique IDs for accessibility
  const inputId = `input-${name}`;
  const errorId = `error-${name}`;
  const descriptionId = `description-${name}`;

  // Combine aria-describedby values
  const describedBy = [
    ariaDescribedBy,
    hasError ? errorId : null,
    errors.length > 0 ? descriptionId : null
  ].filter(Boolean).join(' ');

  return (
    <div className={`w-full ${className}`}>
      {/* Label */}
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          maxLength={maxLength}
          pattern={pattern}
          min={min}
          max={max}
          step={step}
          aria-invalid={ariaInvalid !== undefined ? ariaInvalid : (hasError ? 'true' : 'false')}
          aria-describedby={describedBy || undefined}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors duration-200
            ${showValidation ? 'pr-10' : 'pr-3'}
            ${hasError 
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
              : showSuccess
                ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }
            ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'}
            ${isFocused ? 'ring-2' : ''}
          `}
        />

        {/* Validation Icons */}
        {showValidation && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {isValidating ? (
              <svg 
                className="w-5 h-5 text-gray-400 animate-spin" 
                fill="none" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : hasError ? (
              <svg 
                className="w-5 h-5 text-red-500" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path 
                  fillRule="evenodd" 
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
                  clipRule="evenodd" 
                />
              </svg>
            ) : showSuccess ? (
              <svg 
                className="w-5 h-5 text-green-500" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                  clipRule="evenodd" 
                />
              </svg>
            ) : null}
          </div>
        )}
      </div>

      {/* Character Count */}
      {maxLength && isFocused && (
        <div className="mt-1 text-right">
          <span className={`text-xs ${
            value.length > maxLength * 0.9 
              ? value.length >= maxLength 
                ? 'text-red-500' 
                : 'text-yellow-500'
              : 'text-gray-500'
          }`}>
            {value.length}/{maxLength}
          </span>
        </div>
      )}

      {/* Error Messages */}
      {hasError && (
        <div className="mt-1">
          {error && (
            <p id={errorId} className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {errors.length > 0 && (
            <div id={descriptionId} className="space-y-1" role="alert">
              {errors.map((err, index) => (
                <p key={index} className="text-sm text-red-600">
                  {err.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {showSuccess && !hasError && (
        <p className="mt-1 text-sm text-green-600" role="status">
          ✓ Valid input
        </p>
      )}

      {/* Security Tips for Sensitive Fields */}
      {isFocused && (type === 'password' || type === 'email') && !value && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-sm text-blue-800">
            {type === 'password' ? (
              <>
                <p className="font-medium mb-1">Password Security:</p>
                <ul className="text-xs space-y-1">
                  <li>• Use a unique password you haven't used elsewhere</li>
                  <li>• Consider using a password manager</li>
                  <li>• Mix letters, numbers, and special characters</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-medium mb-1">Email Security:</p>
                <ul className="text-xs space-y-1">
                  <li>• Use a valid email address you can access</li>
                  <li>• Check for typos to ensure you receive notifications</li>
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidatedInput;