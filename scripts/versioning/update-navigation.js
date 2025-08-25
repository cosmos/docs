#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const VERSION = process.argv[2];

if (!VERSION) {
  console.error('Usage: node update-navigation.js VERSION');
  process.exit(1);
}

const docsJsonPath = path.join(__dirname, '..', '..', 'docs.json');
const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));

// Function to recursively update paths in navigation
function updatePaths(obj, fromPrefix, toPrefix) {
  if (typeof obj === 'string') {
    // Replace path prefix
    if (obj.startsWith(fromPrefix)) {
      return obj.replace(fromPrefix, toPrefix);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => updatePaths(item, fromPrefix, toPrefix));
  }

  if (typeof obj === 'object' && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      if (key === 'page' || key === 'pages' || key === 'groups' || key === 'tabs' || key === 'anchors') {
        newObj[key] = updatePaths(obj[key], fromPrefix, toPrefix);
      } else {
        newObj[key] = obj[key];
      }
    }
    return newObj;
  }

  return obj;
}

// Initialize versions array if it doesn't exist
if (!docsJson.navigation.versions) {
  docsJson.navigation.versions = [];
}

// Check if this is the 'main' version
if (VERSION === 'main') {
  console.log('  Skipping navigation update for main version');
  process.exit(0);
}

// Get the base navigation structure
// Priority: 1) root tabs, 2) main version, 3) any existing version
let baseNavigation;

if (docsJson.navigation.tabs) {
  // Use root-level tabs (these should have docs/ paths)
  baseNavigation = { tabs: docsJson.navigation.tabs };
  console.log('  Using root-level navigation structure');
} else {
  // Look for main version first
  const mainVersion = docsJson.navigation.versions.find(v => v.version === 'main');
  if (mainVersion) {
    baseNavigation = { tabs: mainVersion.tabs };
    console.log('  Using main version navigation structure');
  } else if (docsJson.navigation.versions && docsJson.navigation.versions.length > 0) {
    // Fallback to any existing version
    const latestVersion = docsJson.navigation.versions[0];
    baseNavigation = { tabs: latestVersion.tabs };
    console.log(`  Using ${latestVersion.version} navigation structure as base`);
  } else {
    console.error(' No navigation structure found');
    process.exit(1);
  }
}

// Create versioned navigation for the frozen version
const versionedNavigation = {
  version: VERSION,
  ...updatePaths(baseNavigation, 'docs/', `${VERSION}/`)
};

// Check if version already exists
const existingVersionIndex = docsJson.navigation.versions.findIndex(v => v.version === VERSION);

// Add or update the version in the navigation
if (existingVersionIndex >= 0) {
  docsJson.navigation.versions[existingVersionIndex] = versionedNavigation;
  console.log(` Updated navigation for version ${VERSION}`);
} else {
  // Add new version at the beginning (latest first)
  docsJson.navigation.versions.unshift(versionedNavigation);
  console.log(` Added navigation for version ${VERSION}`);
}

// Ensure 'main' version exists and always points to docs/
const mainVersionIndex = docsJson.navigation.versions.findIndex(v => v.version === 'main');

// Create main navigation - always pointing to docs/
// We need to normalize the baseNavigation to ensure it uses docs/ paths
let mainNavigationContent = JSON.parse(JSON.stringify(baseNavigation)); // Deep copy

// Update any version-specific paths back to docs/
// This handles cases where baseNavigation might have come from a versioned source
const versionPatterns = [
  /^v\d+\.\d+\.x\//,  // Matches v0.4.x/, v0.5.x/, etc.
  /^v\d+\.\d+\.\d+\// // Matches v0.4.0/, v0.5.0/, etc.
];

function normalizeToDocsPath(str) {
  if (typeof str !== 'string') return str;
  for (const pattern of versionPatterns) {
    if (pattern.test(str)) {
      return str.replace(pattern, 'docs/');
    }
  }
  return str;
}

function normalizePaths(obj) {
  if (typeof obj === 'string') {
    return normalizeToDocsPath(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(normalizePaths);
  }
  if (typeof obj === 'object' && obj !== null) {
    const normalized = {};
    for (const key in obj) {
      normalized[key] = normalizePaths(obj[key]);
    }
    return normalized;
  }
  return obj;
}

mainNavigationContent = normalizePaths(mainNavigationContent);

const mainNavigation = {
  version: 'main',
  ...mainNavigationContent
};

if (mainVersionIndex >= 0) {
  docsJson.navigation.versions[mainVersionIndex] = mainNavigation;
} else {
  docsJson.navigation.versions.push(mainNavigation);
}

// Write updated docs.json
fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2) + '\n');
console.log(` Navigation updated for version ${VERSION}`);
console.log(` Updated docs.json with ${docsJson.navigation.versions.length} versions`);