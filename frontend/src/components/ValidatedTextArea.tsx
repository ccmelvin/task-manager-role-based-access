/**
 * Validated TextArea Component
 * Provides real-time validation feedback for multi-line text inputs
 */

import React, { useCallback, useState } from 'react';
import { ValidationError } from '../utils/validation';

interface ValidatedTextAreaProps {
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  onBlur?: (name: string, value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  errors?: ValidationError[];
  isValid?: boolean;
  isValidating?: boolean;
  showValidationIcon?: boolean;
  maxLength?: number;
  rows?: number;
  cols?: number;
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling';
}

const ValidatedTextArea: React.FC<ValidatedTextAreaProps> = ({
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  label,
  required = false,
  disabled = false,
  className = '',
  error,
  errors = [],
  isValid,
  isValidating = false,
  showValidationIcon = true,
  maxLength,
  rows = 3,
  cols,
  resize = 'vertical',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(name, newValue);
  }, [name, onChange]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
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

  // Generate unique IDs for accessibility
  const textareaId = `textarea-${name}`;
  const errorId = `error-${name}`;
  const descriptionId = `description-${name}`;

  // Combine aria-describedby values
  const describedBy = [
    ariaDescribedBy,
    hasError ? errorId : null,
    errors.length > 0 ? descriptionId : null
  ].filter(Boolean).join(' ');

  // Calculate word and line count
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const lineCount = value.split('\n').length;

  return (
    <div className={`w-full ${className}`}>
      {/* Label */}
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        </label>
      )}

      {/* TextArea Container */}
      <div className="relative">
        <textarea
          id={textareaId}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          rows={rows}
          cols={cols}
          aria-invalid={ariaInvalid !== undefined ? ariaInvalid : (hasError ? 'true' : 'false')}
          aria-describedby={describedBy || undefined}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors duration-200
            ${hasError 
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
              : showSuccess
                ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }
            ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'}
            ${isFocused ? 'ring-2' : ''}
            ${resize === 'none' ? 'resize-none' : 
              resize === 'horizontal' ? 'resize-x' : 
              resize === 'vertical' ? 'resize-y' : 'resize'}
          `}
          style={{ minHeight: `${rows * 1.5}rem` }}
        />

        {/* Validation Icon */}
        {showValidationIcon && (hasError || showSuccess || isValidating) && (
          <div className="absolute top-2 right-2 pointer-events-none">
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

      {/* Statistics and Character Count */}
      {(maxLength || isFocused) && (
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <div className="space-x-4">
            {isFocused && (
              <>
                <span>{wordCount} words</span>
                <span>{lineCount} lines</span>
              </>
            )}
          </div>
          {maxLength && (
            <span className={`${
              value.length > maxLength * 0.9 
                ? value.length >= maxLength 
                  ? 'text-red-500' 
                  : 'text-yellow-500'
                : 'text-gray-500'
            }`}>
              {value.length}/{maxLength}
            </span>
          )}
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

      {/* Writing Tips */}
      {isFocused && !value && placeholder && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Writing Tips:</p>
            <ul className="text-xs space-y-1">
              <li>• Be clear and concise in your description</li>
              <li>• Use proper grammar and spelling</li>
              <li>• Avoid including sensitive information</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidatedTextArea;