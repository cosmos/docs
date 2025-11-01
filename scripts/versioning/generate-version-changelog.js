#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO = 'cosmos/evm';
const SOURCE = 'main';
const VERSION_PATTERN = process.argv[2] || 'v0.5'; // e.g., 'v0.5' matches v0.5.0, v0.5.1, etc.
const OUTPUT_DIR = process.argv[3] || 'v0.5.0'; // Output directory name

async function fetchChangelog() {
  console.log(`Fetching changelog from ${REPO}: ${SOURCE}...`);
  const url = `https://raw.githubusercontent.com/${REPO}/${SOURCE}/CHANGELOG.md`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  let changelog = await response.text();
  changelog = changelog.replace(/<!--[\s\S]*?-->/g, '');
  console.log(`✓ Fetched CHANGELOG.md`);
  return changelog;
}

function sanitizeLine(line) {
  let cleaned = line.trim();
  const markdownLinks = [];
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const placeholder = `__LINK_${markdownLinks.length}__`;
    markdownLinks.push({ text, url });
    return placeholder;
  });
  cleaned = cleaned
    .replace(/ <= /g, ' &lt;= ')
    .replace(/ >= /g, ' &gt;= ')
    .replace(/ < /g, ' &lt; ')
    .replace(/ > /g, ' &gt; ');
  markdownLinks.forEach((link, i) => {
    cleaned = cleaned.replace(`__LINK_${i}__`, `[${link.text}](${link.url})`);
  });
  return cleaned;
}

function parseChangelog(content) {
  const lines = content.split('\n');
  const updates = [];
  let currentVersion = null;
  let currentDate = null;
  let sections = {};
  let currentSection = null;
  let skipUntilVersion = true;

  for (const line of lines) {
    if (line.match(/^#\s+Changelog/i)) continue;
    if (line.match(/^##\s*\[?Unreleased\]?(?:\([^)]*\))?/i)) {
      skipUntilVersion = true;
      continue;
    }

    const versionMatch = line.match(/^##\s*\[?([vV]?\d+\.\d+(?:\.(?:\d+|x))?)\]?(?:\([^)]*\))?\s*(?:-\s*(.+))?$/);
    if (versionMatch) {
      skipUntilVersion = false;
      if (currentVersion && Object.keys(sections).length > 0) {
        updates.push({ version: currentVersion, date: currentDate, sections });
      }
      currentVersion = versionMatch[1];
      currentDate = versionMatch[2] || '';
      sections = {};
      currentSection = null;
      continue;
    }

    if (skipUntilVersion) continue;
    if (!line.trim() || line.match(/^[-=]+$/)) continue;

    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

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

  if (currentVersion && Object.keys(sections).length > 0) {
    updates.push({ version: currentVersion, date: currentDate, sections });
  }

  // Filter to only include versions matching the pattern (e.g., v0.5.x)
  return updates.filter(u => u.version.startsWith(VERSION_PATTERN));
}

async function main() {
  try {
    const changelog = await fetchChangelog();
    const updates = parseChangelog(changelog);

    const mintlifyContent = `---
title: "Release Notes"
description: "Release history and changelog for Cosmos EVM"
mode: "wide"
---

<Info>
  This page tracks all releases and changes from the [cosmos/evm](https://github.com/cosmos/evm) repository.
  For the latest development updates, see the [next](/evm/next/changelog/release-notes) version.
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
  return `<Update label="${label}" description="${update.version}" tags={["EVM", "Release"]}>
${sectionsContent}
</Update>`;
}).join('\n\n')}
`;

    const outputPath = path.join(__dirname, '..', '..', 'evm', OUTPUT_DIR, 'changelog', 'release-notes.mdx');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, mintlifyContent);
    console.log(`✓ Updated ${outputPath} with ${updates.length} version(s)`);
    console.log(`  Versions: ${updates.map(u => u.version).join(', ')}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
