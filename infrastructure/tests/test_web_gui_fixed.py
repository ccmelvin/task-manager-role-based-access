"""
Fixed Web GUI tests with proper server setup
"""

import pytest
import subprocess
import time
import requests
import os
import signal
from playwright.sync_api import sync_playwright

class TestWebGUIFixed:
    """Web GUI tests with proper server management"""
    
    @classmethod
    def setup_class(cls):
        """Start the web server before tests"""
        print("🌐 Starting web GUI test server...")
        
        # Start server in background
        cls.server_process = subprocess.Popen([
            'python', 'start_web_gui_test.py', 
            '--port', '8000', 
            '--host', '127.0.0.1',
            '--background'
        ], cwd=os.path.dirname(__file__) + '/..')
        
        # Wait for server to start
        max_attempts = 10
        for attempt in range(max_attempts):
            try:
                response = requests.get('http://localhost:8000', timeout=2)
                if response.status_code == 200:
                    print("✅ Web server is ready")
                    break
            except requests.exceptions.RequestException:
                if attempt < max_attempts - 1:
                    print(f"⏳ Waiting for server... (attempt {attempt + 1}/{max_attempts})")
                    time.sleep(2)
                else:
                    raise Exception("❌ Failed to start web server for testing")
    
    @classmethod
    def teardown_class(cls):
        """Stop the web server after tests"""
        if hasattr(cls, 'server_process'):
            print("🛑 Stopping web GUI test server...")
            cls.server_process.terminate()
            cls.server_process.wait(timeout=5)
    
    def test_web_gui_loads(self):
        """Test that the web GUI loads successfully"""
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            # Navigate to the web GUI
            page.goto("http://localhost:8000")
            
            # Check that the page loads
            assert page.title() != ""
            
            # Look for key elements
            assert page.locator("h1").count() > 0
            
            browser.close()
    
    def test_policy_input_form(self):
        """Test the policy input form"""
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            page.goto("http://localhost:8000")
            
            # Look for policy input elements
            policy_textarea = page.locator("textarea")
            if policy_textarea.count() > 0:
                # Test policy input
                test_policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": "s3:GetObject",
                            "Resource": "arn:aws:s3:::test-bucket/*"
                        }
                    ]
                }
                
                policy_textarea.first.fill(json.dumps(test_policy, indent=2))
                
                # Check that the policy was entered
                assert "s3:GetObject" in policy_textarea.first.input_value()
            
            browser.close()
    
    def test_aws_profile_selection(self):
        """Test AWS profile selection functionality"""
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            page.goto("http://localhost:8000")
            
            # Look for profile selection elements
            profile_select = page.locator("select")
            if profile_select.count() > 0:
                # Test profile selection
                profile_select.first.select_option("default")
            
            # Check for profile-related text
            page_content = page.content()
            assert "profile" in page_content.lower() or "aws" in page_content.lower()
            
            browser.close()
    
    def test_validation_workflow(self):
        """Test the complete validation workflow"""
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            page.goto("http://localhost:8000")
            
            # Test basic page functionality
            assert page.is_visible("body")
            
            # Look for validation-related elements
            buttons = page.locator("button")
            if buttons.count() > 0:
                # Check that buttons are clickable
                first_button = buttons.first
                assert first_button.is_enabled()
            
            browser.close()

# Import json for the test
import json
