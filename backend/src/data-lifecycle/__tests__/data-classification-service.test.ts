import { DataClassificationService } from '../data-classification-service';

describe('DataClassificationService', () => {
  let service: DataClassificationService;

  beforeEach(() => {
    service = new DataClassificationService();
  });

  describe('getClassification', () => {
    it('should return classification for existing data type', () => {
      const classification = service.getClassification('tasks');
      expect(classification).toBeDefined();
      expect(classification?.level).toBe('internal');
      expect(classification?.categories).toContain('business_data');
    });

    it('should return undefined for non-existent data type', () => {
      const classification = service.getClassification('non-existent');
      expect(classification).toBeUndefined();
    });
  });

  describe('getMinimizationRule', () => {
    it('should return minimization rule for existing data type', () => {
      const rule = service.getMinimizationRule('task_creation');
      expect(rule).toBeDefined();
      expect(rule?.requiredFields).toContain('title');
      expect(rule?.prohibitedFields).toContain('ssn');
    });

    it('should return undefined for non-existent data type', () => {
      const rule = service.getMinimizationRule('non-existent');
      expect(rule).toBeUndefined();
    });
  });

  describe('validateDataCollection', () => {
    it('should validate correct data collection', () => {
      const data = {
        title: 'Test Task',
        userId: 'user123',
        status: 'pending',
        description: 'Test description'
      };

      const result = service.validateDataCollection('task_creation', data);
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.allowedData).toEqual(data);
    });

    it('should detect missing required fields', () => {
      const data = {
        title: 'Test Task',
        description: 'Test description'
      };

      const result = service.validateDataCollection('task_creation', data);
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Missing required field: userId');
      expect(result.violations).toContain('Missing required field: status');
    });

    it('should detect prohibited fields', () => {
      const data = {
        title: 'Test Task',
        userId: 'user123',
        status: 'pending',
        ssn: '123-45-6789'
      };

      const result = service.validateDataCollection('task_creation', data);
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Prohibited field detected: ssn');
      expect(result.allowedData).not.toHaveProperty('ssn');
    });

    it('should detect unexpected fields', () => {
      const data = {
        title: 'Test Task',
        userId: 'user123',
        status: 'pending',
        unexpectedField: 'value'
      };

      const result = service.validateDataCollection('task_creation', data);
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Unexpected field: unexpectedField (not in allowed fields)');
    });

    it('should return error for unknown data type', () => {
      const data = { test: 'value' };
      const result = service.validateDataCollection('unknown', data);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('No minimization rule found for data type: unknown');
    });
  });

  describe('getHandlingRequirements', () => {
    it('should return handling requirements for existing data type', () => {
      const requirements = service.getHandlingRequirements('user_profiles');
      expect(requirements).toContain('encrypt_at_rest');
      expect(requirements).toContain('consent_required');
    });

    it('should return empty array for non-existent data type', () => {
      const requirements = service.getHandlingRequirements('non-existent');
      expect(requirements).toEqual([]);
    });
  });

  describe('requiresEncryption', () => {
    it('should return true for data types requiring encryption', () => {
      expect(service.requiresEncryption('user_profiles')).toBe(true);
      expect(service.requiresEncryption('security_events')).toBe(true);
    });

    it('should return false for data types not requiring encryption', () => {
      expect(service.requiresEncryption('non-existent')).toBe(false);
    });
  });

  describe('requiresAccessLogging', () => {
    it('should return true for data types requiring access logging', () => {
      expect(service.requiresAccessLogging('tasks')).toBe(true);
      expect(service.requiresAccessLogging('user_profiles')).toBe(true);
    });

    it('should return false for data types not requiring access logging', () => {
      expect(service.requiresAccessLogging('non-existent')).toBe(false);
    });
  });

  describe('requiresConsent', () => {
    it('should return true for data types requiring consent', () => {
      expect(service.requiresConsent('user_profiles')).toBe(true);
    });

    it('should return false for data types not requiring consent', () => {
      expect(service.requiresConsent('tasks')).toBe(false);
      expect(service.requiresConsent('non-existent')).toBe(false);
    });
  });

  describe('supportsRightToDeletion', () => {
    it('should return true for data types supporting right to deletion', () => {
      expect(service.supportsRightToDeletion('user_profiles')).toBe(true);
    });

    it('should return false for data types not supporting right to deletion', () => {
      expect(service.supportsRightToDeletion('tasks')).toBe(false);
      expect(service.supportsRightToDeletion('non-existent')).toBe(false);
    });
  });
});