# Python IAM Policy Validator with AWS Access Analyzer API

## The Core Problem
Users generate IAM policies with Amazon Q Developer but need to validate they work correctly before deployment.

## Amazon Q Prompt for Policy Validator
```
Create a Python GUI application using tkinter that:
- Loads IAM policy JSON files from a directory
- Validates each policy using AWS Access Analyzer API
- Shows validation results with severity levels (ERROR, SECURITY_WARNING, SUGGESTION)
- Displays specific line numbers where issues occur
- Exports validation reports to CSV
- Includes retry logic for API rate limits
```

## Expected Python Code from Q:

```python
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import boto3
import json
import csv
from datetime import datetime
import os

class PolicyValidator:
    def __init__(self, root):
        self.root = root
        self.root.title("IAM Policy Validator")
        self.root.geometry("800x600")
        
        self.access_analyzer = boto3.client('accessanalyzer')
        self.setup_ui()
        
    def setup_ui(self):
        # File selection frame
        file_frame = ttk.Frame(self.root)
        file_frame.pack(fill='x', padx=10, pady=5)
        
        ttk.Button(file_frame, text="Select Policy Files", 
                  command=self.select_files).pack(side='left')
        ttk.Button(file_frame, text="Validate All", 
                  command=self.validate_all).pack(side='left', padx=5)
        
        # Results tree
        self.tree = ttk.Treeview(self.root, columns=('File', 'Severity', 'Issue', 'Line'))
        self.tree.heading('#0', text='ID')
        self.tree.heading('File', text='Policy File')
        self.tree.heading('Severity', text='Severity')
        self.tree.heading('Issue', text='Issue Description')
        self.tree.heading('Line', text='Line')
        self.tree.pack(fill='both', expand=True, padx=10, pady=5)
        
        # Export button
        ttk.Button(self.root, text="Export Results", 
                  command=self.export_results).pack(pady=5)
        
        self.policy_files = []
        self.validation_results = []
    
    def select_files(self):
        files = filedialog.askopenfilenames(
            title="Select IAM Policy JSON Files",
            filetypes=[("JSON files", "*.json")]
        )
        self.policy_files = list(files)
        messagebox.showinfo("Files Selected", f"Selected {len(files)} policy files")
    
    def validate_policy(self, policy_path):
        try:
            with open(policy_path, 'r') as f:
                policy_doc = json.load(f)
            
            response = self.access_analyzer.validate_policy(
                policyDocument=json.dumps(policy_doc),
                policyType='IDENTITY_POLICY'
            )
            
            return response.get('findings', [])
            
        except Exception as e:
            return [{'findingType': 'ERROR', 'findingDetails': str(e)}]
    
    def validate_all(self):
        if not self.policy_files:
            messagebox.showwarning("No Files", "Please select policy files first")
            return
        
        # Clear previous results
        for item in self.tree.get_children():
            self.tree.delete(item)
        self.validation_results = []
        
        for policy_file in self.policy_files:
            findings = self.validate_policy(policy_file)
            filename = os.path.basename(policy_file)
            
            if not findings:
                self.tree.insert('', 'end', values=(filename, 'PASS', 'No issues found', ''))
                self.validation_results.append({
                    'file': filename,
                    'severity': 'PASS',
                    'issue': 'No issues found',
                    'line': ''
                })
            else:
                for finding in findings:
                    severity = finding.get('findingType', 'UNKNOWN')
                    issue = finding.get('findingDetails', 'Unknown issue')
                    line = self.extract_line_number(finding)
                    
                    self.tree.insert('', 'end', values=(filename, severity, issue, line))
                    self.validation_results.append({
                        'file': filename,
                        'severity': severity,
                        'issue': issue,
                        'line': line
                    })
    
    def extract_line_number(self, finding):
        locations = finding.get('locations', [])
        if locations and 'span' in locations[0]:
            return str(locations[0]['span']['start']['line'])
        return ''
    
    def export_results(self):
        if not self.validation_results:
            messagebox.showwarning("No Results", "No validation results to export")
            return
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")]
        )
        
        if filename:
            with open(filename, 'w', newline='') as csvfile:
                writer = csv.DictWriter(csvfile, 
                    fieldnames=['file', 'severity', 'issue', 'line'])
                writer.writeheader()
                writer.writerows(self.validation_results)
            
            messagebox.showinfo("Export Complete", f"Results exported to {filename}")

if __name__ == "__main__":
    root = tk.Tk()
    app = PolicyValidator(root)
    root.mainloop()
```

## Key Features:
- **File Selection**: Load multiple policy JSON files
- **API Integration**: Uses AWS Access Analyzer validate_policy API
- **Results Display**: Shows findings with severity levels
- **Export Capability**: Save results to CSV for reporting
- **Error Handling**: Graceful handling of API errors and file issues
