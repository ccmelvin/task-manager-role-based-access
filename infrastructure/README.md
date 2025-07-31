# IAM Policy Validator GUI

A simple GUI application to validate IAM policies using AWS Access Analyzer.

## Features

- **GUI Interface**: Easy-to-use graphical interface
- **Policy Input**: Paste JSON directly or load from file
- **AWS Integration**: Uses AWS Access Analyzer API with 'spoke' profile
- **Policy Types**: Supports both Identity and Resource policies
- **Detailed Results**: Shows findings with severity levels and recommendations

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure your AWS 'your-profile' profile is configured:
```bash
aws configure --profile your-profile
```

## Usage

1. Run the application:
```bash
python iam_policy_validator.py
```

2. Either:
   - Paste your IAM policy JSON directly into the text area, OR
   - Click "Load from File" to load a JSON file

3. Select the policy type (Identity Policy or Resource Policy)

4. Click "Validate Policy" to check for issues

## Example Policy to Test

Try this overly permissive policy to see validation in action:

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

## Integration with CDK

To validate CDK-generated policies:

1. Run `cdk synth` to generate CloudFormation templates
2. Extract IAM policies from the generated templates
3. Use this tool to validate each policy before deployment
