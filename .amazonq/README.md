# Amazon Q Developer Configuration

This directory contains configuration and rules for Amazon Q Developer to provide better assistance for this project.

## 📁 Structure

```
.amazonq/
├── README.md                    # This file
├── config.json                  # Main configuration
└── rules/                       # Project-specific rules
    ├── project-overview.md      # Project structure and overview
    ├── coding-standards.md      # Code style and standards
    ├── testing-guidelines.md    # Testing best practices
    ├── aws-best-practices.md    # AWS-specific guidelines
    ├── iam-policy-validation.md # IAM policy validation rules
    └── deployment-cicd.md       # CI/CD and deployment rules
```

## 🎯 Purpose

These files help Amazon Q Developer understand:

- **Project Context**: What this application does and how it's structured
- **Coding Standards**: Preferred coding styles and conventions
- **Testing Approach**: How tests should be written and organized
- **AWS Best Practices**: Security, performance, and cost optimization
- **IAM Policy Validation**: Specific rules for the policy validator tools
- **Deployment Guidelines**: CI/CD and infrastructure management

## 🚀 Benefits

With these rules, Amazon Q Developer can:

- Provide more accurate code suggestions
- Follow project-specific conventions
- Understand the testing framework and patterns
- Suggest AWS best practices relevant to this project
- Help with IAM policy validation workflows
- Assist with deployment and CI/CD tasks

## 📋 Key Features Covered

### Project Components
- **Frontend**: React with TypeScript
- **Infrastructure**: AWS CDK and IAM Policy Validator tools
- **Backend**: AWS services (Lambda, DynamoDB, API Gateway, Cognito)
- **Testing**: Playwright + pytest (19 tests, 100% passing)

### IAM Policy Validator Tools
- GUI application (`iam_policy_validator.py`)
- CLI tool (`simple_validator.py`)
- Web interface (`web_gui.py`)
- Comprehensive test coverage

### AWS Integration
- Access Analyzer for policy validation
- Multi-service architecture
- Security best practices
- Cost optimization strategies

## 🔧 Usage

Amazon Q Developer automatically reads these files when providing assistance. No manual configuration is required.

## 📝 Maintenance

Update these files when:
- Project structure changes significantly
- New coding standards are adopted
- Testing approaches evolve
- AWS services are added or modified
- Deployment processes change

## 🎉 Result

Amazon Q Developer will now provide more contextual and relevant assistance for:
- Code generation and refactoring
- Testing strategy and implementation
- AWS service integration
- IAM policy validation
- CI/CD pipeline optimization
- Security and best practices guidance
