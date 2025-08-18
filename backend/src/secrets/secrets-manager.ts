import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export interface DatabaseConfig {
  region: string;
  tasksTableName: string;
  userProfilesTableName: string;
  connectionString: string;
}

export interface ApiConfig {
  corsOrigins: string[];
  allowedIpRanges: string[];
  rateLimitConfig: {
    rateLimit: number;
    burstLimit: number;
  };
  apiKey: string;
}

export interface CognitoConfig {
  userPoolId: string;
  region: string;
  clientSecret: string;
}

export class SecretsManager {
  private client: SecretsManagerClient;
  private cache: Map<string, { value: any; expiry: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(region?: string) {
    this.client = new SecretsManagerClient({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Get secret value with caching
   */
  private async getSecretValue(secretArn: string): Promise<any> {
    const now = Date.now();
    const cached = this.cache.get(secretArn);

    if (cached && cached.expiry > now) {
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretArn,
      });

      const response = await this.client.send(command);
      
      if (!response.SecretString) {
        throw new Error(`Secret ${secretArn} has no string value`);
      }

      const secretValue = JSON.parse(response.SecretString);
      
      // Cache the value
      this.cache.set(secretArn, {
        value: secretValue,
        expiry: now + this.CACHE_TTL,
      });

      return secretValue;
    } catch (error) {
      console.error(`Error retrieving secret ${secretArn}:`, error);
      throw new Error(`Failed to retrieve secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database configuration
   */
  async getDatabaseConfig(secretArn: string): Promise<DatabaseConfig> {
    const secret = await this.getSecretValue(secretArn);
    return {
      region: secret.region,
      tasksTableName: secret.tasksTableName,
      userProfilesTableName: secret.userProfilesTableName,
      connectionString: secret.connectionString,
    };
  }

  /**
   * Get API configuration
   */
  async getApiConfig(secretArn: string): Promise<ApiConfig> {
    const secret = await this.getSecretValue(secretArn);
    return {
      corsOrigins: secret.corsOrigins || [],
      allowedIpRanges: secret.allowedIpRanges || [],
      rateLimitConfig: secret.rateLimitConfig || { rateLimit: 1000, burstLimit: 2000 },
      apiKey: secret.apiKey,
    };
  }

  /**
   * Get Cognito configuration
   */
  async getCognitoConfig(secretArn: string): Promise<CognitoConfig> {
    const secret = await this.getSecretValue(secretArn);
    return {
      userPoolId: secret.userPoolId,
      region: secret.region,
      clientSecret: secret.clientSecret,
    };
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cached secret count (for monitoring)
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
let secretsManagerInstance: SecretsManager | null = null;

/**
 * Get singleton SecretsManager instance
 */
export function getSecretsManager(region?: string): SecretsManager {
  if (!secretsManagerInstance) {
    secretsManagerInstance = new SecretsManager(region);
  }
  return secretsManagerInstance;
}