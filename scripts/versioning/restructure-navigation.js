#!/usr/bin/env node

/**
 * Restructures docs.json to have a cleaner navigation structure
 * Ensures main/development version is clear and versions are properly organized
 */

const fs = require('fs');
const path = require('path');

const docsJsonPath = path.join(__dirname, '..', '..', 'docs.json');
const versionsJsonPath = path.join(__dirname, '..', '..', 'versions.json');

// Read current configurations
const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));
const versionsJson = JSON.parse(fs.readFileSync(versionsJsonPath, 'utf8'));

// Restructure navigation
function restructureNavigation() {
  // New navigation structure uses dropdowns per product; no restructuring needed.
  if (docsJson.navigation && Array.isArray(docsJson.navigation.dropdowns)) {
    console.log(' Detected dropdowns-based navigation; no restructuring required.');
    return;
  }

  // Legacy fallback: convert root tabs to versions array
  if (!docsJson.navigation.versions) {
    docsJson.navigation.versions = [];
  }

  let mainIndex = docsJson.navigation.versions.findIndex(v => v.version === 'main');
  const currentTabs = docsJson.navigation.tabs;

  if (currentTabs) {
    const mainVersion = {
      version: 'main',
      tabs: currentTabs
    };

    if (mainIndex >= 0) {
      docsJson.navigation.versions[mainIndex] = mainVersion;
    } else {
      docsJson.navigation.versions.push(mainVersion);
    }
    delete docsJson.navigation.tabs;
  }

  // Simple sort helper for vX.Y[.Z]
  const parseVersion = (v) => {
    const match = v.match(/v(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3] || '0')];
  };

  docsJson.navigation.versions.sort((a, b) => {
    if (a.version === 'main') return 1;
    if (b.version === 'main') return -1;
    const [aMajor, aMinor, aPatch] = parseVersion(a.version);
    const [bMajor, bMinor, bPatch] = parseVersion(b.version);
    if (bMajor !== aMajor) return bMajor - aMajor;
    if (bMinor !== aMinor) return bMinor - aMinor;
    return bPatch - aPatch;
  });

  console.log(' Navigation structure updated for legacy format.');
}

// Run the restructuring
restructureNavigation();

// Write the updated docs.json
fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2) + '\n');
console.log(' Navigation restructured successfully');
console.log(' docs.json updated');

// Provide guidance
console.log('\n Navigation structure explanation:');
console.log('   - For dropdown-based navigation, manage versions per product in docs.json');
if (versionsJson.products) {
  console.log('   - versions.json now tracks products and their versions');
} else {
  console.log('   - Legacy versions.json detected');
}
