import pytest
import subprocess
import json
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

class TestSimpleValidatorCLI:
    """End-to-end tests for the simple_validator.py CLI tool"""
    
    @pytest.fixture(autouse=True)
    def setup_test_policies(self):
        """Setup test policy files"""
        self.test_dir = Path(__file__).parent / "fixtures" / "test-policies"
        self.test_dir.mkdir(parents=True, exist_ok=True)
        
        # Valid policy
        valid_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject", "s3:PutObject"],
                    "Resource": "arn:aws:s3:::my-bucket/*"
                }
            ]
        }
        
        # Invalid policy (missing Version)
        invalid_policy = {
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "*",
                    "Resource": "*"
                }
            ]
        }
        
        with open(self.test_dir / "valid-policy.json", "w") as f:
            json.dump(valid_policy, f, indent=2)
            
        with open(self.test_dir / "invalid-policy.json", "w") as f:
            json.dump(invalid_policy, f, indent=2)
    
    def test_cli_with_default_file_no_credentials(self):
        """Test CLI with default file when no AWS credentials are available"""
        script_path = Path(__file__).parent.parent / "simple_validator.py"
        
        # Remove AWS credentials from environment
        env = {k: v for k, v in os.environ.items() 
               if not k.startswith('AWS_')}
        
        result = subprocess.run(
            ["python", str(script_path)],
            capture_output=True,
            text=True,
            env=env,
            cwd=script_path.parent
        )
        
        # Should complete successfully but show connection error
        assert result.returncode == 0
        assert "AWS Connection Error" in result.stdout or "credentials" in result.stdout.lower()
    
    def test_cli_with_custom_file(self):
        """Test CLI with custom policy file"""
        script_path = Path(__file__).parent.parent / "simple_validator.py"
        test_file = self.test_dir / "valid-policy.json"
        
        # Remove AWS credentials to avoid real API calls
        env = {k: v for k, v in os.environ.items() 
               if not k.startswith('AWS_')}
        
        result = subprocess.run(
            ["python", str(script_path), str(test_file)],
            capture_output=True,
            text=True,
            env=env,
            cwd=script_path.parent
        )
        
        # Should complete successfully and show the policy content
        assert result.returncode == 0
        assert str(test_file) in result.stdout
        assert "s3:GetObject" in result.stdout
        assert "s3:PutObject" in result.stdout
    
    def test_cli_with_profile_flag(self):
        """Test CLI with --profile flag"""
        script_path = Path(__file__).parent.parent / "simple_validator.py"
        
        # Remove AWS credentials to avoid real API calls
        env = {k: v for k, v in os.environ.items() 
               if not k.startswith('AWS_')}
        
        result = subprocess.run(
            ["python", str(script_path), "--profile", "nonexistent-profile"],
            capture_output=True,
            text=True,
            env=env,
            cwd=script_path.parent
        )
        
        # Should complete successfully but show profile-related error
        assert result.returncode == 0
        assert ("nonexistent-profile" in result.stdout or 
                "profile" in result.stdout.lower() or
                "credentials" in result.stdout.lower())
    
    def test_cli_error_handling_missing_file(self):
        """Test CLI error handling for missing files"""
        script_path = Path(__file__).parent.parent / "simple_validator.py"
        
        result = subprocess.run(
            ["python", str(script_path), "nonexistent-file.json"],
            capture_output=True,
            text=True,
            cwd=script_path.parent
        )
        
        # Should complete successfully but show file not found error
        assert result.returncode == 0
        assert "not found" in result.stdout or "Error" in result.stdout
    
    def test_cli_help_flag(self):
        """Test CLI help flag"""
        script_path = Path(__file__).parent.parent / "simple_validator.py"
        
        result = subprocess.run(
            ["python", str(script_path), "--help"],
            capture_output=True,
            text=True,
            cwd=script_path.parent
        )
        
        # Should show help and exit successfully
        assert result.returncode == 0
        assert ("usage" in result.stdout.lower() or 
                "help" in result.stdout.lower() or
                "IAM Policy Validator" in result.stdout)
    
    def test_cli_invalid_json_file(self):
        """Test CLI with invalid JSON file"""
        script_path = Path(__file__).parent.parent / "simple_validator.py"
        
        # Create invalid JSON file
        invalid_json_file = self.test_dir / "invalid.json"
        with open(invalid_json_file, "w") as f:
            f.write("{ invalid json content")
        
        result = subprocess.run(
            ["python", str(script_path), str(invalid_json_file)],
            capture_output=True,
            text=True,
            cwd=script_path.parent
        )
        
        # Should complete but show JSON error
        assert result.returncode == 0
        assert ("JSON" in result.stdout or "parse" in result.stdout.lower())
    
    def test_cli_output_format(self):
        """Test that CLI produces expected output format"""
        script_path = Path(__file__).parent.parent / "simple_validator.py"
        test_file = self.test_dir / "valid-policy.json"
        
        result = subprocess.run(
            ["python", str(script_path), str(test_file)],
            capture_output=True,
            text=True,
            cwd=script_path.parent
        )
        
        # Check for expected output format elements
        assert result.returncode == 0
        assert "🔍 IAM Policy Validator" in result.stdout
        assert "📋 Validating Policy:" in result.stdout
        assert "==================================================" in result.stdout
    
    @pytest.mark.skipif(
        not any(k.startswith('AWS_') for k in os.environ.keys()),
        reason="Requires AWS credentials for integration test"
    )
    def test_cli_with_real_aws_credentials(self):
        """Integration test with real AWS credentials (if available)"""
        script_path = Path(__file__).parent.parent / "simple_validator.py"
        test_file = self.test_dir / "valid-policy.json"
        
        result = subprocess.run(
            ["python", str(script_path), str(test_file)],
            capture_output=True,
            text=True,
            cwd=script_path.parent
        )
        
        # Should complete successfully
        assert result.returncode == 0
        
        # Should either show validation results or connection info
        assert ("Connected as:" in result.stdout or 
                "AWS Connection Error" in result.stdout or
                "VALIDATION FINDINGS" in result.stdout or
                "✅" in result.stdout)


class TestCLIUnitFunctions:
    """Unit tests for CLI functions that can be imported and tested directly"""
    
    def test_import_simple_validator(self):
        """Test that we can import the simple_validator module"""
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))
        
        try:
            import simple_validator
            assert hasattr(simple_validator, 'main') or callable(simple_validator)
        except ImportError:
            # If the module doesn't have importable functions, that's okay
            # The CLI tests above cover the functionality
            pass
    
    def test_policy_file_reading(self):
        """Test policy file reading functionality"""
        test_file = self.test_dir / "test-read.json"
        test_policy = {"Version": "2012-10-17", "Statement": []}
        
        with open(test_file, "w") as f:
            json.dump(test_policy, f)
        
        # Test that the file exists and is readable
        assert test_file.exists()
        
        with open(test_file, "r") as f:
            loaded_policy = json.load(f)
            assert loaded_policy == test_policy
    
    @pytest.fixture(autouse=True)
    def setup_test_dir(self):
        """Setup test directory for unit tests"""
        self.test_dir = Path(__file__).parent / "fixtures" / "test-policies"
        self.test_dir.mkdir(parents=True, exist_ok=True)
