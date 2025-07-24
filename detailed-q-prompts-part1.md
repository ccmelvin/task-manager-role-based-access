# Detailed Amazon Q Prompts and Responses - Part 1

## Step 1: Project Structure Setup

### Amazon Q Prompt:
```
Create a project structure for a serverless task manager with these requirements:
- Frontend: React with TypeScript
- Backend: AWS Lambda with Node.js  
- Infrastructure: AWS CDK
- Database: DynamoDB
- Auth: Amazon Cognito
- Storage: S3 for attachments
Include package.json files and basic folder structure.
```

### Expected Q Response:
Q will generate a complete project structure with these files:

```
task-manager/
├── package.json (root)
├── infrastructure/
│   ├── package.json
│   ├── bin/
│   │   └── infrastructure.ts
│   ├── lib/
│   │   └── task-manager-stack.ts
│   └── cdk.json
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── tasks.ts
│   │   │   ├── auth.ts
│   │   │   └── users.ts
│   │   ├── models/
│   │   │   ├── Task.ts
│   │   │   └── User.ts
│   │   └── utils/
│   │       └── auth.ts
│   └── tsconfig.json
├── frontend/
│   ├── package.json
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── App.tsx
│   └── tsconfig.json
└── shared/
    ├── package.json
    └── types/
        ├── Task.ts
        └── User.ts
```

### Follow-up Q Prompt for Package.json Details:
```
Generate the package.json files for each directory with appropriate dependencies:
- Root: workspace management
- Infrastructure: AWS CDK v2, TypeScript
- Backend: AWS SDK v3, Lambda types, TypeScript
- Frontend: React 18, TypeScript, AWS Amplify
- Shared: TypeScript only
```

## Step 2: User Roles and Permissions Design

### Amazon Q Prompt:
```
Design a role-based access control system for a task manager with:
- Admin: Full CRUD on all tasks, user management, delete any task
- Contributor: Create/edit own tasks, view assigned tasks, upload attachments  
- Viewer: Read-only access to assigned tasks only
Create TypeScript interfaces for User, Task, and Permission models.
```

### Expected Q Response:

```typescript
// shared/types/User.ts
export enum UserRole {
  ADMIN = 'Admin',
  CONTRIBUTOR = 'Contributor', 
  VIEWER = 'Viewer'
}

export enum Permission {
  // Task permissions
  CREATE_TASK = 'task:create',
  READ_TASK = 'task:read',
  UPDATE_TASK = 'task:update', 
  DELETE_TASK = 'task:delete',
  READ_ALL_TASKS = 'task:read:all',
  
  // User permissions
  MANAGE_USERS = 'user:manage',
  VIEW_USERS = 'user:view',
  
  // File permissions
  UPLOAD_FILES = 'file:upload',
  DELETE_FILES = 'file:delete'
}

export interface User {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  createdAt: string;
  lastLogin?: string;
}

// shared/types/Task.ts
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress', 
  COMPLETED = 'completed'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface Task {
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string; // userId
  createdBy: string; // userId
  deadline?: string;
  attachments?: string[]; // S3 object keys
  createdAt: string;
  updatedAt: string;
}

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.CREATE_TASK,
    Permission.READ_TASK,
    Permission.UPDATE_TASK,
    Permission.DELETE_TASK,
    Permission.READ_ALL_TASKS,
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.UPLOAD_FILES,
    Permission.DELETE_FILES
  ],
  [UserRole.CONTRIBUTOR]: [
    Permission.CREATE_TASK,
    Permission.READ_TASK,
    Permission.UPDATE_TASK,
    Permission.UPLOAD_FILES
  ],
  [UserRole.VIEWER]: [
    Permission.READ_TASK
  ]
};
```

## Step 3: CDK Infrastructure with Security

### Amazon Q Prompt:
```
Create an AWS CDK stack for a task manager with:
- DynamoDB tables for tasks and user profiles
- Lambda functions with minimal IAM permissions
- API Gateway with custom authorizer
- Cognito User Pool with user groups (Admin, Contributor, Viewer)
- S3 bucket for file attachments
Follow least privilege principle for all IAM policies.
```

### Expected Q Response:

```typescript
// infrastructure/lib/task-manager-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class TaskManagerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      tableName: 'TasksTable',
      partitionKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true
    });

    // GSI for querying by assignedTo
    tasksTable.addGlobalSecondaryIndex({
      indexName: 'AssignedToIndex',
      partitionKey: { name: 'assignedTo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING }
    });

    const userProfilesTable = new dynamodb.Table(this, 'UserProfilesTable', {
      tableName: 'UserProfilesTable', 
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });

    // S3 Bucket for attachments
    const attachmentsBucket = new s3.Bucket(this, 'AttachmentsBucket', {
      bucketName: `task-attachments-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [{
        id: 'DeleteOldVersions',
        noncurrentVersionExpiration: cdk.Duration.days(30)
      }]
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'TaskManagerUserPool', {
      userPoolName: 'TaskManagerUsers',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true
      }
    });

    // User Pool Groups
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Admin',
      description: 'Administrator group with full access'
    });

    new cognito.CfnUserPoolGroup(this, 'ContributorGroup', {
      userPoolId: userPool.userPoolId, 
      groupName: 'Contributor',
      description: 'Contributors can create and edit tasks'
    });

    new cognito.CfnUserPoolGroup(this, 'ViewerGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Viewer', 
      description: 'Viewers have read-only access'
    });

    // User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'TaskManagerClient', {
      userPool,
      authFlows: {
        userSrp: true,
        userPassword: false
      },
      generateSecret: false
    });

    // Lambda Functions with Least Privilege IAM
    const tasksLambda = new lambda.Function(this, 'TasksFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handlers/tasks.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      environment: {
        TASKS_TABLE_NAME: tasksTable.tableName,
        USER_PROFILES_TABLE_NAME: userProfilesTable.tableName,
        ATTACHMENTS_BUCKET_NAME: attachmentsBucket.bucketName
      }
    });

    // Minimal DynamoDB permissions
    tasksLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem', 
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query'
      ],
      resources: [
        tasksTable.tableArn,
        `${tasksTable.tableArn}/index/*`,
        userProfilesTable.tableArn
      ]
    }));

    // Minimal S3 permissions
    tasksLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject', 
        's3:DeleteObject'
      ],
      resources: [`${attachmentsBucket.bucketArn}/tasks/*`]
    }));

    // Custom Authorizer Lambda
    const authorizerLambda = new lambda.Function(this, 'AuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handlers/auth.handler',
      code: lambda.Code.fromAsset('../backend/dist'),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_PROFILES_TABLE_NAME: userProfilesTable.tableName
      }
    });

    // Authorizer permissions
    authorizerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cognito-idp:GetUser'],
      resources: [userPool.userPoolArn]
    }));

    authorizerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:GetItem'],
      resources: [userProfilesTable.tableArn]
    }));

    // API Gateway
    const api = new apigateway.RestApi(this, 'TaskManagerApi', {
      restApiName: 'Task Manager API',
      description: 'API for task management system',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization']
      }
    });

    const authorizer = new apigateway.TokenAuthorizer(this, 'TaskAuthorizer', {
      handler: authorizerLambda,
      identitySource: 'method.request.header.Authorization'
    });

    // API Resources
    const tasksResource = api.root.addResource('tasks');
    tasksResource.addMethod('GET', new apigateway.LambdaIntegration(tasksLambda), {
      authorizer
    });
    tasksResource.addMethod('POST', new apigateway.LambdaIntegration(tasksLambda), {
      authorizer
    });

    const taskResource = tasksResource.addResource('{taskId}');
    taskResource.addMethod('PUT', new apigateway.LambdaIntegration(tasksLambda), {
      authorizer
    });
    taskResource.addMethod('DELETE', new apigateway.LambdaIntegration(tasksLambda), {
      authorizer
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID'
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });
  }
}
```

---

*This covers the first 3 steps with detailed Q prompts and expected responses. Should I continue with steps 4-6 next?*
