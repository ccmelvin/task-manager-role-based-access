import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { AutomatedCleanupService } from '../automated-cleanup-service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: jest.fn((obj) => obj),
  unmarshall: jest.fn((obj) => obj)
}));

describe('AutomatedCleanupService', () => {
  let service: AutomatedCleanupService;
  let mockDynamoClient: jest.Mocked<DynamoDBClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoClient = new DynamoDBClient({}) as jest.Mocked<DynamoDBClient>;
    service = new AutomatedCleanupService();
    
    // Replace the internal DynamoDB client with our mock
    (service as any).dynamoClient = mockDynamoClient;
  });

  describe('executeCleanup', () => {
    it('should return error when no retention policy exists', async () => {
      const result = await service.executeCleanup('unknown_type', 'test-table');
      
      expect(result.dataType).toBe('unknown_type');
      expect(result.recordsProcessed).toBe(0);
      expect(result.errors).toContain('No retention policy found for data type: unknown_type');
    });

    it('should process records for cleanup when policy exists', async () => {
      // Mock scan response
      const mockRecords = [
        {
          id: 'record1',
          userId: 'user1',
          createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString() // 400 days ago
        }
      ];

      mockDynamoClient.send = jest.fn().mockResolvedValue({
        Items: mockRecords,
        LastEvaluatedKey: undefined
      });

      const result = await service.executeCleanup('user_activity', 'test-table');
      
      expect(result.dataType).toBe('user_activity');
      expect(result.recordsProcessed).toBe(1);
      expect(result.recordsDeleted).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle scan errors gracefully', async () => {
      mockDynamoClient.send = jest.fn().mockRejectedValue(new Error('DynamoDB error'));

      const result = await service.executeCleanup('tasks', 'test-table');
      
      expect(result.errors).toContain('Cleanup execution error: DynamoDB error');
    });

    it('should archive records when appropriate', async () => {
      const mockRecords = [
        {
          id: 'record1',
          userId: 'user1',
          createdAt: new Date(Date.now() - 2000 * 24 * 60 * 60 * 1000).toISOString() // 2000 days ago
        }
      ];

      mockDynamoClient.send = jest.fn()
        .mockResolvedValueOnce({
          Items: mockRecords,
          LastEvaluatedKey: undefined
        })
        .mockResolvedValueOnce({}); // Update response

      const result = await service.executeCleanup('tasks', 'test-table');
      
      expect(result.recordsArchived).toBe(1);
      expect(result.recordsDeleted).toBe(0);
    });
  });

  describe('scheduleCleanup', () => {
    it('should log scheduling request', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await service.scheduleCleanup('tasks', 'test-table', '0 2 * * *');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Scheduling cleanup for tasks in table test-table with cron: 0 2 * * *'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('getCleanupStatus', () => {
    it('should return cleanup status', async () => {
      const status = await service.getCleanupStatus('tasks');
      
      expect(status).toHaveProperty('lastRun');
      expect(status).toHaveProperty('nextRun');
      expect(status).toHaveProperty('recordsProcessed');
      expect(status).toHaveProperty('recordsDeleted');
      expect(status).toHaveProperty('recordsArchived');
    });
  });
});