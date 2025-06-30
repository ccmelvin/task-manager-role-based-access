import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class TaskManagerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Pool with Groups
    const userPool = new cognito.UserPool(this, 'TaskManagerUserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'TaskManagerClient', {
      userPool,
      generateSecret: false,
    });

    // User Groups
    ['Admin', 'Contributor', 'Viewer'].forEach(role => {
      new cognito.CfnUserPoolGroup(this, `${role}Group`, {
        userPoolId: userPool.userPoolId,
        groupName: role,
        description: `${role} role for task management`,
      });
    });

    // DynamoDB Tables
    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      partitionKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const userProfilesTable = new dynamodb.Table(this, 'UserProfilesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // S3 Bucket for attachments
    const attachmentsBucket = new s3.Bucket(this, 'AttachmentsBucket', {
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // Lambda Authorizer
    const authorizerLambda = new lambda.Function(this, 'AuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'authorizer.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    // Task CRUD Lambda
    const taskLambda = new lambda.Function(this, 'TaskFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'tasks.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      environment: {
        TASKS_TABLE: tasksTable.tableName,
        USER_PROFILES_TABLE: userProfilesTable.tableName,
        ATTACHMENTS_BUCKET: attachmentsBucket.bucketName,
      },
    });

    tasksTable.grantReadWriteData(taskLambda);
    userProfilesTable.grantReadWriteData(taskLambda);
    attachmentsBucket.grantReadWrite(taskLambda);

    // API Gateway
    const api = new apigateway.RestApi(this, 'TaskManagerApi', {
      restApiName: 'Task Manager API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const authorizer = new apigateway.RequestAuthorizer(this, 'TaskAuthorizer', {
      handler: authorizerLambda,
      identitySources: [apigateway.IdentitySource.header('Authorization')],
    });

    const tasksResource = api.root.addResource('tasks');
    tasksResource.addMethod('ANY', new apigateway.LambdaIntegration(taskLambda), {
      authorizer,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}