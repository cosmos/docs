#!/usr/bin/env node

/**
 * Unified Changelog Management Script
 *
 * Usage:
 *   # Generate changelog for 'next' (all versions)
 *   node manage-changelogs.js --product evm --target next
 *
 *   # Generate changelog for specific version (e.g., v0.5.x releases for v0.5.0 directory)
 *   node manage-changelogs.js --product evm --target v0.5.0 --filter v0.5
 *
 *   # Generate all changelogs for a product
 *   node manage-changelogs.js --product evm --all
 *
 *   # Called by versioning script during version freeze
 *   node manage-changelogs.js --product evm --target v0.5.0 --freeze
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    product: 'evm',
    target: null,
    filter: null,
    all: false,
    freeze: false,
    source: 'main',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--product':
        config.product = args[++i];
        break;
      case '--target':
        config.target = args[++i];
        break;
      case '--filter':
        config.filter = args[++i];
        break;
      case '--all':
        config.all = true;
        break;
      case '--freeze':
        config.freeze = true;
        break;
      case '--source':
        config.source = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
Unified Changelog Management Script

Usage:
  node manage-changelogs.js [options]

Options:
  --product <name>      Product name (evm, sdk, ibc, etc.) [default: evm]
  --target <version>    Target version directory (next, v0.5.0, v0.4.x, etc.)
  --filter <pattern>    Version filter pattern (v0.5, v0.4, etc.)
  --all                 Generate changelogs for all versions of the product
  --freeze              Flag indicating this is a version freeze operation
  --source <ref>        Git ref to fetch from (main, tag, etc.) [default: main]
  --help                Show this help message

Examples:
  # Generate 'next' changelog with all versions
  node manage-changelogs.js --product evm --target next

  # Generate v0.5.0 changelog with only v0.5.x releases
  node manage-changelogs.js --product evm --target v0.5.0 --filter v0.5

  # Generate all changelogs for EVM
  node manage-changelogs.js --product evm --all

  # Called during version freeze
  node manage-changelogs.js --product evm --target v0.5.0 --freeze
`);
}

// Load product configuration from versions.json
function getProductConfig(product) {
  const versionsPath = path.join(__dirname, '..', '..', 'versions.json');
  let config = {};

  if (fs.existsSync(versionsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
      if (data.products && data.products[product]) {
        config = data.products[product];
      }
    } catch (e) {
      console.warn('Could not load versions.json, using defaults');
    }
  }

  const defaultRepos = {
    evm: 'cosmos/evm',
    sdk: 'cosmos/cosmos-sdk',
    ibc: 'cosmos/ibc-go',
    hub: 'cosmos/gaia',
  };

  return {
    repository: config.repository || defaultRepos[product] || `cosmos/${product}`,
    changelogPath: config.changelogPath || 'CHANGELOG.md',
    versions: config.versions || ['next'],
  };
}

// Fetch changelog from repository
async function fetchChangelog(repo, source, changelogPath) {
  console.log(`  Fetching changelog from ${repo}: ${source}...`);

  const changelogPaths = [
    changelogPath,
    'CHANGELOG.md',
    'RELEASE_NOTES.md',
    'RELEASES.md',
    'CHANGELOG/CHANGELOG.md',
    'docs/CHANGELOG.md',
  ];

  const errors = [];
  for (const p of changelogPaths) {
    const url = `https://raw.githubusercontent.com/${repo}/${source}/${p}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        errors.push(`${p}: ${response.status}`);
        continue;
      }
      let changelog = await response.text();
      if (changelog && changelog.trim().length > 0) {
        // Remove HTML comments
        changelog = changelog.replace(/<!--[\s\S]*?-->/g, '');
        console.log(`  ✓ Fetched ${p} (${changelog.split('\n').length} lines)`);
        return changelog;
      }
      errors.push(`${p}: empty`);
    } catch (err) {
      errors.push(`${p}: ${err.message}`);
    }
  }

  throw new Error(`Failed to fetch changelog from ${repo}. Tried: ${errors.join('; ')}`);
}

// Sanitize line for MDX compatibility
function sanitizeLine(line) {
  let cleaned = line.trim();
  const markdownLinks = [];

  // Preserve markdown links
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const placeholder = `__LINK_${markdownLinks.length}__`;
    markdownLinks.push({ text, url });
    return placeholder;
  });

  // Escape comparison operators
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

// Parse changelog to extract version updates
function parseChangelog(content, versionFilter = null) {
  const lines = content.split('\n');
  const updates = [];
  let currentVersion = null;
  let currentDate = null;
  let sections = {};
  let currentSection = null;
  let skipUntilVersion = true;

  for (const line of lines) {
    // Skip main changelog header
    if (line.match(/^#\s+Changelog/i)) continue;

    // Skip unreleased section
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
          sections: sections,
        });
      }

      // Start new version
      currentVersion = versionMatch[1];
      currentDate = versionMatch[2] || '';
      sections = {};
      currentSection = null;
      continue;
    }

    if (skipUntilVersion) continue;
    if (!line.trim() || line.match(/^[-=]+$/)) continue;

    // Match section headers
    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      continue;
    }

    // Collect changes
    if (currentVersion && (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\s+\*/))) {
      const cleanedLine = sanitizeLine(line.trim().replace(/^[*-]\s*/, ''));
      if (currentSection) {
        sections[currentSection].push(cleanedLine);
      } else {
        if (!sections['Changes']) sections['Changes'] = [];
        sections['Changes'].push(cleanedLine);
      }
    }
  }

  // Add the last version
  if (currentVersion && Object.keys(sections).length > 0) {
    updates.push({
      version: currentVersion,
      date: currentDate,
      sections: sections,
    });
  }

  // Apply version filter if specified
  if (versionFilter) {
    return updates.filter(u => u.version.startsWith(versionFilter));
  }

  return updates;
}

// Generate Mintlify content
function generateMintlifyContent(updates, repo, product, target) {
  const productLabel = product.toUpperCase();
  const isNext = target === 'next';

  const infoMessage = isNext
    ? `This page tracks all releases and changes from the [${repo}](https://github.com/${repo}) repository.
  For the latest development updates, see the [UNRELEASED](https://github.com/${repo}/blob/main/CHANGELOG.md#unreleased) section.`
    : `This page tracks all releases and changes from the [${repo}](https://github.com/${repo}) repository.
  For the latest development updates, see the [next](/${product}/next/changelog/release-notes) version.`;

  const content = `---
title: "Release Notes"
description: "Release history and changelog for Cosmos ${productLabel}"
mode: "wide"
---

<Info>
  ${infoMessage}
</Info>

${updates.map(update => {
  const label = update.date || 'Release';
  const sectionsContent = Object.entries(update.sections)
    .map(([sectionName, items]) => {
      if (items.length === 0) return '';
      return `## ${sectionName}\n\n${items.map(item => `- ${item}`).join('\n')}`;
    })
    .filter(s => s)
    .join('\n\n');

  return `<Update label="${label}" description="${update.version}" tags={["${productLabel}", "Release"]}>
${sectionsContent}
</Update>`;
}).join('\n\n')}
`;

  return content;
}

// Write changelog to file
function writeChangelog(content, product, target) {
  const outputPath = path.join(__dirname, '..', '..', product, target, 'changelog', 'release-notes.mdx');
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content);
  const versionCount = (content.match(/<Update/g) || []).length;

  console.log(`  ✓ Updated ${outputPath} with ${versionCount} version(s)`);
  return { outputPath, versionCount };
}

// Determine version filter from target
function getVersionFilter(target) {
  if (target === 'next') return null;

  // Extract version pattern (e.g., v0.5.0 -> v0.5, v0.4.x -> v0.4)
  const match = target.match(/^(v?\d+\.\d+)/);
  return match ? match[1] : null;
}

// Generate changelog for a specific target
async function generateChangelog(config, productConfig, target) {
  console.log(`\nGenerating changelog for ${config.product}/${target}...`);

  const versionFilter = getVersionFilter(target);
  const changelog = await fetchChangelog(
    productConfig.repository,
    config.source,
    productConfig.changelogPath
  );

  const updates = parseChangelog(changelog, versionFilter);

  if (updates.length === 0) {
    console.warn(`  ⚠ No versions found matching filter: ${versionFilter || 'none'}`);
    return null;
  }

  const content = generateMintlifyContent(
    updates,
    productConfig.repository,
    config.product,
    target
  );

  const result = writeChangelog(content, config.product, target);
  console.log(`  Versions: ${updates.map(u => u.version).join(', ')}`);

  return result;
}

// Main execution
async function main() {
  const config = parseArgs();

  if (!config.target && !config.all) {
    console.error('Error: Must specify either --target or --all');
    printHelp();
    process.exit(1);
  }

  const productConfig = getProductConfig(config.product);

  console.log(`Changelog Management for ${config.product}`);
  console.log(`Repository: ${productConfig.repository}`);

  try {
    if (config.all) {
      // Generate changelogs for all versions
      console.log(`\nGenerating all changelogs for ${config.product}...`);

      for (const version of productConfig.versions) {
        await generateChangelog(config, productConfig, version);
      }

      console.log(`\n✓ All changelogs generated for ${config.product}`);
    } else {
      // Generate changelog for specific target
      await generateChangelog(config, productConfig, config.target);

      console.log(`\n✓ Changelog generation completed`);
    }
  } catch (error) {
    console.error(`\n✗ Failed to generate changelog:`, error.message);
    process.exit(1);
  }
}

main();
