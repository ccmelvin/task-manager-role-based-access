# Project Overview Rules for Amazon Q

## Project: Task Manager with Role-Based Access Control

### Project Structure
This is a full-stack application with the following main components:

1. **Frontend** (`/frontend/`): React-based web application
2. **Infrastructure** (`/infrastructure/`): AWS CDK infrastructure and IAM Policy Validator tools
3. **Backend**: AWS services (Lambda, DynamoDB, API Gateway, Cognito)

### Key Technologies
- **Frontend**: React, TypeScript, Tailwind CSS
- **Infrastructure**: AWS CDK (TypeScript), Python
- **Backend**: AWS Lambda (Node.js), DynamoDB, API Gateway
- **Authentication**: AWS Cognito
- **Testing**: Playwright, pytest, Jest

### Main Features
- Task management with CRUD operations
- Role-based access control (Admin, Manager, User)
- IAM Policy validation tools (GUI and CLI)
- Real-time updates and notifications
- Comprehensive testing suite

### Development Guidelines
- Follow AWS Well-Architected Framework principles
- Use TypeScript for type safety
- Implement comprehensive testing (unit, integration, e2e)
- Follow conventional commit messages
- Use AWS CDK for infrastructure as code
- Implement proper error handling and logging

### IAM Policy Validator Tools
Located in `/infrastructure/`, includes:
- `iam_policy_validator.py`: GUI application using tkinter
- `simple_validator.py`: Command-line tool
- `web_gui.py`: Web-based interface for testing
- Comprehensive test suite with Playwright
- AWS Access Analyzer integration

### Testing Strategy
- **Frontend**: Jest + React Testing Library
- **Infrastructure**: Playwright + pytest (19 tests, 100% passing)
- **E2E**: Playwright for full application testing
- **CI/CD**: GitHub Actions with automated testing

### AWS Services Used
- **Compute**: Lambda functions
- **Storage**: DynamoDB tables
- **API**: API Gateway
- **Authentication**: Cognito User Pools
- **Security**: IAM roles and policies
- **Monitoring**: CloudWatch
- **Analysis**: Access Analyzer for policy validation
