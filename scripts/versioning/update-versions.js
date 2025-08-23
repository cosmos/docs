#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const action = process.argv[2];
const version = process.argv[3];

if (!action || !version) {
  console.error('Usage: node update-versions.js [add|remove] VERSION');
  process.exit(1);
}

const versionsPath = path.join(__dirname, '..', '..', 'versions.json');
const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));

switch (action) {
  case 'add':
    // Add new version after 'main' (main stays first, then newest to oldest)
    if (!versions.versions.includes(version)) {
      // Find main's position
      const mainIndex = versions.versions.indexOf('main');

      if (mainIndex > -1) {
        // Insert new version right after main
        versions.versions.splice(mainIndex + 1, 0, version);
      } else {
        // If no main, add at beginning
        versions.versions.unshift(version);
      }

      // Update default version to the new version
      versions.defaultVersion = version;

      console.log(` Added version ${version}`);
    } else {
      console.log(`  Version ${version} already exists`);
    }
    break;

  case 'remove':
    const index = versions.versions.indexOf(version);
    if (index > -1) {
      versions.versions.splice(index, 1);
      console.log(` Removed version ${version}`);

      // Update default if removed version was default
      if (versions.defaultVersion === version) {
        // Set to first non-main version, or main if no other versions
        const nonMainVersions = versions.versions.filter(v => v !== 'main');
        versions.defaultVersion = nonMainVersions[0] || 'main';
        console.log(` Updated default version to ${versions.defaultVersion}`);
      }
    } else {
      console.log(`  Version ${version} not found`);
    }
    break;

  default:
    console.error('Invalid action. Use: add or remove');
    process.exit(1);
}

// Write updated versions.json
fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');
console.log(' Updated versions.json');