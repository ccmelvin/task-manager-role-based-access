#!/bin/bash

# Frontend Testing Setup Script

echo "🎭 Setting up Frontend Playwright Testing Environment..."
echo "=================================================="

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the frontend directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
npx playwright install

# Install system dependencies for Playwright (Linux/Ubuntu)
if command -v apt-get &> /dev/null; then
    echo "🔧 Installing Playwright system dependencies..."
    npx playwright install-deps
fi

# Create test directories
echo "📁 Creating test directories..."
mkdir -p test-results/screenshots
mkdir -p test-results/videos
mkdir -p playwright-report

# Run a quick test to verify setup
echo "🧪 Running setup verification test..."
if npx playwright test --list > /dev/null 2>&1; then
    echo "✅ Playwright setup successful!"
    
    # Show available tests
    echo ""
    echo "📋 Available test suites:"
    echo "  • app.spec.ts - Main application tests (8 tests)"
    echo "  • task-management.spec.ts - Task CRUD operations (15+ tests)"
    echo "  • role-based-access.spec.ts - Permission testing (20+ tests)"
    echo "  • ui-components.spec.ts - Component behavior (25+ tests)"
    echo "  • accessibility-performance.spec.ts - A11y & performance (15+ tests)"
    echo ""
    echo "Total: 60+ comprehensive E2E tests"
else
    echo "❌ Playwright setup failed. Please check the error messages above."
    exit 1
fi

echo ""
echo "🚀 Setup complete! You can now run tests:"
echo ""
echo "Basic commands:"
echo "  npm test                    # Unit tests (Jest)"
echo "  npm run test:e2e           # E2E tests (Playwright)"
echo "  npm run test:e2e:ui        # E2E tests with UI mode"
echo "  npm run test:e2e:headed    # E2E tests in headed mode"
echo "  npm run test:e2e:debug     # Debug mode"
echo "  npm run test:all           # All tests"
echo ""
echo "Specific test suites:"
echo "  npx playwright test tests/e2e/app.spec.ts"
echo "  npx playwright test tests/e2e/task-management.spec.ts"
echo "  npx playwright test tests/e2e/role-based-access.spec.ts"
echo ""
echo "Reports and debugging:"
echo "  npm run test:e2e:report    # Show test report"
echo "  npx playwright codegen localhost:3000  # Generate test code"
echo ""
echo "🎉 Happy testing!"
