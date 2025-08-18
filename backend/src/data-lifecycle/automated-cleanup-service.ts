import { DeleteItemCommand, DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { DataRetentionService } from './data-retention-service';
import { CleanupResult } from './types';

export class AutomatedCleanupService {
  private dynamoClient: DynamoDBClient;
  private retentionService: DataRetentionService;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.retentionService = new DataRetentionService();
  }

  async executeCleanup(dataType: string, tableName: string): Promise<CleanupResult> {
    const startTime = Date.now();
    const result: CleanupResult = {
      dataType,
      recordsProcessed: 0,
      recordsArchived: 0,
      recordsDeleted: 0,
      errors: [],
      executionTime: 0
    };

    try {
      const policy = this.retentionService.getRetentionPolicy(dataType);
      if (!policy) {
        result.errors.push(`No retention policy found for data type: ${dataType}`);
        return result;
      }

      // Scan for records that need cleanup
      const records = await this.scanExpiredRecords(tableName, policy.retentionPeriodDays);
      result.recordsProcessed = records.length;

      for (const record of records) {
        try {
          const createdAt = new Date(record.createdAt);
          
          if (this.retentionService.shouldDelete(dataType, createdAt)) {
            await this.deleteRecord(tableName, record, policy.deletionMethod);
            result.recordsDeleted++;
            
            await this.retentionService.logLifecycleEvent({
              dataType,
              recordId: record.id,
              userId: record.userId,
              action: 'deleted',
              metadata: { reason: 'retention_policy', policy: policy.complianceRequirement }
            });
          } else if (this.retentionService.shouldArchive(dataType, createdAt)) {
            await this.archiveRecord(tableName, record);
            result.recordsArchived++;
            
            await this.retentionService.logLifecycleEvent({
              dataType,
              recordId: record.id,
              userId: record.userId,
              action: 'archived',
              metadata: { reason: 'retention_policy', policy: policy.complianceRequirement }
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error processing record ${record.id}: ${errorMessage}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Cleanup execution error: ${errorMessage}`);
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  private async scanExpiredRecords(tableName: string, retentionDays: number): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const params = {
      TableName: tableName,
      FilterExpression: 'createdAt < :cutoffDate',
      ExpressionAttributeValues: marshall({
        ':cutoffDate': cutoffDate.toISOString()
      })
    };

    const records: any[] = [];
    let lastEvaluatedKey: any;

    do {
      const scanParams = {
        ...params,
        ExclusiveStartKey: lastEvaluatedKey
      };
      
      const command = new ScanCommand(scanParams);
      const response = await this.dynamoClient.send(command);
      
      if (response.Items) {
        records.push(...response.Items.map((item: any) => unmarshall(item)));
      }
      
      lastEvaluatedKey = (response as any).LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return records;
  }

  private async deleteRecord(tableName: string, record: any, deletionMethod: 'soft' | 'hard'): Promise<void> {
    if (deletionMethod === 'soft') {
      // Soft delete - mark as deleted
      const updateParams = {
        TableName: tableName,
        Key: marshall({ id: record.id }),
        UpdateExpression: 'SET deletedAt = :deletedAt, #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: marshall({
          ':deletedAt': new Date().toISOString(),
          ':status': 'deleted'
        })
      };

      await this.dynamoClient.send(new UpdateItemCommand(updateParams));
    } else {
      // Hard delete - remove from database
      const deleteParams = {
        TableName: tableName,
        Key: marshall({ id: record.id })
      };

      await this.dynamoClient.send(new DeleteItemCommand(deleteParams));
    }
  }

  private async archiveRecord(tableName: string, record: any): Promise<void> {
    // Mark record as archived
    const updateParams = {
      TableName: tableName,
      Key: marshall({ id: record.id }),
      UpdateExpression: 'SET archivedAt = :archivedAt, #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':archivedAt': new Date().toISOString(),
        ':status': 'archived'
      })
    };

    await this.dynamoClient.send(new UpdateItemCommand(updateParams));
  }

  async scheduleCleanup(dataType: string, tableName: string, cronExpression: string): Promise<void> {
    // In a real implementation, this would integrate with AWS EventBridge or similar
    console.log(`Scheduling cleanup for ${dataType} in table ${tableName} with cron: ${cronExpression}`);
    
    // For now, we'll just log the scheduling request
    await this.retentionService.logLifecycleEvent({
      dataType,
      recordId: 'scheduler',
      action: 'created',
      metadata: { 
        action: 'cleanup_scheduled',
        tableName,
        cronExpression
      }
    });
  }

  async getCleanupStatus(dataType: string): Promise<{
    lastRun?: string;
    nextRun?: string;
    recordsProcessed: number;
    recordsDeleted: number;
    recordsArchived: number;
  }> {
    // In a real implementation, this would query the cleanup status from a dedicated table
    return {
      lastRun: new Date().toISOString(),
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Next day
      recordsProcessed: 0,
      recordsDeleted: 0,
      recordsArchived: 0
    };
  }
}