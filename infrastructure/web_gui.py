#!/usr/bin/env python3
"""
Web-based IAM Policy Validator using Flask
This version is easier to test with Playwright than the tkinter GUI
"""

from flask import Flask, render_template, request, jsonify, session
import boto3
import json
import os
from botocore.exceptions import ClientError, NoCredentialsError

app = Flask(__name__)
app.secret_key = os.urandom(24)

class PolicyValidator:
    def __init__(self, profile_name=None):
        self.profile_name = profile_name
        self.session = None
        self.access_analyzer = None
        self.sts = None
        self._setup_aws_clients()
    
    def _setup_aws_clients(self):
        """Setup AWS clients with optional profile"""
        try:
            if self.profile_name:
                self.session = boto3.Session(profile_name=self.profile_name)
            else:
                self.session = boto3.Session()
            
            self.access_analyzer = self.session.client('accessanalyzer')
            self.sts = self.session.client('sts')
        except Exception as e:
            print(f"Error setting up AWS clients: {e}")
    
    def get_caller_identity(self):
        """Get current AWS caller identity"""
        try:
            if not self.sts:
                return None
            response = self.sts.get_caller_identity()
            return response.get('Arn', 'Unknown')
        except Exception as e:
            return f"Error: {str(e)}"
    
    def validate_policy(self, policy_document, policy_type='IDENTITY_POLICY'):
        """Validate IAM policy using Access Analyzer"""
        try:
            if not self.access_analyzer:
                return {'error': 'AWS client not configured'}
            
            response = self.access_analyzer.validate_policy(
                policyDocument=policy_document,
                policyType=policy_type
            )
            
            return {'findings': response.get('findings', [])}
        
        except ClientError as e:
            return {'error': f"AWS Error: {e.response['Error']['Message']}"}
        except Exception as e:
            return {'error': f"Error: {str(e)}"}

# Global validator instance
validator = PolicyValidator()

@app.route('/')
def index():
    """Main page"""
    identity = validator.get_caller_identity()
    return render_template('index.html', current_identity=identity)

@app.route('/api/profiles')
def get_profiles():
    """Get available AWS profiles"""
    try:
        profiles = boto3.Session().available_profiles
        return jsonify({'profiles': profiles})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/set-profile', methods=['POST'])
def set_profile():
    """Set AWS profile"""
    global validator
    data = request.get_json()
    profile_name = data.get('profile')
    
    try:
        validator = PolicyValidator(profile_name)
        identity = validator.get_caller_identity()
        return jsonify({'success': True, 'identity': identity})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/validate', methods=['POST'])
def validate_policy():
    """Validate IAM policy"""
    data = request.get_json()
    policy_document = data.get('policy')
    policy_type = data.get('type', 'IDENTITY_POLICY')
    
    if not policy_document:
        return jsonify({'error': 'Policy document is required'}), 400
    
    # Validate JSON
    try:
        json.loads(policy_document)
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    
    result = validator.validate_policy(policy_document, policy_type)
    return jsonify(result)

@app.route('/api/examples')
def get_examples():
    """Get example policies"""
    examples = {
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
        'well_scoped_s3': {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:PutObject"
                    ],
                    "Resource": "arn:aws:s3:::my-bucket/*"
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
    return jsonify(examples)

if __name__ == '__main__':
    # Create templates directory and basic template
    os.makedirs('templates', exist_ok=True)
    
    # Basic HTML template
    template_content = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IAM Policy Validator</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        textarea { width: 100%; height: 300px; font-family: monospace; }
        button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        .finding { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .error { background-color: #ffebee; border-left: 4px solid #f44336; }
        .warning { background-color: #fff3e0; border-left: 4px solid #ff9800; }
        .info { background-color: #e3f2fd; border-left: 4px solid #2196f3; }
        .success { background-color: #e8f5e8; border-left: 4px solid #4caf50; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 IAM Policy Validator</h1>
        
        <div class="section">
            <h3>AWS Configuration</h3>
            <p><strong>Current Identity:</strong> <span id="current-identity" data-testid="current-identity">{{ current_identity }}</span></p>
            <button onclick="changeProfile()" data-testid="profile-selector">Change Profile</button>
        </div>
        
        <div class="section">
            <h3>Policy Input</h3>
            <div>
                <label>
                    <input type="radio" name="policy-type" value="IDENTITY_POLICY" checked data-testid="policy-type-identity"> Identity Policy
                </label>
                <label>
                    <input type="radio" name="policy-type" value="RESOURCE_POLICY" data-testid="policy-type-resource"> Resource Policy
                </label>
            </div>
            <textarea id="policy-input" data-testid="policy-input" placeholder="Paste your IAM policy JSON here..."></textarea>
            <div>
                <button onclick="validatePolicy()" data-testid="validate-button">Validate Policy</button>
                <button onclick="loadFromFile()" data-testid="load-file-button">Load from File</button>
                <button onclick="showExamples()" data-testid="help-menu">Examples</button>
            </div>
            <input type="file" id="file-input" data-testid="file-input" accept=".json" style="display: none;" onchange="handleFileLoad(event)">
        </div>
        
        <div class="section">
            <h3>Validation Results</h3>
            <div id="validation-results" data-testid="validation-results"></div>
        </div>
        
        <div id="examples-modal" class="hidden">
            <div class="section">
                <h3>Example Policies</h3>
                <button onclick="loadExample('overpermissive')" data-testid="load-example-overpermissive">Overly Permissive Policy</button>
                <button onclick="loadExample('well_scoped_s3')">Well-Scoped S3 Policy</button>
                <button onclick="loadExample('resource_policy')">Resource Policy</button>
                <button onclick="hideExamples()">Close</button>
            </div>
        </div>
    </div>

    <script>
        let examples = {};
        
        async function changeProfile() {
            const profile = prompt("Enter AWS profile name (or leave empty for default):");
            if (profile !== null) {
                try {
                    const response = await fetch('/api/set-profile', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({profile: profile || null})
                    });
                    const data = await response.json();
                    if (data.success) {
                        document.getElementById('current-identity').textContent = data.identity;
                    } else {
                        alert('Error: ' + data.error);
                    }
                } catch (error) {
                    alert('Error changing profile: ' + error.message);
                }
            }
        }
        
        async function validatePolicy() {
            const policyText = document.getElementById('policy-input').value;
            const policyType = document.querySelector('input[name="policy-type"]:checked').value;
            const resultsDiv = document.getElementById('validation-results');
            
            if (!policyText.trim()) {
                resultsDiv.innerHTML = '<div class="error">Please enter a policy document</div>';
                return;
            }
            
            resultsDiv.innerHTML = '<div>Validating policy...</div>';
            
            try {
                const response = await fetch('/api/validate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({policy: policyText, type: policyType})
                });
                
                const data = await response.json();
                
                if (data.error) {
                    resultsDiv.innerHTML = `<div class="error">❌ ${data.error}</div>`;
                    return;
                }
                
                if (data.findings && data.findings.length === 0) {
                    resultsDiv.innerHTML = '<div class="success" data-testid="success-message">✅ No issues found! Policy looks good.</div>';
                    return;
                }
                
                let html = '';
                data.findings.forEach(finding => {
                    const severity = finding.findingType.toLowerCase();
                    const icon = severity === 'error' ? '🚨' : severity === 'security_warning' ? '⚠️' : 'ℹ️';
                    const cssClass = severity === 'error' ? 'error' : severity === 'security_warning' ? 'warning' : 'info';
                    
                    html += `
                        <div class="finding ${cssClass}" data-testid="${severity.replace('_', '-')}">
                            <strong>${icon} ${finding.findingType}</strong>: ${finding.issueCode}<br>
                            ${finding.findingDetails}<br>
                            <a href="${finding.learnMoreLink}" target="_blank">Learn more</a>
                        </div>
                    `;
                });
                
                resultsDiv.innerHTML = html;
                
            } catch (error) {
                resultsDiv.innerHTML = `<div class="error">❌ Error: ${error.message}</div>`;
            }
        }
        
        function loadFromFile() {
            document.getElementById('file-input').click();
        }
        
        function handleFileLoad(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('policy-input').value = e.target.result;
                };
                reader.readAsText(file);
            }
        }
        
        async function showExamples() {
            if (Object.keys(examples).length === 0) {
                const response = await fetch('/api/examples');
                examples = await response.json();
            }
            document.getElementById('examples-modal').classList.remove('hidden');
        }
        
        function hideExamples() {
            document.getElementById('examples-modal').classList.add('hidden');
        }
        
        function loadExample(exampleName) {
            if (examples[exampleName]) {
                document.getElementById('policy-input').value = JSON.stringify(examples[exampleName], null, 2);
                hideExamples();
            }
        }
    </script>
</body>
</html>'''
    
    with open('templates/index.html', 'w') as f:
        f.write(template_content)
    
    print("🚀 Starting IAM Policy Validator Web Interface...")
    print("📝 Access the application at: http://localhost:8000")
    print("🔧 Use Ctrl+C to stop the server")
    
    app.run(host='0.0.0.0', port=8000, debug=True)
