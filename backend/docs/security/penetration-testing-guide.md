# Penetration Testing Guide

## Overview

This document provides comprehensive procedures for conducting penetration testing on the task management system. It includes automated testing scenarios, manual testing procedures, and reporting guidelines.

## Table of Contents

1. [Testing Environment Setup](#testing-environment-setup)
2. [Automated Security Testing](#automated-security-testing)
3. [Manual Penetration Testing](#manual-penetration-testing)
4. [OWASP Top 10 Testing](#owasp-top-10-testing)
5. [Infrastructure Testing](#infrastructure-testing)
6. [Reporting and Remediation](#reporting-and-remediation)

## Testing Environment Setup

### Prerequisites

- Node.js 18+ installed
- AWS CLI configured with test account credentials
- Docker installed (for isolated testing)
- Burp Suite or OWASP ZAP (for manual testing)

### Environment Configuration

1. **Clone the repository and install dependencies:**

   ```bash
   git clone <repository-url>
   cd task-manager
   cd backend
   npm install
   ```

2. **Set up test environment variables:**

   ```bash
   export NODE_ENV=test
   export AWS_REGION=us-east-1
   export DYNAMODB_TABLE_NAME=test-tasks-table
   export COGNITO_USER_POOL_ID=test-user-pool
   ```

3. **Initialize security test environment:**
   ```bash
   npm run test:security -- --setupFilesAfterEnv=src/__tests__/security-test-environment.ts
   ```

### Test Data Management

The security test environment automatically creates:

- Test users with different roles (Admin, Contributor, Viewer)
- Sample task data for testing
- Malicious payload collections
- Attack scenario configurations

## Automated Security Testing

### Running the Complete Security Test Suite

```bash
# Run all security tests
npm run test:security

# Run specific security test categories
npm test -- --testPathPattern=security-test-suite
npm test -- --testPathPattern=security-integration
npm test -- --testPathPattern=dependency-security
npm test -- --testPathPattern=infrastructure-security
```

### OWASP Top 10 Automated Testing

The automated test suite covers all OWASP Top 10 2021 vulnerabilities:

1. **A01:2021 - Broken Access Control**

   - Privilege escalation tests
   - Horizontal access control bypass
   - Role hierarchy validation

2. **A02:2021 - Cryptographic Failures**

   - Password strength validation
   - Encryption implementation checks
   - Secure transmission validation

3. **A03:2021 - Injection**

   - SQL injection pattern detection
   - NoSQL injection prevention
   - XSS attack prevention
   - Command injection protection

4. **A04:2021 - Insecure Design**

   - Rate limiting validation
   - Business logic constraint testing
   - Security control effectiveness

5. **A05:2021 - Security Misconfiguration**

   - Security header validation
   - CORS policy testing
   - Default configuration checks

6. **A06:2021 - Vulnerable Components**

   - Dependency vulnerability scanning
   - License compliance checking
   - Version security validation

7. **A07:2021 - Authentication Failures**

   - Brute force protection
   - Session security validation
   - Multi-factor authentication

8. **A08:2021 - Software Integrity Failures**

   - Data integrity validation
   - Checksum verification
   - Tampering detection

9. **A09:2021 - Logging Failures**

   - Security event logging
   - Log sanitization
   - Monitoring effectiveness

10. **A10:2021 - Server-Side Request Forgery**
    - SSRF prevention testing
    - URL validation
    - Internal service protection

## Manual Penetration Testing

### Authentication Testing

#### 1. Password Policy Testing

**Objective:** Verify password strength requirements

**Test Cases:**

- Attempt to create accounts with weak passwords
- Test password complexity requirements
- Verify password history enforcement
- Test account lockout mechanisms

**Commands:**

```bash
# Test weak password creation
curl -X POST https://api.example.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"weak"}'

# Test brute force protection
for i in {1..10}; do
  curl -X POST https://api.example.com/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"wrong'$i'"}'
done
```

#### 2. Session Management Testing

**Objective:** Validate session security controls

**Test Cases:**

- Session fixation attacks
- Session timeout validation
- Concurrent session handling
- Session token entropy

**Commands:**

```bash
# Test session fixation
curl -X POST https://api.example.com/auth/login \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionid=fixed-session-id" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Authorization Testing

#### 1. Role-Based Access Control

**Objective:** Verify proper authorization controls

**Test Cases:**

- Privilege escalation attempts
- Horizontal access control bypass
- Role hierarchy enforcement
- Resource-based permissions

**Test Procedure:**

1. Authenticate as a Viewer user
2. Attempt to access Admin-only resources
3. Try to modify other users' data
4. Test API endpoints with different roles

#### 2. API Authorization Testing

**Commands:**

```bash
# Test unauthorized access
curl -X DELETE https://api.example.com/tasks/123 \
  -H "Authorization: Bearer viewer-token"

# Test cross-user data access
curl -X GET https://api.example.com/tasks \
  -H "Authorization: Bearer user1-token" \
  -G -d "userId=user2"
```

### Input Validation Testing

#### 1. Injection Attack Testing

**SQL Injection:**

```bash
curl -X POST https://api.example.com/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer valid-token" \
  -d '{"title":"Test'\'''; DROP TABLE tasks; --","description":"test"}'
```

**XSS Testing:**

```bash
curl -X POST https://api.example.com/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer valid-token" \
  -d '{"title":"<script>alert(\"xss\")</script>","description":"test"}'
```

**Command Injection:**

```bash
curl -X POST https://api.example.com/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer valid-token" \
  -d '{"title":"test; ls -la","description":"test"}'
```

#### 2. File Upload Testing (if applicable)

**Test Cases:**

- Malicious file upload attempts
- File type validation bypass
- Path traversal in filenames
- File size limit testing

### Network Security Testing

#### 1. CORS Policy Testing

```bash
# Test CORS with malicious origin
curl -X OPTIONS https://api.example.com/tasks \
  -H "Origin: https://malicious.com" \
  -H "Access-Control-Request-Method: POST"

# Test CORS with null origin
curl -X OPTIONS https://api.example.com/tasks \
  -H "Origin: null" \
  -H "Access-Control-Request-Method: POST"
```

#### 2. Rate Limiting Testing

```bash
# Test rate limiting
for i in {1..200}; do
  curl -X GET https://api.example.com/tasks \
    -H "Authorization: Bearer valid-token" &
done
wait
```

### Infrastructure Testing

#### 1. SSL/TLS Configuration

**Test Commands:**

```bash
# Test SSL configuration
nmap --script ssl-enum-ciphers -p 443 api.example.com

# Test for weak ciphers
sslscan api.example.com

# Test certificate validation
openssl s_client -connect api.example.com:443 -verify_return_error
```

#### 2. Security Headers Testing

```bash
# Test security headers
curl -I https://api.example.com/

# Expected headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# Content-Security-Policy: default-src 'self'
```

## OWASP Top 10 Testing

### A01: Broken Access Control

**Manual Tests:**

1. **Privilege Escalation:**

   - Login as Viewer, attempt Admin actions
   - Modify user role in requests
   - Access other users' resources

2. **Direct Object References:**
   - Enumerate task IDs
   - Access tasks not assigned to user
   - Modify task ownership

**Test Script:**

```bash
#!/bin/bash
# Privilege escalation test
VIEWER_TOKEN="viewer-jwt-token"
ADMIN_ENDPOINT="https://api.example.com/admin/users"

echo "Testing privilege escalation..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$ADMIN_ENDPOINT" \
  -H "Authorization: Bearer $VIEWER_TOKEN")

if [ "$response" = "403" ]; then
  echo "✅ Privilege escalation properly blocked"
else
  echo "❌ Privilege escalation vulnerability detected"
fi
```

### A03: Injection

**SQL Injection Test:**

```bash
#!/bin/bash
# SQL injection test
API_ENDPOINT="https://api.example.com/tasks"
TOKEN="valid-jwt-token"

payloads=(
  "'; DROP TABLE tasks; --"
  "1' OR '1'='1"
  "admin'/*"
  "1; DELETE FROM tasks WHERE 1=1; --"
)

for payload in "${payloads[@]}"; do
  echo "Testing payload: $payload"
  response=$(curl -s -X POST "$API_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"title\":\"$payload\",\"description\":\"test\"}")

  if echo "$response" | grep -q "error\|validation"; then
    echo "✅ SQL injection blocked"
  else
    echo "❌ Potential SQL injection vulnerability"
  fi
done
```

### A05: Security Misconfiguration

**Security Headers Test:**

```bash
#!/bin/bash
# Security headers test
URL="https://api.example.com/"

echo "Testing security headers..."
headers=$(curl -s -I "$URL")

required_headers=(
  "X-Frame-Options"
  "X-Content-Type-Options"
  "Strict-Transport-Security"
  "Content-Security-Policy"
)

for header in "${required_headers[@]}"; do
  if echo "$headers" | grep -qi "$header"; then
    echo "✅ $header present"
  else
    echo "❌ $header missing"
  fi
done
```

## Infrastructure Testing

### AWS Security Testing

#### 1. IAM Policy Testing

```bash
# Test IAM policies with AWS CLI
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/TaskManagerRole \
  --action-names dynamodb:Scan \
  --resource-arns arn:aws:dynamodb:us-east-1:123456789012:table/tasks
```

#### 2. S3 Bucket Security

```bash
# Test S3 bucket permissions
aws s3api get-bucket-acl --bucket task-manager-bucket
aws s3api get-bucket-policy --bucket task-manager-bucket
```

#### 3. VPC Security Testing

```bash
# Test security groups
aws ec2 describe-security-groups --group-ids sg-12345678

# Test NACLs
aws ec2 describe-network-acls --network-acl-ids acl-12345678
```

### Container Security Testing (if applicable)

```bash
# Scan Docker images for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image task-manager:latest

# Test container runtime security
docker run --rm -it --cap-drop=ALL --read-only \
  task-manager:latest /bin/sh -c "whoami && id"
```

## Reporting and Remediation

### Security Test Report Template

```markdown
# Security Test Report

## Executive Summary

- **Test Date:** [Date]
- **Tester:** [Name]
- **Scope:** [Application/Infrastructure components tested]
- **Overall Risk Level:** [Low/Medium/High/Critical]

## Test Summary

- **Total Tests:** [Number]
- **Passed:** [Number]
- **Failed:** [Number]
- **Vulnerabilities Found:** [Number]

## Vulnerabilities

### Critical Vulnerabilities

1. **[Vulnerability Name]**
   - **Severity:** Critical
   - **CVSS Score:** [Score]
   - **Description:** [Detailed description]
   - **Impact:** [Business impact]
   - **Reproduction Steps:** [Steps to reproduce]
   - **Recommendation:** [Remediation steps]

### High Vulnerabilities

[Similar format for high severity issues]

### Medium Vulnerabilities

[Similar format for medium severity issues]

### Low Vulnerabilities

[Similar format for low severity issues]

## Recommendations

1. [Priority 1 recommendations]
2. [Priority 2 recommendations]
3. [Priority 3 recommendations]

## Appendix

- Test methodology
- Tools used
- Raw test results
```

### Automated Report Generation

```bash
# Generate security report
npm run test:security -- --reporters=json > security-test-results.json

# Process results and generate report
node scripts/generate-security-report.js security-test-results.json
```

### Remediation Workflow

1. **Immediate Actions (Critical/High):**

   - Disable affected functionality if necessary
   - Apply temporary mitigations
   - Notify security team and stakeholders

2. **Short-term Actions (Medium):**

   - Develop and test fixes
   - Update security controls
   - Enhance monitoring

3. **Long-term Actions (Low):**
   - Improve security architecture
   - Enhance security training
   - Update security policies

### Continuous Testing

Set up automated security testing in CI/CD pipeline:

```yaml
# .github/workflows/security-testing.yml
name: Security Testing
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 2 * * *" # Daily at 2 AM

jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Security Tests
        run: |
          cd backend
          npm ci
          npm run test:security
          npm run security:audit
```

## Best Practices

1. **Test Environment Isolation:**

   - Use dedicated test environments
   - Avoid testing on production systems
   - Implement proper data sanitization

2. **Documentation:**

   - Document all test procedures
   - Maintain test case libraries
   - Record all findings and remediation

3. **Regular Testing:**

   - Schedule regular penetration tests
   - Implement continuous security testing
   - Update test cases based on new threats

4. **Collaboration:**
   - Work closely with development teams
   - Provide clear remediation guidance
   - Validate fixes through retesting

## Tools and Resources

### Recommended Tools

- **OWASP ZAP:** Web application security scanner
- **Burp Suite:** Web vulnerability scanner
- **Nmap:** Network discovery and security auditing
- **SQLMap:** SQL injection testing tool
- **Nikto:** Web server scanner

### Additional Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [AWS Security Best Practices](https://aws.amazon.com/security/security-resources/)
