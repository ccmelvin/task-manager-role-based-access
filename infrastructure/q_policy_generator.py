#!/usr/bin/env python3
"""
Amazon Q + IAM Access Analyzer Integration
Demonstrates using Q to generate, validate, and remediate IAM policies
"""

import boto3
import json
import sys

class QPolicyValidator:
    def __init__(self, region='us-east-1'):
        self.access_analyzer = boto3.client('accessanalyzer', region_name=region)
    
    def validate_policy(self, policy_document, policy_type='IDENTITY_POLICY'):
        """Validate policy using Access Analyzer API"""
        try:
            response = self.access_analyzer.validate_policy(
                policyDocument=policy_document,
                policyType=policy_type
            )
            return response.get('findings', [])
        except Exception as e:
            print(f"❌ Validation failed: {e}")
            return None
    
    def generate_remediation_prompt(self, policy, findings):
        """Generate Amazon Q prompt for policy remediation"""
        issues = []
        for finding in findings:
            issues.append(f"- {finding.get('issueCode', 'Unknown')}: {finding.get('findingDetails', 'No details')}")
        
        prompt = f"""Fix this IAM policy to address the following security issues:

CURRENT POLICY:
{json.dumps(policy, indent=2)}

ISSUES FOUND:
{chr(10).join(issues)}

Please provide a corrected policy that follows least privilege principles and addresses all the identified issues."""
        
        return prompt

# Example: Q-generated problematic policy
problematic_policy = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "*",
            "Resource": "*"
        }
    ]
}

# Example: Q-remediated policy (what Q would suggest)
remediated_policy = {
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
            "Resource": "arn:aws:s3:::task-attachments-bucket/*"
        }
    ]
}

def main():
    validator = QPolicyValidator()
    
    print("🤖 Amazon Q + IAM Access Analyzer Demo")
    print("=" * 50)
    
    # Step 1: Validate problematic policy
    print("\n1️⃣ Validating Q-generated policy...")
    policy_json = json.dumps(problematic_policy)
    findings = validator.validate_policy(policy_json)
    
    if findings:
        print(f"⚠️  Found {len(findings)} security issues:")
        for i, finding in enumerate(findings, 1):
            print(f"   {i}. {finding.get('issueCode')}: {finding.get('findingDetails')}")
        
        # Step 2: Generate Q remediation prompt
        print("\n2️⃣ Amazon Q Remediation Prompt:")
        print("-" * 30)
        prompt = validator.generate_remediation_prompt(problematic_policy, findings)
        print(prompt)
        
        # Step 3: Validate remediated policy
        print("\n3️⃣ Validating Q-remediated policy...")
        remediated_json = json.dumps(remediated_policy)
        remediated_findings = validator.validate_policy(remediated_json)
        
        if not remediated_findings:
            print("✅ Remediated policy passes validation!")
        else:
            print(f"⚠️  Still has {len(remediated_findings)} issues")
    
    else:
        print("✅ Policy is valid!")

if __name__ == "__main__":
    main()