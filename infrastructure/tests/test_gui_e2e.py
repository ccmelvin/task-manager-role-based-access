import pytest
import json
import subprocess
import time
import os
from playwright.sync_api import Page, expect
from pathlib import Path

class TestIAMPolicyValidatorGUI:
    """End-to-end tests for the IAM Policy Validator GUI"""
    
    @pytest.fixture(autouse=True)
    def setup_test_data(self):
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
        
        # Overly permissive policy
        permissive_policy = {
            "Version": "2012-10-17",
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
            
        with open(self.test_dir / "permissive-policy.json", "w") as f:
            json.dump(permissive_policy, f, indent=2)
    
    @pytest.fixture
    def gui_app(self):
        """Start the GUI application"""
        # Start the GUI app in a subprocess
        app_path = Path(__file__).parent.parent / "iam_policy_validator.py"
        process = subprocess.Popen(
            ["python", str(app_path)],
            env={**os.environ, "DISPLAY": ":0"}  # Ensure display is set
        )
        
        # Give the app time to start
        time.sleep(2)
        
        yield process
        
        # Cleanup
        process.terminate()
        process.wait()
    
    def test_gui_launches_successfully(self, page: Page, gui_app):
        """Test that the GUI application launches and displays correctly"""
        # Note: This would require the GUI to be web-based or use a different approach
        # For tkinter apps, we'd need to use a different testing strategy
        pass
    
    def test_policy_validation_workflow(self, page: Page):
        """Test the complete policy validation workflow"""
        # This is a conceptual test - actual implementation would depend on
        # whether we convert the GUI to web-based or use different testing tools
        pass

class TestWebBasedGUI:
    """Tests for a hypothetical web-based version of the GUI"""
    
    def test_load_policy_from_text(self, page: Page):
        """Test loading policy from text input"""
        # Navigate to the web app
        page.goto("http://localhost:8000")  # Assuming web version
        
        # Input policy JSON
        policy_json = json.dumps({
            "Version": "2012-10-17",
            "Statement": [{"Effect": "Allow", "Action": "s3:GetObject", "Resource": "*"}]
        }, indent=2)
        
        page.fill('[data-testid="policy-input"]', policy_json)
        page.click('[data-testid="validate-button"]')
        
        # Wait for results
        page.wait_for_selector('[data-testid="validation-results"]')
        
        # Check for security warning about overly broad resource
        expect(page.locator('[data-testid="security-warning"]')).to_be_visible()
    
    def test_load_policy_from_file(self, page: Page):
        """Test loading policy from file upload"""
        page.goto("http://localhost:8000")
        
        # Upload file
        test_file = Path(__file__).parent / "fixtures" / "test-policies" / "valid-policy.json"
        page.set_input_files('[data-testid="file-input"]', str(test_file))
        
        # Validate
        page.click('[data-testid="validate-button"]')
        
        # Check results
        page.wait_for_selector('[data-testid="validation-results"]')
        expect(page.locator('[data-testid="success-message"]')).to_be_visible()
    
    def test_aws_profile_selection(self, page: Page):
        """Test AWS profile selection functionality"""
        page.goto("http://localhost:8000")
        
        # Click profile selector
        page.click('[data-testid="profile-selector"]')
        
        # Select a profile
        page.click('[data-testid="profile-option-default"]')
        
        # Verify identity display updates
        expect(page.locator('[data-testid="current-identity"]')).to_contain_text("arn:aws:")
    
    def test_policy_type_selection(self, page: Page):
        """Test switching between Identity and Resource policy types"""
        page.goto("http://localhost:8000")
        
        # Test Identity policy (default)
        identity_policy = {
            "Version": "2012-10-17",
            "Statement": [{"Effect": "Allow", "Action": "s3:GetObject", "Resource": "*"}]
        }
        page.fill('[data-testid="policy-input"]', json.dumps(identity_policy))
        page.click('[data-testid="validate-button"]')
        
        # Switch to Resource policy
        page.click('[data-testid="policy-type-resource"]')
        
        resource_policy = {
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::my-bucket/*"
            }]
        }
        page.fill('[data-testid="policy-input"]', json.dumps(resource_policy))
        page.click('[data-testid="validate-button"]')
        
        # Check for public access warning
        expect(page.locator('[data-testid="security-warning"]')).to_be_visible()
    
    def test_help_menu_functionality(self, page: Page):
        """Test help menu and examples"""
        page.goto("http://localhost:8000")
        
        # Open help menu
        page.click('[data-testid="help-menu"]')
        
        # Load example policy
        page.click('[data-testid="load-example-overpermissive"]')
        
        # Verify policy is loaded
        expect(page.locator('[data-testid="policy-input"]')).to_contain_text('"Action": "*"')
        
        # Validate the example
        page.click('[data-testid="validate-button"]')
        
        # Should show security warnings
        expect(page.locator('[data-testid="security-warning"]')).to_be_visible()
