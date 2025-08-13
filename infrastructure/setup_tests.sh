#!/bin/bash

# Setup script for Playwright testing

echo "🚀 Setting up Playwright testing environment..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install test dependencies
echo "Installing test dependencies..."
pip install -r requirements-test.txt

# Install Playwright browsers
echo "Installing Playwright browsers..."
playwright install

# Install Playwright system dependencies (Linux/Ubuntu)
if command -v apt-get &> /dev/null; then
    echo "Installing Playwright system dependencies..."
    playwright install-deps
fi

# Create test directories
echo "Creating test directories..."
mkdir -p tests/fixtures/test-policies
mkdir -p tests/fixtures/screenshots

echo "✅ Setup complete!"
echo ""
echo "To run tests:"
echo "  source venv/bin/activate"
echo "  pytest tests/"
echo ""
echo "To run specific test types:"
echo "  pytest tests/test_cli_e2e.py -v"
echo "  pytest tests/test_aws_integration.py -v"
echo ""
echo "To run tests with coverage:"
echo "  pytest tests/ --cov=. --cov-report=html"
