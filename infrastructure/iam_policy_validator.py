#!/usr/bin/env python3
"""
IAM Policy Validator GUI
A GUI tool to validate IAM policies using AWS Access Analyzer

USAGE:
    python iam_policy_validator.py

    The tool automatically uses your default AWS credentials or you can:
    • Click "Change Profile" to select a specific AWS profile
    • Load policies from JSON files or paste directly
    • Select Identity or Resource policy type
    • Get detailed validation results with security findings

REQUIREMENTS:
    • AWS credentials configured (aws configure, env vars, or IAM role)
    • Python packages: boto3, botocore
    • AWS permissions: access-analyzer:ValidatePolicy, sts:GetCallerIdentity

FEATURES:
    • Multi-profile AWS credential support
    • Both Identity and Resource policy validation
    • File loading with JSON formatting
    • Real-time AWS identity verification
    • Color-coded results with severity indicators

EXAMPLE TEST POLICY (overly permissive - will show warnings):
    {
        "Version": "2012-10-17",
        "Statement": [{"Effect": "Allow", "Action": "*", "Resource": "*"}]
    }
"""

from tkinter import Tk, StringVar, W, E, N, S, LEFT, END, SUNKEN, Menu, Toplevel, WORD, BOTH, DISABLED
from tkinter import ttk, scrolledtext, filedialog, messagebox
import json
from boto3 import Session
from botocore.exceptions import ClientError, NoCredentialsError, ProfileNotFound
from threading import Thread
from configparser import ConfigParser
from os.path import expanduser, exists

class IAMPolicyValidator:
    def __init__(self, root):
        self.root = root
        self.root.title("IAM Policy Validator")
        self.root.geometry("900x700")
        
        # Initialize AWS session variables
        self.session = None
        self.access_analyzer = None
        self.current_profile = None
        self.current_region = 'us-east-1'
        
        self.setup_ui()
        
        # Try to initialize with default credentials
        self.initialize_aws_session()
    
    def initialize_aws_session(self, profile_name=None):
        """Initialize AWS session with specified profile or default credentials"""
        try:
            if profile_name:
                self.session = Session(profile_name=profile_name)
                self.current_profile = profile_name
            else:
                self.session = Session()
                self.current_profile = "default"
            
            self.access_analyzer = self.session.client('accessanalyzer', region_name=self.current_region)
            
            # Test the connection and get current identity
            self._test_aws_connection()
            
        except ProfileNotFound:
            error_msg = f"AWS profile '{profile_name}' not found. Available profiles: {self._get_available_profiles()}"
            self._display_aws_error(error_msg)
        except NoCredentialsError:
            error_msg = "AWS credentials not found. Please configure your AWS credentials using 'aws configure' or set environment variables."
            self._display_aws_error(error_msg)
        except Exception as e:
            error_msg = f"Failed to initialize AWS session: {str(e)}"
            self._display_aws_error(error_msg)
    
    def _test_aws_connection(self):
        """Test AWS connection and get current identity"""
        try:
            sts_client = self.session.client('sts', region_name=self.current_region)
            identity = sts_client.get_caller_identity()
            
            user_arn = identity.get('Arn', 'Unknown')
            account_id = identity.get('Account', 'Unknown')
            
            status_msg = f"Connected as: {user_arn} (Account: {account_id})"
            self.aws_status_var.set(status_msg)
            
            # Enable the validate button
            self.validate_btn.config(state='normal')
            
        except Exception as e:
            error_msg = f"Failed to verify AWS connection: {str(e)}"
            self._display_aws_error(error_msg)
    
    def _get_available_profiles(self):
        """Get list of available AWS profiles"""
        try:
            profiles = []
            
            # Check ~/.aws/credentials
            credentials_path = expanduser('~/.aws/credentials')
            if exists(credentials_path):
                config = ConfigParser()
                config.read(credentials_path)
                profiles.extend(config.sections())
            
            # Check ~/.aws/config
            config_path = expanduser('~/.aws/config')
            if exists(config_path):
                config = ConfigParser()
                config.read(config_path)
                for section in config.sections():
                    if section.startswith('profile '):
                        profiles.append(section[8:])  # Remove 'profile ' prefix
            
            return list(set(profiles)) if profiles else ['default']
        except:
            return ['default']
    
    def _display_aws_error(self, error_msg):
        """Display AWS connection error"""
        self.aws_status_var.set(f"AWS Error: {error_msg}")
        self.validate_btn.config(state='disabled')
        messagebox.showerror("AWS Connection Error", error_msg)
    
    def change_profile(self):
        """Change AWS profile"""
        available_profiles = self._get_available_profiles()
        
        # Create a simple dialog to select profile
        profile_window = Toplevel(self.root)
        profile_window.title("Select AWS Profile")
        profile_window.geometry("400x200")
        profile_window.transient(self.root)
        profile_window.grab_set()
        
        ttk.Label(profile_window, text="Select AWS Profile:").pack(pady=10)
        
        profile_var = StringVar(value=self.current_profile or "default")
        profile_combo = ttk.Combobox(profile_window, textvariable=profile_var, values=available_profiles, width=30)
        profile_combo.pack(pady=10)
        
        def apply_profile():
            selected_profile = profile_var.get().strip()
            if selected_profile and selected_profile != "default":
                self.initialize_aws_session(selected_profile)
            else:
                self.initialize_aws_session()  # Use default credentials
            profile_window.destroy()
        
        def cancel():
            profile_window.destroy()
        
        button_frame = ttk.Frame(profile_window)
        button_frame.pack(pady=20)
        
        ttk.Button(button_frame, text="Apply", command=apply_profile).pack(side=LEFT, padx=5)
        ttk.Button(button_frame, text="Cancel", command=cancel).pack(side=LEFT, padx=5)
        
        # Center the window
        profile_window.update_idletasks()
        x = (profile_window.winfo_screenwidth() // 2) - (profile_window.winfo_width() // 2)
        y = (profile_window.winfo_screenheight() // 2) - (profile_window.winfo_height() // 2)
        profile_window.geometry(f"+{x}+{y}")
    
    def setup_ui(self):
        # Create menu bar
        menubar = Menu(self.root)
        self.root.config(menu=menubar)
        
        # Help menu
        help_menu = Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="Usage Instructions", command=self.show_help)
        help_menu.add_command(label="Example Policies", command=self.show_examples)
        help_menu.add_separator()
        help_menu.add_command(label="About", command=self.show_about)
        
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(W, E, N, S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(3, weight=1)
        main_frame.rowconfigure(6, weight=1)
        
        # Title
        title_label = ttk.Label(main_frame, text="IAM Policy Validator", font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 10))
        
        # AWS Configuration Section
        aws_frame = ttk.LabelFrame(main_frame, text="AWS Configuration", padding="5")
        aws_frame.grid(row=1, column=0, columnspan=3, sticky=(W, E), pady=(0, 10))
        aws_frame.columnconfigure(1, weight=1)
        
        ttk.Label(aws_frame, text="Profile:").grid(row=0, column=0, sticky=W, padx=(0, 5))
        self.aws_status_var = StringVar(value="Initializing AWS connection...")
        ttk.Label(aws_frame, textvariable=self.aws_status_var, foreground="white").grid(row=0, column=1, sticky=W, padx=(5, 0))
        ttk.Button(aws_frame, text="Change Profile", command=self.change_profile).grid(row=0, column=2, padx=(5, 0))
        
        # Policy input section
        ttk.Label(main_frame, text="IAM Policy JSON:").grid(row=2, column=0, sticky=W, pady=(0, 5))
        
        # Buttons frame
        buttons_frame = ttk.Frame(main_frame)
        buttons_frame.grid(row=2, column=1, columnspan=2, sticky=E, pady=(0, 5))
        
        ttk.Button(buttons_frame, text="Load from File", command=self.load_file).pack(side=LEFT, padx=(0, 5))
        ttk.Button(buttons_frame, text="Clear", command=self.clear_input).pack(side=LEFT)
        
        # Policy input text area
        self.policy_text = scrolledtext.ScrolledText(main_frame, height=12, width=80)
        self.policy_text.grid(row=3, column=0, columnspan=3, sticky=(W, E, N, S), pady=(0, 10))
        
        # Policy type selection
        type_frame = ttk.Frame(main_frame)
        type_frame.grid(row=4, column=0, columnspan=3, sticky=W, pady=(0, 10))
        
        ttk.Label(type_frame, text="Policy Type:").pack(side=LEFT, padx=(0, 10))
        
        self.policy_type = StringVar(value="IDENTITY_POLICY")
        ttk.Radiobutton(type_frame, text="Identity Policy", variable=self.policy_type, 
                       value="IDENTITY_POLICY").pack(side=LEFT, padx=(0, 10))
        ttk.Radiobutton(type_frame, text="Resource Policy", variable=self.policy_type, 
                       value="RESOURCE_POLICY").pack(side=LEFT, padx=(0, 10))
        
        # Validate button (initially disabled until AWS connection is established)
        self.validate_btn = ttk.Button(main_frame, text="Validate Policy", command=self.validate_policy, state='disabled')
        self.validate_btn.grid(row=4, column=2, sticky=E, pady=(0, 10))
        
        # Results section
        ttk.Label(main_frame, text="Validation Results:").grid(row=5, column=0, sticky=(W, N), pady=(10, 5))
        
        # Results text area
        self.results_text = scrolledtext.ScrolledText(main_frame, height=15, width=80)
        self.results_text.grid(row=6, column=0, columnspan=3, sticky=(W, E, N, S))
        
        # Status bar
        self.status_var = StringVar(value="Ready")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=SUNKEN)
        status_bar.grid(row=7, column=0, columnspan=3, sticky=(W, E), pady=(10, 0))
    
    def load_file(self):
        """Load policy from JSON file"""
        file_path = filedialog.askopenfilename(
            title="Select IAM Policy JSON File",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        
        if not file_path:
            return
            
        try:
            with open(file_path, 'r') as file:
                content = file.read()
            self._load_content(content, file_path)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load file: {str(e)}")
    
    def _load_content(self, content, file_path):
        """Load content into text area with JSON formatting if possible"""
        try:
            parsed = json.loads(content)
            formatted = json.dumps(parsed, indent=2)
            self.policy_text.delete(1.0, END)
            self.policy_text.insert(1.0, formatted)
            self.status_var.set(f"Loaded: {file_path}")
        except json.JSONDecodeError:
            self.policy_text.delete(1.0, END)
            self.policy_text.insert(1.0, content)
            self.status_var.set(f"Loaded (not valid JSON): {file_path}")
    
    def clear_input(self):
        """Clear the policy input area"""
        self.policy_text.delete(1.0, END)
        self.results_text.delete(1.0, END)
        self.status_var.set("Ready")
    
    def validate_policy(self):
        """Validate the policy using AWS Access Analyzer"""
        policy_json = self.policy_text.get(1.0, END).strip()
        
        if not policy_json:
            messagebox.showwarning("Warning", "Please enter or load a policy JSON")
            return
        
        # Validate JSON format
        try:
            policy_dict = json.loads(policy_json)
        except json.JSONDecodeError as e:
            messagebox.showerror("JSON Error", f"Invalid JSON format: {str(e)}")
            return
        
        # Disable button and show progress
        self.validate_btn.config(state='disabled')
        self.status_var.set("Validating policy...")
        self.results_text.delete(1.0, END)
        
        # Run validation in separate thread to avoid blocking UI
        thread = Thread(target=self._validate_policy_thread, args=(policy_json,))
        thread.daemon = True
        thread.start()
    
    def _validate_policy_thread(self, policy_json):
        """Run policy validation in background thread"""
        try:
            response = self.access_analyzer.validate_policy(
                policyDocument=policy_json,
                policyType=self.policy_type.get()
            )
            self.root.after(0, self._display_results, response)
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'InvalidParameterException':
                error_msg = "Invalid policy format or parameters"
            elif error_code == 'AccessDeniedException':
                error_msg = "Access denied. Check your AWS permissions for Access Analyzer"
            else:
                error_msg = f"AWS API Error: {e.response['Error']['Message']}"
            self.root.after(0, self._display_error, error_msg)
        except NoCredentialsError:
            error_msg = "AWS credentials not found. Please configure your AWS credentials or select a different profile."
            self.root.after(0, self._display_error, error_msg)
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            self.root.after(0, self._display_error, error_msg)
    
    def _get_severity_emoji(self, finding_type):
        """Get emoji based on finding severity"""
        severity_map = {
            'ERROR': "🚨",
            'SECURITY_WARNING': "⚠️"
        }
        return severity_map.get(finding_type, "ℹ️")
    
    def _format_finding(self, finding, index):
        """Format a single finding for display"""
        finding_type = finding.get('findingType', 'UNKNOWN')
        issue_code = finding.get('issueCode', 'UNKNOWN')
        details = finding.get('findingDetails', 'No details available')
        learn_more = finding.get('learnMoreLink', '')
        
        emoji = self._get_severity_emoji(finding_type)
        
        lines = [
            f"{emoji} Finding #{index}: {finding_type}",
            f"Issue Code: {issue_code}",
            f"Details: {details}"
        ]
        
        if learn_more:
            lines.append(f"Learn More: {learn_more}")
        
        return "\n".join(lines) + "\n" + "-" * 80 + "\n\n"
    
    def _format_results(self, findings):
        """Format validation results for display"""
        if not findings:
            return "✅ VALIDATION PASSED\n\nNo issues found with this policy!"
        
        header = f"⚠️  VALIDATION FINDINGS ({len(findings)} issues found)\n\n"
        findings_text = "".join(self._format_finding(finding, i) for i, finding in enumerate(findings, 1))
        return header + findings_text
    
    def _display_results(self, response):
        """Display validation results in the UI"""
        findings = response.get('findings', [])
        result_text = self._format_results(findings)
        
        self.results_text.delete(1.0, END)
        self.results_text.insert(1.0, result_text)
        
        self.validate_btn.config(state='normal')
        status_msg = f"Validation complete - {len(findings)} issues found" if findings else "Validation complete - No issues found"
        self.status_var.set(status_msg)
    
    def show_help(self):
        """Show usage instructions dialog"""
        help_text = """
IAM Policy Validator - Usage Instructions

1. AWS CONFIGURATION:
   • The tool uses your default AWS credentials by default
   • Click "Change Profile" to use a specific AWS profile
   • Ensure you have access-analyzer:ValidatePolicy permissions

2. VALIDATING POLICIES:
   • Paste JSON policy into the text area, OR
   • Click "Load from File" to load from a .json file
   • Select policy type (Identity or Resource)
   • Click "Validate Policy"

3. UNDERSTANDING RESULTS:
   🚨 ERROR: Critical issues that prevent policy from working
   ⚠️  SECURITY_WARNING: Potential security concerns
   ℹ️  INFO: General recommendations

4. TROUBLESHOOTING:
   • If you see credential errors, run: aws configure
   • Check your AWS permissions include Access Analyzer
   • Verify your policy JSON syntax is valid

For more detailed information, see the script's docstring.
        """
        
        help_window = Toplevel(self.root)
        help_window.title("Usage Instructions")
        help_window.geometry("600x500")
        help_window.transient(self.root)
        
        text_widget = scrolledtext.ScrolledText(help_window, wrap=WORD, padx=10, pady=10)
        text_widget.pack(fill=BOTH, expand=True)
        text_widget.insert(END, help_text)
        text_widget.config(state=DISABLED)
        
        ttk.Button(help_window, text="Close", command=help_window.destroy).pack(pady=10)
    
    def show_examples(self):
        """Show example policies dialog"""
        examples_text = """
EXAMPLE POLICIES FOR TESTING

1. OVERLY PERMISSIVE POLICY (will show warnings):
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "*",
            "Resource": "*"
        }
    ]
}

2. WELL-SCOPED S3 POLICY (should pass):
{
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
}

3. RESOURCE POLICY EXAMPLE (S3 bucket policy):
{
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

Copy and paste any of these examples to test the validator.
        """
        
        examples_window = Toplevel(self.root)
        examples_window.title("Example Policies")
        examples_window.geometry("700x600")
        examples_window.transient(self.root)
        
        text_widget = scrolledtext.ScrolledText(examples_window, wrap=WORD, padx=10, pady=10)
        text_widget.pack(fill=BOTH, expand=True)
        text_widget.insert(END, examples_text)
        text_widget.config(state=DISABLED)
        
        button_frame = ttk.Frame(examples_window)
        button_frame.pack(pady=10)
        
        def copy_example(example_num):
            examples = [
                # Overly permissive
                '{\n    "Version": "2012-10-17",\n    "Statement": [\n        {\n            "Effect": "Allow",\n            "Action": "*",\n            "Resource": "*"\n        }\n    ]\n}',
                # Well-scoped S3
                '{\n    "Version": "2012-10-17",\n    "Statement": [\n        {\n            "Effect": "Allow",\n            "Action": [\n                "s3:GetObject",\n                "s3:PutObject"\n            ],\n            "Resource": "arn:aws:s3:::my-bucket/*"\n        }\n    ]\n}',
                # Resource policy
                '{\n    "Version": "2012-10-17",\n    "Statement": [\n        {\n            "Sid": "AllowPublicRead",\n            "Effect": "Allow",\n            "Principal": "*",\n            "Action": "s3:GetObject",\n            "Resource": "arn:aws:s3:::my-public-bucket/*"\n        }\n    ]\n}'
            ]
            
            self.policy_text.delete(1.0, END)
            self.policy_text.insert(1.0, examples[example_num])
            examples_window.destroy()
        
        ttk.Button(button_frame, text="Copy Example 1", command=lambda: copy_example(0)).pack(side=LEFT, padx=5)
        ttk.Button(button_frame, text="Copy Example 2", command=lambda: copy_example(1)).pack(side=LEFT, padx=5)
        ttk.Button(button_frame, text="Copy Example 3", command=lambda: copy_example(2)).pack(side=LEFT, padx=5)
        ttk.Button(button_frame, text="Close", command=examples_window.destroy).pack(side=LEFT, padx=5)
    
    def show_about(self):
        """Show about dialog"""
        about_text = """
IAM Policy Validator GUI
Version 2.0

A comprehensive tool for validating AWS IAM policies using 
AWS Access Analyzer's ValidatePolicy API.

Features:
• Multi-profile AWS credential support
• Identity and Resource policy validation
• Detailed security findings with recommendations
• File loading and JSON formatting
• Real-time AWS identity verification

Built for the AWS CDK Task Manager Project

Requirements:
• Python 3.6+ with tkinter
• boto3, botocore packages
• AWS credentials with Access Analyzer permissions

© 2024 - Open Source
        """
        
        messagebox.showinfo("About IAM Policy Validator", about_text)
    
    def _display_error(self, error_msg):
        """Display error message in the UI"""
        self.results_text.delete(1.0, END)
        self.results_text.insert(1.0, f"❌ ERROR\n\n{error_msg}")
        
        self.validate_btn.config(state='normal')
        self.status_var.set("Validation failed")

def main():
    root = Tk()
    app = IAMPolicyValidator(root)
    root.mainloop()

if __name__ == "__main__":
    main()
