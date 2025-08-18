import { DataClassification, DataMinimizationRule } from './types';

export class DataClassificationService {
  private classifications: Map<string, DataClassification> = new Map();
  private minimizationRules: Map<string, DataMinimizationRule> = new Map();

  constructor() {
    this.initializeClassifications();
    this.initializeMinimizationRules();
  }

  private initializeClassifications(): void {
    // Task data classification
    this.classifications.set('tasks', {
      level: 'internal',
      categories: ['business_data', 'user_generated'],
      handlingRequirements: [
        'encrypt_at_rest',
        'access_logging',
        'user_isolation'
      ],
      retentionPolicy: {
        dataType: 'tasks',
        retentionPeriodDays: 2555,
        archivalPeriodDays: 1825,
        deletionMethod: 'soft',
        complianceRequirement: 'Business Records Retention'
      }
    });

    // User profile classification
    this.classifications.set('user_profiles', {
      level: 'confidential',
      categories: ['personal_data', 'authentication_data'],
      handlingRequirements: [
        'encrypt_at_rest',
        'encrypt_in_transit',
        'access_logging',
        'consent_required',
        'right_to_deletion'
      ],
      retentionPolicy: {
        dataType: 'user_profiles',
        retentionPeriodDays: 90,
        deletionMethod: 'hard',
        complianceRequirement: 'GDPR Compliance'
      }
    });

    // Security events classification
    this.classifications.set('security_events', {
      level: 'restricted',
      categories: ['security_data', 'audit_data'],
      handlingRequirements: [
        'encrypt_at_rest',
        'encrypt_in_transit',
        'immutable_logging',
        'restricted_access',
        'long_term_retention'
      ],
      retentionPolicy: {
        dataType: 'security_events',
        retentionPeriodDays: 2555,
        archivalPeriodDays: 1095,
        deletionMethod: 'soft',
        complianceRequirement: 'Security Audit Requirements'
      }
    });
  }

  private initializeMinimizationRules(): void {
    // Task creation minimization
    this.minimizationRules.set('task_creation', {
      dataType: 'tasks',
      requiredFields: ['title', 'userId', 'status'],
      optionalFields: ['description', 'dueDate', 'priority'],
      prohibitedFields: ['ssn', 'creditCard', 'password'],
      collectionPurpose: 'Task management and productivity tracking',
      legalBasis: 'Legitimate business interest'
    });

    // User registration minimization
    this.minimizationRules.set('user_registration', {
      dataType: 'user_profiles',
      requiredFields: ['email', 'userId'],
      optionalFields: ['name', 'preferences'],
      prohibitedFields: ['ssn', 'creditCard', 'biometric_data'],
      collectionPurpose: 'User account management and authentication',
      legalBasis: 'Contract performance'
    });
  }

  getClassification(dataType: string): DataClassification | undefined {
    return this.classifications.get(dataType);
  }

  getMinimizationRule(dataType: string): DataMinimizationRule | undefined {
    return this.minimizationRules.get(dataType);
  }

  validateDataCollection(dataType: string, data: Record<string, any>): {
    isValid: boolean;
    violations: string[];
    allowedData: Record<string, any>;
  } {
    const rule = this.getMinimizationRule(dataType);
    if (!rule) {
      return {
        isValid: false,
        violations: [`No minimization rule found for data type: ${dataType}`],
        allowedData: {}
      };
    }

    const violations: string[] = [];
    const allowedData: Record<string, any> = {};
    const allAllowedFields = [...rule.requiredFields, ...rule.optionalFields];

    // Check for prohibited fields
    for (const field of Object.keys(data)) {
      if (rule.prohibitedFields.includes(field)) {
        violations.push(`Prohibited field detected: ${field}`);
        continue;
      }

      if (allAllowedFields.includes(field)) {
        allowedData[field] = data[field];
      } else {
        violations.push(`Unexpected field: ${field} (not in allowed fields)`);
      }
    }

    // Check for missing required fields
    for (const requiredField of rule.requiredFields) {
      if (!(requiredField in data)) {
        violations.push(`Missing required field: ${requiredField}`);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      allowedData
    };
  }

  getHandlingRequirements(dataType: string): string[] {
    const classification = this.getClassification(dataType);
    return classification?.handlingRequirements || [];
  }

  requiresEncryption(dataType: string): boolean {
    const requirements = this.getHandlingRequirements(dataType);
    return requirements.includes('encrypt_at_rest') || requirements.includes('encrypt_in_transit');
  }

  requiresAccessLogging(dataType: string): boolean {
    const requirements = this.getHandlingRequirements(dataType);
    return requirements.includes('access_logging');
  }

  requiresConsent(dataType: string): boolean {
    const requirements = this.getHandlingRequirements(dataType);
    return requirements.includes('consent_required');
  }

  supportsRightToDeletion(dataType: string): boolean {
    const requirements = this.getHandlingRequirements(dataType);
    return requirements.includes('right_to_deletion');
  }
}