# IAM Policy Validator Tools

A comprehensive set of Python tools to validate IAM policies using AWS Access Analyzer, featuring both GUI and command-line interfaces.

## 🚀 Features

### GUI Application (`iam_policy_validator.py`)
- **Intuitive Interface**: Easy-to-use graphical interface with help menus
- **Flexible AWS Credentials**: Uses default credentials or select specific profiles
- **Policy Input Options**: Paste JSON directly or load from files
- **Policy Type Support**: Both Identity and Resource policies
- **Detailed Results**: Color-coded findings with severity levels and recommendations
- **Real-time Identity Verification**: Shows current AWS user/role
- **Example Policies**: Built-in examples for testing

### Command-Line Tool (`simple_validator.py`)
- **CLI Interface**: Perfect for automation and screenshots
- **Profile Support**: Use `--profile` flag for specific AWS profiles
- **Flexible Input**: Validate any policy file
- **Detailed Output**: Formatted results with emojis and links

## 📋 Requirements

- **Python 3.6+** with tkinter support
- **AWS Credentials** configured via:
  - `aws configure` (recommended)
  - Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
  - IAM role (if running on EC2)
- **AWS Permissions**:
  - `access-analyzer:ValidatePolicy`
  - `sts:GetCallerIdentity`

## 🛠️ Setup

1. **Install Python dependencies:**
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Configure AWS credentials** (choose one):
```bash
# Option 1: Default profile
aws configure

# Option 2: Named profile
aws configure --profile myprofile

# Option 3: Environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

## 🎯 Usage

### GUI Application

```bash
# Use default AWS credentials
python iam_policy_validator.py
```

**In the GUI:**
1. **AWS Setup**: Tool automatically connects with default credentials
   - Click "Change Profile" to select a specific AWS profile
   - Current identity is displayed for verification
2. **Policy Input**: 
   - Paste JSON directly into the text area, OR
   - Click "Load from File" to load a JSON file
3. **Validation**: 
   - Select policy type (Identity or Resource)
   - Click "Validate Policy"
4. **Help**: Use the Help menu for usage instructions and examples

### Command-Line Tool

```bash
# Use default credentials with default file
python simple_validator.py

# Specify a different policy file
python simple_validator.py my-policy.json

# Use a specific AWS profile
python simple_validator.py --profile myprofile

# Combine options
python simple_validator.py my-policy.json --profile myprofile
```

## 📝 Example Policies

### Overly Permissive Policy (will show warnings)
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

### Well-Scoped S3 Policy (should pass)
```json
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
```

### Resource Policy Example (S3 bucket policy)
```json
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
```

## 🔍 Understanding Results

- 🚨 **ERROR**: Critical issues that prevent policy from working
- ⚠️ **SECURITY_WARNING**: Potential security concerns  
- ℹ️ **INFO**: General recommendations and best practices

Each finding includes:
- Issue code and description
- Detailed explanation
- Link to AWS documentation for more information

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| "AWS credentials not found" | Run `aws configure` or set environment variables |
| "Access denied" | Ensure your AWS user/role has `access-analyzer:ValidatePolicy` permission |
| "Profile not found" | Check available profiles: `aws configure list-profiles` |
| GUI doesn't start | Ensure tkinter is installed: `python -m tkinter` |
| Import errors | Activate virtual environment and install requirements |

## 🏗️ Files in this Directory

```
infrastructure/
├── iam_policy_validator.py    # GUI application
├── simple_validator.py        # Command-line tool
├── requirements.txt           # Python dependencies
├── problematic-policy.json    # Example policy for testing
├── resource-policy.json       # Example resource policy
└── venv/                      # Virtual environment (created during setup)
```

---

**💡 Pro Tip**: Start with the GUI application for interactive policy development, then use the command-line tool for automation and CI/CD pipelines!
