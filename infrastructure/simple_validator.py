#!/usr/bin/env python3
"""
Simple IAM Policy Validator for Screenshots
"""

import boto3
import json

def validate_policy_file(filename):
    """Validate a policy file and show results"""
    
    # Load policy
    with open(filename, 'r') as f:
        policy = json.load(f)
    
    print(f"📋 Validating Policy: {filename}")
    print("=" * 50)
    print(json.dumps(policy, indent=2))
    print()
    
    # Initialize Access Analyzer
    session = boto3.Session(profile_name='spoke')
    client = session.client('accessanalyzer', region_name='us-east-1')
    
    # Validate
    try:
        response = client.validate_policy(
            policyDocument=json.dumps(policy),
            policyType='IDENTITY_POLICY'
        )
        
        findings = response.get('findings', [])
        
        if not findings:
            print("✅ VALIDATION PASSED")
            print("No security issues found!")
        else:
            print(f"⚠️  VALIDATION FINDINGS ({len(findings)} issues)")
            print()
            
            for i, finding in enumerate(findings, 1):
                issue_code = finding.get('issueCode', 'Unknown')
                details = finding.get('findingDetails', 'No details')
                severity = finding.get('findingType', 'Unknown')
                
                emoji = "🚨" if severity == 'ERROR' else "⚠️"
                print(f"{emoji} Finding #{i}: {severity}")
                print(f"   Issue: {issue_code}")
                print(f"   Details: {details}")
                print()
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🔍 IAM Policy Validator")
    print("Testing problematic policy...")
    print()
    
    validate_policy_file('problematic-policy.json')