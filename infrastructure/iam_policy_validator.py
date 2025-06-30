#!/usr/bin/env python3
"""
IAM Policy Validator GUI
A simple GUI tool to validate IAM policies using AWS Access Analyzer
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, filedialog, messagebox
import json
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import threading

class IAMPolicyValidator:
    def __init__(self, root):
        self.root = root
        self.root.title("IAM Policy Validator")
        self.root.geometry("800x600")
        
        # AWS client with spoke profile
        try:
            self.session = boto3.Session(profile_name='spoke')
            self.access_analyzer = self.session.client('accessanalyzer', region_name='us-east-1')
        except Exception as e:
            messagebox.showerror("AWS Error", f"Failed to initialize AWS client: {str(e)}")
            return
        
        self.setup_ui()
    
    def setup_ui(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(2, weight=1)
        main_frame.rowconfigure(4, weight=1)
        
        # Title
        title_label = ttk.Label(main_frame, text="IAM Policy Validator", font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        # Policy input section
        ttk.Label(main_frame, text="IAM Policy JSON:").grid(row=1, column=0, sticky=tk.W, pady=(0, 5))
        
        # Buttons frame
        buttons_frame = ttk.Frame(main_frame)
        buttons_frame.grid(row=1, column=1, columnspan=2, sticky=tk.E, pady=(0, 5))
        
        ttk.Button(buttons_frame, text="Load from File", command=self.load_file).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(buttons_frame, text="Clear", command=self.clear_input).pack(side=tk.LEFT)
        
        # Policy input text area
        self.policy_text = scrolledtext.ScrolledText(main_frame, height=12, width=80)
        self.policy_text.grid(row=2, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # Policy type selection
        type_frame = ttk.Frame(main_frame)
        type_frame.grid(row=3, column=0, columnspan=3, sticky=tk.W, pady=(0, 10))
        
        ttk.Label(type_frame, text="Policy Type:").pack(side=tk.LEFT, padx=(0, 10))
        
        self.policy_type = tk.StringVar(value="IDENTITY_POLICY")
        ttk.Radiobutton(type_frame, text="Identity Policy", variable=self.policy_type, 
                       value="IDENTITY_POLICY").pack(side=tk.LEFT, padx=(0, 10))
        ttk.Radiobutton(type_frame, text="Resource Policy", variable=self.policy_type, 
                       value="RESOURCE_POLICY").pack(side=tk.LEFT, padx=(0, 10))
        
        # Validate button
        self.validate_btn = ttk.Button(main_frame, text="Validate Policy", command=self.validate_policy)
        self.validate_btn.grid(row=3, column=2, sticky=tk.E, pady=(0, 10))
        
        # Results section
        ttk.Label(main_frame, text="Validation Results:").grid(row=4, column=0, sticky=(tk.W, tk.N), pady=(10, 5))
        
        # Results text area
        self.results_text = scrolledtext.ScrolledText(main_frame, height=15, width=80)
        self.results_text.grid(row=5, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Status bar
        self.status_var = tk.StringVar(value="Ready")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN)
        status_bar.grid(row=6, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(10, 0))
    
    def load_file(self):
        """Load policy from JSON file"""
        file_path = filedialog.askopenfilename(
            title="Select IAM Policy JSON File",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        
        if file_path:
            try:
                with open(file_path, 'r') as file:
                    content = file.read()
                    # Try to parse and pretty-print JSON
                    try:
                        parsed = json.loads(content)
                        formatted = json.dumps(parsed, indent=2)
                        self.policy_text.delete(1.0, tk.END)
                        self.policy_text.insert(1.0, formatted)
                        self.status_var.set(f"Loaded: {file_path}")
                    except json.JSONDecodeError:
                        # If not valid JSON, just load as text
                        self.policy_text.delete(1.0, tk.END)
                        self.policy_text.insert(1.0, content)
                        self.status_var.set(f"Loaded (not valid JSON): {file_path}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load file: {str(e)}")
    
    def clear_input(self):
        """Clear the policy input area"""
        self.policy_text.delete(1.0, tk.END)
        self.results_text.delete(1.0, tk.END)
        self.status_var.set("Ready")
    
    def validate_policy(self):
        """Validate the policy using AWS Access Analyzer"""
        policy_json = self.policy_text.get(1.0, tk.END).strip()
        
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
        self.results_text.delete(1.0, tk.END)
        
        # Run validation in separate thread to avoid blocking UI
        thread = threading.Thread(target=self._validate_policy_thread, args=(policy_json,))
        thread.daemon = True
        thread.start()
    
    def _validate_policy_thread(self, policy_json):
        """Run policy validation in background thread"""
        try:
            # Call Access Analyzer
            response = self.access_analyzer.validate_policy(
                policyDocument=policy_json,
                policyType=self.policy_type.get()
            )
            
            # Process results on main thread
            self.root.after(0, self._display_results, response)
            
        except ClientError as e:
            error_msg = f"AWS API Error: {e.response['Error']['Message']}"
            self.root.after(0, self._display_error, error_msg)
        except NoCredentialsError:
            error_msg = "AWS credentials not found. Please configure your 'spoke' profile."
            self.root.after(0, self._display_error, error_msg)
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            self.root.after(0, self._display_error, error_msg)
    
    def _display_results(self, response):
        """Display validation results in the UI"""
        findings = response.get('findings', [])
        
        if not findings:
            result_text = "✅ VALIDATION PASSED\n\nNo issues found with this policy!"
        else:
            result_text = f"⚠️  VALIDATION FINDINGS ({len(findings)} issues found)\n\n"
            
            for i, finding in enumerate(findings, 1):
                finding_type = finding.get('findingType', 'UNKNOWN')
                issue_code = finding.get('issueCode', 'UNKNOWN')
                details = finding.get('findingDetails', 'No details available')
                learn_more = finding.get('learnMoreLink', '')
                
                # Add severity emoji
                if finding_type == 'ERROR':
                    emoji = "🚨"
                elif finding_type == 'SECURITY_WARNING':
                    emoji = "⚠️"
                else:
                    emoji = "ℹ️"
                
                result_text += f"{emoji} Finding #{i}: {finding_type}\n"
                result_text += f"Issue Code: {issue_code}\n"
                result_text += f"Details: {details}\n"
                
                if learn_more:
                    result_text += f"Learn More: {learn_more}\n"
                
                result_text += "-" * 80 + "\n\n"
        
        self.results_text.delete(1.0, tk.END)
        self.results_text.insert(1.0, result_text)
        
        # Re-enable button and update status
        self.validate_btn.config(state='normal')
        if findings:
            self.status_var.set(f"Validation complete - {len(findings)} issues found")
        else:
            self.status_var.set("Validation complete - No issues found")
    
    def _display_error(self, error_msg):
        """Display error message in the UI"""
        self.results_text.delete(1.0, tk.END)
        self.results_text.insert(1.0, f"❌ ERROR\n\n{error_msg}")
        
        self.validate_btn.config(state='normal')
        self.status_var.set("Validation failed")

def main():
    root = tk.Tk()
    app = IAMPolicyValidator(root)
    root.mainloop()

if __name__ == "__main__":
    main()
