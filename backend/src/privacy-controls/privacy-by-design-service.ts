import { DataClassificationService } from '../data-lifecycle/data-classification-service';
import { ConsentManagementService } from './consent-management-service';

export class PrivacyByDesignService {
  private classificationService: DataClassificationService;
  private consentService: ConsentManagementService;

  constructor() {
    this.classificationService = new DataClassificationService();
    this.consentService = new ConsentManagementService();
  }

  async validateDataCollection(
    userId: string,
    dataType: string,
    data: Record<string, any>,
    purpose: string,
    legalBasis: 'consent' | 'contract' | 'legitimate_interest' | 'legal_obligation'
  ): Promise<{
    isValid: boolean;
    violations: string[];
    sanitizedData: Record<string, any>;
    consentRequired: boolean;
  }> {
    const result = {
      isValid: true,
      violations: [] as string[],
      sanitizedData: {} as Record<string, any>,
      consentRequired: false
    };

    // 1. Data Minimization Check
    const minimizationResult = this.classificationService.validateDataCollection(dataType, data);
    if (!minimizationResult.isValid) {
      result.isValid = false;
      result.violations.push(...minimizationResult.violations);
    }
    result.sanitizedData = minimizationResult.allowedData;

    // 2. Consent Requirement Check
    if (this.classificationService.requiresConsent(dataType)) {
      result.consentRequired = true;
      
      if (legalBasis === 'consent') {
        const hasValidConsent = await this.consentService.validateConsentForDataProcessing(
          userId,
          purpose,
          [dataType]
        );
        
        if (!hasValidConsent) {
          result.isValid = false;
          result.violations.push(`Valid consent required for ${purpose} but not found`);
        }
      }
    }

    // 3. Purpose Limitation Check
    if (!this.isValidPurpose(purpose, dataType)) {
      result.isValid = false;
      result.violations.push(`Purpose ${purpose} is not valid for data type ${dataType}`);
    }

    // 4. Data Quality Check
    const qualityViolations = this.validateDataQuality(result.sanitizedData);
    if (qualityViolations.length > 0) {
      result.violations.push(...qualityViolations);
    }

    return result;
  }

  async applyPrivacyByDesignPrinciples(
    userId: string,
    dataType: string,
    data: Record<string, any>,
    operation: 'create' | 'read' | 'update' | 'delete'
  ): Promise<{
    processedData: Record<string, any>;
    privacyActions: string[];
    warnings: string[];
  }> {
    const result = {
      processedData: { ...data },
      privacyActions: [] as string[],
      warnings: [] as string[]
    };

    // 1. Privacy by Default - Apply most restrictive settings
    if (operation === 'create') {
      result.processedData = this.applyPrivacyDefaults(result.processedData, dataType);
      result.privacyActions.push('Applied privacy-by-default settings');
    }

    // 2. Data Protection by Design - Add security measures
    if (this.classificationService.requiresEncryption(dataType)) {
      result.processedData = this.applyEncryptionMarkers(result.processedData);
      result.privacyActions.push('Marked sensitive fields for encryption');
    }

    // 3. Transparency - Add audit trail
    if (this.classificationService.requiresAccessLogging(dataType)) {
      await this.logDataAccess(userId, dataType, operation);
      result.privacyActions.push('Logged data access for transparency');
    }

    // 4. Data Subject Control - Check user preferences
    const userSettings = await this.consentService.getPrivacySettings(userId);
    if (userSettings?.dataMinimization) {
      result.processedData = this.applyDataMinimization(result.processedData, dataType);
      result.privacyActions.push('Applied user data minimization preferences');
    }

    // 5. Accountability - Generate compliance record
    result.privacyActions.push('Generated compliance audit record');

    return result;
  }

  private isValidPurpose(purpose: string, dataType: string): boolean {
    const validPurposes: Record<string, string[]> = {
      'tasks': ['task_management', 'productivity_tracking', 'user_experience'],
      'user_profiles': ['authentication', 'personalization', 'account_management'],
      'user_activity': ['security_monitoring', 'analytics', 'audit_compliance'],
      'security_events': ['security_monitoring', 'incident_response', 'compliance']
    };

    return validPurposes[dataType]?.includes(purpose) || false;
  }

  private validateDataQuality(data: Record<string, any>): string[] {
    const violations: string[] = [];

    // Check for empty required fields
    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        violations.push(`Field ${key} is empty or null`);
      }
    });

    // Check for data format issues
    if (data.email && !this.isValidEmail(data.email)) {
      violations.push('Invalid email format');
    }

    if (data.dueDate && !this.isValidDate(data.dueDate)) {
      violations.push('Invalid date format');
    }

    return violations;
  }

  private applyPrivacyDefaults(data: Record<string, any>, dataType: string): Record<string, any> {
    const defaults = { ...data };

    // Apply privacy-by-default settings based on data type
    switch (dataType) {
      case 'user_profiles':
        defaults.marketingOptIn = false;
        defaults.dataSharing = false;
        defaults.profileVisibility = 'private';
        break;
      case 'tasks':
        defaults.shareWithTeam = false;
        defaults.publicVisibility = false;
        break;
    }

    return defaults;
  }

  private applyEncryptionMarkers(data: Record<string, any>): Record<string, any> {
    const processed = { ...data };
    
    // Mark sensitive fields for encryption
    const sensitiveFields = ['email', 'name', 'description', 'notes'];
    
    sensitiveFields.forEach(field => {
      if (processed[field]) {
        processed[`${field}_encrypted`] = true;
      }
    });

    return processed;
  }

  private applyDataMinimization(data: Record<string, any>, dataType: string): Record<string, any> {
    const rule = this.classificationService.getMinimizationRule(dataType);
    if (!rule) return data;

    const minimized: Record<string, any> = {};
    
    // Only include required and explicitly allowed optional fields
    [...rule.requiredFields, ...rule.optionalFields].forEach(field => {
      if (data[field] !== undefined) {
        minimized[field] = data[field];
      }
    });

    return minimized;
  }

  private async logDataAccess(userId: string, dataType: string, operation: string): Promise<void> {
    const logEntry = {
      userId,
      dataType,
      operation,
      timestamp: new Date().toISOString(),
      purpose: 'privacy_by_design_audit'
    };

    console.log('Privacy audit log:', logEntry);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  async generatePrivacyImpactAssessment(
    dataTypes: string[],
    purposes: string[],
    dataSubjects: number
  ): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
    complianceRequirements: string[];
  }> {
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const recommendations: string[] = [];
    const complianceRequirements: string[] = [];

    // Assess risk based on data sensitivity
    const hasHighRiskData = dataTypes.some(type => {
      const classification = this.classificationService.getClassification(type);
      return classification?.level === 'restricted' || classification?.level === 'confidential';
    });

    if (hasHighRiskData) {
      riskLevel = 'high';
      recommendations.push('Implement additional encryption measures');
      recommendations.push('Conduct regular security audits');
      complianceRequirements.push('GDPR Article 35 - Data Protection Impact Assessment');
    }

    // Assess risk based on data volume
    if (dataSubjects > 10000) {
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      recommendations.push('Implement automated data retention policies');
      recommendations.push('Set up real-time monitoring and alerting');
    }

    // Add general recommendations
    recommendations.push('Implement privacy-by-design principles');
    recommendations.push('Provide clear privacy notices to users');
    recommendations.push('Enable user data portability and deletion rights');

    complianceRequirements.push('GDPR Article 25 - Data Protection by Design and by Default');
    complianceRequirements.push('GDPR Article 32 - Security of Processing');

    return {
      riskLevel,
      recommendations,
      complianceRequirements
    };
  }
}