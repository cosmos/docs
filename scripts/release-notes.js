#!/usr/bin/env node

/**
 * Release Notes Management
 * Combines changelog fetching and parsing functionality
 * Supports multiple products and versions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
// Usage: node release-notes.js [source/version] [product] [specific-version]
// Examples:
//   node release-notes.js latest evm          # Fetch latest for EVM (default behavior)
//   node release-notes.js all sdk             # Fetch all versions for SDK
//   node release-notes.js v0.53 sdk           # Fetch specific version for SDK
//   node release-notes.js latest ibc v1.0     # Fetch for IBC v1.0
const SOURCE = process.argv[2] || 'latest';
const SUBDIR = process.argv[3] || process.env.DOCS_SUBDIR || process.env.SUBDIR || 'evm';
const SPECIFIC_VERSION = process.argv[4]; // Optional: specific version to target

// Repo mapping per product - expandable for future products
const PRODUCT_REPOS = {
  evm: 'cosmos/evm',
  sdk: 'cosmos/cosmos-sdk',
  ibc: 'cosmos/ibc-go',
  cometbft: 'cometbft/cometbft',
  // Add more products as needed
};

// Version configurations per product
const PRODUCT_VERSIONS = {
  evm: ['next', 'v0.4.x'], // EVM versions
  sdk: ['next', 'v0.53', 'v0.50', 'v0.47'], // SDK versions
  ibc: ['next', 'v10.1.x', 'v8.5.x', 'v7.8.x', 'v6.3.x', 'v5.4.x', 'v4.6.x'], // IBC versions
  cometbft: ['v0.38', 'v0.37'], // Example CometBFT versions (to be added)
  // Add version configs as needed
};

const REPO = PRODUCT_REPOS[SUBDIR] || PRODUCT_REPOS.evm;
const PRODUCT_LABEL = SUBDIR.toUpperCase();

// Common changelog file candidates by repo
const CHANGELOG_PATHS = [
  'CHANGELOG.md',
  'RELEASE_NOTES.md',
  'RELEASES.md',
  'CHANGELOG/CHANGELOG.md',
  'docs/CHANGELOG.md'
];

async function getLatestRelease() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    const data = await response.json();
    return data.tag_name;
  } catch (error) {
    console.warn('Could not fetch latest tag, falling back to main branch');
    return 'main';
  }
}

async function fetchChangelog(source, version = null) {
  // Determine the actual source to fetch from
  let fetchSource = source;

  // Handle different branch naming conventions per product
  if (version && SUBDIR === 'ibc') {
    // IBC uses release/vX.Y.x format (with .x suffix)
    // For version patterns like v10.1.x, v8.5.x, use the pattern as-is

    // For 'next', use 'main' branch
    if (version === 'next') {
      fetchSource = 'main';
    } else {
      // IBC uses vX.Y.x format for release branches
      fetchSource = `release/${version}`;
    }
  } else if (version && SUBDIR === 'sdk') {
    // SDK uses release/vX.Y.x branch format
    if (version === 'next') {
      fetchSource = 'main';
    } else {
      fetchSource = `release/${version}.x`;
    }
  } else if (source === 'latest' && version) {
    // For specific version requests
    fetchSource = version;
  }

  console.log(` Fetching changelog from ${REPO}: ${fetchSource}...`);

  const errors = [];
  const sources = [fetchSource];

  // Add fallback sources
  if (fetchSource !== source) {
    sources.push(source);
  }
  if (version && !sources.includes(version)) {
    sources.push(version);
  }

  for (const src of sources) {
    for (const p of CHANGELOG_PATHS) {
      const url = `https://raw.githubusercontent.com/${REPO}/${src}/${p}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          errors.push(`${src}/${p}: ${response.status}`);
          continue;
        }
        const changelog = await response.text();
        if (changelog && changelog.trim().length > 0) {
          console.log(`✓ Fetched ${p} from ${src} (${changelog.split('\n').length} lines)`);
          return changelog;
        }
        errors.push(`${src}/${p}: empty`);
      } catch (err) {
        errors.push(`${src}/${p}: ${err.message}`);
      }
    }
  }

  throw new Error(`Failed to fetch changelog from ${REPO}. Tried: ${errors.join('; ')}`);
}

function sanitizeLine(line) {
  // Convert HTML comments to MDX comments and neutralize problematic sequences
  return line.replace(/<!--/g, '{/*').replace(/-->/g, '*/}');
}

function parseChangelogToMintlify(changelogContent, targetVersion = null) {
  console.log(' Converting changelog to Mintlify format...');

  const lines = changelogContent.split('\n');
  const updates = [];
  let currentVersion = null;
  let currentDate = null;
  let currentChanges = [];

  // For version-specific requests (e.g., v0.53), extract major.minor version
  let targetMajorMinor = null;
  if (targetVersion && targetVersion !== 'next') {
    // Extract major.minor from patterns like v0.53, v0.53.x, v10.1.x
    const match = targetVersion.match(/^v?(\d+\.\d+)/);
    if (match) {
      targetMajorMinor = match[1];
    }
  }

  for (const line of lines) {
    // Match version headers commonly used across repos
    // Examples:
    //   ## [v0.4.1] - 2024-08-15
    //   ## v0.53.0 - 2024-08-15
    //   ## v0.53
    //   ## [v0.4.x] - 2024-08-15
    //   ## [v0.53.4](link) - 2025-07-25
    const versionMatch = line.match(/^##\s*\[?v?(\d+\.\d+(?:\.\d+)?(?:\.x)?)\]?(?:\([^)]*\))?\s*(?:-\s*(.+))?$/);

    if (versionMatch) {
      // Save previous version if exists
      if (currentVersion && currentChanges.length > 0) {
        updates.push({
          version: currentVersion,
          date: currentDate,
          changes: currentChanges
        });
      }

      // Start new version
      currentVersion = versionMatch[1];
      currentDate = versionMatch[2] || '';
      currentChanges = [];
      continue;
    }

    // Skip empty lines and separators
    if (!line.trim() || line.match(/^[-=]+$/)) continue;

    // Collect changes (lines that start with - or * or are indented)
    if (currentVersion && (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\s+/))) {
      currentChanges.push(sanitizeLine(line.trim()));
    }
  }

  // Add the last version
  if (currentVersion && currentChanges.length > 0) {
    updates.push({
      version: currentVersion,
      date: currentDate,
      changes: currentChanges
    });
  }

  // Filter updates to only include versions matching the target
  let filteredUpdates = updates;
  if (targetMajorMinor) {
    filteredUpdates = updates.filter(update => {
      // Check if the update version starts with the target major.minor
      const updateVersion = update.version.replace(/^v/, '');
      return updateVersion.startsWith(targetMajorMinor);
    });

    // If no matching versions found, include all as fallback
    if (filteredUpdates.length === 0) {
      console.log(` No versions matching ${targetMajorMinor} found, including all versions`);
      filteredUpdates = updates;
    } else {
      console.log(` Found ${filteredUpdates.length} versions matching ${targetMajorMinor}`);
    }
  }

  // Fallback: if nothing parsed, wrap entire changelog
  if (filteredUpdates.length === 0) {
    const nonEmpty = lines.filter(l => l.trim().length).slice(0, 500);
    filteredUpdates.push({ version: targetVersion || SOURCE, date: '', changes: nonEmpty.map(l => sanitizeLine(`- ${l.trim()}`)) });
  }

  // Generate Mintlify format
  const mintlifyContent = `---
title: "Release Notes"
description: "Cosmos ${PRODUCT_LABEL} release notes and changelog"
mode: "custom"
---

${filteredUpdates.map(update =>
  `<Update version="${update.version}" date="${update.date}">
${update.changes.map(change => `  ${change}`).join('\n')}
</Update>`
).join('\n\n')}`;

  return mintlifyContent;
}

async function updateReleaseNotes(content, version = 'next') {
  // Determine output path based on product and version
  const outputPath = path.join(
    __dirname,
    '..',
    'docs',
    SUBDIR,
    version,
    'changelog',
    'release-notes.mdx'
  );
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write the file
  fs.writeFileSync(outputPath, content);

  const versionCount = (content.match(/<Update/g) || []).length;
  console.log(`✓ Release notes updated with ${versionCount} versions`);
  console.log(` Output: ${outputPath}`);

  return { outputPath, versionCount };
}

async function processVersion(version, source) {
  try {
    // Fetch and process changelog for this version
    const changelog = await fetchChangelog(source, version);
    const mintlifyContent = parseChangelogToMintlify(changelog, version);
    const result = await updateReleaseNotes(mintlifyContent, version);

    return {
      version,
      success: true,
      ...result
    };
  } catch (error) {
    console.error(` Failed for ${version}: ${error.message}`);
    return {
      version,
      success: false,
      error: error.message
    };
  }
}

async function main() {
  try {
    console.log(`\n=== Release Notes Update ===`);
    console.log(` Product: ${PRODUCT_LABEL}`);
    console.log(` Repository: ${REPO}`);

    let results = [];

    // Handle different modes
    if (SOURCE === 'all') {
      // Process all configured versions for this product
      const versions = PRODUCT_VERSIONS[SUBDIR] || ['next'];
      console.log(` Processing versions: ${versions.join(', ')}\n`);

      for (const version of versions) {
        const result = await processVersion(version, 'latest');
        results.push(result);
      }
    } else if (SPECIFIC_VERSION) {
      // Process specific version only
      console.log(` Processing specific version: ${SPECIFIC_VERSION}\n`);
      const result = await processVersion(SPECIFIC_VERSION, SOURCE);
      results.push(result);
    } else {
      // Default behavior - process for 'next' or default version
      let source = SOURCE;
      if (source === 'latest') {
        source = await getLatestRelease();
        console.log(` Using latest release: ${source}`);
      }

      const targetVersion = PRODUCT_VERSIONS[SUBDIR]?.[0] || 'next';
      const result = await processVersion(targetVersion, source);
      results.push(result);
    }

    // Summary
    console.log('\n=== Summary ===');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0) {
      console.log('✓ Successful updates:');
      successful.forEach(r => {
        console.log(`   ${r.version}: ${r.versionCount} versions -> ${r.outputPath}`);
      });
    }

    if (failed.length > 0) {
      console.log('✗ Failed updates:');
      failed.forEach(r => {
        console.log(`   ${r.version}: ${r.error}`);
      });
    }

    if (failed.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error(' Failed to update release notes:', error.message);
    process.exit(1);
  }
}

// Support both direct execution and module import
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fetchChangelog, parseChangelogToMintlify, updateReleaseNotes };
