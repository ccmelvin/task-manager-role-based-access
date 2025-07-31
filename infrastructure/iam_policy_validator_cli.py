#!/usr/bin/env python3
"""
IAM Policy Validator CLI
Command-line version for CI/CD integration
"""

import argparse
import json
import sys
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

class IAMPolicyValidatorCLI:
    def __init__(self, profile='spoke', region='us-east-1'):
        try:
            self.session = boto3.Session(profile_name=profile)
            self.access_analyzer = self.session.client('accessanalyzer', region_name=region)
        except Exception as e:
            print(f"❌ Failed to initialize AWS client: {str(e)}")
            sys.exit(1)
    
    def validate_policy(self, policy_json, policy_type='IDENTITY_POLICY'):
        """Validate a single policy"""
        try:
            response = self.access_analyzer.validate_policy(
                policyDocument=policy_json,
                policyType=policy_type
            )
            return response.get('findings', [])
        except ClientError as e:
            print(f"❌ AWS API Error: {e.response['Error']['Message']}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}")
            return None
    
    def extract_policies_from_template(self, template_path):
        """Extract IAM policies from CloudFormation template"""
        try:
            with open(template_path, 'r') as f:
                template = json.load(f)
            
            policies = []
            resources = template.get('Resources', {})
            
            for resource_name, resource in resources.items():
                resource_type = resource.get('Type', '')
                
                # Extract from IAM roles
                if resource_type == 'AWS::IAM::Role':
                    properties = resource.get('Properties', {})
                    
                    # Inline policies
                    for policy in properties.get('Policies', []):
                        policy_doc = policy.get('PolicyDocument')
                        if policy_doc:
                            policies.append({
                                'name': f"{resource_name}-{policy.get('PolicyName', 'inline')}",
                                'document': json.dumps(policy_doc),
                                'type': 'IDENTITY_POLICY'
                            })
                    
                    # Assume role policy
                    assume_role_policy = properties.get('AssumeRolePolicyDocument')
                    if assume_role_policy:
                        policies.append({
                            'name': f"{resource_name}-AssumeRolePolicy",
                            'document': json.dumps(assume_role_policy),
                            'type': 'IDENTITY_POLICY'
                        })
                
                # Extract from IAM policies
                elif resource_type == 'AWS::IAM::Policy':
                    properties = resource.get('Properties', {})
                    policy_doc = properties.get('PolicyDocument')
                    if policy_doc:
                        policies.append({
                            'name': f"{resource_name}",
                            'document': json.dumps(policy_doc),
                            'type': 'IDENTITY_POLICY'
                        })
                
                # Extract from S3 bucket policies
                elif resource_type == 'AWS::S3::BucketPolicy':
                    properties = resource.get('Properties', {})
                    policy_doc = properties.get('PolicyDocument')
                    if policy_doc:
                        policies.append({
                            'name': f"{resource_name}",
                            'document': json.dumps(policy_doc),
                            'type': 'RESOURCE_POLICY'
                        })
            
            return policies
        except Exception as e:
            print(f"❌ Failed to extract policies from template: {str(e)}")
            return []
    
    def format_findings(self, findings, policy_name):
        """Format validation findings for display"""
        if not findings:
            return f"✅ {policy_name}: No issues found"
        
        output = [f"⚠️  {policy_name}: {len(findings)} issues found"]
        
        for i, finding in enumerate(findings, 1):
            finding_type = finding.get('findingType', 'UNKNOWN')
            issue_code = finding.get('issueCode', 'UNKNOWN')
            details = finding.get('findingDetails', 'No details available')
            
            # Add severity emoji
            emoji = "🚨" if finding_type == 'ERROR' else "⚠️"
            
            output.append(f"  {emoji} Finding #{i}: {finding_type}")
            output.append(f"     Issue: {issue_code}")
            output.append(f"     Details: {details}")
        
        return "\n".join(output)

def main():
    parser = argparse.ArgumentParser(description='Validate IAM policies using AWS Access Analyzer')
    parser.add_argument('--file', '-f', help='JSON file containing policy or CloudFormation template')
    parser.add_argument('--policy', '-p', help='Policy JSON string')
    parser.add_argument('--type', '-t', choices=['IDENTITY_POLICY', 'RESOURCE_POLICY'], 
                       default='IDENTITY_POLICY', help='Policy type')
    parser.add_argument('--template', action='store_true', 
                       help='Treat input file as CloudFormation template and extract policies')
    parser.add_argument('--profile', default='spoke', help='AWS profile to use')
    parser.add_argument('--region', default='us-east-1', help='AWS region')
    parser.add_argument('--fail-on-findings', action='store_true', 
                       help='Exit with non-zero code if findings are found')
    
    args = parser.parse_args()
    
    if not args.file and not args.policy:
        parser.error("Either --file or --policy must be specified")
    
    validator = IAMPolicyValidatorCLI(profile=args.profile, region=args.region)
    
    total_findings = 0
    
    if args.template and args.file:
        # Extract and validate policies from CloudFormation template
        policies = validator.extract_policies_from_template(args.file)
        
        if not policies:
            print("❌ No IAM policies found in template")
            sys.exit(1)
        
        print(f"📋 Found {len(policies)} policies to validate\n")
        
        for policy in policies:
            findings = validator.validate_policy(policy['document'], policy['type'])
            if findings is not None:
                print(validator.format_findings(findings, policy['name']))
                total_findings += len(findings)
                print()
    
    else:
        # Validate single policy
        if args.file:
            try:
                with open(args.file, 'r') as f:
                    policy_json = f.read()
            except Exception as e:
                print(f"❌ Failed to read file: {str(e)}")
                sys.exit(1)
        else:
            policy_json = args.policy
        
        # Validate JSON format
        try:
            json.loads(policy_json)
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON format: {str(e)}")
            sys.exit(1)
        
        findings = validator.validate_policy(policy_json, args.type)
        if findings is not None:
            print(validator.format_findings(findings, "Policy"))
            total_findings = len(findings)
    
    # Summary
    if total_findings == 0:
        print("🎉 All policies validated successfully!")
        sys.exit(0)
    else:
        print(f"\n📊 Summary: {total_findings} total findings across all policies")
        if args.fail_on_findings:
            sys.exit(1)
        else:
            sys.exit(0)

if __name__ == "__main__":
    main()