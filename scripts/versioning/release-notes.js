#!/usr/bin/env node

/**
 * Release Notes Management
 * Combines changelog fetching and parsing functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get source from command line argument, default to latest release
const SOURCE = process.argv[2] || 'latest';
const SUBDIR = process.argv[3] || process.env.DOCS_SUBDIR || process.env.SUBDIR || 'evm';

// Repo mapping per product
const PRODUCT_REPOS = {
  evm: 'cosmos/evm',
  sdk: 'cosmos/cosmos-sdk',
  ibc: 'cosmos/ibc-go'
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

async function fetchChangelog(source) {
  console.log(` Fetching changelog from ${REPO}: ${source}...`);

  const errors = [];
  for (const p of CHANGELOG_PATHS) {
    const url = `https://raw.githubusercontent.com/${REPO}/${source}/${p}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        errors.push(`${p}: ${response.status}`);
        continue;
      }
      const changelog = await response.text();
      if (changelog && changelog.trim().length > 0) {
        console.log(`✓ Fetched ${p} (${changelog.split('\n').length} lines)`);
        return changelog;
      }
      errors.push(`${p}: empty`);
    } catch (err) {
      errors.push(`${p}: ${err.message}`);
    }
  }

  throw new Error(`Failed to fetch changelog from ${REPO}. Tried: ${errors.join('; ')}`);
}

function sanitizeLine(line) {
  // Convert HTML comments to MDX comments and neutralize problematic sequences
  return line.replace(/<!--/g, '{/*').replace(/-->/g, '*/}');
}

function parseChangelogToMintlify(changelogContent) {
  console.log(' Converting changelog to Mintlify format...');

  const lines = changelogContent.split('\n');
  const updates = [];
  let currentVersion = null;
  let currentDate = null;
  let currentChanges = [];

  for (const line of lines) {
    // Match version headers commonly used across repos
    // Examples:
    //   ## [v0.4.1] - 2024-08-15
    //   ## v0.53.0 - 2024-08-15
    //   ## v0.53
    //   ## [v0.4.x] - 2024-08-15
    const versionMatch = line.match(/^##\s*\[?([vV]?\d+\.\d+(?:\.(?:\d+|x))?)\]?\s*(?:-\s*(.+))?$/);

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

  // Fallback: if nothing parsed, wrap entire changelog
  if (updates.length === 0) {
    const nonEmpty = lines.filter(l => l.trim().length).slice(0, 500);
    updates.push({ version: SOURCE, date: '', changes: nonEmpty.map(l => sanitizeLine(`- ${l.trim()}`)) });
  }

  // Generate Mintlify format
  const mintlifyContent = `---
title: "Release Notes"
description: "Cosmos ${PRODUCT_LABEL} release notes and changelog"
mode: "custom"
---

${updates.map(update =>
  `<Update version="${update.version}" date="${update.date}">
${update.changes.map(change => `  ${change}`).join('\n')}
</Update>`
).join('\n\n')}`;

  return mintlifyContent;
}

async function updateReleaseNotes(content) {
  // Create directory if it doesn't exist
  const outputPath = path.join(__dirname, '..', '..', 'docs', SUBDIR, 'next', 'changelog', 'release-notes.mdx');
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

async function main() {
  try {
    // Determine source
    let source = SOURCE;
    if (source === 'latest') {
      source = await getLatestRelease();
      console.log(` Using latest release: ${source}`);
    }

    // Fetch and process changelog
    const changelog = await fetchChangelog(source);
    const mintlifyContent = parseChangelogToMintlify(changelog);
    const result = await updateReleaseNotes(mintlifyContent);

    console.log('\n Release notes update completed');
    console.log(` Summary:`);
    console.log(`   Repo: ${REPO}`);
    console.log(`   Source: ${source}`);
    console.log(`   Versions: ${result.versionCount}`);
    console.log(`   Output: ${result.outputPath}`);

  } catch (error) {
    console.error(' Failed to update release notes:', error.message);
    process.exit(1);
  }
}

main();
