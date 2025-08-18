import { DeleteItemCommand, DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { DataClassificationService } from '../data-lifecycle/data-classification-service';
import { DataDeletionRequest } from './types';

export class DataDeletionService {
  private dynamoClient: DynamoDBClient;
  private classificationService: DataClassificationService;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.classificationService = new DataClassificationService();
  }

  async requestDataDeletion(
    userId: string,
    requestType: 'full_deletion' | 'partial_deletion',
    dataTypes: string[] = [],
    reason: string = 'User requested deletion'
  ): Promise<DataDeletionRequest> {
    const request: DataDeletionRequest = {
      requestId: this.generateRequestId(),
      userId,
      requestType,
      dataTypes: requestType === 'full_deletion' ? this.getAllDeletableDataTypes() : dataTypes,
      reason,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      verificationToken: this.generateVerificationToken()
    };

    // Store the deletion request
    await this.storeDeletionRequest(request);

    // Send verification email (in real implementation)
    await this.sendVerificationEmail(request);

    return request;
  }

  async verifyDeletionRequest(requestId: string, verificationToken: string): Promise<boolean> {
    const request = await this.getDeletionRequest(requestId);
    
    if (!request || request.verificationToken !== verificationToken) {
      return false;
    }

    if (request.status !== 'pending') {
      return false;
    }

    // Update status to processing
    await this.updateDeletionRequestStatus(requestId, 'processing');

    // Execute deletion in background
    this.executeDeletion(request).catch(error => {
      console.error('Deletion execution failed:', error);
      this.updateDeletionRequestStatus(requestId, 'failed');
    });

    return true;
  }

  private async executeDeletion(request: DataDeletionRequest): Promise<void> {
    try {
      for (const dataType of request.dataTypes) {
        await this.deleteUserDataByType(request.userId, dataType);
      }

      await this.updateDeletionRequestStatus(request.requestId, 'completed');
      await this.logDeletionCompletion(request);
    } catch (error) {
      await this.updateDeletionRequestStatus(request.requestId, 'failed');
      throw error;
    }
  }

  private async deleteUserDataByType(userId: string, dataType: string): Promise<void> {
    const classification = this.classificationService.getClassification(dataType);
    
    if (!classification || !this.classificationService.supportsRightToDeletion(dataType)) {
      throw new Error(`Data type ${dataType} does not support deletion`);
    }

    switch (dataType) {
      case 'tasks':
        await this.deleteUserTasks(userId);
        break;
      case 'user_profiles':
        await this.deleteUserProfile(userId);
        break;
      case 'user_activity':
        await this.deleteUserActivity(userId);
        break;
      default:
        console.warn(`Unknown data type for deletion: ${dataType}`);
    }
  }

  private async deleteUserTasks(userId: string): Promise<void> {
    const tableName = process.env.TASKS_TABLE_NAME || 'Tasks';
    
    // Query all user tasks
    const queryParams = {
      TableName: tableName,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId
      })
    };

    const queryCommand = new QueryCommand(queryParams);
    const response = await this.dynamoClient.send(queryCommand);

    if (response.Items) {
      // Delete each task
      for (const item of response.Items) {
        const task = unmarshall(item);
        const deleteParams = {
          TableName: tableName,
          Key: marshall({ id: task.id })
        };
        
        await this.dynamoClient.send(new DeleteItemCommand(deleteParams));
      }
    }
  }

  private async deleteUserProfile(userId: string): Promise<void> {
    const tableName = process.env.USERS_TABLE_NAME || 'Users';
    
    const deleteParams = {
      TableName: tableName,
      Key: marshall({ userId })
    };

    await this.dynamoClient.send(new DeleteItemCommand(deleteParams));
  }

  private async deleteUserActivity(userId: string): Promise<void> {
    const tableName = process.env.USER_ACTIVITY_TABLE_NAME || 'UserActivity';
    
    // Query all user activity records
    const queryParams = {
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId
      })
    };

    const queryCommand = new QueryCommand(queryParams);
    const response = await this.dynamoClient.send(queryCommand);

    if (response.Items) {
      // Delete each activity record
      for (const item of response.Items) {
        const activity = unmarshall(item);
        const deleteParams = {
          TableName: tableName,
          Key: marshall({ 
            userId: activity.userId,
            timestamp: activity.timestamp
          })
        };
        
        await this.dynamoClient.send(new DeleteItemCommand(deleteParams));
      }
    }
  }

  private async storeDeletionRequest(request: DataDeletionRequest): Promise<void> {
    const tableName = process.env.DELETION_REQUESTS_TABLE_NAME || 'DeletionRequests';
    
    const putParams = {
      TableName: tableName,
      Item: marshall(request)
    };

    // In a real implementation, you would use PutItemCommand
    console.log('Storing deletion request:', request.requestId);
  }

  private async getDeletionRequest(requestId: string): Promise<DataDeletionRequest | null> {
    // In a real implementation, you would query DynamoDB
    console.log('Getting deletion request:', requestId);
    return null;
  }

  private async updateDeletionRequestStatus(requestId: string, status: DataDeletionRequest['status']): Promise<void> {
    const tableName = process.env.DELETION_REQUESTS_TABLE_NAME || 'DeletionRequests';
    
    const updateParams = {
      TableName: tableName,
      Key: marshall({ requestId }),
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':status': status,
        ':updatedAt': new Date().toISOString()
      })
    };

    // In a real implementation, you would use UpdateItemCommand
    console.log(`Updating deletion request ${requestId} status to ${status}`);
  }

  private async sendVerificationEmail(request: DataDeletionRequest): Promise<void> {
    // In a real implementation, you would send an email with the verification link
    console.log(`Sending verification email for deletion request ${request.requestId}`);
  }

  private async logDeletionCompletion(request: DataDeletionRequest): Promise<void> {
    console.log('Data deletion completed:', {
      requestId: request.requestId,
      userId: request.userId,
      dataTypes: request.dataTypes,
      completedAt: new Date().toISOString()
    });
  }

  private getAllDeletableDataTypes(): string[] {
    return ['tasks', 'user_profiles', 'user_activity'];
  }

  private generateRequestId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVerificationToken(): string {
    return Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join('');
  }

  async getDeletionStatus(requestId: string): Promise<DataDeletionRequest | null> {
    return this.getDeletionRequest(requestId);
  }

  async cancelDeletionRequest(requestId: string, userId: string): Promise<boolean> {
    const request = await this.getDeletionRequest(requestId);
    
    if (!request || request.userId !== userId || request.status !== 'pending') {
      return false;
    }

    await this.updateDeletionRequestStatus(requestId, 'failed');
    return true;
  }
}