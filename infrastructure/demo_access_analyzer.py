#!/usr/bin/env python3
"""
Demo: Amazon Q + Access Analyzer API Integration
Shows the complete workflow from Q generation to validation to remediation
"""

import boto3
import json

def demo_access_analyzer_workflow():
    """Demonstrate the complete Q + Access Analyzer workflow"""
    
    # Initialize Access Analyzer client with SSO profile
    session = boto3.Session(profile_name='your-profile')
    client = session.client('accessanalyzer', region_name='us-east-1')
    
    print("🤖 Amazon Q + IAM Access Analyzer Demo")
    print("=" * 50)
    
    # Step 1: Q-generated problematic policy
    print("\n1️⃣ Amazon Q Generated Policy (Initial):")
    print("Prompt: 'Create IAM policy for Lambda accessing DynamoDB and S3'")
    
    q_generated_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "*",
                "Resource": "*"
            }
        ]
    }
    
    print(json.dumps(q_generated_policy, indent=2))
    
    # Step 2: Validate with Access Analyzer
    print("\n2️⃣ Access Analyzer Validation:")
    try:
        response = client.validate_policy(
            policyDocument=json.dumps(q_generated_policy),
            policyType='IDENTITY_POLICY'
        )
        
        findings = response.get('findings', [])
        
        if findings:
            print(f"⚠️  Found {len(findings)} security issues:")
            for i, finding in enumerate(findings, 1):
                issue_code = finding.get('issueCode', 'Unknown')
                details = finding.get('findingDetails', 'No details')
                severity = finding.get('findingType', 'Unknown')
                
                emoji = "🚨" if severity == 'ERROR' else "⚠️"
                print(f"   {emoji} Issue #{i}: {issue_code}")
                print(f"      Details: {details}")
                print(f"      Severity: {severity}")
        else:
            print("✅ No issues found")
            
    except Exception as e:
        print(f"❌ API Error: {e}")
        return
    
    # Step 3: Generate Q remediation prompt
    print("\n3️⃣ Amazon Q Remediation Prompt:")
    print("-" * 40)
    
    remediation_prompt = f"""Fix this IAM policy to address security issues:

POLICY:
{json.dumps(q_generated_policy, indent=2)}

ISSUES:
{chr(10).join([f"- {f.get('issueCode')}: {f.get('findingDetails')}" for f in findings])}

Provide a secure policy following least privilege."""
    
    print(remediation_prompt)
    
    # Step 4: Q-remediated policy
    print("\n4️⃣ Amazon Q Remediated Policy:")
    
    q_remediated_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem", 
                    "dynamodb:DeleteItem",
                    "dynamodb:Query"
                ],
                "Resource": [
                    "arn:aws:dynamodb:us-east-1:*:table/TasksTable",
                    "arn:aws:dynamodb:us-east-1:*:table/UserProfilesTable"
                ]
            },
            {
                "Effect": "Allow",
                "Action": [
                    "s3:GetObject",
                    "s3:PutObject"
                ],
                "Resource": "arn:aws:s3:::task-attachments/*"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                "Resource": "arn:aws:logs:us-east-1:*:log-group:/aws/lambda/*"
            }
        ]
    }
    
    print(json.dumps(q_remediated_policy, indent=2))
    
    # Step 5: Validate remediated policy
    print("\n5️⃣ Validating Remediated Policy:")
    try:
        remediated_response = client.validate_policy(
            policyDocument=json.dumps(q_remediated_policy),
            policyType='IDENTITY_POLICY'
        )
        
        remediated_findings = remediated_response.get('findings', [])
        
        if not remediated_findings:
            print("✅ Remediated policy passes all security checks!")
            print("🎉 Ready for deployment")
        else:
            print(f"⚠️  Still has {len(remediated_findings)} issues:")
            for finding in remediated_findings:
                print(f"   - {finding.get('issueCode')}")
                
    except Exception as e:
        print(f"❌ Validation error: {e}")
    
    # Step 6: Show API usage
    print("\n6️⃣ Access Analyzer API Usage:")
    print("-" * 30)
    
    api_example = '''
# Key API calls used:
import boto3

client = boto3.client('accessanalyzer')

# Validate policy
response = client.validate_policy(
    policyDocument=policy_json,
    policyType='IDENTITY_POLICY'
)

# Process findings
findings = response.get('findings', [])
for finding in findings:
    print(f"Issue: {finding['issueCode']}")
    print(f"Details: {finding['findingDetails']}")
    print(f"Severity: {finding['findingType']}")
'''
    
    print(api_example)

if __name__ == "__main__":
    demo_access_analyzer_workflow()