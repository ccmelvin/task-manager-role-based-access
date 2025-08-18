# Security Configuration and Deployment Guide

## Overview

This guide provides step-by-step instructions for securely deploying and configuring the Task Management System. It covers all security-related configurations, deployment procedures, and post-deployment verification steps.

## Prerequisites

### Required Tools and Access

- AWS CLI configured with appropriate permissions
- Node.js 18+ and npm
- AWS CDK CLI
- Docker (for local testing)
- Access to AWS account with administrative privileges

### Required AWS Services

- AWS Cognito (User Pool and Identity Pool)
- AWS Lambda
- Amazon DynamoDB
- Amazon API Gateway
- AWS CloudTrail
- Amazon CloudWatch
- AWS Secrets Manager
- AWS KMS

## Pre-Deployment Security Checklist

### 1. Environment Preparation

```bash
# Verify AWS CLI configuration
aws sts get-caller-identity

# Verify CDK bootstrap
cdk bootstrap aws://ACCOUNT-ID/REGION

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../infrastructure && npm install
```

### 2. Security Configuration Validation

```bash
# Run security configuration tests
npm run test:security-config

# Validate IAM policies
python infrastructure/iam_policy_validator.py

# Check for security vulnerabilities
npm audit
```

### 3. Environment Variables Setup

Create environment-specific configuration files:

**Development (.env.development):**

```bash
# API Configuration
REACT_APP_API_URL=https://dev-api.yourdomain.com
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
REACT_APP_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX

# Security Configuration
REACT_APP_ENVIRONMENT=development
REACT_APP_CORS_ORIGINS=http://localhost:3000

# Monitoring
REACT_APP_LOG_LEVEL=debug
```

**Production (.env.production):**

```bash
# API Configuration
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
REACT_APP_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX

# Security Configuration
REACT_APP_ENVIRONMENT=production
REACT_APP_CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Monitoring
REACT_APP_LOG_LEVEL=error
```

## Infrastructure Deployment

### 1. Deploy Core Infrastructure

```bash
cd infrastructure

# Deploy with security configurations
cdk deploy TaskManagerStack --parameters Environment=production

# Verify deployment
aws cloudformation describe-stacks --stack-name TaskManagerStack
```

### 2. Configure DynamoDB Security

```bash
# Verify encryption at rest
aws dynamodb describe-table --table-name TaskManagerTable-prod

# Expected output should show:
# "SSEDescription": {
#   "Status": "ENABLED",
#   "SSEType": "KMS"
# }
```

### 3. Configure Lambda Security

```bash
# Verify VPC configuration
aws lambda get-function-configuration --function-name TaskManagerFunction-prod

# Expected output should show VPC configuration:
# "VpcConfig": {
#   "SubnetIds": [...],
#   "SecurityGroupIds": [...],
#   "VpcId": "vpc-..."
# }
```

### 4. Configure API Gateway Security

```bash
# Verify throttling configuration
aws apigateway get-stage --rest-api-id YOUR_API_ID --stage-name prod

# Expected output should show throttling settings:
# "throttleSettings": {
#   "rateLimit": 1000,
#   "burstLimit": 2000
# }
```

## Security Service Configuration

### 1. Cognito User Pool Configuration

```bash
# Update password policy
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_XXXXXXXXX \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 12,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true,
      "TemporaryPasswordValidityDays": 1
    }
  }'

# Configure account lockout
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_XXXXXXXXX \
  --account-recovery-setting '{
    "RecoveryMechanisms": [
      {
        "Priority": 1,
        "Name": "verified_email"
      }
    ]
  }'
```

### 2. Secrets Manager Configuration

```bash
# Create database connection secret
aws secretsmanager create-secret \
  --name "taskmanager/database/connection" \
  --description "Database connection configuration" \
  --secret-string '{
    "host": "your-db-host",
    "port": 5432,
    "database": "taskmanager",
    "username": "taskmanager_user"
  }'

# Create API keys secret
aws secretsmanager create-secret \
  --name "taskmanager/api/keys" \
  --description "API keys and tokens" \
  --secret-string '{
    "jwt_secret": "your-jwt-secret",
    "encryption_key": "your-encryption-key"
  }'
```

### 3. CloudTrail Configuration

```bash
# Create CloudTrail for security monitoring
aws cloudtrail create-trail \
  --name TaskManagerSecurityTrail \
  --s3-bucket-name taskmanager-security-logs \
  --include-global-service-events \
  --is-multi-region-trail \
  --enable-log-file-validation

# Start logging
aws cloudtrail start-logging --name TaskManagerSecurityTrail
```

### 4. CloudWatch Alarms Configuration

```bash
# Create security alert for failed logins
aws cloudwatch put-metric-alarm \
  --alarm-name "TaskManager-FailedLogins" \
  --alarm-description "Alert on excessive failed login attempts" \
  --metric-name "FailedLoginAttempts" \
  --namespace "TaskManager/Security" \
  --statistic "Sum" \
  --period 300 \
  --threshold 10 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1

# Create security alert for authorization failures
aws cloudwatch put-metric-alarm \
  --alarm-name "TaskManager-AuthorizationFailures" \
  --alarm-description "Alert on authorization failures" \
  --metric-name "AuthorizationFailures" \
  --namespace "TaskManager/Security" \
  --statistic "Sum" \
  --period 300 \
  --threshold 5 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1
```

## Application Deployment

### 1. Backend Deployment

```bash
cd backend

# Build and test
npm run build
npm run test:security

# Deploy Lambda functions
npm run deploy:prod

# Verify deployment
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `TaskManager`)]'
```

### 2. Frontend Deployment

```bash
cd frontend

# Build with production configuration
npm run build

# Deploy to S3 with security headers
aws s3 sync build/ s3://taskmanager-frontend-prod \
  --delete \
  --cache-control "public, max-age=31536000" \
  --metadata-directive REPLACE

# Configure CloudFront security headers
aws cloudfront create-response-headers-policy \
  --response-headers-policy-config file://security-headers-policy.json
```

## Post-Deployment Security Verification

### 1. Security Configuration Verification

```bash
# Run security validation tests
npm run test:security-integration

# Verify HTTPS configuration
curl -I https://api.yourdomain.com/health

# Expected headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
```

### 2. Authentication and Authorization Testing

```bash
# Test authentication flow
curl -X POST https://api.yourdomain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test@example.com", "password": "TestPassword123!"}'

# Test authorization with invalid token
curl -X GET https://api.yourdomain.com/tasks \
  -H "Authorization: Bearer invalid-token"

# Expected response: 401 Unauthorized
```

### 3. Input Validation Testing

```bash
# Test XSS protection
curl -X POST https://api.yourdomain.com/tasks \
  -H "Authorization: Bearer valid-token" \
  -H "Content-Type: application/json" \
  -d '{"title": "<script>alert(\"xss\")</script>", "description": "test"}'

# Expected response: 400 Bad Request with validation error
```

### 4. Rate Limiting Testing

```bash
# Test rate limiting
for i in {1..1100}; do
  curl -X GET https://api.yourdomain.com/health &
done
wait

# Expected: Some requests should return 429 Too Many Requests
```

## Security Monitoring Setup

### 1. CloudWatch Dashboard Configuration

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["TaskManager/Security", "FailedLoginAttempts"],
          ["TaskManager/Security", "AuthorizationFailures"],
          ["TaskManager/Security", "InputValidationFailures"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Security Metrics"
      }
    }
  ]
}
```

### 2. Security Event Monitoring

```bash
# Create log group for security events
aws logs create-log-group --log-group-name /taskmanager/security

# Create metric filter for failed logins
aws logs put-metric-filter \
  --log-group-name /taskmanager/security \
  --filter-name FailedLoginAttempts \
  --filter-pattern "[timestamp, requestId, level=\"ERROR\", event=\"AUTHENTICATION_FAILED\"]" \
  --metric-transformations \
    metricName=FailedLoginAttempts,metricNamespace=TaskManager/Security,metricValue=1
```

## Backup and Recovery Configuration

### 1. DynamoDB Backup Configuration

```bash
# Enable point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name TaskManagerTable-prod \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Create backup vault
aws backup create-backup-vault \
  --backup-vault-name TaskManagerBackupVault \
  --encryption-key-arn arn:aws:kms:region:account:key/key-id
```

### 2. Configuration Backup

```bash
# Backup security configurations
aws secretsmanager get-secret-value --secret-id taskmanager/api/keys > backup/api-keys.json
aws cognito-idp describe-user-pool --user-pool-id us-east-1_XXXXXXXXX > backup/cognito-config.json
```

## Security Maintenance Procedures

### 1. Regular Security Updates

```bash
# Weekly security scan
npm audit
npm audit fix

# Monthly dependency updates
npm update
npm run test:security

# Quarterly security review
npm run security:full-scan
```

### 2. Certificate Management

```bash
# Check certificate expiration
aws acm list-certificates --query 'CertificateSummaryList[?Status==`ISSUED`]'

# Renew certificates (if using custom certificates)
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS
```

### 3. Access Review

```bash
# Review IAM policies quarterly
aws iam list-policies --scope Local
aws iam get-policy-version --policy-arn POLICY_ARN --version-id v1

# Review Cognito user groups
aws cognito-idp list-groups --user-pool-id us-east-1_XXXXXXXXX
```

## Troubleshooting Security Issues

### Common Security Configuration Issues

1. **CORS Errors**

   ```bash
   # Check CORS configuration
   aws apigateway get-resource --rest-api-id API_ID --resource-id RESOURCE_ID

   # Update CORS if needed
   aws apigateway put-method-response \
     --rest-api-id API_ID \
     --resource-id RESOURCE_ID \
     --http-method OPTIONS \
     --status-code 200 \
     --response-parameters method.response.header.Access-Control-Allow-Origin=true
   ```

2. **Authentication Issues**

   ```bash
   # Check Cognito configuration
   aws cognito-idp describe-user-pool --user-pool-id us-east-1_XXXXXXXXX

   # Verify JWT token
   aws cognito-idp admin-get-user --user-pool-id us-east-1_XXXXXXXXX --username USERNAME
   ```

3. **Authorization Issues**
   ```bash
   # Check Lambda authorizer logs
   aws logs filter-log-events \
     --log-group-name /aws/lambda/TaskManagerAuthorizer \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

### Security Incident Response

1. **Immediate Response**

   ```bash
   # Disable compromised user
   aws cognito-idp admin-disable-user \
     --user-pool-id us-east-1_XXXXXXXXX \
     --username COMPROMISED_USERNAME

   # Revoke all sessions
   aws cognito-idp admin-user-global-sign-out \
     --user-pool-id us-east-1_XXXXXXXXX \
     --username COMPROMISED_USERNAME
   ```

2. **Investigation**

   ```bash
   # Check CloudTrail logs
   aws logs filter-log-events \
     --log-group-name CloudTrail/TaskManagerSecurityTrail \
     --filter-pattern "{ $.userIdentity.userName = \"COMPROMISED_USERNAME\" }"

   # Check security event logs
   aws logs filter-log-events \
     --log-group-name /taskmanager/security \
     --filter-pattern "COMPROMISED_USERNAME"
   ```

## Security Compliance Verification

### 1. OWASP Top 10 Compliance Check

```bash
# Run OWASP ZAP security scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.yourdomain.com \
  -J owasp-report.json

# Review results
cat owasp-report.json | jq '.site[0].alerts'
```

### 2. AWS Security Best Practices Check

```bash
# Run AWS Config rules
aws configservice put-config-rule \
  --config-rule file://security-config-rules.json

# Check compliance
aws configservice get-compliance-details-by-config-rule \
  --config-rule-name security-compliance-rule
```

### 3. Infrastructure Security Scan

```bash
# Run Checkov security scan
pip install checkov
checkov -d infrastructure/ --framework cloudformation

# Run AWS Security Hub
aws securityhub enable-security-hub
aws securityhub get-findings --filters '{"ProductArn": [{"Value": "arn:aws:securityhub:region:account:product/aws/config", "Comparison": "EQUALS"}]}'
```

## Documentation Maintenance

### 1. Regular Updates

- Review and update security configurations monthly
- Update deployment procedures after any infrastructure changes
- Maintain change log for all security-related modifications
- Conduct quarterly security architecture reviews

### 2. Version Control

- All security configurations stored in version control
- Security documentation versioned with application releases
- Change approval process for security configuration updates
- Automated testing for security configuration changes

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-15  
**Next Review**: 2025-02-15  
**Owner**: DevOps Team  
**Approved By**: Security Architect
