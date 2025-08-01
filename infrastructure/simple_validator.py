#!/usr/bin/env python3
"""
Simple IAM Policy Validator for Screenshots

USAGE:
    python simple_validator.py [filename] [--profile PROFILE_NAME]
    
    Examples:
    python simple_validator.py                                    # Uses default credentials, validates problematic-policy.json
    python simple_validator.py policy.json                        # Uses default credentials, validates policy.json
    python simple_validator.py policy.json --profile spoke        # Uses 'spoke' profile
"""

import boto3
import json
import sys
import argparse

def validate_policy_file(filename, profile_name=None):
    """Validate a policy file and show results"""
    
    # Load policy
    try:
        with open(filename, 'r') as f:
            policy = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: File '{filename}' not found")
        return
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in '{filename}': {e}")
        return
    
    print(f"📋 Validating Policy: {filename}")
    if profile_name:
        print(f"🔧 Using AWS Profile: {profile_name}")
    else:
        print("🔧 Using default AWS credentials")
    print("=" * 50)
    print(json.dumps(policy, indent=2))
    print()
    
    # Initialize Access Analyzer
    try:
        if profile_name:
            session = boto3.Session(profile_name=profile_name)
        else:
            session = boto3.Session()
        
        # Test connection and show identity
        sts_client = session.client('sts', region_name='us-east-1')
        identity = sts_client.get_caller_identity()
        print(f"🔐 Connected as: {identity.get('Arn', 'Unknown')}")
        print()
        
        client = session.client('accessanalyzer', region_name='us-east-1')
        
    except Exception as e:
        print(f"❌ AWS Connection Error: {e}")
        print("💡 Try: aws configure --profile <profile-name> or set AWS environment variables")
        return
    
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
                learn_more = finding.get('learnMoreLink', '')
                
                emoji = "🚨" if severity == 'ERROR' else "⚠️"
                print(f"{emoji} Finding #{i}: {severity}")
                print(f"   Issue: {issue_code}")
                print(f"   Details: {details}")
                if learn_more:
                    print(f"   Learn More: {learn_more}")
                print()
                
    except Exception as e:
        print(f"❌ Validation Error: {e}")
        if "AccessDenied" in str(e):
            print("💡 Ensure your AWS user/role has 'access-analyzer:ValidatePolicy' permission")

def main():
    parser = argparse.ArgumentParser(description='Simple IAM Policy Validator')
    parser.add_argument('filename', nargs='?', default='problematic-policy.json',
                       help='Policy JSON file to validate (default: problematic-policy.json)')
    parser.add_argument('--profile', help='AWS profile name to use')
    
    args = parser.parse_args()
    
    print("🔍 IAM Policy Validator")
    print("Testing policy...")
    print()
    
    validate_policy_file(args.filename, args.profile)

if __name__ == "__main__":
    main()