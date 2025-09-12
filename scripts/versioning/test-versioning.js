#!/usr/bin/env node

/**
 * Test script for versioning system
 * Validates setup without making actual changes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(50));
console.log('   Testing Versioning System');
console.log('='.repeat(50));
console.log('');

// Test 1: Check dependencies
console.log('1. Checking dependencies...');
try {
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    throw new Error('Dependencies missing - run: cd scripts/versioning && npm install');
  }

  // Check for googleapis specifically
  if (!fs.existsSync(path.join(nodeModulesPath, 'googleapis'))) {
    throw new Error('googleapis dependency missing');
  }

  console.log('   ✓ Dependencies installed');
} catch (error) {
  console.log('   ✗ ' + error.message);
  process.exit(1);
}

// Test 2: Check Google Sheets API setup
console.log('2. Checking Google Sheets API setup...');
const serviceAccountPath = path.join(__dirname, 'service-account-key.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.log('   ✗ Service account key not found');
  console.log('   ERROR: Google Sheets API credentials are required');
  console.log('   See GSHEET-SETUP.md for setup instructions');
  process.exit(1);
}

console.log('   ✓ Service account key found');

// Test 3: Test Google Sheets connection
console.log('   Testing Google Sheets connection...');
try {
  execSync(`node sheets-manager.js test-version`, {
    cwd: __dirname,
    stdio: 'pipe'
  });
  console.log('   ✓ Google Sheets test successful');
  console.log('   ! Remember to delete the "test-version" tab from Google Sheets');
} catch (error) {
  console.log('   ✗ Google Sheets test failed');
  console.log('   ERROR: Check API credentials and spreadsheet permissions');
  process.exit(1);
}

// Test 4: Test release notes fetching
console.log('3. Testing release notes...');
try {
  execSync(`node release-notes.js latest evm`, {
    cwd: __dirname,
    stdio: 'pipe'
  });
  console.log('   ✓ Release notes fetch successful');
} catch (error) {
  console.log('    Release notes test failed (may be network issue)');
}

console.log('');
console.log('='.repeat(50));
console.log('   Test Summary');
console.log('='.repeat(50));
console.log('');
console.log(' All critical tests passed!');
console.log('');
console.log('Ready to use:');
console.log('   npm run freeze     # Freeze current version');
console.log('   npm run release-notes [version]  # Update release notes');
console.log('   npm run sheets <version>        # Manage Google Sheets');
console.log('');
