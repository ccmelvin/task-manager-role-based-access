import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DataDeletionService } from '../data-deletion-service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: jest.fn((obj) => obj),
  unmarshall: jest.fn((obj) => obj)
}));

// Mock DataClassificationService
jest.mock('../../data-lifecycle/data-classification-service', () => ({
  DataClassificationService: jest.fn().mockImplementation(() => ({
    getClassification: jest.fn().mockReturnValue({
      level: 'confidential',
      categories: ['personal_data']
    }),
    supportsRightToDeletion: jest.fn().mockReturnValue(true)
  }))
}));

describe('DataDeletionService', () => {
  let service: DataDeletionService;
  let mockDynamoClient: jest.Mocked<DynamoDBClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoClient = new DynamoDBClient({}) as jest.Mocked<DynamoDBClient>;
    service = new DataDeletionService();
    
    // Replace the internal DynamoDB client with our mock
    (service as any).dynamoClient = mockDynamoClient;
  });

  describe('requestDataDeletion', () => {
    it('should create a full deletion request', async () => {
      const request = await service.requestDataDeletion('user123', 'full_deletion', [], 'User requested');
      
      expect(request.userId).toBe('user123');
      expect(request.requestType).toBe('full_deletion');
      expect(request.status).toBe('pending');
      expect(request.dataTypes).toContain('tasks');
      expect(request.dataTypes).toContain('user_profiles');
      expect(request.verificationToken).toBeDefined();
    });

    it('should create a partial deletion request', async () => {
      const request = await service.requestDataDeletion('user123', 'partial_deletion', ['tasks'], 'Cleanup old tasks');
      
      expect(request.userId).toBe('user123');
      expect(request.requestType).toBe('partial_deletion');
      expect(request.dataTypes).toEqual(['tasks']);
      expect(request.reason).toBe('Cleanup old tasks');
    });
  });

  describe('verifyDeletionRequest', () => {
    it('should return false for invalid verification token', async () => {
      // Mock getDeletionRequest to return a request with different token
      jest.spyOn(service as any, 'getDeletionRequest').mockResolvedValue({
        requestId: 'req123',
        verificationToken: 'different_token',
        status: 'pending'
      });

      const result = await service.verifyDeletionRequest('req123', 'wrong_token');
      expect(result).toBe(false);
    });

    it('should return false for non-pending request', async () => {
      jest.spyOn(service as any, 'getDeletionRequest').mockResolvedValue({
        requestId: 'req123',
        verificationToken: 'correct_token',
        status: 'completed'
      });

      const result = await service.verifyDeletionRequest('req123', 'correct_token');
      expect(result).toBe(false);
    });

    it('should return true and start processing for valid request', async () => {
      const mockRequest = {
        requestId: 'req123',
        userId: 'user123',
        verificationToken: 'correct_token',
        status: 'pending',
        dataTypes: ['tasks']
      };

      jest.spyOn(service as any, 'getDeletionRequest').mockResolvedValue(mockRequest);
      jest.spyOn(service as any, 'updateDeletionRequestStatus').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'executeDeletion').mockResolvedValue(undefined);

      const result = await service.verifyDeletionRequest('req123', 'correct_token');
      expect(result).toBe(true);
    });
  });

  describe('cancelDeletionRequest', () => {
    it('should cancel pending deletion request', async () => {
      const mockRequest = {
        requestId: 'req123',
        userId: 'user123',
        status: 'pending'
      };

      jest.spyOn(service as any, 'getDeletionRequest').mockResolvedValue(mockRequest);
      jest.spyOn(service as any, 'updateDeletionRequestStatus').mockResolvedValue(undefined);

      const result = await service.cancelDeletionRequest('req123', 'user123');
      expect(result).toBe(true);
    });

    it('should not cancel request for different user', async () => {
      const mockRequest = {
        requestId: 'req123',
        userId: 'user123',
        status: 'pending'
      };

      jest.spyOn(service as any, 'getDeletionRequest').mockResolvedValue(mockRequest);

      const result = await service.cancelDeletionRequest('req123', 'different_user');
      expect(result).toBe(false);
    });

    it('should not cancel non-pending request', async () => {
      const mockRequest = {
        requestId: 'req123',
        userId: 'user123',
        status: 'completed'
      };

      jest.spyOn(service as any, 'getDeletionRequest').mockResolvedValue(mockRequest);

      const result = await service.cancelDeletionRequest('req123', 'user123');
      expect(result).toBe(false);
    });
  });

  describe('private methods', () => {
    it('should generate unique request IDs', () => {
      const id1 = (service as any).generateRequestId();
      const id2 = (service as any).generateRequestId();
      
      expect(id1).toMatch(/^del_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^del_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate verification tokens', () => {
      const token1 = (service as any).generateVerificationToken();
      const token2 = (service as any).generateVerificationToken();
      
      expect(token1).toHaveLength(32);
      expect(token2).toHaveLength(32);
      expect(token1).not.toBe(token2);
    });

    it('should return all deletable data types', () => {
      const dataTypes = (service as any).getAllDeletableDataTypes();
      expect(dataTypes).toContain('tasks');
      expect(dataTypes).toContain('user_profiles');
      expect(dataTypes).toContain('user_activity');
    });
  });
});