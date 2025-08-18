import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { DataExportRequest, DataPortabilityPackage } from './types';

export class DataExportService {
  private dynamoClient: DynamoDBClient;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  async requestDataExport(
    userId: string,
    dataTypes: string[] = ['all'],
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<DataExportRequest> {
    const request: DataExportRequest = {
      requestId: this.generateRequestId(),
      userId,
      dataTypes: dataTypes.includes('all') ? this.getAllExportableDataTypes() : dataTypes,
      format,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    };

    // Store the export request
    await this.storeExportRequest(request);

    // Process export in background
    this.processExport(request).catch(error => {
      console.error('Export processing failed:', error);
      this.updateExportRequestStatus(request.requestId, 'failed');
    });

    return request;
  }

  private async processExport(request: DataExportRequest): Promise<void> {
    try {
      await this.updateExportRequestStatus(request.requestId, 'processing');

      const exportPackage = await this.generateExportPackage(request.userId, request.dataTypes, request.format);
      const downloadUrl = await this.storeExportPackage(exportPackage, request.requestId);

      await this.updateExportRequest(request.requestId, {
        status: 'completed',
        downloadUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

      await this.notifyExportReady(request);
    } catch (error) {
      await this.updateExportRequestStatus(request.requestId, 'failed');
      throw error;
    }
  }

  private async generateExportPackage(
    userId: string,
    dataTypes: string[],
    format: string
  ): Promise<DataPortabilityPackage> {
    const exportData: any = {};
    let totalRecords = 0;

    for (const dataType of dataTypes) {
      const data = await this.exportDataByType(userId, dataType);
      exportData[dataType] = data;
      totalRecords += Array.isArray(data) ? data.length : 1;
    }

    const exportPackage: DataPortabilityPackage = {
      userId,
      generatedAt: new Date().toISOString(),
      format,
      data: {
        profile: exportData.user_profiles || {},
        tasks: exportData.tasks || [],
        preferences: exportData.user_preferences || {},
        activityLog: exportData.user_activity || []
      },
      metadata: {
        totalRecords,
        dataTypes,
        exportVersion: '1.0'
      }
    };

    return exportPackage;
  }

  private async exportDataByType(userId: string, dataType: string): Promise<any> {
    switch (dataType) {
      case 'tasks':
        return this.exportUserTasks(userId);
      case 'user_profiles':
        return this.exportUserProfile(userId);
      case 'user_activity':
        return this.exportUserActivity(userId);
      case 'user_preferences':
        return this.exportUserPreferences(userId);
      default:
        console.warn(`Unknown data type for export: ${dataType}`);
        return [];
    }
  }

  private async exportUserTasks(userId: string): Promise<any[]> {
    const tableName = process.env.TASKS_TABLE_NAME || 'Tasks';
    
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
      return response.Items.map(item => {
        const task = unmarshall(item);
        // Remove internal fields and sanitize for export
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        };
      });
    }

    return [];
  }

  private async exportUserProfile(userId: string): Promise<any> {
    const tableName = process.env.USERS_TABLE_NAME || 'Users';
    
    const queryParams = {
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId
      })
    };

    const queryCommand = new QueryCommand(queryParams);
    const response = await this.dynamoClient.send(queryCommand);

    if (response.Items && response.Items.length > 0) {
      const profile = unmarshall(response.Items[0]);
      // Remove sensitive fields and sanitize for export
      return {
        userId: profile.userId,
        email: profile.email,
        name: profile.name,
        createdAt: profile.createdAt,
        lastLoginAt: profile.lastLoginAt,
        preferences: profile.preferences
      };
    }

    return {};
  }

  private async exportUserActivity(userId: string): Promise<any[]> {
    const tableName = process.env.USER_ACTIVITY_TABLE_NAME || 'UserActivity';
    
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
      return response.Items.map(item => {
        const activity = unmarshall(item);
        // Sanitize activity data for export
        return {
          action: activity.action,
          resource: activity.resource,
          timestamp: activity.timestamp,
          metadata: activity.metadata
        };
      });
    }

    return [];
  }

  private async exportUserPreferences(userId: string): Promise<any> {
    // In a real implementation, this would query a preferences table
    return {
      theme: 'light',
      notifications: true,
      language: 'en',
      timezone: 'UTC'
    };
  }

  private async storeExportPackage(exportPackage: DataPortabilityPackage, requestId: string): Promise<string> {
    // In a real implementation, this would upload to S3 and return a signed URL
    const filename = `export_${requestId}_${Date.now()}.json`;
    console.log(`Storing export package: ${filename}`);
    
    // Return a mock download URL
    return `https://exports.example.com/${filename}`;
  }

  private async storeExportRequest(request: DataExportRequest): Promise<void> {
    const tableName = process.env.EXPORT_REQUESTS_TABLE_NAME || 'ExportRequests';
    console.log('Storing export request:', request.requestId);
  }

  private async updateExportRequestStatus(requestId: string, status: DataExportRequest['status']): Promise<void> {
    console.log(`Updating export request ${requestId} status to ${status}`);
  }

  private async updateExportRequest(requestId: string, updates: Partial<DataExportRequest>): Promise<void> {
    console.log(`Updating export request ${requestId}:`, updates);
  }

  private async notifyExportReady(request: DataExportRequest): Promise<void> {
    // In a real implementation, this would send an email notification
    console.log(`Export ready notification sent for request ${request.requestId}`);
  }

  private getAllExportableDataTypes(): string[] {
    return ['tasks', 'user_profiles', 'user_activity', 'user_preferences'];
  }

  private generateRequestId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getExportStatus(requestId: string): Promise<DataExportRequest | null> {
    // In a real implementation, this would query the export requests table
    console.log('Getting export status for:', requestId);
    return null;
  }

  async downloadExport(requestId: string, userId: string): Promise<string | null> {
    const request = await this.getExportStatus(requestId);
    
    if (!request || request.userId !== userId || request.status !== 'completed') {
      return null;
    }

    return request.downloadUrl || null;
  }

  async deleteExpiredExports(): Promise<void> {
    // In a real implementation, this would clean up expired export files
    console.log('Cleaning up expired exports');
  }
}