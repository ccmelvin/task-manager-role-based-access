import { DataRetentionService } from '../data-retention-service';
import { DataRetentionPolicy } from '../types';

describe('DataRetentionService', () => {
  let service: DataRetentionService;

  beforeEach(() => {
    service = new DataRetentionService();
  });

  describe('getRetentionPolicy', () => {
    it('should return policy for existing data type', () => {
      const policy = service.getRetentionPolicy('tasks');
      expect(policy).toBeDefined();
      expect(policy?.dataType).toBe('tasks');
      expect(policy?.retentionPeriodDays).toBe(2555);
    });

    it('should return undefined for non-existent data type', () => {
      const policy = service.getRetentionPolicy('non-existent');
      expect(policy).toBeUndefined();
    });
  });

  describe('setRetentionPolicy', () => {
    it('should set new retention policy', () => {
      const newPolicy: DataRetentionPolicy = {
        dataType: 'test_data',
        retentionPeriodDays: 30,
        deletionMethod: 'hard',
        complianceRequirement: 'Test Requirement'
      };

      service.setRetentionPolicy(newPolicy);
      const retrievedPolicy = service.getRetentionPolicy('test_data');
      expect(retrievedPolicy).toEqual(newPolicy);
    });
  });

  describe('calculateExpirationDate', () => {
    it('should calculate correct expiration date', () => {
      const createdAt = new Date('2024-01-01');
      const expirationDate = service.calculateExpirationDate('user_activity', createdAt);
      
      expect(expirationDate).toBeDefined();
      const expectedDate = new Date('2024-01-01');
      expectedDate.setDate(expectedDate.getDate() + 365);
      expect(expirationDate).toEqual(expectedDate);
    });

    it('should return null for unknown data type', () => {
      const createdAt = new Date('2024-01-01');
      const expirationDate = service.calculateExpirationDate('unknown', createdAt);
      expect(expirationDate).toBeNull();
    });
  });

  describe('calculateArchivalDate', () => {
    it('should calculate correct archival date when policy has archival period', () => {
      const createdAt = new Date('2024-01-01');
      const archivalDate = service.calculateArchivalDate('tasks', createdAt);
      
      expect(archivalDate).toBeDefined();
      const expectedDate = new Date('2024-01-01');
      expectedDate.setDate(expectedDate.getDate() + 1825);
      expect(archivalDate).toEqual(expectedDate);
    });

    it('should return null when policy has no archival period', () => {
      const createdAt = new Date('2024-01-01');
      const archivalDate = service.calculateArchivalDate('user_activity', createdAt);
      expect(archivalDate).toBeNull();
    });
  });

  describe('shouldArchive', () => {
    it('should return true when data should be archived', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 2000); // 2000 days ago
      
      const shouldArchive = service.shouldArchive('tasks', oldDate);
      expect(shouldArchive).toBe(true);
    });

    it('should return false when data should not be archived', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 100); // 100 days ago
      
      const shouldArchive = service.shouldArchive('tasks', recentDate);
      expect(shouldArchive).toBe(false);
    });

    it('should return false when no archival policy exists', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 2000);
      
      const shouldArchive = service.shouldArchive('user_activity', oldDate);
      expect(shouldArchive).toBe(false);
    });
  });

  describe('shouldDelete', () => {
    it('should return true when data should be deleted', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400); // 400 days ago
      
      const shouldDelete = service.shouldDelete('user_activity', oldDate);
      expect(shouldDelete).toBe(true);
    });

    it('should return false when data should not be deleted', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 100); // 100 days ago
      
      const shouldDelete = service.shouldDelete('user_activity', recentDate);
      expect(shouldDelete).toBe(false);
    });
  });

  describe('logLifecycleEvent', () => {
    it('should log lifecycle event without throwing', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await service.logLifecycleEvent({
        dataType: 'tasks',
        recordId: 'test-record',
        userId: 'test-user',
        action: 'created',
        metadata: { test: 'data' }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Data Lifecycle Event:',
        expect.stringContaining('test-record')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('getAllPolicies', () => {
    it('should return all default policies', () => {
      const policies = service.getAllPolicies();
      expect(policies).toHaveLength(4);
      
      const dataTypes = policies.map(p => p.dataType);
      expect(dataTypes).toContain('tasks');
      expect(dataTypes).toContain('user_activity');
      expect(dataTypes).toContain('security_events');
      expect(dataTypes).toContain('user_profiles');
    });
  });
});