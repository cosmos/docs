#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node migrate-single-file.js <input-file> <output-file>');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1];

/**
 * Safely process content while preserving code blocks and inline code
 */
function safeProcessContent(content, processor) {
  const codeBlocks = [];
  const inlineCode = [];

  let processed = content;

  // Replace code blocks with placeholders
  processed = processed.replace(/```[\s\S]*?```/g, (match) => {
    const index = codeBlocks.length;
    codeBlocks.push(match);
    return `__CODE_BLOCK_${index}__`;
  });

  // Replace inline code with placeholders - handle ANY number of backticks
  // This regex matches any number of backticks, content, then same number of backticks
  processed = processed.replace(/(`+)([^`\n]*?)\1/g, (match) => {
    const index = inlineCode.length;
    inlineCode.push(match);
    return `__INLINE_CODE_${index}__`;
  });

  // Process the content without code
  processed = processor(processed);

  // Restore inline code first
  for (let i = 0; i < inlineCode.length; i++) {
    processed = processed.replace(`__INLINE_CODE_${i}__`, inlineCode[i]);
  }

  // Restore code blocks last
  for (let i = 0; i < codeBlocks.length; i++) {
    processed = processed.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
  }

  return processed;
}

/**
 * Parse Docusaurus frontmatter using gray-matter library
 */
function parseDocusaurusFrontmatter(content) {
  const parsed = matter(content);
  return {
    frontmatter: parsed.data,
    content: parsed.content
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
      content: content.replace(/^#\s+.+\n?/m, '').trim()
    };
  }
  return { title: null, content };
}

/**
 * PASS 1: Fix malformed code blocks (whitespace before backticks, etc.)
 */
function fixMalformedCodeBlocks(content) {
  // Fix code blocks with leading whitespace before backticks
  // This regex finds lines with whitespace before ``` and removes the whitespace
  content = content.replace(/^[ \t]+```/gm, '```');

  // Fix unclosed code blocks by ensuring each ``` has a matching closing ```
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockStartLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStartLine = i;
      } else {
        inCodeBlock = false;
      }
    }
  }

  // If we ended while still in a code block, add closing backticks
  if (inCodeBlock) {
    lines.push('```');
  }

  return lines.join('\n');
}

/**
 * PASS 2: Convert reference syntax code blocks
 */
function convertReferenceCodeBlocks(content) {
  // Handle Docusaurus reference syntax: ```lang reference\nURL\n```
  return content.replace(/```([^\n]+)\s+reference\n(https:\/\/[^\n]+)\n```/g, (match, lang, url) => {
    // Preserve the URL as a comment in the code block
    const commentStyle = (lang === 'python' || lang === 'bash' || lang === 'shell') ? '#' : '//';
    return `\`\`\`${lang}\n${commentStyle} Reference: ${url}\n\`\`\``;
  });
}

/**
 * PASS 3: Add expandable to long code blocks and ensure language is specified
 */
function enhanceCodeBlocks(content) {
  return content.replace(/```([^\n]*)\n([\s\S]*?)\n```/g, (match, header, code) => {
    // Parse header to get language and existing parameters
    const headerParts = header.trim().split(/\s+/);
    let lang = headerParts[0] || '';
    const hasExpandable = headerParts.includes('expandable');

    // Detect language if not specified
    if (!lang && code) {
      const codeLower = code.toLowerCase();
      if (codeLower.includes('package ') || codeLower.includes('func ') ||
          codeLower.includes('import "') || codeLower.includes('interface{')) {
        lang = 'go';
      } else if (codeLower.includes('const ') || codeLower.includes('let ') ||
                 codeLower.includes('function ') || codeLower.includes('=> ')) {
        lang = 'javascript';
      } else if (codeLower.includes('#!/bin/bash') || codeLower.includes('echo ') ||
                 codeLower.includes('npm ') || codeLower.includes('yarn ')) {
        lang = 'bash';
      } else if (codeLower.includes('def ') || codeLower.includes('class ') ||
                 codeLower.includes('import ') && codeLower.includes('from ')) {
        lang = 'python';
      } else if (code.trim().startsWith('{') && code.includes('"')) {
        lang = 'json';
      } else if (codeLower.includes('message ') || codeLower.includes('service ')) {
        lang = 'protobuf';
      }
    }

    // Count lines to determine if expandable is needed
    const lineCount = code.split('\n').length;
    const needsExpandable = lineCount > 10 && !hasExpandable;

    // Build new header
    let newHeader = '```';
    if (lang) {
      newHeader += lang;
    }
    if (needsExpandable || hasExpandable) {
      newHeader += ' expandable';
    }

    return `${newHeader}\n${code}\n\`\`\``;
  });
}

/**
 * PASS 4: Fix inline code and curly brackets
 */
function fixInlineCodeAndBrackets(content) {
  // Protect existing code blocks and inline code first
  const codeBlocks = [];
  const inlineCode = [];

  // Replace code blocks with placeholders
  let processed = content.replace(/```[\s\S]*?```/g, (match) => {
    const index = codeBlocks.length;
    codeBlocks.push(match);
    return `__CODE_BLOCK_${index}__`;
  });

  // Replace existing inline code with placeholders
  processed = processed.replace(/`[^`\n]+`/g, (match) => {
    const index = inlineCode.length;
    inlineCode.push(match);
    return `__INLINE_CODE_${index}__`;
  });

  // Now fix curly brackets in tables and other places
  // Match table cells with {value} patterns
  processed = processed.replace(/\|([^|\n]*\{[^}]+\}[^|\n]*)\|/g, (match, cell) => {
    // Add backticks around {value} patterns in table cells
    const fixed = cell.replace(/(\{[^}]+\})/g, '`$1`');
    return `|${fixed}|`;
  });

  // Fix standalone {value} patterns outside of JSX/MDX components
  // But avoid touching JSX comments {/* */} or component props
  processed = processed.replace(/(?<![\w<\/])(\{[a-zA-Z_][\w\s]*\})(?![>}])/g, '`$1`');

  // Fix interface{} and similar Go patterns
  processed = processed.replace(/\binterface\{\}/g, '`interface{}`');
  processed = processed.replace(/\bmap\[[^\]]+\]interface\{\}/g, (match) => `\`${match}\``);

  // Restore inline code
  for (let i = 0; i < inlineCode.length; i++) {
    processed = processed.replace(`__INLINE_CODE_${i}__`, inlineCode[i]);
  }

  // Restore code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    processed = processed.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
  }

  return processed;
}

/**
 * PASS 5: Convert HTML elements and fix problematic angle brackets
 */
function convertHTMLElements(content) {
  // Protect code blocks and inline code first
  const codeBlocks = [];
  const inlineCode = [];

  let processed = content.replace(/```[\s\S]*?```/g, (match) => {
    const index = codeBlocks.length;
    codeBlocks.push(match);
    return `__CODE_BLOCK_${index}__`;
  });

  processed = processed.replace(/`[^`\n]+`/g, (match) => {
    const index = inlineCode.length;
    inlineCode.push(match);
    return `__INLINE_CODE_${index}__`;
  });

  // Convert HTML comments to JSX comments
  processed = processed.replace(/<!--\s*([\s\S]*?)\s*-->/g, '{/* $1 */}');
  processed = processed.replace(/<!--([^>]*?)$/gm, '{/* $1 */}');

  // Convert <details> tags to Mintlify Expandable component
  processed = processed.replace(/<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*([\s\S]*?)<\/details>/gi,
    (match, summary, content) => {
      return `<Expandable title="${summary.trim()}">\n${content.trim()}\n</Expandable>`;
    });

  // Fix command placeholders like <appd>, <simd>, etc.
  // These are commonly used in Cosmos SDK docs as command placeholders
  processed = processed.replace(/<(appd|simd|gaiad|osmosisd|junod|yourapp)>/g, '`$1`');

  // Fix comparison operators and arrows that break MDX
  processed = processed.replace(/([^`])<=>([^`])/g, '$1`<=>`$2');
  processed = processed.replace(/([^`])<->([^`])/g, '$1`<->`$2');

  // Fix generic placeholders like <host>, <port>, <chain-id> etc.
  processed = processed.replace(/<([a-z]+(?:-[a-z]+)*)>/g, '`<$1>`');

  // Restore inline code first
  for (let i = 0; i < inlineCode.length; i++) {
    processed = processed.replace(`__INLINE_CODE_${i}__`, inlineCode[i]);
  }

  // Restore code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    processed = processed.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
  }

  return processed;
}

/**
 * Master function to process code blocks in correct sequence
 */
function convertCodeBlocks(content) {
  // Apply passes in sequence
  content = fixMalformedCodeBlocks(content);
  content = convertReferenceCodeBlocks(content);
  content = enhanceCodeBlocks(content);
  content = fixInlineCodeAndBrackets(content);
  content = convertHTMLElements(content);

  return content;
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
    'success': 'Check',
    'details': 'Accordion'
  };

  const lines = content.split('\n');
  const result = [];
  const admonitionStack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for opening admonition
    const openMatch = line.match(/^:::(\w+)(?:\s+(.+))?$/);
    if (openMatch) {
      const type = openMatch[1].toLowerCase();
      const title = openMatch[2];

      const component = admonitionMap[type] || 'Note';
      admonitionStack.push(component);

      if (title) {
        result.push(`<${component}>`);
        result.push(`**${title}**`);
      } else {
        result.push(`<${component}>`);
      }
      continue;
    }

    // Check for closing admonition
    if (line.trim() === ':::') {
      if (admonitionStack.length > 0) {
        const component = admonitionStack.pop();
        result.push(`</${component}>`);
      }
      continue;
    }

    // Regular line
    result.push(line);
  }

  let finalResult = result.join('\n');

  // Clean up any remaining ::: artifacts
  finalResult = finalResult.replace(/:::\s*\n/g, '\n');
  finalResult = finalResult.replace(/:::\./g, '');
  finalResult = finalResult.replace(/^\s*:::\s*$/gm, '');

  return finalResult;
}

/**
 * Convert internal links from Docusaurus to Mintlify format
 */
function convertInternalLinks(content, currentPath) {
  // Handle .md/.mdx links
  content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, link) => {
    // Skip external links
    if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('#')) {
      return match;
    }

    // Remove .md/.mdx extensions
    let cleanLink = link.replace(/\.(md|mdx)(?:#|$)/, '');

    // Handle relative paths - convert to absolute from docs root
    if (cleanLink.startsWith('./') || cleanLink.startsWith('../')) {
      const dir = path.dirname(currentPath);
      cleanLink = path.join(dir, cleanLink);
      cleanLink = cleanLink.replace(/\\/g, '/'); // Ensure forward slashes
    }

    // Ensure the link starts with /
    if (!cleanLink.startsWith('/')) {
      cleanLink = '/' + cleanLink;
    }

    return `[${text}](${cleanLink})`;
  });

  return content;
}

/**
 * Fix heading anchors for Mintlify
 */
function fixHeadingAnchors(content) {
  // Remove {#anchor} style anchors and convert to standard markdown
  content = content.replace(/^(#+\s+.+?)\s*\{#[\w-]+\}\s*$/gm, '$1');

  // Fix [​](#anchor) style empty anchor links
  content = content.replace(/\[​\]\(#[\w-]+\s*"[^"]*"\)/g, '');
  content = content.replace(/\[​\]\(#[\w-]+\)/g, '');

  return content;
}

/**
 * Convert tabs from Docusaurus to Mintlify
 */
function convertTabs(content) {
  // Convert Docusaurus tabs to Mintlify tabs
  content = content.replace(/<Tabs[^>]*>/g, '<Tabs>');
  content = content.replace(/<TabItem\s+value="([^"]+)"(?:\s+label="([^"]+)")?[^>]*>/g,
    (match, value, label) => `<Tab title="${label || value}">`);
  content = content.replace(/<\/TabItem>/g, '</Tab>');
  content = content.replace(/<\/Tabs>/g, '</Tabs>');

  return content;
}

/**
 * Clean up Docusaurus-specific syntax
 */
function cleanupDocusaurusSyntax(content) {
  // Remove import statements
  content = content.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');

  // Remove export statements
  content = content.replace(/^export\s+.*?;\s*$/gm, '');

  // Remove HTML comments
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // Clean up extra newlines
  content = content.replace(/\n{4,}/g, '\n\n\n');

  return content;
}

/**
 * Generate version-appropriate frontmatter
 */
function generateFrontmatter(title, description, version) {
  const frontmatter = {
    title: title || 'Documentation',
    description: description || `Version: ${version}`
  };

  // Generate YAML frontmatter
  let yaml = '---\n';
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== null && value !== undefined) {
      // Escape quotes in values
      const escapedValue = String(value).replace(/"/g, '\\"');
      yaml += `${key}: "${escapedValue}"\n`;
    }
  }
  yaml += '---\n\n';

  return yaml;
}

/**
 * Main conversion function
 */
function convertFile(inputPath, outputPath) {
  try {
    // Read the input file
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      return false;
    }

    let content = fs.readFileSync(inputPath, 'utf-8');

    // Parse frontmatter
    const { frontmatter, content: mainContent } = parseDocusaurusFrontmatter(content);

    // Extract title from content if not in frontmatter
    let processedContent = mainContent;
    let title = frontmatter.title || frontmatter.sidebar_label;

    if (!title) {
      const extracted = extractTitleFromContent(processedContent);
      title = extracted.title;
      processedContent = extracted.content;
    }

    // Determine version from output path
    let version = 'latest';
    const versionMatch = outputPath.match(/\/(v[\d.]+)\//);
    if (versionMatch) {
      version = versionMatch[1];
    }

    // FIRST: Process code blocks BEFORE other conversions
    // This ensures all code is properly contained in code blocks
    // and won't interfere with other syntax processing
    processedContent = convertCodeBlocks(processedContent);

    // NOW: Apply other conversions with code block protection
    processedContent = safeProcessContent(processedContent, (content) => {
      // Convert admonitions
      content = convertAdmonitions(content);

      // Fix heading anchors
      content = fixHeadingAnchors(content);

      // Convert tabs
      content = convertTabs(content);

      // Convert internal links
      const relativePath = outputPath.replace(/^.*?\/docs\//, '/');
      content = convertInternalLinks(content, relativePath);

      // Clean up Docusaurus-specific syntax
      content = cleanupDocusaurusSyntax(content);

      return content;
    });

    // Generate new frontmatter
    const newFrontmatter = generateFrontmatter(
      title,
      frontmatter.description || frontmatter.sidebar_label,
      version
    );

    // Combine frontmatter and content
    const finalContent = newFrontmatter + processedContent;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write the output file
    fs.writeFileSync(outputPath, finalContent, 'utf-8');

    console.log(`✓ Converted: ${inputPath} → ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error converting ${inputPath}:`, error.message);
    return false;
  }
}

// Run the conversion
convertFile(inputFile, outputFile);