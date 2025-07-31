#!/bin/bash
# Setup script for IAM Policy Validator demo

echo "📦 Installing Python dependencies..."
pip3 install boto3 tkinter

echo "✅ Dependencies installed!"
echo ""
echo "🔧 Next steps:"
echo "1. Configure AWS profile: aws configure --profile your-profile"
echo "2. Run GUI validator: python3 iam_policy_validator.py"
echo "3. Run CLI demo: python3 demo_access_analyzer.py"