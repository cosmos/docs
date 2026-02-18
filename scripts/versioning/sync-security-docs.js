#!/usr/bin/env node

/**
 * Security Documentation Sync Script
 *
 * Fetches security documentation from cosmos/security repo and transforms it
 * into Mintlify-compatible MDX pages for the Cosmos SDK documentation.
 *
 * Usage:
 *   node sync-security-docs.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SECURITY_REPO = 'cosmos/security';
const SECURITY_BRANCH = 'main';
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'sdk', 'v0.53', 'security');

// Fetch content from GitHub
async function fetchFromGitHub(filePath) {
  const url = `https://raw.githubusercontent.com/${SECURITY_REPO}/${SECURITY_BRANCH}/${filePath}`;
  console.log(`Fetching: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const content = await response.text();
    console.log(`✓ Fetched ${filePath} (${content.split('\n').length} lines)`);
    return content;
  } catch (error) {
    console.error(`✗ Failed to fetch ${filePath}: ${error.message}`);
    throw error;
  }
}

// Fetch audit directory structure from GitHub API
async function fetchAuditStructure() {
  const url = `https://api.github.com/repos/${SECURITY_REPO}/contents/audits`;
  console.log(`Fetching audit structure from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'cosmos-docs-sync'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✓ Fetched audit directory structure`);
    return data;
  } catch (error) {
    console.error(`✗ Failed to fetch audit structure: ${error.message}`);
    throw error;
  }
}

// Recursively fetch all files from a directory and its subdirectories
async function fetchDirectoryRecursive(path, baseUrl = '') {
  const url = `https://api.github.com/repos/${SECURITY_REPO}/contents/${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'cosmos-docs-sync'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    const allFiles = [];

    for (const item of data) {
      if (item.type === 'file') {
        // Add file with its relative path for better organization
        allFiles.push({
          ...item,
          relativePath: baseUrl ? `${baseUrl}/${item.name}` : item.name
        });
      } else if (item.type === 'dir') {
        // Recursively fetch subdirectory contents
        const subPath = `${path}/${item.name}`;
        const subFiles = await fetchDirectoryRecursive(
          subPath,
          baseUrl ? `${baseUrl}/${item.name}` : item.name
        );
        allFiles.push(...subFiles);
      }
    }

    return allFiles;
  } catch (error) {
    console.warn(`Could not fetch ${path}: ${error.message}`);
    return [];
  }
}

// Fetch contents of a specific audit subdirectory (recursively)
async function fetchAuditSubdirectory(dirName) {
  return await fetchDirectoryRecursive(`audits/${dirName}`);
}

// Fetch transparency reports
async function fetchReports() {
  const url = `https://api.github.com/repos/${SECURITY_REPO}/contents/reports`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'cosmos-docs-sync'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`Could not fetch reports: ${error.message}`);
    return [];
  }
}

// Transform markdown to MDX with info box
function transformToMDX(content, sourceFile, title) {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Remove the main title if it exists (we'll add it in frontmatter)
  const contentWithoutTitle = content.replace(/^#\s+[^\n]+\n*/m, '');

  // Escape MDX special characters in content
  let sanitized = contentWithoutTitle;

  // Remove HTML comments
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

  // Transform relative links to absolute GitHub URLs
  // Get the directory of the source file for resolving relative paths
  const sourceDir = sourceFile.includes('/')
    ? sourceFile.substring(0, sourceFile.lastIndexOf('/'))
    : '';

  sanitized = sanitized.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    // Skip if already an absolute URL (http://, https://, //, #anchor)
    if (url.match(/^(https?:\/\/|\/\/|#)/)) {
      return match;
    }

    // Handle relative paths
    let absolutePath = url;

    if (url.startsWith('./')) {
      // ./path -> resolve relative to source file directory
      absolutePath = sourceDir ? `${sourceDir}/${url.substring(2)}` : url.substring(2);
    } else if (url.startsWith('../')) {
      // ../path -> go up one level from source file directory
      const parts = sourceDir.split('/');
      const urlParts = url.split('/');
      let upLevels = 0;

      // Count how many ../ we have
      for (const part of urlParts) {
        if (part === '..') upLevels++;
        else break;
      }

      // Remove the ../ parts from the beginning
      const remainingPath = urlParts.slice(upLevels).join('/');

      // Go up the directory tree
      const newParts = parts.slice(0, Math.max(0, parts.length - upLevels));
      absolutePath = newParts.length > 0
        ? `${newParts.join('/')}/${remainingPath}`
        : remainingPath;
    } else if (!url.startsWith('/')) {
      // Relative path without ./ -> resolve relative to source file directory
      absolutePath = sourceDir ? `${sourceDir}/${url}` : url;
    }

    // Convert to GitHub blob URL
    const githubUrl = `https://github.com/${SECURITY_REPO}/blob/${SECURITY_BRANCH}/${absolutePath}`;
    return `[${text}](${githubUrl})`;
  });

  const mdx = `---
title: "${title}"
description: "Security and maintenance policy documentation for the Cosmos Stack"
---

<Info>
This content is sourced from the official [Cosmos Security](https://github.com/${SECURITY_REPO}) repository. 

**Last sync:** ${date} | [View source](https://github.com/${SECURITY_REPO}/blob/${SECURITY_BRANCH}/${sourceFile})
</Info>

${sanitized}
`;

  return mdx;
}

// Generate the Security Policy page
async function generateSecurityPolicyPage() {
  console.log('\n📄 Generating Security Policy page...');
  const content = await fetchFromGitHub('POLICY.md');
  const mdx = transformToMDX(content, 'POLICY.md', 'Security Policy');

  const outputPath = path.join(OUTPUT_DIR, 'security-policy.mdx');
  fs.writeFileSync(outputPath, mdx, 'utf8');
  console.log(`✓ Written: ${outputPath}`);

  return outputPath;
}

// Generate the Bug Bounty page
async function generateBugBountyPage() {
  console.log('\n📄 Generating Bug Bounty page...');
  const content = await fetchFromGitHub('SECURITY.md');
  const mdx = transformToMDX(content, 'SECURITY.md', 'Bug Bounty Program');

  const outputPath = path.join(OUTPUT_DIR, 'bug-bounty.mdx');
  fs.writeFileSync(outputPath, mdx, 'utf8');
  console.log(`✓ Written: ${outputPath}`);

  return outputPath;
}

// Generate the Audits page
async function generateAuditsPage() {
  console.log('\n📄 Generating Audits page...');

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Fetch audit structure
  const auditDirs = await fetchAuditStructure();
  const directories = auditDirs.filter(item => item.type === 'dir');

  // Fetch reports
  const reports = await fetchReports();

  // Component name mapping
  const componentNames = {
    'sdk': 'Cosmos SDK',
    'evm': 'Cosmos EVM',
    'gaia': 'Cosmos Hub (Gaia)',
    'ics': 'Interchain Security (ICS)',
    'ledger': 'Ledger'
  };

  let auditsContent = '';

  // Generate audit sections by component
  for (const dir of directories) {
    const componentName = componentNames[dir.name] || dir.name.toUpperCase();
    const files = await fetchAuditSubdirectory(dir.name);

    if (files.length === 0) continue;

    auditsContent += `\n## ${componentName}\n\n`;

    // Filter for audit report files (PDFs, markdown, etc.)
    const auditFiles = files.filter(file =>
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.markdown')
    );

    if (auditFiles.length > 0) {
      // Group files by subdirectory for better organization
      const filesByDir = {};

      for (const file of auditFiles) {
        const pathParts = file.relativePath.split('/');
        const dirPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

        if (!filesByDir[dirPath]) {
          filesByDir[dirPath] = [];
        }
        filesByDir[dirPath].push(file);
      }

      // Sort by directory path (root first, then alphabetically)
      const sortedDirs = Object.keys(filesByDir).sort((a, b) => {
        if (a === '') return -1;
        if (b === '') return 1;
        return a.localeCompare(b);
      });

      for (const dirPath of sortedDirs) {
        // Add subdirectory header if files are nested
        if (dirPath !== '') {
          auditsContent += `\n**${dirPath}/**\n\n`;
        }

        for (const file of filesByDir[dirPath]) {
          const fileName = file.name.replace(/\.[^.]+$/, ''); // Remove extension
          const displayName = fileName
            .replace(/_/g, ' ')
            .replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          auditsContent += `- [${displayName}](${file.html_url})\n`;
        }
      }
    } else {
      auditsContent += `[View all ${componentName} audits](https://github.com/${SECURITY_REPO}/tree/${SECURITY_BRANCH}/audits/${dir.name})\n`;
    }
  }

  // Add transparency reports section
  if (reports.length > 0) {
    auditsContent += `\n## Transparency Reports\n\n`;
    for (const report of reports) {
      const fileName = report.name.replace(/\.[^.]+$/, '');
      const displayName = fileName
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      auditsContent += `- [${displayName}](${report.html_url})\n`;
    }
  }

  const mdx = `---
title: "Security Audits"
description: "Security audits and transparency reports for Cosmos Stack components"
---

<Info>
This page is auto-generated from the [cosmos/security](https://github.com/${SECURITY_REPO}) repository.

**Last synced:** ${date} | [View all audits](https://github.com/${SECURITY_REPO}/tree/${SECURITY_BRANCH}/audits)
</Info>

Cosmos Labs maintains a comprehensive security program for all Cosmos Stack components. This page provides links to third-party security audits and transparency reports.

${auditsContent}

## Additional Resources

- [Security Policy](./security-policy) - Release and maintenance policy
- [Bug Bounty Program](./bug-bounty) - Report vulnerabilities and earn rewards
- [cosmos/security Repository](https://github.com/${SECURITY_REPO}) - Complete security documentation
`;

  const outputPath = path.join(OUTPUT_DIR, 'audits.mdx');
  fs.writeFileSync(outputPath, mdx, 'utf8');
  console.log(`✓ Written: ${outputPath}`);

  return outputPath;
}

// Main execution
async function main() {
  console.log('🔒 Cosmos Security Documentation Sync');
  console.log('=====================================\n');
  console.log(`Source: github.com/${SECURITY_REPO}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✓ Created output directory: ${OUTPUT_DIR}\n`);
  }

  try {
    // Generate all pages
    await generateSecurityPolicyPage();
    await generateBugBountyPage();
    await generateAuditsPage();

    console.log('\n✅ Security documentation sync completed successfully!');
    console.log(`\nGenerated files:`);
    console.log(`  - ${path.join(OUTPUT_DIR, 'security-policy.mdx')}`);
    console.log(`  - ${path.join(OUTPUT_DIR, 'bug-bounty.mdx')}`);
    console.log(`  - ${path.join(OUTPUT_DIR, 'audits.mdx')}`);

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
