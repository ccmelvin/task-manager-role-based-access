import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export class TaskManagerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC Configuration for Lambda isolation
    const vpc = new ec2.Vpc(this, 'TaskManagerVpc', {
      maxAzs: 2,
      natGateways: 1, // Single NAT Gateway for cost optimization
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Security Group for Lambda functions
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Security group for Lambda functions with minimal required access',
      allowAllOutbound: false, // Explicitly control outbound traffic
    });

    // Allow HTTPS outbound for AWS API calls and external services
    lambdaSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS outbound for AWS APIs and external services'
    );

    // Allow HTTP outbound for package downloads (if needed)
    lambdaSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP outbound for package downloads'
    );

    // Security Group for VPC Endpoints (if needed in future)
    const vpcEndpointSecurityGroup = new ec2.SecurityGroup(this, 'VpcEndpointSecurityGroup', {
      vpc,
      description: 'Security group for VPC endpoints',
      allowAllOutbound: false,
    });

    // Allow inbound HTTPS from Lambda security group
    vpcEndpointSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(443),
      'HTTPS from Lambda functions'
    );

    // Cognito User Pool with Enhanced Security Configuration
    const userPool = new cognito.UserPool(this, 'TaskManagerUserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 12, // Increased from 8 to 12
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true, // Added special characters requirement
        tempPasswordValidity: cdk.Duration.days(1), // Temporary password expires in 1 day
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      autoVerify: { 
        email: true // Require email verification for new accounts
      },
      userVerification: {
        emailSubject: 'Task Manager - Verify your email address',
        emailBody: 'Thank you for signing up to Task Manager! Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      signInCaseSensitive: false,
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        'security_questions_set': new cognito.BooleanAttribute({ mutable: true }),
        'last_password_change': new cognito.StringAttribute({ mutable: true }),
        'failed_login_attempts': new cognito.NumberAttribute({ mutable: true }),
        'account_locked_until': new cognito.StringAttribute({ mutable: true }),
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      mfa: cognito.Mfa.OPTIONAL, // Enable MFA support
      mfaSecondFactor: {
        sms: true,
        otp: true, // TOTP support
      },
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED, // Enable advanced security features
      userPoolName: 'TaskManagerUserPool',
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Protect user data
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'TaskManagerClient', {
      userPool,
      generateSecret: false,
      authFlows: {
        userSrp: true, // Secure Remote Password protocol
        userPassword: false, // Disable less secure password flow
        adminUserPassword: false, // Disable admin password flow
        custom: false, // Disable custom auth flow for now
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false, // Disable less secure implicit flow
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: this.getOAuthCallbackUrls(),
        logoutUrls: this.getOAuthLogoutUrls(),
      },
      preventUserExistenceErrors: true, // Prevent user enumeration attacks
      refreshTokenValidity: cdk.Duration.days(30), // Refresh token expires in 30 days
      accessTokenValidity: cdk.Duration.hours(1), // Access token expires in 1 hour
      idTokenValidity: cdk.Duration.hours(1), // ID token expires in 1 hour
      enableTokenRevocation: true, // Enable token revocation
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      userPoolClientName: 'TaskManagerWebClient',
    });

    // User Groups
    ['Admin', 'Contributor', 'Viewer'].forEach(role => {
      new cognito.CfnUserPoolGroup(this, `${role}Group`, {
        userPoolId: userPool.userPoolId,
        groupName: role,
        description: `${role} role for task management`,
      });
    });

    // KMS Key for DynamoDB encryption
    const dynamoDbKey = new kms.Key(this, 'DynamoDbEncryptionKey', {
      description: 'KMS key for DynamoDB table encryption',
      enableKeyRotation: true,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow DynamoDB Service',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('dynamodb.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:DescribeKey',
              'kms:Encrypt',
              'kms:GenerateDataKey*',
              'kms:ReEncrypt*',
            ],
            resources: ['*'],
          }),
        ],
      }),
    });

    // KMS Key for Secrets Manager encryption
    const secretsKey = new kms.Key(this, 'SecretsEncryptionKey', {
      description: 'KMS key for Secrets Manager encryption',
      enableKeyRotation: true,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow Secrets Manager Service',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('secretsmanager.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:DescribeKey',
              'kms:Encrypt',
              'kms:GenerateDataKey*',
              'kms:ReEncrypt*',
            ],
            resources: ['*'],
          }),
        ],
      }),
    });

    // Secrets for sensitive configuration
    const databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: 'task-manager/database',
      description: 'Database connection configuration for Task Manager',
      encryptionKey: secretsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          region: this.region,
          tasksTableName: '', // Will be updated after table creation
          userProfilesTableName: '', // Will be updated after table creation
        }),
        generateStringKey: 'connectionString',
        excludeCharacters: '"@/\\',
      },
    });

    const apiSecret = new secretsmanager.Secret(this, 'ApiSecret', {
      secretName: 'task-manager/api',
      description: 'API configuration secrets for Task Manager',
      encryptionKey: secretsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          corsOrigins: this.getCorsOrigins(),
          allowedIpRanges: this.getAllowedIpRanges(),
          rateLimitConfig: {
            rateLimit: 1000,
            burstLimit: 2000,
          },
        }),
        generateStringKey: 'apiKey',
        excludeCharacters: '"@/\\',
      },
    });

    const cognitoSecret = new secretsmanager.Secret(this, 'CognitoSecret', {
      secretName: 'task-manager/cognito',
      description: 'Cognito configuration secrets for Task Manager',
      encryptionKey: secretsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          userPoolId: '', // Will be updated after user pool creation
          region: this.region,
        }),
        generateStringKey: 'clientSecret',
        excludeCharacters: '"@/\\',
      },
    });

    // DynamoDB Tables with encryption at rest
    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      partitionKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for user-based queries
    tasksTable.addGlobalSecondaryIndex({
      indexName: 'UserTasksIndex',
      partitionKey: { name: 'assignedTo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for creator-based queries
    tasksTable.addGlobalSecondaryIndex({
      indexName: 'CreatorTasksIndex',
      partitionKey: { name: 'createdBy', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for status-based queries
    tasksTable.addGlobalSecondaryIndex({
      indexName: 'StatusTasksIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    const userProfilesTable = new dynamodb.Table(this, 'UserProfilesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Security Events Table for account security tracking
    const securityEventsTable = new dynamodb.Table(this, 'SecurityEventsTable', {
      tableName: `${userProfilesTable.tableName}-SecurityEvents`,
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl', // Auto-delete old security events
    });

    // Add GSI for querying security events by userId
    securityEventsTable.addGlobalSecondaryIndex({
      indexName: 'UserSecurityEventsIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // S3 Bucket for attachments
    const attachmentsBucket = new s3.Bucket(this, 'AttachmentsBucket', {
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // Lambda Authorizer with VPC configuration and secrets
    const authorizerLambda = new lambda.Function(this, 'AuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'authorizer.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      environment: {
        COGNITO_SECRET_ARN: cognitoSecret.secretArn,
        DATABASE_SECRET_ARN: databaseSecret.secretArn,
        SECURITY_NOTIFICATIONS_TOPIC_ARN: securityNotificationsTopic.topicArn,
        AWS_REGION: this.region,
      },
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // Task CRUD Lambda with VPC configuration and secrets
    const taskLambda = new lambda.Function(this, 'TaskFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'tasks.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      environment: {
        DATABASE_SECRET_ARN: databaseSecret.secretArn,
        API_SECRET_ARN: apiSecret.secretArn,
        ATTACHMENTS_BUCKET: attachmentsBucket.bucketName,
        AWS_REGION: this.region,
      },
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    tasksTable.grantReadWriteData(taskLambda);
    userProfilesTable.grantReadWriteData(taskLambda);
    attachmentsBucket.grantReadWrite(taskLambda);

    // Grant KMS permissions for DynamoDB encryption
    dynamoDbKey.grantDecrypt(taskLambda);
    dynamoDbKey.grantEncrypt(taskLambda);
    
    // Additional KMS permissions for Lambda execution role
    taskLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:Decrypt',
        'kms:DescribeKey',
        'kms:Encrypt',
        'kms:GenerateDataKey',
        'kms:ReEncrypt*',
      ],
      resources: [dynamoDbKey.keyArn],
    }));

    // VPC permissions for Lambda functions
    const vpcPermissions = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:CreateNetworkInterface',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DeleteNetworkInterface',
        'ec2:AttachNetworkInterface',
        'ec2:DetachNetworkInterface',
      ],
      resources: ['*'],
    });

    authorizerLambda.addToRolePolicy(vpcPermissions);
    taskLambda.addToRolePolicy(vpcPermissions);

    // Grant Secrets Manager permissions
    cognitoSecret.grantRead(authorizerLambda);
    databaseSecret.grantRead(authorizerLambda); // Authorizer needs database access for security events
    databaseSecret.grantRead(taskLambda);
    apiSecret.grantRead(taskLambda);

    // Grant DynamoDB permissions for security events
    userProfilesTable.grantReadWriteData(authorizerLambda);
    securityEventsTable.grantReadWriteData(authorizerLambda);

    // Grant SNS permissions for security notifications
    securityNotificationsTopic.grantPublish(authorizerLambda);
    securityAlertsTopic.grantPublish(authorizerLambda);

    // Grant KMS permissions for secrets and SNS
    secretsKey.grantDecrypt(authorizerLambda);
    secretsKey.grantDecrypt(taskLambda);
    dynamoDbKey.grantDecrypt(authorizerLambda);
    dynamoDbKey.grantEncrypt(authorizerLambda);

    // Update secrets with actual resource values
    new secretsmanager.CfnSecretTargetAttachment(this, 'DatabaseSecretAttachment', {
      secretId: databaseSecret.secretArn,
      targetId: tasksTable.tableName,
      targetType: 'AWS::DynamoDB::Table',
    });

    // Custom resource to update secret values
    const updateSecretsLambda = new lambda.Function(this, 'UpdateSecretsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const secretsManager = new AWS.SecretsManager();
        
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          if (event.RequestType === 'Delete') {
            return { PhysicalResourceId: 'update-secrets' };
          }
          
          try {
            // Update database secret
            await secretsManager.updateSecret({
              SecretId: event.ResourceProperties.DatabaseSecretArn,
              SecretString: JSON.stringify({
                region: event.ResourceProperties.Region,
                tasksTableName: event.ResourceProperties.TasksTableName,
                userProfilesTableName: event.ResourceProperties.UserProfilesTableName,
                connectionString: 'dynamodb-connection'
              })
            }).promise();
            
            // Update cognito secret
            await secretsManager.updateSecret({
              SecretId: event.ResourceProperties.CognitoSecretArn,
              SecretString: JSON.stringify({
                userPoolId: event.ResourceProperties.UserPoolId,
                region: event.ResourceProperties.Region,
                clientSecret: 'cognito-client-secret'
              })
            }).promise();
            
            return { PhysicalResourceId: 'update-secrets' };
          } catch (error) {
            console.error('Error updating secrets:', error);
            throw error;
          }
        };
      `),
      timeout: cdk.Duration.minutes(5),
    });

    updateSecretsLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:UpdateSecret',
        'secretsmanager:GetSecretValue',
      ],
      resources: [
        databaseSecret.secretArn,
        cognitoSecret.secretArn,
        apiSecret.secretArn,
      ],
    }));

    secretsKey.grantDecrypt(updateSecretsLambda);

    const updateSecretsProvider = new cdk.CustomResource(this, 'UpdateSecretsProvider', {
      serviceToken: updateSecretsLambda.functionArn,
      properties: {
        DatabaseSecretArn: databaseSecret.secretArn,
        CognitoSecretArn: cognitoSecret.secretArn,
        TasksTableName: tasksTable.tableName,
        UserProfilesTableName: userProfilesTable.tableName,
        UserPoolId: userPool.userPoolId,
        Region: this.region,
      },
    });

    updateSecretsProvider.node.addDependency(tasksTable);
    updateSecretsProvider.node.addDependency(userProfilesTable);
    updateSecretsProvider.node.addDependency(userPool);

    // API Gateway with security features and throttling
    const api = new apigateway.RestApi(this, 'TaskManagerApi', {
      restApiName: 'Task Manager API',
      description: 'Secure Task Manager API with rate limiting and monitoring',
      deployOptions: {
        stageName: 'prod',
        throttleSettings: {
          rateLimit: 1000, // requests per second
          burstLimit: 2000, // burst capacity
        },
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['*'],
            conditions: {
              IpAddress: {
                'aws:SourceIp': this.getAllowedIpRanges(),
              },
            },
          }),
        ],
      }),
      defaultCorsPreflightOptions: {
        allowOrigins: this.getCorsOrigins(),
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          'X-CSRF-Token',
          'X-API-Key'
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(24),
        exposeHeaders: [
          'X-RateLimit-Limit',
          'X-RateLimit-Remaining', 
          'X-RateLimit-Reset'
        ]
      },
    });

    // API Key for additional access control
    const apiKey = new apigateway.ApiKey(this, 'TaskManagerApiKey', {
      apiKeyName: 'TaskManagerKey',
      description: 'API Key for Task Manager application',
      enabled: true,
    });

    // Usage Plan with throttling and quota
    const usagePlan = new apigateway.UsagePlan(this, 'TaskManagerUsagePlan', {
      name: 'TaskManagerUsagePlan',
      description: 'Usage plan for Task Manager API with rate limiting',
      throttle: {
        rateLimit: 500, // requests per second per API key
        burstLimit: 1000, // burst capacity per API key
      },
      quota: {
        limit: 100000, // requests per month
        period: apigateway.Period.MONTH,
      },
      apiStages: [
        {
          api,
          stage: api.deploymentStage,
        },
      ],
    });

    // Associate API key with usage plan
    usagePlan.addApiKey(apiKey);

    const authorizer = new apigateway.RequestAuthorizer(this, 'TaskAuthorizer', {
      handler: authorizerLambda,
      identitySources: [apigateway.IdentitySource.header('Authorization')],
    });

    // Request validator for input validation
    const requestValidator = new apigateway.RequestValidator(this, 'TaskManagerRequestValidator', {
      restApi: api,
      requestValidatorName: 'TaskManagerValidator',
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    const tasksResource = api.root.addResource('tasks');
    
    // Configure method with security features
    const methodOptions: apigateway.MethodOptions = {
      authorizer,
      apiKeyRequired: this.isApiKeyRequired(),
      requestValidator,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.X-RateLimit-Limit': true,
            'method.response.header.X-RateLimit-Remaining': true,
            'method.response.header.X-RateLimit-Reset': true,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL,
          },
        },
        {
          statusCode: '429',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL,
          },
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL,
          },
        },
      ],
    };

    const lambdaIntegration = new apigateway.LambdaIntegration(taskLambda, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.X-RateLimit-Limit': 'integration.response.header.X-RateLimit-Limit',
            'method.response.header.X-RateLimit-Remaining': 'integration.response.header.X-RateLimit-Remaining',
            'method.response.header.X-RateLimit-Reset': 'integration.response.header.X-RateLimit-Reset',
          },
        },
      ],
    });

    tasksResource.addMethod('ANY', lambdaIntegration, methodOptions);

    // CloudTrail for audit logging
    const cloudTrailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      bucketName: `task-manager-cloudtrail-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'CloudTrailLogRetention',
          enabled: true,
          expiration: cdk.Duration.days(2555), // 7 years retention
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });

    const trail = new cloudtrail.Trail(this, 'TaskManagerCloudTrail', {
      bucket: cloudTrailBucket,
      trailName: 'TaskManagerSecurityTrail',
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      enableFileValidation: true,
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: new logs.LogGroup(this, 'CloudTrailLogGroup', {
        logGroupName: '/aws/cloudtrail/task-manager',
        retention: logs.RetentionDays.ONE_YEAR,
      }),
    });

    // Add data events for S3 and DynamoDB
    trail.addS3EventSelector([{
      bucket: attachmentsBucket,
      objectPrefix: '',
    }]);

    // SNS Topic for security alerts
    const securityAlertsTopic = new sns.Topic(this, 'SecurityAlerts', {
      topicName: 'TaskManagerSecurityAlerts',
      displayName: 'Task Manager Security Alerts',
      kmsMasterKey: secretsKey, // Encrypt SNS messages
    });

    // SNS Topic for security notifications (user-facing)
    const securityNotificationsTopic = new sns.Topic(this, 'SecurityNotifications', {
      topicName: 'TaskManagerSecurityNotifications',
      displayName: 'Task Manager Security Notifications',
      kmsMasterKey: secretsKey, // Encrypt SNS messages
    });

    // CloudWatch Dashboard for security monitoring
    const securityDashboard = new cloudwatch.Dashboard(this, 'SecurityDashboard', {
      dashboardName: 'TaskManagerSecurity',
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: 'API Gateway Requests',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: 'Count',
                dimensionsMap: {
                  ApiName: api.restApiName,
                },
                statistic: 'Sum',
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: '4XXError',
                dimensionsMap: {
                  ApiName: api.restApiName,
                },
                statistic: 'Sum',
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: '5XXError',
                dimensionsMap: {
                  ApiName: api.restApiName,
                },
                statistic: 'Sum',
              }),
            ],
            width: 12,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Lambda Function Performance',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                dimensionsMap: {
                  FunctionName: taskLambda.functionName,
                },
                statistic: 'Average',
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                dimensionsMap: {
                  FunctionName: authorizerLambda.functionName,
                },
                statistic: 'Average',
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Errors',
                dimensionsMap: {
                  FunctionName: taskLambda.functionName,
                },
                statistic: 'Sum',
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Errors',
                dimensionsMap: {
                  FunctionName: authorizerLambda.functionName,
                },
                statistic: 'Sum',
              }),
            ],
            width: 12,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'DynamoDB Operations',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedReadCapacityUnits',
                dimensionsMap: {
                  TableName: tasksTable.tableName,
                },
                statistic: 'Sum',
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedWriteCapacityUnits',
                dimensionsMap: {
                  TableName: tasksTable.tableName,
                },
                statistic: 'Sum',
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ThrottledRequests',
                dimensionsMap: {
                  TableName: tasksTable.tableName,
                },
                statistic: 'Sum',
              }),
            ],
            width: 12,
          }),
        ],
      ],
    });

    // Security Alarms
    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      alarmName: 'TaskManager-HighErrorRate',
      alarmDescription: 'High error rate detected in API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: {
          ApiName: api.restApiName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    highErrorRateAlarm.addAlarmAction(new cloudwatch.SnsAction(securityAlertsTopic));

    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: 'TaskManager-LambdaErrors',
      alarmDescription: 'Lambda function errors detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: taskLambda.functionName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    lambdaErrorAlarm.addAlarmAction(new cloudwatch.SnsAction(securityAlertsTopic));

    const authorizerErrorAlarm = new cloudwatch.Alarm(this, 'AuthorizerErrorAlarm', {
      alarmName: 'TaskManager-AuthorizerErrors',
      alarmDescription: 'Authorizer function errors detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: authorizerLambda.functionName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    authorizerErrorAlarm.addAlarmAction(new cloudwatch.SnsAction(securityAlertsTopic));

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'DynamoDbKeyId', { value: dynamoDbKey.keyId });
    new cdk.CfnOutput(this, 'TasksTableName', { value: tasksTable.tableName });
    new cdk.CfnOutput(this, 'UserProfilesTableName', { value: userProfilesTable.tableName });
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', { value: lambdaSecurityGroup.securityGroupId });
    new cdk.CfnOutput(this, 'ApiKeyId', { value: apiKey.keyId });
    new cdk.CfnOutput(this, 'UsagePlanId', { value: usagePlan.usagePlanId });
    new cdk.CfnOutput(this, 'CloudTrailArn', { value: trail.trailArn });
    new cdk.CfnOutput(this, 'SecurityAlertsTopicArn', { value: securityAlertsTopic.topicArn });
    new cdk.CfnOutput(this, 'SecurityDashboardUrl', { 
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${securityDashboard.dashboardName}` 
    });
    new cdk.CfnOutput(this, 'DatabaseSecretArn', { value: databaseSecret.secretArn });
    new cdk.CfnOutput(this, 'ApiSecretArn', { value: apiSecret.secretArn });
    new cdk.CfnOutput(this, 'CognitoSecretArn', { value: cognitoSecret.secretArn });
    new cdk.CfnOutput(this, 'SecretsKeyId', { value: secretsKey.keyId });
  }

  /**
   * Get CORS origins based on environment
   */
  private getCorsOrigins(): string[] {
    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'development';
    
    switch (stage.toLowerCase()) {
      case 'production':
        const prodOrigins = process.env.PRODUCTION_ALLOWED_ORIGINS;
        if (prodOrigins) {
          return prodOrigins.split(',').map(origin => origin.trim());
        }
        throw new Error('PRODUCTION_ALLOWED_ORIGINS environment variable must be set for production deployment');
        
      case 'staging':
        const stagingOrigins = process.env.STAGING_ALLOWED_ORIGINS;
        if (stagingOrigins) {
          return stagingOrigins.split(',').map(origin => origin.trim());
        }
        return ['https://staging.yourdomain.com']; // Default staging origin
        
      case 'development':
      default:
        const devOrigins = process.env.DEVELOPMENT_ALLOWED_ORIGINS;
        if (devOrigins) {
          return devOrigins.split(',').map(origin => origin.trim());
        }
        return [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001'
        ];
    }
  }

  /**
   * Get allowed IP ranges for API Gateway resource policy
   */
  private getAllowedIpRanges(): string[] {
    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'development';
    
    switch (stage.toLowerCase()) {
      case 'production':
        const prodIps = process.env.PRODUCTION_ALLOWED_IPS;
        if (prodIps) {
          return prodIps.split(',').map(ip => ip.trim());
        }
        // Default to allow all IPs if not specified (can be restricted later)
        return ['0.0.0.0/0'];
        
      case 'staging':
        const stagingIps = process.env.STAGING_ALLOWED_IPS;
        if (stagingIps) {
          return stagingIps.split(',').map(ip => ip.trim());
        }
        return ['0.0.0.0/0']; // Allow all for staging by default
        
      case 'development':
      default:
        return ['0.0.0.0/0']; // Allow all IPs in development
    }
  }

  /**
   * Determine if API key is required based on environment
   */
  private isApiKeyRequired(): boolean {
    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'development';
    const requireApiKey = process.env.REQUIRE_API_KEY;
    
    if (requireApiKey !== undefined) {
      return requireApiKey.toLowerCase() === 'true';
    }
    
    // Require API key in production by default
    return stage.toLowerCase() === 'production';
  }

  /**
   * Get OAuth callback URLs based on environment
   */
  private getOAuthCallbackUrls(): string[] {
    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'development';
    
    switch (stage.toLowerCase()) {
      case 'production':
        const prodCallbacks = process.env.PRODUCTION_OAUTH_CALLBACKS;
        if (prodCallbacks) {
          return prodCallbacks.split(',').map(url => url.trim());
        }
        throw new Error('PRODUCTION_OAUTH_CALLBACKS environment variable must be set for production deployment');
        
      case 'staging':
        const stagingCallbacks = process.env.STAGING_OAUTH_CALLBACKS;
        if (stagingCallbacks) {
          return stagingCallbacks.split(',').map(url => url.trim());
        }
        return ['https://staging.yourdomain.com/auth/callback'];
        
      case 'development':
      default:
        const devCallbacks = process.env.DEVELOPMENT_OAUTH_CALLBACKS;
        if (devCallbacks) {
          return devCallbacks.split(',').map(url => url.trim());
        }
        return [
          'http://localhost:3000/auth/callback',
          'http://localhost:3001/auth/callback',
          'http://127.0.0.1:3000/auth/callback',
          'http://127.0.0.1:3001/auth/callback'
        ];
    }
  }

  /**
   * Get OAuth logout URLs based on environment
   */
  private getOAuthLogoutUrls(): string[] {
    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'development';
    
    switch (stage.toLowerCase()) {
      case 'production':
        const prodLogouts = process.env.PRODUCTION_OAUTH_LOGOUTS;
        if (prodLogouts) {
          return prodLogouts.split(',').map(url => url.trim());
        }
        throw new Error('PRODUCTION_OAUTH_LOGOUTS environment variable must be set for production deployment');
        
      case 'staging':
        const stagingLogouts = process.env.STAGING_OAUTH_LOGOUTS;
        if (stagingLogouts) {
          return stagingLogouts.split(',').map(url => url.trim());
        }
        return ['https://staging.yourdomain.com/auth/logout'];
        
      case 'development':
      default:
        const devLogouts = process.env.DEVELOPMENT_OAUTH_LOGOUTS;
        if (devLogouts) {
          return devLogouts.split(',').map(url => url.trim());
        }
        return [
          'http://localhost:3000/auth/logout',
          'http://localhost:3001/auth/logout',
          'http://127.0.0.1:3000/auth/logout',
          'http://127.0.0.1:3001/auth/logout'
        ];
    }
  }
}