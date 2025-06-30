# Task Manager with Role-Based Access Control

A serverless task management system built with AWS services and React, featuring comprehensive role-based access control.

## Architecture

- **Frontend**: React SPA with AWS Amplify authentication
- **Backend**: AWS Lambda functions with API Gateway
- **Database**: DynamoDB for tasks and user profiles
- **Authentication**: Amazon Cognito with user groups
- **Storage**: S3 for file attachments
- **Infrastructure**: AWS CDK for deployment

## User Roles

- **Admin**: Full CRUD on all tasks, user management, system configuration
- **Contributor**: Create/edit own tasks, view assigned tasks, upload attachments
- **Viewer**: Read-only access to assigned tasks only

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   cd infrastructure && npm install
   cd ../backend && npm install
   cd ../frontend && npm install
   ```

2. **Deploy Infrastructure**
   ```bash
   cd infrastructure
   cdk bootstrap
   cdk deploy
   ```

3. **Build Backend**
   ```bash
   cd backend
   npm run build
   ```

4. **Configure Frontend**
   - Update `frontend/src/App.tsx` with your Cognito and API Gateway URLs
   - Get values from CDK output after deployment

5. **Run Frontend**
   ```bash
   cd frontend
   npm start
   ```

## Project Structure

```
├── infrastructure/         # AWS CDK infrastructure code
├── backend/               # Lambda functions
├── frontend/              # React application
├── shared/                # Shared TypeScript types
└── README.md
```

## Security Features

- JWT token validation via custom Lambda authorizer
- Role-based API endpoint access control
- Cognito user groups for permission management
- CORS configuration for secure cross-origin requests

## Database Schema

### Tasks Table
- `taskId` (PK): Unique task identifier
- `title`: Task title
- `description`: Task description
- `status`: pending | in-progress | completed
- `assignedTo`: User ID of assignee
- `createdBy`: User ID of creator
- `deadline`: Task deadline
- `priority`: low | medium | high
- `attachments`: Array of S3 object keys

### UserProfiles Table
- `userId` (PK): Cognito user ID
- `email`: User email
- `role`: Admin | Contributor | Viewer
- `permissions`: Array of specific permissions
- `createdAt`: Account creation timestamp

## API Endpoints

- `GET /tasks` - List tasks (filtered by role)
- `POST /tasks` - Create new task
- `PUT /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task (Admin only)

All endpoints require valid Cognito JWT token in Authorization header.