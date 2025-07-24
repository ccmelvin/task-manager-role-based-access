# Policy Validation Examples: Common Issues and Solutions

## Overview
This document shows real-world IAM policy issues discovered during task manager development and how Amazon Q Developer helps fix them.

## Common Policy Issues Found by Access Analyzer

### Issue 1: Overly Broad Resource Access

#### ❌ Problematic Policy (Initial Q Generation)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": "*"
    }
  ]
}
```

#### 🔍 Access Analyzer Finding
```
SECURITY_WARNING: Policy allows access to all DynamoDB resources
Severity: HIGH
Suggestion: Restrict resource to specific table ARNs
```

#### ✅ Fixed Policy (After Q Refinement)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/TasksTable",
        "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/TasksTable/index/*"
      ]
    }
  ]
}
```

### Issue 2: Unnecessary S3 Permissions

#### ❌ Problematic Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:*"
      ],
      "Resource": [
        "arn:aws:s3:::task-attachments-bucket",
        "arn:aws:s3:::task-attachments-bucket/*"
      ]
    }
  ]
}
```

#### 🔍 Access Analyzer Finding
```
SECURITY_WARNING: Policy grants excessive S3 permissions
Severity: MEDIUM
Actions like s3:DeleteBucket, s3:PutBucketPolicy are unnecessary
```

#### ✅ Fixed Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::task-attachments-bucket/tasks/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::task-attachments-bucket",
      "Condition": {
        "StringLike": {
          "s3:prefix": "tasks/*"
        }
      }
    }
  ]
}
```

### Issue 3: Missing Resource Conditions

#### ❌ Problematic Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminGetUser",
        "cognito-idp:ListUsers"
      ],
      "Resource": "*"
    }
  ]
}
```

#### 🔍 Access Analyzer Finding
```
SECURITY_WARNING: Cognito permissions too broad
Severity: HIGH
Should be restricted to specific User Pool
```

#### ✅ Fixed Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminGetUser"
      ],
      "Resource": "arn:aws:cognito-idp:${AWS::Region}:${AWS::AccountId}:userpool/${UserPoolId}"
    }
  ]
}
```

## Role-Specific Policy Examples

### Admin Role Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/TasksTable",
        "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/UserProfilesTable"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::task-attachments-bucket/*"
    }
  ]
}
```

### Contributor Role Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/TasksTable",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "taskId",
            "title",
            "description",
            "status",
            "assignedTo",
            "createdBy",
            "deadline",
            "priority"
          ]
        },
        "StringEquals": {
          "dynamodb:LeadingKeys": ["${cognito-identity.amazonaws.com:sub}"]
        }
      }
    }
  ]
}
```

### Viewer Role Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/TasksTable",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "taskId",
            "title",
            "description",
            "status",
            "deadline",
            "priority"
          ]
        },
        "StringEquals": {
          "dynamodb:Select": "SpecificAttributes"
        }
      }
    }
  ]
}
```

## Policy Validation Workflow

### Step 1: Extract Policies from CDK
```bash
# Generate CloudFormation template
cdk synth > template.json

# Extract IAM policies (using jq)
jq '.Resources | to_entries[] | select(.value.Type == "AWS::IAM::Role") | .value.Properties.Policies' template.json
```

### Step 2: Validate with Access Analyzer
```python
import boto3
import json

def validate_policy(policy_document):
    client = boto3.client('accessanalyzer')
    
    response = client.validate_policy(
        policyDocument=json.dumps(policy_document),
        policyType='IDENTITY_POLICY'
    )
    
    return response['findings']
```

### Step 3: Common Validation Results
```json
{
  "findings": [
    {
      "findingType": "SECURITY_WARNING",
      "issueCode": "PASS_ROLE_WITH_STAR_IN_RESOURCE",
      "learnMoreLink": "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_resource.html",
      "locations": [
        {
          "path": [
            {
              "key": "Statement",
              "index": 0
            },
            {
              "key": "Resource"
            }
          ],
          "span": {
            "start": {
              "line": 8,
              "column": 20
            },
            "end": {
              "line": 8,
              "column": 23
            }
          }
        }
      ]
    }
  ]
}
```

---

*Next: I'll create the actual Q prompts with expected responses for each tutorial step.*
