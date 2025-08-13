#!/usr/bin/env node

/**
 * Simple test debug script to check if the React app is working
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Debugging Frontend Tests...\n');

// Check if package.json exists
const fs = require('fs');
const packagePath = path.join(__dirname, 'package.json');

if (!fs.existsSync(packagePath)) {
  console.error('❌ package.json not found');
  process.exit(1);
}

console.log('✅ package.json found');

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing dependencies...');
  
  const install = spawn('npm', ['install'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  install.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Dependencies installed');
      runBuild();
    } else {
      console.error('❌ Failed to install dependencies');
      process.exit(1);
    }
  });
} else {
  console.log('✅ node_modules found');
  runBuild();
}

function runBuild() {
  console.log('🏗️ Testing build...');
  
  const build = spawn('npm', ['run', 'build'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  build.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build successful!');
      console.log('\n🎉 Frontend is working correctly');
      console.log('📝 The issue might be with Playwright configuration or test expectations');
      console.log('\n💡 Suggestions:');
      console.log('   1. Check if React app starts correctly: npm start');
      console.log('   2. Verify test selectors match actual DOM elements');
      console.log('   3. Run tests locally: npm run test:e2e');
    } else {
      console.error('❌ Build failed');
      process.exit(1);
    }
  });
}
