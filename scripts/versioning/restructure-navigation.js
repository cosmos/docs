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
  // Ensure we have the versions array
  if (!docsJson.navigation.versions) {
    docsJson.navigation.versions = [];
  }

  // Find or create the main version entry
  let mainIndex = docsJson.navigation.versions.findIndex(v => v.version === 'main');

  // Get the current root tabs (these represent main/development)
  const currentTabs = docsJson.navigation.tabs;

  if (currentTabs) {
    // Update or create main version
    const mainVersion = {
      version: 'main',
      tabs: currentTabs
    };

    if (mainIndex >= 0) {
      docsJson.navigation.versions[mainIndex] = mainVersion;
    } else {
      // Add main at the end (after numbered versions)
      docsJson.navigation.versions.push(mainVersion);
    }

    // Remove root-level tabs to avoid confusion
    delete docsJson.navigation.tabs;
  }

  // Sort versions: numbered versions first (newest to oldest), then main
  docsJson.navigation.versions.sort((a, b) => {
    // Main always goes last
    if (a.version === 'main') return 1;
    if (b.version === 'main') return -1;

    // For numbered versions, sort by version number (newest first)
    // Assuming format vX.Y.Z
    const parseVersion = (v) => {
      const match = v.match(/v(\d+)\.(\d+)\.(\d+)/);
      if (!match) return [0, 0, 0];
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    };

    const [aMajor, aMinor, aPatch] = parseVersion(a.version);
    const [bMajor, bMinor, bPatch] = parseVersion(b.version);

    if (bMajor !== aMajor) return bMajor - aMajor;
    if (bMinor !== aMinor) return bMinor - aMinor;
    return bPatch - aPatch;
  });

  // Add labels to make versions clearer
  docsJson.navigation.versions = docsJson.navigation.versions.map(v => {
    if (v.version === 'main') {
      // Don't modify main, just ensure it has the right structure
      return v;
    }

    // Check if this is the default/latest stable version
    if (v.version === versionsJson.defaultVersion && v.version !== 'main') {
      // Add a label to indicate this is the latest stable
      // Note: Mintlify might not support custom labels, so this is just for clarity
      return v;
    }

    return v;
  });

  console.log(' Navigation structure:');
  console.log(`   - ${docsJson.navigation.versions.length} versions total`);
  docsJson.navigation.versions.forEach(v => {
    const label = v.version === versionsJson.defaultVersion ? ' (default)' : '';
    const devLabel = v.version === 'main' ? ' (development)' : '';
    console.log(`   - ${v.version}${label}${devLabel}`);
  });
}

// Run the restructuring
restructureNavigation();

// Write the updated docs.json
fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2) + '\n');
console.log(' Navigation restructured successfully');
console.log(' docs.json updated');

// Provide guidance
console.log('\n Navigation structure explanation:');
console.log('   - Versions are listed newest to oldest');
console.log('   - "main" represents ongoing development (docs/ directory)');
console.log('   - Numbered versions (e.g., v0.4.0) are frozen snapshots');
console.log(`   - Default version for users: ${versionsJson.defaultVersion}`);