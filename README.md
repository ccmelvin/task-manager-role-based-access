```
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

1. **Prerequisites**
   - AWS CLI installed and configured
   - Node.js 18+ installed
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, region, and output format
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd infrastructure && npm install
   cd ../backend && npm install
   cd ../frontend && npm install
   ```

3. **Build Backend**
   ```bash
   cd backend
   npm run build
   ```

4. **Deploy Infrastructure**
   ```bash
   cd infrastructure
   npm install -g aws-cdk
   cdk bootstrap
   cdk deploy
   ```

5. **Configure Frontend**
   - Update `frontend/src/App.tsx` with your Cognito and API Gateway URLs
   - Get values from CDK output after deployment

6. **Run Frontend**
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

## User Management

After deployment, create users and assign roles:

1. **Create Users** (AWS Console > Cognito > User Pools)
   - Add users manually or enable self-registration
   - Confirm user accounts

2. **Assign Roles** (AWS Console > Cognito > Groups)
   - Add users to Admin, Contributor, or Viewer groups
   - Groups determine API access permissions

## Troubleshooting

- **CDK Bootstrap Error**: Run `aws configure` to set up credentials
- **Lambda Build Error**: Ensure `npm run build` completes in backend folder
- **Frontend Auth Error**: Update Cognito config in `App.tsx` with deployed values
- **CORS Issues**: API Gateway automatically handles CORS for configured origins
    ```