#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question) => new Promise((resolve) => rl.question(question, resolve));

/**
 * Parse Docusaurus frontmatter
 */
function parseDocusaurusFrontmatter(content) {
  const lines = content.split('\n');
  const frontmatter = {};
  let contentStart = 0;

  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        contentStart = i + 1;
        break;
      }
      const match = lines[i].match(/^(\w+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2];
        // Remove quotes if present
        value = value.replace(/^["']|["']$/g, '');
        frontmatter[key] = value;
      }
    }
  }

  return {
    frontmatter,
    content: lines.slice(contentStart).join('\n')
  };
}

/**
 * Extract title from content (first H1 heading)
 */
function extractTitleFromContent(content) {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return {
      title: match[1].trim(),
      content: content.replace(match[0], '').trim()
    };
  }
  return { title: null, content };
}

/**
 * Generate description from content
 */
function generateDescription(content, version = 'v0.53') {
  // Remove markdown formatting
  let plainText = content
    .replace(/^#+\s+.*$/gm, '') // Remove headings
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[*_`]/g, '') // Remove formatting
    .trim();

  // Find first non-empty paragraph
  const paragraphs = plainText.split(/\n\n+/);
  for (const para of paragraphs) {
    const cleaned = para.trim();
    if (cleaned && cleaned.length > 20) {
      return cleaned.length > 150 ? cleaned.substring(0, 147) + '...' : cleaned;
    }
  }

  return `Cosmos SDK ${version} Documentation`;
}

/**
 * Convert Docusaurus admonitions to Mintlify callouts
 */
function convertAdmonitions(content) {
  const admonitionMap = {
    'note': 'Note',
    'tip': 'Tip',
    'info': 'Info',
    'warning': 'Warning',
    'danger': 'Warning',
    'caution': 'Warning',
    'important': 'Info',
    'success': 'Check'
  };

  let result = content;

  // Match multiline admonitions
  const admonitionRegex = /:::(note|tip|info|warning|danger|caution|important|success)(?:\s+(.+?))?\n([\s\S]*?)\n:::/gi;

  result = result.replace(admonitionRegex, (match, type, title, content) => {
    const component = admonitionMap[type.toLowerCase()] || 'Note';
    const titleLine = title ? `**${title}**\n` : '';
    return `<${component}>\n${titleLine}${content.trim()}\n</${component}>`;
  });

  // Also handle single-line admonitions
  const singleLineRegex = /:::(note|tip|info|warning|danger|caution|important|success)\s+(.+?)\s*:::/gi;

  result = result.replace(singleLineRegex, (match, type, content) => {
    const component = admonitionMap[type.toLowerCase()] || 'Note';
    return `<${component}>${content.trim()}</${component}>`;
  });

  return result;
}

/**
 * Convert code blocks to Mintlify format with expandable for long blocks
 */
function convertCodeBlocks(content) {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  return content.replace(codeBlockRegex, (match, lang, code) => {
    const lines = code.split('\n');
    const lineCount = lines.length;

    // If more than 10 lines, make it expandable
    if (lineCount > 10) {
      // Get first few lines for preview
      const preview = lines.slice(0, 3).join('\n');
      const title = lang ? `${lang} code` : 'Code';

      return `<Expandable title="${title}" defaultOpen={false}>
\`\`\`${lang}
${code}\`\`\`
</Expandable>`;
    }

    // Otherwise keep as regular code block
    return match;
  });
}

/**
 * Fix internal documentation links
 */
function fixInternalLinks(content, version) {
  let result = content;

  // Fix v0.53 links
  result = result.replace(/\]\(\/v0\.53\/learn\/advanced\//g, '](/docs/sdk/v0.53/core-concepts/');
  result = result.replace(/\]\(\/v0\.53\/learn\/beginner\//g, '](/docs/sdk/v0.53/core-concepts/');
  result = result.replace(/\]\(\/v0\.53\/learn\/intro\//g, '](/docs/sdk/v0.53/core-concepts/');
  result = result.replace(/\]\(\/v0\.53\/build\/building-modules\//g, '](/docs/sdk/v0.53/module-anatomy-keepers/');
  result = result.replace(/\]\(\/v0\.53\/build\/building-apps\//g, '](/docs/sdk/v0.53/app-wiring-runtime/');
  result = result.replace(/\]\(\/v0\.53\/build\/modules\//g, '](/docs/sdk/v0.53/module-reference/');
  result = result.replace(/\]\(\/v0\.53\/build\/abci\//g, '](/docs/sdk/v0.53/runtime-abci/');
  result = result.replace(/\]\(\/v0\.53\/tutorials\//g, '](/docs/sdk/v0.53/tutorials/');
  result = result.replace(/\]\(\/v0\.53\/user\//g, '](/docs/sdk/v0.53/node-operations/');

  // Fix v0.50 links
  result = result.replace(/\]\(\/v0\.50\/learn\//g, '](/docs/sdk/v0.50/learn/');
  result = result.replace(/\]\(\/v0\.50\/build\//g, '](/docs/sdk/v0.50/build/');
  result = result.replace(/\]\(\/v0\.50\/user\//g, '](/docs/sdk/v0.50/user/');

  // Fix v0.47 links
  result = result.replace(/\]\(\/v0\.47\/learn\//g, '](/docs/sdk/v0.47/learn/');
  result = result.replace(/\]\(\/v0\.47\/build\//g, '](/docs/sdk/v0.47/build/');
  result = result.replace(/\]\(\/v0\.47\/user\//g, '](/docs/sdk/v0.47/user/');

  // Remove Docusaurus-specific "Direct link" anchors
  result = result.replace(/\[​\]\(#[^)]+\s+"Direct link to[^"]+"\)/g, '');

  // Remove heading anchors {#anchor}
  result = result.replace(/^(#+\s+.+?)\s*\{#[^}]+\}\s*$/gm, '$1');

  // Fix relative links (../ or ./)
  result = result.replace(/\]\(\.\.\//g, '](');
  result = result.replace(/\]\(\.\//g, '](');

  return result;
}

/**
 * Convert a single Docusaurus file to Mintlify format
 */
function convertDocusaurusToMintlify(content, options = {}) {
  const { version = 'v0.53', keepTitle = false } = options;

  // Parse frontmatter and content
  const { frontmatter, content: mainContent } = parseDocusaurusFrontmatter(content);

  // Extract or generate title
  let title = frontmatter.title || frontmatter.sidebar_label;
  let processedContent = mainContent;

  if (!title) {
    const extracted = extractTitleFromContent(processedContent);
    title = extracted.title || 'Documentation';
    processedContent = extracted.content;
  } else if (!keepTitle) {
    // Remove H1 if we have title from frontmatter
    const extracted = extractTitleFromContent(processedContent);
    if (extracted.title) {
      processedContent = extracted.content;
    }
  }

  // Generate or use description
  const description = frontmatter.description || generateDescription(processedContent, version);

  // Apply conversions
  processedContent = convertAdmonitions(processedContent);
  processedContent = convertCodeBlocks(processedContent);
  processedContent = fixInternalLinks(processedContent, version);

  // Build Mintlify frontmatter
  const mintlifyFrontmatter = {
    title,
    description
  };

  // Add icon if specified
  if (frontmatter.icon) {
    mintlifyFrontmatter.icon = frontmatter.icon;
  }

  // Build final content
  let finalContent = '---\n';
  for (const [key, value] of Object.entries(mintlifyFrontmatter)) {
    finalContent += `${key}: "${value}"\n`;
  }
  finalContent += '---\n\n';
  finalContent += processedContent;

  // Clean up multiple empty lines
  finalContent = finalContent.replace(/\n{3,}/g, '\n\n');

  return {
    content: finalContent,
    metadata: {
      title,
      sidebarPosition: frontmatter.sidebar_position || frontmatter.sidebarPosition || 999
    }
  };
}

/**
 * Process a directory of Docusaurus files
 */
async function processDirectory(sourceDir, targetDir, version) {
  const files = [];

  // Recursively find all .md and .mdx files
  function findFiles(dir, baseDir = '') {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.join(baseDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findFiles(fullPath, relativePath);
      } else if (item.endsWith('.md') || item.endsWith('.mdx')) {
        files.push({
          source: fullPath,
          relative: relativePath,
          name: item
        });
      }
    }
  }

  findFiles(sourceDir);

  console.log(`Found ${files.length} files to convert`);

  const converted = [];

  for (const file of files) {
    console.log(`Converting: ${file.relative}`);

    const content = fs.readFileSync(file.source, 'utf-8');
    const result = convertDocusaurusToMintlify(content, { version });

    // Determine target path
    const targetPath = path.join(targetDir, file.relative.replace('.md', '.mdx'));
    const targetSubdir = path.dirname(targetPath);

    // Ensure target directory exists
    if (!fs.existsSync(targetSubdir)) {
      fs.mkdirSync(targetSubdir, { recursive: true });
    }

    // Write converted file
    fs.writeFileSync(targetPath, result.content);

    converted.push({
      path: targetPath,
      relativePath: file.relative.replace('.md', '.mdx'),
      ...result.metadata
    });
  }

  return converted;
}

/**
 * Update docs.json with new navigation entries
 */
async function updateDocsJson(files, version, product = 'SDK') {
  const docsJsonPath = path.join(__dirname, '../docs.json');
  const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf-8'));

  // Sort files by sidebar position
  files.sort((a, b) => a.sidebarPosition - b.sidebarPosition);

  console.log('\nWould you like to update docs.json navigation? (y/n)');
  const updateNav = await prompt('> ');

  if (updateNav.toLowerCase() === 'y') {
    // Find the product and version in navigation
    // Implementation depends on your specific docs.json structure
    console.log('Navigation update feature to be implemented based on your docs.json structure');
  }
}

/**
 * Main interactive flow
 */
async function main() {
  console.log('=== Docusaurus to Mintlify Converter ===\n');

  // Get source directory
  const defaultSource = '/Users/cordt/repos/cosmos-sdk-docs/versioned_docs';
  console.log(`Enter source directory (default: ${defaultSource}):`);
  let sourceBase = await prompt('> ');
  sourceBase = sourceBase.trim() || defaultSource;

  // List available versions
  if (fs.existsSync(sourceBase)) {
    const versions = fs.readdirSync(sourceBase)
      .filter(d => d.startsWith('version-'))
      .map(d => d.replace('version-', ''));

    console.log(`\nAvailable versions: ${versions.join(', ')}`);
    console.log('Enter version to convert (e.g., 0.53):');
    const versionInput = await prompt('> ');
    const sourceVersion = `version-${versionInput.trim()}`;
    const sourceDir = path.join(sourceBase, sourceVersion);

    if (!fs.existsSync(sourceDir)) {
      console.error(`Source directory not found: ${sourceDir}`);
      process.exit(1);
    }

    // Get target directory
    const defaultTarget = `/Users/cordt/repos/docs/docs/sdk/v${versionInput.trim()}`;
    console.log(`\nEnter target directory (default: ${defaultTarget}):`);
    let targetDir = await prompt('> ');
    targetDir = targetDir.trim() || defaultTarget;

    // Confirm before proceeding
    console.log('\n=== Conversion Summary ===');
    console.log(`Source: ${sourceDir}`);
    console.log(`Target: ${targetDir}`);
    console.log(`Version: v${versionInput.trim()}`);
    console.log('\nProceed with conversion? (y/n)');

    const confirm = await prompt('> ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Conversion cancelled');
      process.exit(0);
    }

    // Process files
    console.log('\nProcessing files...\n');
    const convertedFiles = await processDirectory(sourceDir, targetDir, `v${versionInput.trim()}`);

    console.log(`\n✅ Successfully converted ${convertedFiles.length} files`);

    // Optionally update navigation
    await updateDocsJson(convertedFiles, `v${versionInput.trim()}`);

  } else {
    console.error(`Source directory not found: ${sourceBase}`);
    process.exit(1);
  }

  rl.close();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}