import pytest
import os
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

@pytest.fixture(scope="session")
def test_data_dir():
    """Get the test data directory"""
    return Path(__file__).parent / "fixtures"

@pytest.fixture(scope="session")
def sample_policies():
    """Sample IAM policies for testing"""
    return {
        'valid_s3_policy': {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject", "s3:PutObject"],
                    "Resource": "arn:aws:s3:::my-bucket/*"
                }
            ]
        },
        'overpermissive_policy': {
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
        },
        'invalid_policy': {
            "Statement": [  # Missing Version
                {
                    "Effect": "Allow",
                    "Action": "s3:GetObject",
                    "Resource": "*"
                }
            ]
        }
    }

@pytest.fixture
def mock_aws_credentials():
    """Mock AWS credentials for testing"""
    with patch.dict(os.environ, {
        'AWS_ACCESS_KEY_ID': 'test-access-key',
        'AWS_SECRET_ACCESS_KEY': 'test-secret-key',
        'AWS_DEFAULT_REGION': 'us-east-1'
    }):
        yield

@pytest.fixture
def mock_access_analyzer():
    """Mock AWS Access Analyzer client"""
    with patch('boto3.client') as mock_client:
        mock_analyzer = MagicMock()
        mock_client.return_value = mock_analyzer
        
        # Default successful response
        mock_analyzer.validate_policy.return_value = {
            'findings': []
        }
        
        yield mock_analyzer

@pytest.fixture
def mock_sts_client():
    """Mock AWS STS client for identity verification"""
    with patch('boto3.client') as mock_client:
        mock_sts = MagicMock()
        mock_client.return_value = mock_sts
        
        mock_sts.get_caller_identity.return_value = {
            'UserId': 'AIDACKCEVSQ6C2EXAMPLE',
            'Account': '123456789012',
            'Arn': 'arn:aws:iam::123456789012:user/test-user'
        }
        
        yield mock_sts

@pytest.fixture
def temp_policy_file(tmp_path, sample_policies):
    """Create a temporary policy file for testing"""
    policy_file = tmp_path / "test-policy.json"
    with open(policy_file, 'w') as f:
        json.dump(sample_policies['valid_s3_policy'], f, indent=2)
    return policy_file

@pytest.fixture(autouse=True)
def setup_test_environment():
    """Setup test environment"""
    # Ensure test directories exist
    test_dir = Path(__file__).parent
    fixtures_dir = test_dir / "fixtures"
    fixtures_dir.mkdir(exist_ok=True)
    
    policies_dir = fixtures_dir / "test-policies"
    policies_dir.mkdir(exist_ok=True)
    
    screenshots_dir = fixtures_dir / "screenshots"
    screenshots_dir.mkdir(exist_ok=True)
    
    yield
    
    # Cleanup if needed
    pass
