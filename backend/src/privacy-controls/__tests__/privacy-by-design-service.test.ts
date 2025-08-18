import { PrivacyByDesignService } from '../privacy-by-design-service';

// Mock dependencies
jest.mock('../../data-lifecycle/data-classification-service', () => ({
  DataClassificationService: jest.fn().mockImplementation(() => ({
    validateDataCollection: jest.fn().mockReturnValue({
      isValid: true,
      violations: [],
      allowedData: { title: 'Test Task', userId: 'user123' }
    }),
    requiresConsent: jest.fn().mockReturnValue(true),
    requiresEncryption: jest.fn().mockReturnValue(true),
    requiresAccessLogging: jest.fn().mockReturnValue(true),
    getClassification: jest.fn().mockReturnValue({
      level: 'confidential',
      categories: ['personal_data']
    }),
    getMinimizationRule: jest.fn().mockReturnValue({
      requiredFields: ['title', 'userId'],
      optionalFields: ['description', 'shareWithTeam', 'publicVisibility'],
      prohibitedFields: ['ssn']
    })
  }))
}));

jest.mock('../consent-management-service', () => ({
  ConsentManagementService: jest.fn().mockImplementation(() => ({
    validateConsentForDataProcessing: jest.fn().mockResolvedValue(true),
    getPrivacySettings: jest.fn().mockResolvedValue({
      userId: 'user123',
      dataMinimization: true,
      marketingConsent: false
    })
  }))
}));

describe('PrivacyByDesignService', () => {
  let service: PrivacyByDesignService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrivacyByDesignService();
  });

  describe('validateDataCollection', () => {
    it('should validate data collection with consent', async () => {
      const data = { title: 'Test Task', userId: 'user123', description: 'Test' };
      
      const result = await service.validateDataCollection(
        'user123',
        'tasks',
        data,
        'task_management',
        'consent'
      );

      expect(result.isValid).toBe(true);
      expect(result.consentRequired).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.sanitizedData).toEqual({ title: 'Test Task', userId: 'user123' });
    });

    it('should detect invalid purpose', async () => {
      const data = { title: 'Test Task', userId: 'user123' };
      
      const result = await service.validateDataCollection(
        'user123',
        'tasks',
        data,
        'invalid_purpose',
        'consent'
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Purpose invalid_purpose is not valid for data type tasks');
    });

    it('should detect missing consent when required', async () => {
      // Mock consent validation to return false
      const mockConsentService = (service as any).consentService;
      mockConsentService.validateConsentForDataProcessing.mockResolvedValue(false);

      const data = { title: 'Test Task', userId: 'user123' };
      
      const result = await service.validateDataCollection(
        'user123',
        'tasks',
        data,
        'task_management',
        'consent'
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Valid consent required for task_management but not found');
    });
  });

  describe('applyPrivacyByDesignPrinciples', () => {
    it('should apply privacy by default for create operations', async () => {
      const data = { title: 'Test Task', userId: 'user123' };
      
      const result = await service.applyPrivacyByDesignPrinciples(
        'user123',
        'tasks',
        data,
        'create'
      );

      expect(result.processedData.shareWithTeam).toBe(false);
      expect(result.processedData.publicVisibility).toBe(false);
      expect(result.privacyActions).toContain('Applied privacy-by-default settings');
    });

    it('should apply encryption markers for sensitive data', async () => {
      // Update the mock to include encryption marker fields
      const mockClassificationService = (service as any).classificationService;
      mockClassificationService.getMinimizationRule.mockReturnValueOnce({
        requiredFields: ['title', 'userId'],
        optionalFields: ['description', 'title_encrypted', 'description_encrypted', 'marketingOptIn', 'dataSharing', 'profileVisibility'],
        prohibitedFields: ['ssn']
      });

      const data = { title: 'Test Task', description: 'Sensitive info', userId: 'user123' };
      
      const result = await service.applyPrivacyByDesignPrinciples(
        'user123',
        'user_profiles',
        data,
        'create'
      );

      expect(result.processedData.description_encrypted).toBe(true);
      expect(result.processedData.title_encrypted).toBeUndefined(); // title is not in sensitive fields
      expect(result.privacyActions).toContain('Marked sensitive fields for encryption');
    });

    it('should apply data minimization when user preference is set', async () => {
      const data = { 
        title: 'Test Task', 
        userId: 'user123', 
        description: 'Test',
        extraField: 'should be removed'
      };
      
      const result = await service.applyPrivacyByDesignPrinciples(
        'user123',
        'tasks',
        data,
        'read'
      );

      expect(result.processedData).not.toHaveProperty('extraField');
      expect(result.privacyActions).toContain('Applied user data minimization preferences');
    });
  });

  describe('generatePrivacyImpactAssessment', () => {
    it('should generate high risk assessment for sensitive data', async () => {
      // Mock classification to return restricted data
      const mockClassificationService = (service as any).classificationService;
      mockClassificationService.getClassification.mockReturnValue({
        level: 'restricted',
        categories: ['sensitive_data']
      });

      const assessment = await service.generatePrivacyImpactAssessment(
        ['user_profiles', 'security_events'],
        ['authentication', 'security_monitoring'],
        15000
      );

      expect(assessment.riskLevel).toBe('high');
      expect(assessment.recommendations).toContain('Implement additional encryption measures');
      expect(assessment.complianceRequirements).toContain('GDPR Article 35 - Data Protection Impact Assessment');
    });

    it('should generate medium risk assessment for large data volume', async () => {
      // Mock classification to return internal data
      const mockClassificationService = (service as any).classificationService;
      mockClassificationService.getClassification.mockReturnValue({
        level: 'internal',
        categories: ['business_data']
      });

      const assessment = await service.generatePrivacyImpactAssessment(
        ['tasks'],
        ['task_management'],
        15000
      );

      expect(assessment.riskLevel).toBe('medium');
      expect(assessment.recommendations).toContain('Implement automated data retention policies');
    });

    it('should generate low risk assessment for minimal data', async () => {
      // Mock classification to return internal data for this test
      const mockClassificationService = (service as any).classificationService;
      mockClassificationService.getClassification.mockReturnValue({
        level: 'internal',
        categories: ['business_data']
      });

      const assessment = await service.generatePrivacyImpactAssessment(
        ['tasks'],
        ['task_management'],
        100
      );

      expect(assessment.riskLevel).toBe('low');
      expect(assessment.recommendations).toContain('Implement privacy-by-design principles');
      expect(assessment.complianceRequirements).toContain('GDPR Article 25 - Data Protection by Design and by Default');
    });
  });

  describe('validation helpers', () => {
    it('should validate email format', () => {
      expect((service as any).isValidEmail('test@example.com')).toBe(true);
      expect((service as any).isValidEmail('invalid-email')).toBe(false);
      expect((service as any).isValidEmail('test@')).toBe(false);
    });

    it('should validate date format', () => {
      expect((service as any).isValidDate('2024-01-01')).toBe(true);
      expect((service as any).isValidDate('2024-01-01T10:00:00Z')).toBe(true);
      expect((service as any).isValidDate('invalid-date')).toBe(false);
    });

    it('should validate purpose for data type', () => {
      expect((service as any).isValidPurpose('task_management', 'tasks')).toBe(true);
      expect((service as any).isValidPurpose('authentication', 'user_profiles')).toBe(true);
      expect((service as any).isValidPurpose('invalid_purpose', 'tasks')).toBe(false);
    });
  });

  describe('data quality validation', () => {
    it('should detect empty fields', () => {
      const data = { title: '', userId: null, description: undefined };
      const violations = (service as any).validateDataQuality(data);
      
      expect(violations).toContain('Field title is empty or null');
      expect(violations).toContain('Field userId is empty or null');
      expect(violations).toContain('Field description is empty or null');
    });

    it('should detect invalid email format', () => {
      const data = { email: 'invalid-email' };
      const violations = (service as any).validateDataQuality(data);
      
      expect(violations).toContain('Invalid email format');
    });

    it('should detect invalid date format', () => {
      const data = { dueDate: 'invalid-date' };
      const violations = (service as any).validateDataQuality(data);
      
      expect(violations).toContain('Invalid date format');
    });
  });
});