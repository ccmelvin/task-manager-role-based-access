# Security Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to security incidents in the Task Management System. It covers incident classification, immediate response actions, investigation procedures, and recovery steps.

## Incident Classification

### Severity Levels

#### Critical (P0)

- **Definition**: Immediate threat to system security or data integrity
- **Examples**: Active data breach, system compromise, privilege escalation
- **Response Time**: Immediate (within 15 minutes)
- **Escalation**: CISO, CTO, Legal team

#### High (P1)

- **Definition**: Significant security risk requiring urgent attention
- **Examples**: Suspicious authentication patterns, potential data exposure
- **Response Time**: Within 1 hour
- **Escalation**: Security team lead, Engineering manager

#### Medium (P2)

- **Definition**: Security concern requiring investigation
- **Examples**: Failed security controls, policy violations
- **Response Time**: Within 4 hours
- **Escalation**: Security team member

#### Low (P3)

- **Definition**: Minor security issue or informational alert
- **Examples**: Configuration drift, routine security events
- **Response Time**: Within 24 hours
- **Escalation**: Assigned security engineer

### Incident Types

1. **Authentication Incidents**

   - Brute force attacks
   - Credential stuffing
   - Account takeover attempts
   - Suspicious login patterns

2. **Authorization Incidents**

   - Privilege escalation attempts
   - Unauthorized resource access
   - Role manipulation
   - Permission bypass attempts

3. **Data Security Incidents**

   - Data exfiltration attempts
   - Unauthorized data access
   - Data integrity violations
   - Encryption failures

4. **Infrastructure Incidents**

   - Network intrusion attempts
   - Malware detection
   - DDoS attacks
   - Configuration tampering

5. **Application Security Incidents**
   - Injection attacks
   - Cross-site scripting (XSS)
   - Cross-site request forgery (CSRF)
   - Input validation bypass

## Immediate Response Procedures

### 1. Incident Detection and Alerting

#### Automated Detection Sources

- CloudWatch alarms
- Security event logs
- AWS GuardDuty findings
- Application monitoring alerts

#### Manual Detection Sources

- User reports
- Security team observations
- Third-party security notifications
- Audit findings

#### Initial Response Checklist

```
□ Acknowledge the incident alert
□ Assign incident commander
□ Create incident tracking ticket
□ Notify stakeholders based on severity
□ Begin evidence collection
□ Document all actions taken
```

### 2. Containment Procedures

#### Authentication Incidents

```bash
# Disable compromised user account
aws cognito-idp admin-disable-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username COMPROMISED_USERNAME

# Revoke all active sessions
aws cognito-idp admin-user-global-sign-out \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username COMPROMISED_USERNAME

# Block IP address if identified
aws wafv2 update-ip-set \
  --scope CLOUDFRONT \
  --id IP_SET_ID \
  --addresses MALICIOUS_IP/32
```

#### Authorization Incidents

```bash
# Remove user from all groups
aws cognito-idp admin-remove-user-from-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username COMPROMISED_USERNAME \
  --group-name GROUP_NAME

# Audit and revoke elevated permissions
aws iam detach-user-policy \
  --user-name COMPROMISED_USER \
  --policy-arn POLICY_ARN
```

#### Data Security Incidents

```bash
# Enable additional logging
aws logs put-retention-policy \
  --log-group-name /taskmanager/security \
  --retention-in-days 90

# Create point-in-time backup
aws dynamodb create-backup \
  --table-name TaskManagerTable-prod \
  --backup-name incident-backup-$(date +%Y%m%d-%H%M%S)
```

#### Infrastructure Incidents

```bash
# Isolate affected Lambda functions
aws lambda put-function-concurrency \
  --function-name AFFECTED_FUNCTION \
  --reserved-concurrent-executions 0

# Update security groups to block traffic
aws ec2 revoke-security-group-ingress \
  --group-id sg-XXXXXXXXX \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

### 3. Evidence Collection

#### Log Collection Commands

```bash
# Collect CloudTrail logs
aws logs filter-log-events \
  --log-group-name CloudTrail/TaskManagerSecurityTrail \
  --start-time $(date -d '24 hours ago' +%s)000 \
  --end-time $(date +%s)000 \
  --output json > evidence/cloudtrail-$(date +%Y%m%d).json

# Collect security event logs
aws logs filter-log-events \
  --log-group-name /taskmanager/security \
  --start-time $(date -d '24 hours ago' +%s)000 \
  --end-time $(date +%s)000 \
  --output json > evidence/security-events-$(date +%Y%m%d).json

# Collect Lambda function logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/TaskManagerFunction \
  --start-time $(date -d '24 hours ago' +%s)000 \
  --end-time $(date +%s)000 \
  --output json > evidence/lambda-logs-$(date +%Y%m%d).json

# Collect API Gateway access logs
aws logs filter-log-events \
  --log-group-name API-Gateway-Execution-Logs_XXXXXXXXX/prod \
  --start-time $(date -d '24 hours ago' +%s)000 \
  --end-time $(date +%s)000 \
  --output json > evidence/api-gateway-$(date +%Y%m%d).json
```

#### System State Capture

```bash
# Capture current IAM policies
aws iam list-policies --scope Local > evidence/iam-policies-$(date +%Y%m%d).json

# Capture Cognito configuration
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_XXXXXXXXX > evidence/cognito-config-$(date +%Y%m%d).json

# Capture DynamoDB table configuration
aws dynamodb describe-table \
  --table-name TaskManagerTable-prod > evidence/dynamodb-config-$(date +%Y%m%d).json

# Capture Lambda function configurations
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `TaskManager`)]' > evidence/lambda-config-$(date +%Y%m%d).json
```

## Investigation Procedures

### 1. Timeline Reconstruction

#### Log Analysis Workflow

```bash
# Create investigation workspace
mkdir -p investigation/$(date +%Y%m%d)
cd investigation/$(date +%Y%m%d)

# Merge and sort all logs by timestamp
jq -s 'map(.events[]) | sort_by(.timestamp)' \
  ../../evidence/*-$(date +%Y%m%d).json > merged-timeline.json

# Extract relevant events
jq '.[] | select(.message | contains("SECURITY") or contains("ERROR") or contains("FAILED"))' \
  merged-timeline.json > security-events.json
```

#### Pattern Analysis

```bash
# Analyze authentication patterns
jq '.[] | select(.eventName == "AdminInitiateAuth" or .eventName == "RespondToAuthChallenge")' \
  security-events.json | jq -s 'group_by(.sourceIPAddress) | map({ip: .[0].sourceIPAddress, count: length, events: .})'

# Analyze authorization patterns
jq '.[] | select(.eventName | contains("Authorization"))' \
  security-events.json | jq -s 'group_by(.userIdentity.userName) | map({user: .[0].userIdentity.userName, count: length})'

# Analyze data access patterns
jq '.[] | select(.eventName | contains("Query") or contains("Scan") or contains("GetItem"))' \
  security-events.json | jq -s 'group_by(.userIdentity.userName) | map({user: .[0].userIdentity.userName, resources: [.[].resources[].ARN] | unique})'
```

### 2. Impact Assessment

#### Data Impact Analysis

```bash
# Check for data exfiltration
jq '.[] | select(.eventName == "Query" or .eventName == "Scan") |
  {timestamp: .eventTime, user: .userIdentity.userName, table: .resources[].ARN, responseSize: .responseElements.count}' \
  security-events.json > data-access-analysis.json

# Identify unusual data access patterns
jq 'group_by(.user) | map({user: .[0].user, total_records: [.[].responseSize] | add, access_count: length})' \
  data-access-analysis.json
```

#### System Impact Analysis

```bash
# Check for configuration changes
jq '.[] | select(.eventName | contains("Put") or contains("Update") or contains("Create") or contains("Delete"))' \
  security-events.json > configuration-changes.json

# Analyze privilege changes
jq '.[] | select(.eventName | contains("Policy") or contains("Role") or contains("Group"))' \
  security-events.json > privilege-changes.json
```

### 3. Root Cause Analysis

#### Common Attack Vectors Checklist

```
□ Credential compromise (check for password spraying, brute force)
□ Session hijacking (check for unusual session patterns)
□ Privilege escalation (check for role/permission changes)
□ Injection attacks (check input validation logs)
□ Cross-site attacks (check CORS and referrer headers)
□ Infrastructure compromise (check for unusual API calls)
□ Social engineering (check for unusual user behavior)
□ Supply chain attack (check for dependency vulnerabilities)
```

#### Technical Analysis Commands

```bash
# Analyze failed authentication attempts
jq '.[] | select(.errorCode == "NotAuthorizedException" or .errorCode == "UserNotFoundException")' \
  security-events.json | jq -s 'group_by(.sourceIPAddress) | map({ip: .[0].sourceIPAddress, failures: length})'

# Check for privilege escalation attempts
jq '.[] | select(.eventName | contains("AttachUserPolicy") or contains("PutUserPolicy") or contains("AddUserToGroup"))' \
  security-events.json

# Analyze input validation failures
jq '.[] | select(.level == "ERROR" and (.message | contains("validation") or contains("sanitization")))' \
  security-events.json
```

## Recovery Procedures

### 1. System Recovery

#### Authentication System Recovery

```bash
# Reset compromised user passwords
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username COMPROMISED_USERNAME \
  --password TEMPORARY_PASSWORD \
  --permanent

# Re-enable user account after verification
aws cognito-idp admin-enable-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username VERIFIED_USERNAME

# Force password reset on next login
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username USERNAME \
  --password TEMPORARY_PASSWORD
```

#### Authorization System Recovery

```bash
# Restore proper role assignments
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username USERNAME \
  --group-name APPROPRIATE_GROUP

# Audit and restore IAM policies
aws iam attach-user-policy \
  --user-name USERNAME \
  --policy-arn APPROPRIATE_POLICY_ARN
```

#### Data Recovery

```bash
# Restore from backup if data integrity compromised
aws dynamodb restore-table-from-backup \
  --target-table-name TaskManagerTable-prod-restored \
  --backup-arn BACKUP_ARN

# Verify data integrity
aws dynamodb scan --table-name TaskManagerTable-prod-restored --select COUNT
```

#### Infrastructure Recovery

```bash
# Restore Lambda function concurrency
aws lambda delete-function-concurrency \
  --function-name AFFECTED_FUNCTION

# Restore security group rules
aws ec2 authorize-security-group-ingress \
  --group-id sg-XXXXXXXXX \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Remove IP blocks after verification
aws wafv2 update-ip-set \
  --scope CLOUDFRONT \
  --id IP_SET_ID \
  --addresses []
```

### 2. Security Hardening

#### Immediate Hardening Steps

```bash
# Rotate all secrets
aws secretsmanager update-secret \
  --secret-id taskmanager/api/keys \
  --secret-string '{"jwt_secret": "NEW_JWT_SECRET", "encryption_key": "NEW_ENCRYPTION_KEY"}'

# Update password policies
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_XXXXXXXXX \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 14,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true,
      "TemporaryPasswordValidityDays": 1
    }
  }'

# Enable additional monitoring
aws logs put-metric-filter \
  --log-group-name /taskmanager/security \
  --filter-name SuspiciousActivity \
  --filter-pattern "[timestamp, requestId, level=\"WARN\", event=\"SUSPICIOUS_ACTIVITY\"]" \
  --metric-transformations \
    metricName=SuspiciousActivity,metricNamespace=TaskManager/Security,metricValue=1
```

### 3. Validation and Testing

#### Security Validation Checklist

```
□ Verify all compromised accounts are secured
□ Confirm all unauthorized access is blocked
□ Validate data integrity and completeness
□ Test authentication and authorization flows
□ Verify monitoring and alerting functionality
□ Confirm backup and recovery procedures
□ Update security configurations as needed
□ Document lessons learned and improvements
```

#### Validation Commands

```bash
# Test authentication flow
curl -X POST https://api.yourdomain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test@example.com", "password": "TestPassword123!"}'

# Test authorization with various roles
curl -X GET https://api.yourdomain.com/tasks \
  -H "Authorization: Bearer ADMIN_TOKEN"

curl -X GET https://api.yourdomain.com/tasks \
  -H "Authorization: Bearer VIEWER_TOKEN"

# Test input validation
curl -X POST https://api.yourdomain.com/tasks \
  -H "Authorization: Bearer VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "<script>alert(\"test\")</script>", "description": "test"}'
```

## Communication Procedures

### 1. Internal Communication

#### Incident Commander Responsibilities

- Coordinate response efforts
- Maintain incident timeline
- Communicate with stakeholders
- Make containment decisions
- Authorize recovery actions

#### Communication Templates

**Initial Incident Notification:**

```
Subject: [SECURITY INCIDENT] P{SEVERITY} - {BRIEF_DESCRIPTION}

Incident Details:
- Incident ID: {INCIDENT_ID}
- Severity: P{SEVERITY}
- Detection Time: {TIMESTAMP}
- Affected Systems: {SYSTEMS}
- Initial Assessment: {DESCRIPTION}
- Incident Commander: {NAME}

Current Status:
- Containment: {STATUS}
- Investigation: {STATUS}
- Recovery: {STATUS}

Next Update: {TIMESTAMP}
```

**Status Update:**

```
Subject: [SECURITY INCIDENT] {INCIDENT_ID} - Status Update

Current Status:
- Containment: {STATUS}
- Investigation: {STATUS}
- Recovery: {STATUS}

Recent Actions:
- {ACTION_1}
- {ACTION_2}
- {ACTION_3}

Next Steps:
- {NEXT_STEP_1}
- {NEXT_STEP_2}

Next Update: {TIMESTAMP}
```

### 2. External Communication

#### Customer Communication

- Determine if customer notification is required
- Prepare customer-facing communication
- Coordinate with legal and compliance teams
- Follow regulatory notification requirements

#### Regulatory Communication

- Identify applicable regulations (GDPR, CCPA, etc.)
- Prepare regulatory notifications
- Document compliance with notification timelines
- Maintain evidence for regulatory review

## Post-Incident Activities

### 1. Incident Documentation

#### Incident Report Template

```markdown
# Security Incident Report

## Executive Summary

- Incident ID: {INCIDENT_ID}
- Date/Time: {TIMESTAMP}
- Duration: {DURATION}
- Severity: P{SEVERITY}
- Impact: {IMPACT_SUMMARY}

## Incident Details

- Detection Method: {DETECTION}
- Root Cause: {ROOT_CAUSE}
- Attack Vector: {ATTACK_VECTOR}
- Affected Systems: {SYSTEMS}
- Data Impact: {DATA_IMPACT}

## Response Timeline

- Detection: {TIMESTAMP}
- Containment: {TIMESTAMP}
- Investigation: {TIMESTAMP}
- Recovery: {TIMESTAMP}
- Resolution: {TIMESTAMP}

## Actions Taken

- Immediate Response: {ACTIONS}
- Containment: {ACTIONS}
- Investigation: {ACTIONS}
- Recovery: {ACTIONS}

## Lessons Learned

- What Worked Well: {POSITIVES}
- Areas for Improvement: {IMPROVEMENTS}
- Recommendations: {RECOMMENDATIONS}

## Follow-up Actions

- Security Improvements: {ACTIONS}
- Process Updates: {ACTIONS}
- Training Needs: {ACTIONS}
```

### 2. Lessons Learned Session

#### Session Agenda

1. Incident timeline review
2. Response effectiveness analysis
3. Process improvement identification
4. Technology gap analysis
5. Training need assessment
6. Action item assignment

#### Improvement Tracking

```bash
# Create improvement tracking issue
cat > improvement-tracking.md << EOF
# Security Improvement Tracking

## Incident: {INCIDENT_ID}
## Date: $(date +%Y-%m-%d)

### Identified Improvements
- [ ] {IMPROVEMENT_1} - Owner: {OWNER} - Due: {DATE}
- [ ] {IMPROVEMENT_2} - Owner: {OWNER} - Due: {DATE}
- [ ] {IMPROVEMENT_3} - Owner: {OWNER} - Due: {DATE}

### Process Updates
- [ ] {PROCESS_UPDATE_1} - Owner: {OWNER} - Due: {DATE}
- [ ] {PROCESS_UPDATE_2} - Owner: {OWNER} - Due: {DATE}

### Training Requirements
- [ ] {TRAINING_1} - Owner: {OWNER} - Due: {DATE}
- [ ] {TRAINING_2} - Owner: {OWNER} - Due: {DATE}
EOF
```

### 3. Security Posture Enhancement

#### Post-Incident Security Review

```bash
# Run comprehensive security assessment
npm run security:full-assessment

# Update threat model based on incident
# Review and update security controls
# Enhance monitoring and detection capabilities
# Update incident response procedures
```

## Emergency Contacts

### Internal Contacts

- **Incident Commander**: {NAME} - {PHONE} - {EMAIL}
- **Security Team Lead**: {NAME} - {PHONE} - {EMAIL}
- **Engineering Manager**: {NAME} - {PHONE} - {EMAIL}
- **CISO**: {NAME} - {PHONE} - {EMAIL}
- **CTO**: {NAME} - {PHONE} - {EMAIL}
- **Legal Counsel**: {NAME} - {PHONE} - {EMAIL}

### External Contacts

- **AWS Support**: 1-800-xxx-xxxx (Premium Support)
- **Security Vendor**: {VENDOR} - {PHONE} - {EMAIL}
- **Legal Counsel**: {FIRM} - {PHONE} - {EMAIL}
- **Cyber Insurance**: {COMPANY} - {PHONE} - {POLICY_NUMBER}

### Escalation Matrix

| Severity | Initial Response  | 30 Minutes    | 1 Hour | 4 Hours |
| -------- | ----------------- | ------------- | ------ | ------- |
| P0       | Security Engineer | Security Lead | CISO   | CTO     |
| P1       | Security Engineer | Security Lead | CISO   | -       |
| P2       | Security Engineer | Security Lead | -      | -       |
| P3       | Security Engineer | -             | -      | -       |

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-15  
**Next Review**: 2025-02-15  
**Owner**: Security Team  
**Approved By**: CISO
