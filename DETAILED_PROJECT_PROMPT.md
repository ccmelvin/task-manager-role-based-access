# Comprehensive Project Prompt: Task Manager with Role-Based Access Control

## Project Overview
Create a complete serverless task management system with comprehensive role-based access control using AWS services and React. The system must support three distinct user roles with different permission levels and provide secure, scalable task management capabilities.

## Architecture Requirements

### Frontend Stack
- **Framework**: React SPA with TypeScript
- **Authentication**: AWS Amplify with Cognito integration
- **UI Components**: Modern, responsive design
- **State Management**: Context API or Redux for user state
- **Routing**: React Router with protected routes based on user roles

### Backend Stack
- **API**: AWS API Gateway with Lambda integration
- **Functions**: AWS Lambda (Node.js/TypeScript)
- **Authorization**: Custom Lambda authorizer for JWT validation
- **Database**: DynamoDB with optimized table design
- **Storage**: S3 for file attachments with presigned URLs
- **CORS**: Properly configured for secure cross-origin requests

### Infrastructure
- **IaC**: AWS CDK (TypeScript) for complete infrastructure deployment
- **Security**: IAM roles with least privilege principle
- **Monitoring**: CloudWatch logs and metrics
- **Environment**: Support for dev/staging/prod environments

## User Role System

### Admin Role
- **Permissions**: Full CRUD operations on all tasks
- **User Management**: Create, modify, delete user accounts
- **System Configuration**: Manage system settings and permissions
- **Reporting**: Access to all system analytics and reports
- **Task Assignment**: Can assign tasks to any user

### Contributor Role
- **Task Management**: Create and edit own tasks
- **Task Viewing**: View tasks assigned to them
- **File Operations**: Upload and manage attachments
- **Collaboration**: Comment on assigned tasks
- **Status Updates**: Update status of own and assigned tasks

### Viewer Role
- **Read-Only Access**: View assigned tasks only
- **No Modifications**: Cannot create, edit, or delete tasks
- **Limited Viewing**: Only see tasks specifically assigned to them
- **Download Only**: Can download attachments but not upload

## Database Schema Design

### Tasks Table (DynamoDB)
```
Primary Key: taskId (String)
Attributes:
- title (String, required)
- description (String)
- status (String: "pending" | "in-progress" | "completed")
- assignedTo (String: Cognito User ID)
- createdBy (String: Cognito User ID)
- deadline (String: ISO date)
- priority (String: "low" | "medium" | "high")
- attachments (List: S3 object keys)
- createdAt (String: ISO timestamp)
- updatedAt (String: ISO timestamp)
- tags (List: String array)
- comments (List: Comment objects)

GSI: assignedTo-createdAt-index
GSI: createdBy-createdAt-index
GSI: status-deadline-index
```

### UserProfiles Table (DynamoDB)
```
Primary Key: userId (String: Cognito User ID)
Attributes:
- email (String, required)
- role (String: "Admin" | "Contributor" | "Viewer")
- permissions (List: Specific permission strings)
- createdAt (String: ISO timestamp)
- lastLogin (String: ISO timestamp)
- isActive (Boolean)
- preferences (Map: User preferences object)
```

## API Endpoints Specification

### Task Management Endpoints
```
GET /tasks
- Query Parameters: status, assignedTo, priority, limit, nextToken
- Authorization: All roles (filtered by permissions)
- Response: Paginated task list

POST /tasks
- Authorization: Admin, Contributor
- Body: Task creation payload
- Response: Created task object

GET /tasks/{taskId}
- Authorization: All roles (filtered by access)
- Response: Single task object

PUT /tasks/{taskId}
- Authorization: Admin, Contributor (own tasks only)
- Body: Task update payload
- Response: Updated task object

DELETE /tasks/{taskId}
- Authorization: Admin only
- Response: Deletion confirmation

POST /tasks/{taskId}/attachments
- Authorization: Admin, Contributor
- Body: Multipart file upload
- Response: S3 presigned URL and attachment metadata
```

### User Management Endpoints (Admin Only)
```
GET /users
- Authorization: Admin only
- Response: User list with roles

POST /users
- Authorization: Admin only
- Body: User creation payload
- Response: Created user object

PUT /users/{userId}/role
- Authorization: Admin only
- Body: Role assignment payload
- Response: Updated user object
```

## Security Implementation

### Authentication Flow
1. **User Registration**: Cognito user pool with email verification
2. **Login Process**: Cognito hosted UI or custom login form
3. **Token Management**: JWT tokens with automatic refresh
4. **Session Handling**: Secure token storage and validation

### Authorization Strategy
1. **Lambda Authorizer**: Custom authorizer validates JWT tokens
2. **Role Verification**: Check user's Cognito group membership
3. **Resource Access**: Validate user permissions for specific resources
4. **API Gateway**: Integration with custom authorizer for all endpoints

### Data Security
1. **Encryption**: DynamoDB encryption at rest
2. **S3 Security**: Bucket policies with restricted access
3. **HTTPS Only**: All API communications over TLS
4. **Input Validation**: Comprehensive input sanitization

## Frontend Implementation Requirements

### Component Structure
```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── RoleGuard.tsx
│   ├── tasks/
│   │   ├── TaskList.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskForm.tsx
│   │   └── TaskDetails.tsx
│   ├── users/
│   │   ├── UserManagement.tsx
│   │   └── UserProfile.tsx
│   └── common/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── LoadingSpinner.tsx
├── contexts/
│   ├── AuthContext.tsx
│   └── TaskContext.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useTasks.ts
│   └── useRole.ts
├── services/
│   ├── api.ts
│   ├── auth.ts
│   └── storage.ts
└── types/
    ├── Task.ts
    ├── User.ts
    └── Auth.ts
```

### Key Features to Implement
1. **Dashboard**: Role-specific dashboard with relevant metrics
2. **Task Management**: CRUD operations with role-based restrictions
3. **File Upload**: Drag-and-drop file upload with progress indicators
4. **Real-time Updates**: WebSocket or polling for live task updates
5. **Search & Filter**: Advanced search with multiple filter options
6. **Responsive Design**: Mobile-first responsive layout
7. **Error Handling**: Comprehensive error boundaries and user feedback

## Backend Implementation Requirements

### Lambda Functions Structure
```
backend/
├── src/
│   ├── handlers/
│   │   ├── tasks/
│   │   │   ├── createTask.ts
│   │   │   ├── getTasks.ts
│   │   │   ├── updateTask.ts
│   │   │   └── deleteTask.ts
│   │   ├── users/
│   │   │   ├── getUsers.ts
│   │   │   └── updateUserRole.ts
│   │   └── auth/
│   │       └── authorizer.ts
│   ├── services/
│   │   ├── dynamodb.ts
│   │   ├── s3.ts
│   │   └── cognito.ts
│   ├── utils/
│   │   ├── response.ts
│   │   ├── validation.ts
│   │   └── permissions.ts
│   └── types/
│       ├── api.ts
│       └── database.ts
```

### Key Backend Features
1. **Input Validation**: Joi or similar for request validation
2. **Error Handling**: Standardized error responses
3. **Logging**: Structured logging with correlation IDs
4. **Performance**: Optimized DynamoDB queries with proper indexing
5. **Rate Limiting**: API Gateway throttling configuration
6. **Monitoring**: CloudWatch metrics and alarms

## Infrastructure as Code (CDK)

### Stack Organization
```
infrastructure/
├── lib/
│   ├── stacks/
│   │   ├── auth-stack.ts          # Cognito resources
│   │   ├── database-stack.ts      # DynamoDB tables
│   │   ├── api-stack.ts          # API Gateway + Lambda
│   │   ├── storage-stack.ts      # S3 buckets
│   │   └── monitoring-stack.ts   # CloudWatch resources
│   ├── constructs/
│   │   ├── lambda-function.ts
│   │   └── dynamodb-table.ts
│   └── task-manager-app.ts
└── bin/
    └── task-manager.ts
```

### CDK Implementation Requirements
1. **Environment Configuration**: Support for multiple environments
2. **Resource Tagging**: Consistent tagging strategy
3. **IAM Policies**: Least privilege access patterns
4. **Outputs**: Export important resource ARNs and URLs
5. **Dependencies**: Proper stack dependencies and cross-references

## Development Workflow

### Setup Instructions
1. **Prerequisites**: AWS CLI, Node.js 18+, CDK CLI
2. **Installation**: Multi-package dependency installation
3. **Configuration**: Environment-specific configuration files
4. **Deployment**: Automated deployment pipeline
5. **Testing**: Unit and integration test setup

### Quality Assurance
1. **Code Standards**: ESLint, Prettier configuration
2. **Type Safety**: Strict TypeScript configuration
3. **Testing**: Jest for unit tests, Cypress for E2E
4. **Security**: Regular dependency vulnerability scans
5. **Performance**: Bundle size optimization and monitoring

## Success Criteria

### Functional Requirements
- [ ] Users can register and login with email verification
- [ ] Role-based access control works correctly for all endpoints
- [ ] Tasks can be created, viewed, updated, and deleted based on permissions
- [ ] File attachments upload and download successfully
- [ ] Admin users can manage other users and their roles
- [ ] All data is properly validated and sanitized

### Non-Functional Requirements
- [ ] API response times under 500ms for 95th percentile
- [ ] Frontend loads within 3 seconds on 3G connection
- [ ] System handles 1000+ concurrent users
- [ ] 99.9% uptime availability
- [ ] All sensitive data encrypted in transit and at rest
- [ ] WCAG 2.1 AA accessibility compliance

### Security Requirements
- [ ] No unauthorized access to tasks or user data
- [ ] All API endpoints properly authenticated and authorized
- [ ] Input validation prevents injection attacks
- [ ] File uploads are scanned and restricted by type/size
- [ ] Audit logging for all administrative actions
