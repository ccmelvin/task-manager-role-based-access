/**
 * React Hook for Real-time Input Validation
 * Provides comprehensive validation with sanitization and security features
 */

import { useCallback, useEffect, useState } from 'react';
import { SanitizationService } from '../utils/sanitization';
import { ValidationError, ValidationResult, ValidationSchema, ValidationService } from '../utils/validation';

interface UseValidationOptions {
    validateOnChange?: boolean;
    validateOnBlur?: boolean;
    sanitizeOnChange?: boolean;
    debounceMs?: number;
}

interface ValidationState {
    errors: Record<string, ValidationError[]>;
    isValid: boolean;
    isValidating: boolean;
    touchedFields: Set<string>;
    sanitizedData: Record<string, any>;
}

export const useValidation = (
    schema: ValidationSchema[],
    options: UseValidationOptions = {}
) => {
    const {
        validateOnChange = true,
        validateOnBlur = true,
        sanitizeOnChange = true,
        debounceMs = 300
    } = options;

    const [validationState, setValidationState] = useState<ValidationState>({
        errors: {},
        isValid: false,
        isValidating: false,
        touchedFields: new Set(),
        sanitizedData: {}
    });

    const validationService = ValidationService.getInstance();
    const sanitizationService = SanitizationService.getInstance();

    // Debounce timer ref
    const debounceTimerRef = useState<NodeJS.Timeout | null>(null)[0];

    const validateField = useCallback((fieldName: string, value: any): ValidationResult => {
        const fieldSchema = schema.find(s => s.field === fieldName);
        if (!fieldSchema) {
            return { isValid: true, errors: [] };
        }

        return validationService.validateSingleField(value, fieldSchema);
    }, [schema, validationService]);

    const validateAllFields = useCallback((data: Record<string, any>): ValidationResult => {
        return validationService.validate(data, schema);
    }, [schema, validationService]);

    const sanitizeField = useCallback((fieldName: string, value: any): any => {
        if (typeof value !== 'string') return value;

        const fieldSchema = schema.find(s => s.field === fieldName);
        const maxLength = fieldSchema?.constraints.find(c => c.type === 'length')?.value?.max;

        return sanitizationService.sanitizeText(value, {
            allowHtml: false,
            maxLength,
            trimWhitespace: true,
            removeControlChars: true,
            normalizeUnicode: true
        });
    }, [schema, sanitizationService]);

    const updateValidationState = useCallback((
        fieldName: string,
        validationResult: ValidationResult,
        sanitizedValue?: any
    ) => {
        setValidationState(prev => {
            const newErrors = { ...prev.errors };
            const newSanitizedData = { ...prev.sanitizedData };

            if (validationResult.errors.length > 0) {
                newErrors[fieldName] = validationResult.errors;
            } else {
                delete newErrors[fieldName];
            }

            if (sanitizedValue !== undefined) {
                newSanitizedData[fieldName] = sanitizedValue;
            }

            const hasErrors = Object.keys(newErrors).length > 0;

            return {
                ...prev,
                errors: newErrors,
                isValid: !hasErrors,
                sanitizedData: newSanitizedData
            };
        });
    }, []);

    const validateFieldWithDebounce = useCallback((
        fieldName: string,
        value: any,
        immediate: boolean = false
    ) => {
        if (debounceTimerRef) {
            clearTimeout(debounceTimerRef);
        }

        const performValidation = () => {
            setValidationState(prev => ({ ...prev, isValidating: true }));

            const sanitizedValue = sanitizeOnChange ? sanitizeField(fieldName, value) : value;
            const validationResult = validateField(fieldName, sanitizedValue);

            updateValidationState(fieldName, validationResult, sanitizedValue);

            setValidationState(prev => ({ ...prev, isValidating: false }));
        };

        if (immediate || debounceMs === 0) {
            performValidation();
        } else {
            const timer = setTimeout(performValidation, debounceMs);
            // Store timer reference for cleanup
            if (debounceTimerRef) {
                clearTimeout(debounceTimerRef);
            }
        }
    }, [validateField, sanitizeField, sanitizeOnChange, debounceMs, updateValidationState]);

    const handleFieldChange = useCallback((fieldName: string, value: any) => {
        // Mark field as touched
        setValidationState(prev => {
            const newTouchedFields = new Set(prev.touchedFields);
            newTouchedFields.add(fieldName);
            return {
                ...prev,
                touchedFields: newTouchedFields
            };
        });

        if (validateOnChange) {
            validateFieldWithDebounce(fieldName, value);
        } else if (sanitizeOnChange) {
            const sanitizedValue = sanitizeField(fieldName, value);
            setValidationState(prev => ({
                ...prev,
                sanitizedData: { ...prev.sanitizedData, [fieldName]: sanitizedValue }
            }));
        }
    }, [validateOnChange, sanitizeOnChange, validateFieldWithDebounce, sanitizeField]);

    const handleFieldBlur = useCallback((fieldName: string, value: any) => {
        // Mark field as touched
        setValidationState(prev => {
            const newTouchedFields = new Set(prev.touchedFields);
            newTouchedFields.add(fieldName);
            return {
                ...prev,
                touchedFields: newTouchedFields
            };
        });

        if (validateOnBlur) {
            validateFieldWithDebounce(fieldName, value, true); // Immediate validation on blur
        }
    }, [validateOnBlur, validateFieldWithDebounce]);

    const validateForm = useCallback((data: Record<string, any>): ValidationResult => {
        setValidationState(prev => ({ ...prev, isValidating: true }));

        // Sanitize all data first
        const sanitizedData = sanitizeOnChange
            ? sanitizationService.sanitizeAllTextFields(data, {})
            : data;

        const validationResult = validateAllFields(sanitizedData);

        // Update state with all field errors
        const fieldErrors: Record<string, ValidationError[]> = {};
        validationResult.errors.forEach(error => {
            if (!fieldErrors[error.field]) {
                fieldErrors[error.field] = [];
            }
            fieldErrors[error.field].push(error);
        });

        setValidationState(prev => {
            const newTouchedFields = new Set<string>();
            Object.keys(data).forEach(key => newTouchedFields.add(key));
            return {
                ...prev,
                errors: fieldErrors,
                isValid: validationResult.isValid,
                isValidating: false,
                sanitizedData: validationResult.sanitizedData || sanitizedData,
                touchedFields: newTouchedFields
            };
        });

        return validationResult;
    }, [validateAllFields, sanitizationService, sanitizeOnChange]);

    const clearValidation = useCallback(() => {
        setValidationState({
            errors: {},
            isValid: false,
            isValidating: false,
            touchedFields: new Set(),
            sanitizedData: {}
        });
    }, []);

    const getFieldError = useCallback((fieldName: string): string | undefined => {
        const fieldErrors = validationState.errors[fieldName];
        return fieldErrors && fieldErrors.length > 0 ? fieldErrors[0].message : undefined;
    }, [validationState.errors]);

    const getFieldErrors = useCallback((fieldName: string): ValidationError[] => {
        return validationState.errors[fieldName] || [];
    }, [validationState.errors]);

    const isFieldValid = useCallback((fieldName: string): boolean => {
        return !validationState.errors[fieldName] || validationState.errors[fieldName].length === 0;
    }, [validationState.errors]);

    const isFieldTouched = useCallback((fieldName: string): boolean => {
        return validationState.touchedFields.has(fieldName);
    }, [validationState.touchedFields]);

    const getSanitizedValue = useCallback((fieldName: string): any => {
        return validationState.sanitizedData[fieldName];
    }, [validationState.sanitizedData]);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef) {
                clearTimeout(debounceTimerRef);
            }
        };
    }, [debounceTimerRef]);

    return {
        // State
        errors: validationState.errors,
        isValid: validationState.isValid,
        isValidating: validationState.isValidating,
        sanitizedData: validationState.sanitizedData,

        // Field-specific helpers
        getFieldError,
        getFieldErrors,
        isFieldValid,
        isFieldTouched,
        getSanitizedValue,

        // Event handlers
        handleFieldChange,
        handleFieldBlur,

        // Form validation
        validateForm,
        clearValidation,

        // Manual validation
        validateField: validateFieldWithDebounce
    };
};

export default useValidation;