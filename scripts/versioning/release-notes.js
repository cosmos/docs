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

// Load product configuration from versions.json
function getProductConfig(subdir) {
  const versionsPath = path.join(__dirname, '..', '..', 'versions.json');
  let config = {};
  if (fs.existsSync(versionsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
      if (data.products && data.products[subdir]) {
        config = data.products[subdir];
      }
    } catch (e) {
      // Fallback to defaults
    }
  }

  // Fallback repo mapping if not in versions.json
  const defaultRepos = {
    evm: 'cosmos/evm',
    sdk: 'cosmos/cosmos-sdk',
    ibc: 'cosmos/ibc-go'
  };

  return {
    repository: config.repository || defaultRepos[subdir] || `cosmos/${subdir}`,
    changelogPath: config.changelogPath || 'CHANGELOG.md'
  };
}

const productConfig = getProductConfig(SUBDIR);
const REPO = productConfig.repository;
const PRODUCT_LABEL = SUBDIR.toUpperCase();

// Changelog paths - primary from config, fallbacks for discovery
function getChangelogPaths(configPath) {
  const paths = [configPath];
  // Add common fallbacks if not already included
  const fallbacks = [
    'CHANGELOG.md',
    'RELEASE_NOTES.md',
    'RELEASES.md',
    'CHANGELOG/CHANGELOG.md',
    'docs/CHANGELOG.md'
  ];
  for (const fb of fallbacks) {
    if (fb !== configPath) paths.push(fb);
  }
  return paths;
}

const CHANGELOG_PATHS = getChangelogPaths(productConfig.changelogPath);

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
      let changelog = await response.text();
      if (changelog && changelog.trim().length > 0) {
        // Remove all HTML comment blocks before parsing
        // This prevents malformed MDX comments in the output
        changelog = changelog.replace(/<!--[\s\S]*?-->/g, '');
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
  // Clean up line for MDX compatibility
  // Note: HTML comments are already stripped at fetch time

  let cleaned = line.trim();

  // Escape comparison operators that could be interpreted as JSX/HTML tags
  // Must preserve markdown links [text](url) - match them first
  const markdownLinks = [];
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const placeholder = `__LINK_${markdownLinks.length}__`;
    markdownLinks.push({ text, url });
    return placeholder;
  });

  // Now escape comparison operators outside of markdown links
  cleaned = cleaned
    .replace(/ <= /g, ' &lt;= ')
    .replace(/ >= /g, ' &gt;= ')
    .replace(/ < /g, ' &lt; ')
    .replace(/ > /g, ' &gt; ');

  // Restore markdown links
  markdownLinks.forEach((link, i) => {
    cleaned = cleaned.replace(`__LINK_${i}__`, `[${link.text}](${link.url})`);
  });

  return cleaned;
}

function parseChangelogToMintlify(changelogContent) {
  console.log(' Converting changelog to Mintlify format...');

  const lines = changelogContent.split('\n');
  const updates = [];
  let currentVersion = null;
  let currentDate = null;
  let currentSection = null;
  let sections = {};
  let skipUntilVersion = true;

  for (const line of lines) {
    // Skip main changelog header
    if (line.match(/^#\s+Changelog/i)) {
      continue;
    }

    // Detect unreleased section header
    if (line.match(/^##\s*\[?Unreleased\]?(?:\([^)]*\))?/i)) {
      skipUntilVersion = true;
      continue;
    }

    // Match version headers
    const versionMatch = line.match(/^##\s*\[?([vV]?\d+\.\d+(?:\.(?:\d+|x))?)\]?(?:\([^)]*\))?\s*(?:-\s*(.+))?$/);

    if (versionMatch) {
      skipUntilVersion = false;

      // Save previous version if exists
      if (currentVersion && Object.keys(sections).length > 0) {
        updates.push({
          version: currentVersion,
          date: currentDate,
          sections: sections
        });
      }

      // Start new version
      currentVersion = versionMatch[1];
      currentDate = versionMatch[2] || '';
      sections = {};
      currentSection = null;
      continue;
    }

    // Skip content until we find the first version
    if (skipUntilVersion) continue;

    // Skip empty lines and separators
    if (!line.trim() || line.match(/^[-=]+$/)) continue;

    // Match section headers (### Features, ### Bug Fixes, etc.)
    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      continue;
    }

    // Collect changes under current section
    if (currentVersion && (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\s+\*/))) {
      const cleanedLine = sanitizeLine(line.trim().replace(/^[*-]\s*/, ''));
      if (currentSection) {
        sections[currentSection].push(cleanedLine);
      } else {
        // No section header, add to "Changes" section
        if (!sections['Changes']) {
          sections['Changes'] = [];
        }
        sections['Changes'].push(cleanedLine);
      }
    }
  }

  // Add the last version
  if (currentVersion && Object.keys(sections).length > 0) {
    updates.push({
      version: currentVersion,
      date: currentDate,
      sections: sections
    });
  }

  // Fallback: if nothing parsed, create a single update with available content
  if (updates.length === 0) {
    console.log('   ⚠ No versions parsed from changelog, creating fallback entry');
    const nonEmpty = lines.filter(l => l.trim().length).slice(0, 100);
    updates.push({
      version: 'latest',
      date: '',
      sections: {
        'Changes': nonEmpty.map(l => sanitizeLine(l.trim()))
      }
    });
  }

  // Generate Mintlify format with proper structure
  const mintlifyContent = `---
title: "Release Notes"
description: "Release history and changelog for Cosmos ${PRODUCT_LABEL}"
mode: "wide"
---

<Info>
  This page tracks all releases and changes from the [${REPO}](https://github.com/${REPO}) repository.
  For the latest development updates, see the [UNRELEASED](https://github.com/${REPO}/blob/main/CHANGELOG.md#unreleased) section.
</Info>

${updates.map(update => {
  // Format date for label
  const label = update.date || 'Release';

  // Generate sections with markdown headers
  const sectionsContent = Object.entries(update.sections)
    .map(([sectionName, items]) => {
      if (items.length === 0) return '';
      return `## ${sectionName}\n\n${items.map(item => `- ${item}`).join('\n')}`;
    })
    .filter(s => s)
    .join('\n\n');

  return `<Update label="${label}" description="${update.version}" tags={["${PRODUCT_LABEL}", "Release"]}>
${sectionsContent}
</Update>`;
}).join('\n\n')}`;

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
      // Use 'main' branch to get full changelog with all versions
      // Using a specific release tag often only includes that release's notes
      source = 'main';
      console.log(` Using main branch for full changelog history`);
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
