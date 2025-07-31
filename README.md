# IAM Policy Validator GUI

A Python GUI application to validate IAM policies using AWS Access Analyzer.

## Features

- **GUI Interface**: Easy-to-use graphical interface
- **Policy Input**: Paste JSON directly or load from file
- **AWS Integration**: Uses AWS Access Analyzer API
- **Policy Types**: Supports both Identity and Resource policies
- **Detailed Results**: Shows findings with severity levels and recommendations

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure your AWS profile:
```bash
aws configure --profile your-profile
```

## Usage

1. Run the Python application:
```bash
python iam_policy_validator.py
```

2. In the GUI:
   - Paste your IAM policy JSON directly into the text area, OR
   - Click "Load from File" to load a JSON file

3. Select the policy type (Identity Policy or Resource Policy)

4. Click "Validate Policy" to check for issues

## Example Policy

Test with this overly permissive policy:

```json
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
```
