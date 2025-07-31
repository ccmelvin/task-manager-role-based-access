#!/bin/bash

# Task Manager - Validate and Deploy Script
# This script validates IAM policies before deployment

set -e

echo "🚀 Task Manager - Validate and Deploy Pipeline"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_PROFILE=${AWS_PROFILE:-spoke}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME=${STACK_NAME:-TaskManagerStack}

# Step 1: Build backend
echo -e "\n${YELLOW}📦 Building backend...${NC}"
cd ../backend
npm run build
cd ../infrastructure

# Step 2: Synthesize CDK stack
echo -e "\n${YELLOW}🔧 Synthesizing CDK stack...${NC}"
cdk synth --profile $AWS_PROFILE > cdk-template.json

if [ ! -f "cdk-template.json" ]; then
    echo -e "${RED}❌ Failed to generate CDK template${NC}"
    exit 1
fi

echo -e "${GREEN}✅ CDK template generated successfully${NC}"

# Step 3: Validate IAM policies
echo -e "\n${YELLOW}🔍 Validating IAM policies...${NC}"

# Check if validator exists
if [ ! -f "iam_policy_validator_cli.py" ]; then
    echo -e "${RED}❌ IAM policy validator not found${NC}"
    exit 1
fi

# Run policy validation
python3 iam_policy_validator_cli.py \
    --file cdk-template.json \
    --template \
    --profile $AWS_PROFILE \
    --region $AWS_REGION \
    --fail-on-findings

VALIDATION_RESULT=$?

if [ $VALIDATION_RESULT -ne 0 ]; then
    echo -e "\n${RED}❌ Policy validation failed!${NC}"
    echo -e "${RED}Deployment blocked due to security issues.${NC}"
    echo -e "${YELLOW}Please fix the identified issues and try again.${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ All IAM policies validated successfully!${NC}"

# Step 4: Deploy stack
echo -e "\n${YELLOW}🚀 Deploying stack...${NC}"

# Confirm deployment
read -p "Deploy to AWS? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏸️  Deployment cancelled by user${NC}"
    exit 0
fi

# Deploy with CDK
cdk deploy --profile $AWS_PROFILE --require-approval never

DEPLOY_RESULT=$?

if [ $DEPLOY_RESULT -eq 0 ]; then
    echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
    
    # Display stack outputs
    echo -e "\n${YELLOW}📋 Stack Outputs:${NC}"
    aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table
else
    echo -e "\n${RED}❌ Deployment failed!${NC}"
    exit 1
fi

# Cleanup
echo -e "\n${YELLOW}🧹 Cleaning up temporary files...${NC}"
rm -f cdk-template.json

echo -e "\n${GREEN}✅ Pipeline completed successfully!${NC}"