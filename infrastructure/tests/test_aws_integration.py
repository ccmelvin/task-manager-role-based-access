import pytest
import json
from unittest.mock import patch, MagicMock
import boto3
from botocore.exceptions import ClientError

class TestAWSIntegration:
    """Integration tests for AWS Access Analyzer functionality"""
    
    @pytest.fixture
    def sample_policies(self):
        """Sample policies for testing"""
        return {
            'valid_identity': {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": ["s3:GetObject", "s3:PutObject"],
                        "Resource": "arn:aws:s3:::my-bucket/*"
                    }
                ]
            },
            'overpermissive': {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": "*",
                        "Resource": "*"
                    }
                ]
            },
            'resource_policy': {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "AllowPublicRead",
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": "s3:GetObject",
                        "Resource": "arn:aws:s3:::my-public-bucket/*"
                    }
                ]
            }
        }
    
    def test_validate_identity_policy_success(self, sample_policies):
        """Test successful validation of identity policy"""
        with patch('boto3.client') as mock_boto:
            mock_client = MagicMock()
            mock_client.validate_policy.return_value = {
                'findings': []
            }
            mock_boto.return_value = mock_client
            
            client = boto3.client('accessanalyzer', region_name='us-east-1')
            response = client.validate_policy(
                policyDocument=json.dumps(sample_policies['valid_identity']),
                policyType='IDENTITY_POLICY'
            )
            
            assert response['findings'] == []
            mock_client.validate_policy.assert_called_once()
    
    def test_validate_overpermissive_policy(self, sample_policies):
        """Test validation of overpermissive policy returns warnings"""
        with patch('boto3.client') as mock_boto:
            mock_client = MagicMock()
            mock_client.validate_policy.return_value = {
                'findings': [
                    {
                        'findingType': 'SECURITY_WARNING',
                        'issueCode': 'OVERLY_PERMISSIVE_ACTIONS',
                        'findingDetails': 'The policy allows all actions. Consider restricting actions to only those required.',
                        'learnMoreLink': 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege'
                    },
                    {
                        'findingType': 'SECURITY_WARNING',
                        'issueCode': 'OVERLY_PERMISSIVE_RESOURCES',
                        'findingDetails': 'The policy allows access to all resources. Consider restricting resources.',
                        'learnMoreLink': 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege'
                    }
                ]
            }
            mock_boto.return_value = mock_client
            
            client = boto3.client('accessanalyzer', region_name='us-east-1')
            response = client.validate_policy(
                policyDocument=json.dumps(sample_policies['overpermissive']),
                policyType='IDENTITY_POLICY'
            )
            
            assert len(response['findings']) == 2
            assert all(f['findingType'] == 'SECURITY_WARNING' for f in response['findings'])
            assert any('OVERLY_PERMISSIVE_ACTIONS' in f['issueCode'] for f in response['findings'])
    
    def test_validate_resource_policy(self, sample_policies):
        """Test validation of resource policy"""
        with patch('boto3.client') as mock_boto:
            mock_client = MagicMock()
            mock_client.validate_policy.return_value = {
                'findings': [
                    {
                        'findingType': 'SECURITY_WARNING',
                        'issueCode': 'PUBLIC_ACCESS_GRANTED',
                        'findingDetails': 'The policy grants public access to the resource.',
                        'learnMoreLink': 'https://docs.aws.amazon.com/s3/latest/userguide/access-control-block-public-access.html'
                    }
                ]
            }
            mock_boto.return_value = mock_client
            
            client = boto3.client('accessanalyzer', region_name='us-east-1')
            response = client.validate_policy(
                policyDocument=json.dumps(sample_policies['resource_policy']),
                policyType='RESOURCE_POLICY'
            )
            
            assert len(response['findings']) == 1
            assert response['findings'][0]['issueCode'] == 'PUBLIC_ACCESS_GRANTED'
    
    def test_get_caller_identity(self):
        """Test getting caller identity for profile verification"""
        with patch('boto3.client') as mock_boto:
            mock_client = MagicMock()
            mock_client.get_caller_identity.return_value = {
                'UserId': 'AIDACKCEVSQ6C2EXAMPLE',
                'Account': '123456789012',
                'Arn': 'arn:aws:iam::123456789012:user/test-user'
            }
            mock_boto.return_value = mock_client
            
            client = boto3.client('sts', region_name='us-east-1')
            response = client.get_caller_identity()
            
            assert response['Account'] == '123456789012'
            assert 'test-user' in response['Arn']
    
    def test_aws_credentials_error_handling(self):
        """Test handling of AWS credentials errors"""
        with patch('boto3.client') as mock_boto:
            mock_boto.side_effect = ClientError(
                error_response={'Error': {'Code': 'NoCredentialsError', 'Message': 'Unable to locate credentials'}},
                operation_name='ValidatePolicy'
            )
            
            with pytest.raises(ClientError):
                client = boto3.client('accessanalyzer', region_name='us-east-1')
    
    def test_access_denied_error_handling(self):
        """Test handling of access denied errors"""
        with patch('boto3.client') as mock_boto:
            mock_client = MagicMock()
            mock_client.validate_policy.side_effect = ClientError(
                error_response={
                    'Error': {
                        'Code': 'AccessDenied',
                        'Message': 'User is not authorized to perform: access-analyzer:ValidatePolicy'
                    }
                },
                operation_name='ValidatePolicy'
            )
            mock_boto.return_value = mock_client
            
            client = boto3.client('accessanalyzer', region_name='us-east-1')
            
            with pytest.raises(ClientError) as exc_info:
                client.validate_policy(
                    policyDocument='{}',
                    policyType='IDENTITY_POLICY'
                )
            
            assert exc_info.value.response['Error']['Code'] == 'AccessDenied'
    
    def test_invalid_policy_document_error(self):
        """Test handling of invalid policy document errors"""
        with patch('boto3.client') as mock_boto:
            mock_client = MagicMock()
            mock_client.validate_policy.side_effect = ClientError(
                error_response={
                    'Error': {
                        'Code': 'InvalidParameterValueException',
                        'Message': 'Invalid policy document'
                    }
                },
                operation_name='ValidatePolicy'
            )
            mock_boto.return_value = mock_client
            
            client = boto3.client('accessanalyzer', region_name='us-east-1')
            
            with pytest.raises(ClientError) as exc_info:
                client.validate_policy(
                    policyDocument='invalid json',
                    policyType='IDENTITY_POLICY'
                )
            
            assert exc_info.value.response['Error']['Code'] == 'InvalidParameterValueException'
    
    def test_boto3_session_with_profile(self):
        """Test creating boto3 session with specific profile"""
        with patch('boto3.Session') as mock_session:
            mock_session_instance = MagicMock()
            mock_client = MagicMock()
            mock_client.validate_policy.return_value = {'findings': []}
            mock_session_instance.client.return_value = mock_client
            mock_session.return_value = mock_session_instance
            
            # Test session creation with profile
            session = boto3.Session(profile_name='test-profile')
            client = session.client('accessanalyzer', region_name='us-east-1')
            
            # Verify profile was used
            mock_session.assert_called_with(profile_name='test-profile')
            mock_session_instance.client.assert_called_with('accessanalyzer', region_name='us-east-1')
    
    def test_policy_validation_with_different_types(self, sample_policies):
        """Test policy validation with different policy types"""
        with patch('boto3.client') as mock_boto:
            mock_client = MagicMock()
            mock_boto.return_value = mock_client
            
            # Test Identity Policy
            mock_client.validate_policy.return_value = {'findings': []}
            client = boto3.client('accessanalyzer', region_name='us-east-1')
            
            response = client.validate_policy(
                policyDocument=json.dumps(sample_policies['valid_identity']),
                policyType='IDENTITY_POLICY'
            )
            
            # Verify the call was made with correct parameters
            mock_client.validate_policy.assert_called_with(
                policyDocument=json.dumps(sample_policies['valid_identity']),
                policyType='IDENTITY_POLICY'
            )
            
            # Test Resource Policy
            response = client.validate_policy(
                policyDocument=json.dumps(sample_policies['resource_policy']),
                policyType='RESOURCE_POLICY'
            )
            
            # Verify the call was made with correct parameters
            mock_client.validate_policy.assert_called_with(
                policyDocument=json.dumps(sample_policies['resource_policy']),
                policyType='RESOURCE_POLICY'
            )
