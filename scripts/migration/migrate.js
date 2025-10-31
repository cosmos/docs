#!/usr/bin/env node

/**
 * @fileoverview Docusaurus to Mintlify Migration Script
 * @description Converts Docusaurus documentation to Mintlify format with proper MDX syntax,
 * code formatting, and navigation structure. Supports multi-version migration with intelligent
 * content caching and validation.
 *
 * @example
 * // Interactive mode
 * node migrate-docusaurus.js
 *
 * @example
 * // Non-interactive mode (all versions)
 * node migrate-docusaurus.js ~/repos/cosmos-sdk-docs ./tmp sdk
 * node migrate-docusaurus.js ~/repos/cosmos-sdk-docs ./tmp sdk --update-nav
 *
 * @requires gray-matter - Parse and generate YAML frontmatter
 * @requires unified - Unified text processing framework
 * @requires remark-parse - Markdown parser for unified
 * @requires remark-gfm - GitHub Flavored Markdown support
 * @requires remark-stringify - Markdown stringifier for unified
 * @requires unist-util-visit - Tree visitor for unified AST
 *
 * @author Cosmos SDK Team
 * @version 2.0.0
 * @since 2024
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import crypto from 'crypto';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question) => new Promise((resolve) => rl.question(question, resolve));

/**
 * Safely process content while preserving code blocks and inline code.
 * This is the foundation of our text transformation system, ensuring code is never
 * accidentally modified by markdown transformations.
 *
 * @function safeProcessContent
 * @param {string} content - The markdown content to process
 * @param {Function} processor - Function to process non-code content
 * @returns {string} Processed content with code blocks preserved
 *
 * @description
 * Pipeline steps:
 * 1. Extract and replace fenced code blocks with placeholders
 * 2. Extract and replace inline code with placeholders
 * 3. Apply processor function to remaining content
 * 4. Restore inline code from placeholders
 * 5. Restore fenced code blocks from placeholders
 *
 * This ensures transformations like escaping underscores or fixing JSX
 * comments never affect actual code content.
 *
 * @example
 * const result = safeProcessContent(content, (text) => {
 *   return text.replace(/_/g, '\\_'); // Escapes underscores in text only
 * });
 */
function safeProcessContent(content, processor) {
  // STEP 1: Extract all code blocks and inline code to protect them from processing
  const codeBlocks = [];
  const inlineCode = [];

  let processed = content;

  // STEP 2: Replace triple-backtick code blocks with placeholders
  // This prevents code blocks from being modified by subsequent processing
  processed = processed.replace(/```[\s\S]*?```/g, (match) => {
    const index = codeBlocks.length;
    codeBlocks.push(match); // Store original code block
    return `__CODE_BLOCK_${index}__`; // Replace with placeholder
  });

  // STEP 3: Replace inline code spans of ANY tick length with placeholders
  // This handles `, ``, ```, etc. to protect all code spans from processing
  // The regex (`+)([^`\n]*?)\1 matches any number of backticks, content, then same number of backticks
  processed = processed.replace(/(`+)([^`\n]*?)\1/g, (match) => {
    const index = inlineCode.length;
    inlineCode.push(match); // Store original inline code (e.g., `{groupId}` or ``{groupId}``)
    return `__INLINE_CODE_${index}__`; // Replace with placeholder
  });

  // STEP 4: Process the content (with code replaced by placeholders)
  // The processor function won't see any backtick-wrapped content
  processed = processor(processed);

  // STEP 5: Restore inline code first
  // This puts back the original inline code (e.g., `{groupId}`) exactly as it was
  // Handle both escaped and non-escaped versions (in case underscores were escaped in tables)
  for (let i = 0; i < inlineCode.length; i++) {
    // Try escaped version first (if underscores were escaped in table processing)
    const escapedPlaceholder = `__INLINE\\_CODE_${i}__`;
    const normalPlaceholder = `__INLINE_CODE_${i}__`;

    if (processed.includes(escapedPlaceholder)) {
      processed = processed.replace(escapedPlaceholder, inlineCode[i]);
    } else {
      processed = processed.replace(normalPlaceholder, inlineCode[i]);
    }
  }

  // STEP 6: Restore code blocks last
  for (let i = 0; i < codeBlocks.length; i++) {
    // Try escaped version first
    const escapedPlaceholder = `__CODE\\_BLOCK_${i}__`;
    const normalPlaceholder = `__CODE_BLOCK_${i}__`;

    if (processed.includes(escapedPlaceholder)) {
      processed = processed.replace(escapedPlaceholder, codeBlocks[i]);
    } else {
      processed = processed.replace(normalPlaceholder, codeBlocks[i]);
    }
  }

  return processed;
}

/**
 * Parse Docusaurus frontmatter using battle-tested gray-matter library.
 * Extracts YAML frontmatter and returns parsed metadata.
 *
 * @function parseDocusaurusFrontmatter
 * @param {string} content - Raw markdown content with potential frontmatter
 * @returns {Object} Parsed result
 * @returns {Object} result.frontmatter - Parsed YAML frontmatter as object
 * @returns {string} result.content - Content with frontmatter removed
 *
 * @description
 * Uses gray-matter to parse YAML frontmatter from markdown.
 * Handles missing frontmatter gracefully by returning empty object.
 *
 * Common Docusaurus frontmatter fields:
 * - title: Page title
 * - sidebar_label: Navigation label
 * - sidebar_position: Sort order in navigation
 * - description: Page description
 * - slug: Custom URL slug
 *
 * @example
 * const { frontmatter, content } = parseDocusaurusFrontmatter(
 *   '---\ntitle: My Page\n---\n# Content'
 * );
 * // frontmatter = { title: 'My Page' }
 * // content = '# Content'
 */
function parseDocusaurusFrontmatter(content) {
  const parsed = matter(content);

  return {
    frontmatter: parsed.data,
    content: parsed.content
  };
}


/**
 * Extract title from content (first H1 heading).
 * Removes the H1 from content to avoid duplication.
 *
 * @function extractTitleFromContent
 * @param {string} content - Markdown content potentially containing H1
 * @returns {Object} Extraction result
 * @returns {string|null} result.title - Extracted title or null if no H1
 * @returns {string} result.content - Content with H1 removed
 *
 * @description
 * Looks for H1 heading at the start of content (after any blank lines).
 * Supports both # syntax and underline (===) syntax.
 * Returns the title text and content without the H1.
 *
 * @example
 * const { title, content } = extractTitleFromContent('# My Title\n\nContent here');
 * // title = 'My Title'
 * // content = 'Content here'
 */
function extractTitleFromContent(content) {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return {
      title: match[1].trim(),
      content: content.replace(/^#\s+.+\n?/m, '').trim() // Only remove the heading line, not random content
    };
  }
  return { title: null, content };
}


/**
 * Convert Docusaurus admonitions to Mintlify callouts.
 * Only processes non-code content, preserving code blocks.
 *
 * @function convertAdmonitions
 * @param {string} content - Markdown content with Docusaurus admonitions
 * @returns {string} Content with Mintlify callout components
 *
 * @description
 * Converts Docusaurus triple-colon syntax to Mintlify components:
 * - note admonitions to Note components
 * - warning admonitions to Warning components
 * - tip admonitions to Tip components
 * - info admonitions to Info components
 * - caution admonitions to Warning components
 * - danger admonitions to Warning components
 *
 * Features:
 * - Supports custom titles after the admonition type
 * - Handles nested admonitions with a stack
 * - Cleans up malformed syntax
 * - Ensures proper tag pairing
 * - Processes only non-code content
 *
 * @example
 * // Converts Docusaurus admonition with title
 * // to Mintlify Note component with bold title
 */
function convertAdmonitions(content) {
  return safeProcessContent(content, (nonCodeContent) => {
    const admonitionMap = {
      'note': 'Note',
      'tip': 'Tip',
      'info': 'Info',
      'warning': 'Warning',
      'danger': 'Warning',
      'caution': 'Warning',
      'important': 'Info',
      'success': 'Check',
      'details': 'Accordion' // For expandable sections
    };

    // Use line-by-line processing to handle complex nested cases
    const lines = nonCodeContent.split('\n');
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

  // Clean up any remaining ::: artifacts and malformed syntax
  finalResult = finalResult.replace(/:::\s*\n/g, '\n');
  finalResult = finalResult.replace(/:::\./g, ''); // Handle malformed :::.
  finalResult = finalResult.replace(/^\s*:::\s*$/gm, '');

  // Fix unclosed tags by ensuring proper pairing
  // If we find an opening tag without a closing tag, add the closing tag
  const tagPattern = /<(Note|Warning|Tip|Info|Check)\b[^>]*>/g;
  const openTags = finalResult.match(tagPattern) || [];

  for (const openTag of openTags) {
    const tagName = openTag.match(/<(\w+)/)[1];
    const closeTag = `</${tagName}>`;

    // Check if this opening tag has a corresponding closing tag
    const openIndex = finalResult.indexOf(openTag);
    const nextOpenIndex = finalResult.indexOf(`<${tagName}`, openIndex + openTag.length);
    const closeIndex = finalResult.indexOf(closeTag, openIndex);

    // If no closing tag found, or closing tag is after the next opening tag, add one
    if (closeIndex === -1 || (nextOpenIndex !== -1 && closeIndex > nextOpenIndex)) {
      const insertPoint = nextOpenIndex !== -1 ? nextOpenIndex : finalResult.length;
      finalResult = finalResult.slice(0, insertPoint) + `\n${closeTag}\n` + finalResult.slice(insertPoint);
    }
  }

    return finalResult;
  });
}



/**
 * Format Go code
 */
function formatGoCode(code) {
  return code
    // Fix imports
    .replace(/import \(/g, 'import (\n    ')
    .replace(/"\s+"/g, '"\n    "')
    .replace(/\)\s*([a-zA-Z])/g, ')\n\n$1')

    // Fix braces and structure
    .replace(/\{\s*([a-zA-Z])/g, '{\n    $1')
    .replace(/([^}\n])\s*\}/g, '$1\n}')
    .replace(/\)\s*\{/g, ') {')
    .replace(/\}\s*([a-zA-Z])/g, '}\n\n$1')

    // Fix struct declarations
    .replace(/\{\s*([A-Z][a-zA-Z]*:)/g, '{\n    $1')
    .replace(/,\s*([A-Z][a-zA-Z]*:)/g, ',\n    $1')

    // Basic indentation
    .replace(/^(\s*)([a-z][a-zA-Z]*\s*:=)/gm, '    $2')
    .replace(/^(\s*)(if|for|switch|case)/gm, '    $2')

    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Format JavaScript/TypeScript code
 */
function formatJavaScriptCode(code) {
  return code
    // Fix imports
    .replace(/import\s*\{([^}]+)\}\s*from/g, (match, imports) => {
      const cleanImports = imports.split(',').map(imp => imp.trim()).join(',\n  ');
      return `import {\n  ${cleanImports}\n} from`;
    })

    // Fix object/function braces
    .replace(/\{\s*([a-zA-Z])/g, '{\n  $1')
    .replace(/([^}\n])\s*\}/g, '$1\n}')
    .replace(/\)\s*=>\s*\{/g, ') => {')

    // Fix function declarations
    .replace(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, 'function $1(')
    .replace(/\)\s*\{/g, ') {')

    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Format Rust code
 */
function formatRustCode(code) {
  return code
    // Fix use statements
    .replace(/use\s+([^;]+);/g, (match, usePath) => {
      if (usePath.includes('{')) {
        return match.replace(/\{\s*([^}]+)\s*\}/g, (m, items) => {
          const cleanItems = items.split(',').map(item => item.trim()).join(',\n    ');
          return `{\n    ${cleanItems}\n}`;
        });
      }
      return match;
    })

    // Fix function formatting
    .replace(/fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, 'fn $1(')
    .replace(/\)\s*->\s*([^{]+)\s*\{/g, ') -> $1 {')

    // Fix struct/impl blocks
    .replace(/\{\s*([a-zA-Z])/g, '{\n    $1')
    .replace(/([^}\n])\s*\}/g, '$1\n}')

    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Format JSON code
 */
function formatJsonCode(code) {
  try {
    // Try to parse and reformat JSON
    const parsed = JSON.parse(code);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // If not valid JSON, just clean up basic formatting
    return code
      .replace(/\{\s*"/g, '{\n  "')
      .replace(/",\s*"/g, '",\n  "')
      .replace(/\}\s*,/g, '\n},')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

/**
 * Generic code formatting for other languages.
 * Applies basic formatting rules for unrecognized languages.
 *
 * @function formatGenericCode
 * @param {string} code - Raw code in any language
 * @returns {string} Formatted code with basic improvements
 *
 * @description
 * Applies minimal formatting:
 * - Basic brace positioning
 * - Removes excessive blank lines
 * - Trims whitespace
 *
 * Used as fallback when language-specific formatter unavailable.
 *
 * @example
 * const formatted = formatGenericCode('function() {return true}');
 * // Returns code with improved brace positioning
 */
function formatGenericCode(code) {
  return code
    // Basic brace formatting
    .replace(/\{\s*([a-zA-Z])/g, '{\n  $1')
    .replace(/([^}\n])\s*\}/g, '$1\n}')

    // Basic function-like patterns
    .replace(/\)\s*\{/g, ') {')

    // Clean up spacing
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Fix internal documentation links for Mintlify's product-based structure.
 * Only processes non-code content, preserving links in code blocks.
 *
 * @function fixInternalLinks
 * @param {string} content - Markdown content with internal links
 * @param {string} version - Target version (e.g., 'next', 'v0.50')
 * @param {string} [product='generic'] - Product name for namespacing
 * @returns {string} Content with updated internal links
 *
 * @description
 * Cleans up Docusaurus-specific patterns:
 * - Removes Docusaurus-specific "Direct link" anchor links
 * - Removes heading ID anchors (e.g., {#my-anchor})
 *
 * Note: All relative link resolution (../, ./, implicit paths) is handled by
 * the AST-based createLinkFixerPlugin which properly resolves paths using the
 * source file location. File extension removal and product/version prefixing
 * are also handled by the AST plugin.
 *
 * Link transformation examples:
 * - [​](#heading "Direct link to Heading") → (removed)
 * - # Heading {#my-anchor} → # Heading
 *
 * @example
 * const fixed = fixInternalLinks(
 *   'markdown with relative link',
 *   'v0.50',
 *   'sdk'
 * );
 * // Returns markdown with absolute versioned link
 */
function fixInternalLinks(content, version, product = 'generic') {
  return safeProcessContent(content, (nonCodeContent) => {
    let result = nonCodeContent;

  // Remove Docusaurus-specific "Direct link" anchors
  result = result.replace(/\[​\]\(#[^)]+\s+"Direct link to[^"]+"\)/g, '');

  // Remove heading anchors {#anchor}
  result = result.replace(/^(#+\s+.+?)\s*\{#[^}]+\}\s*$/gm, '$1');

  // Note: Relative link resolution (../, ./, implicit paths) is handled by
  // the AST-based createLinkFixerPlugin which properly resolves paths using
  // the source file location. No need for regex-based link fixing here.

    return result;
  });
}

/**
 * Copy static assets (images) from source to target directory.
 * Recursively copies all image files while preserving directory structure.
 *
 * @function copyStaticAssets
 * @param {string} staticPath - Source directory containing static assets
 * @param {string} targetImagesDir - Target directory for images
 *
 * @description
 * Copies image assets with the following features:
 * - Recursively traverses source directory
 * - Preserves directory structure in target
 * - Copies common image formats: png, jpg, jpeg, gif, svg, webp
 * - Creates target directories as needed
 * - Skips non-image files
 *
 * @example
 * copyStaticAssets(
 *   '/source/static',
 *   './assets/product/images'
 * );
 * // Copies all images from /source/static to ./assets/product/images
 */
function copyStaticAssets(staticPath, targetImagesDir) {
  if (!fs.existsSync(targetImagesDir)) {
    fs.mkdirSync(targetImagesDir, { recursive: true });
  }

  function copyImages(dir, targetSubDir = '') {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const sourcePath = path.join(dir, item);
      const stat = fs.statSync(sourcePath);

      if (stat.isDirectory()) {
        // Recursively copy subdirectories
        const newTargetSubDir = path.join(targetSubDir, item);
        copyImages(sourcePath, newTargetSubDir);
      } else if (item.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
        // Copy image files
        const targetPath = path.join(targetImagesDir, 'static', targetSubDir, item);
        const targetDir = path.dirname(targetPath);

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.copyFileSync(sourcePath, targetPath);
        console.log(`  Copied: static/${targetSubDir}/${item}`);
      }
    }
  }

  copyImages(staticPath);
}

/**
 * Update image paths to use centralized images folder.
 * Moves images from versioned directories to shared location.
 *
 * @function updateImagePaths
 * @param {string} content - Content with image references
 * @param {string} sourceRelativePath - Relative path of source file
 * @param {string} version - Version directory name
 * @returns {string} Content with updated image paths
 *
 * @description
 * Updates image references to point to centralized images directory:
 * - Removes version from image paths
 * - Handles both markdown and HTML image syntax
 * - Preserves relative path structure within images folder
 *
 * Path transformation:
 * - Local images to centralized dirname path
 * - Parent directory images to root images path
 *
 * @example
 * const updated = updateImagePaths(
 *   'markdown with local image reference',
 *   'learn/intro.md',
 *   'v0.50'
 * );
 * // Returns markdown with centralized image path
 */
function updateImagePaths(content, sourceRelativePath, version) {
  let result = content;

  // Calculate the depth of the source file to determine relative path to images
  const sourceDepth = sourceRelativePath.split('/').length - 1;
  const pathToRoot = sourceDepth > 0 ? '../'.repeat(sourceDepth) : './';
  // Images are at the same level as version directories (e.g., sdk/images/)
  const pathToImages = `${pathToRoot}../images/`;

  // Update local image references (./image.png or ../image.png)
  // Match both markdown images ![alt](path) and HTML img tags
  result = result.replace(/(!\[[^\]]*\]\()(\.\.\/|\.\/)([^)]+\.(png|jpg|jpeg|gif|svg|webp))/gi,
    (match, prefix, relative, imagePath) => {
      const imageName = path.basename(imagePath);
      const imageDir = path.dirname(imagePath);
      const sourceDir = path.dirname(sourceRelativePath);

      // Strip numbered prefixes from source directory for clean image paths
      const cleanSourceDir = sourceDir.replace(/\/(\d+-)/g, '/').replace(/^(\d+-)/, '');

      if (relative === './' && imageDir === '.') {
        // Image in same directory as markdown
        return `${prefix}${pathToImages}${cleanSourceDir}/${imageName}`;
      } else if (relative === '../') {
        // Image in parent directory
        const parentSourceDir = path.dirname(cleanSourceDir);
        return `${prefix}${pathToImages}${parentSourceDir}/${imagePath}`;
      } else {
        // Image in subdirectory
        return `${prefix}${pathToImages}${cleanSourceDir}/${imagePath}`;
      }
    });

  // Update HTML img tags
  result = result.replace(/(<img[^>]+src=")(\.\.\/|\.\/)([^"]+\.(png|jpg|jpeg|gif|svg|webp))/gi,
    (match, prefix, relative, imagePath) => {
      const imageName = path.basename(imagePath);
      const imageDir = path.dirname(imagePath);

      if (imageDir === '.') {
        const sourceDir = path.dirname(sourceRelativePath);
        // Strip numbered prefixes from source directory for clean image paths
        const cleanSourceDir = sourceDir.replace(/\/(\d+-)/g, '/').replace(/^(\d+-)/, '');
        return `${prefix}${pathToImages}${cleanSourceDir}/${imageName}`;
      } else {
        return `${prefix}${pathToImages}${imagePath}`;
      }
    });

  // Handle references to /img/ or /static/ folders (from Docusaurus static folder)
  result = result.replace(/(!\[[^\]]*\]\()(\/(img|static)\/[^)]+\.(png|jpg|jpeg|gif|svg|webp))/gi,
    (match, prefix, imagePath) => {
      // Convert /img/file.png to images/static/img/file.png
      // Convert /static/file.png to images/static/file.png
      const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
      return `${prefix}${pathToImages}static/${cleanPath.replace(/^static\//, '')}`;
    });

  // Handle HTML img tags with /img/ or /static/ paths
  result = result.replace(/(<img[^>]+src=")(\/(img|static)\/[^"]+\.(png|jpg|jpeg|gif|svg|webp))/gi,
    (match, prefix, imagePath) => {
      const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
      return `${prefix}${pathToImages}static/${cleanPath.replace(/^static\//, '')}`;
    });

  // Handle GitHub raw content URLs (keep them as-is)
  // These don't need updating as they're external URLs

  return result;
}

/**
 * Content-based migration cache system.
 * Implements SHA-256 checksumming to detect duplicate content across versions,
 * significantly improving performance by processing identical content only once.
 *
 * @namespace migrationCache
 * @description
 * The cache system tracks:
 * - Content checksums to detect duplicates
 * - Transformation results to reuse for identical content
 * - Validation errors per unique content block
 * - File paths mapped to their content checksums
 *
 * This enables efficient processing where identical files across versions
 * (e.g., v0.47, v0.50, v0.53) are transformed only once but written to
 * all appropriate locations.
 *
 * @example
 * // Process flow with caching:
 * // 1. File A in v0.47: Full processing, cached
 * // 2. File A in v0.50 (identical): Cache hit, skip processing
 * // 3. File A in v0.53 (modified): Different checksum, full processing
 */
const migrationCache = {
  // Map of content checksum → migration result
  contentCache: new Map(),
  // Map of content checksum → validation errors
  validationCache: new Map(),
  // Map of file path → content checksum
  fileChecksums: new Map(),

  /**
   * Calculate SHA-256 checksum of content
   */
  getChecksum(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  },

  /**
   * Check if content has been processed before
   */
  hasProcessed(checksum) {
    return this.contentCache.has(checksum);
  },

  /**
   * Get cached migration result
   */
  getCachedResult(checksum) {
    return this.contentCache.get(checksum);
  },

  /**
   * Cache migration result
   */
  cacheResult(checksum, result) {
    this.contentCache.set(checksum, result);
  },

  /**
   * Get cached validation errors
   */
  getCachedValidation(checksum) {
    return this.validationCache.get(checksum) || [];
  },

  /**
   * Cache validation errors
   */
  cacheValidation(checksum, errors) {
    this.validationCache.set(checksum, errors);
  },

  /**
   * Track file checksum
   */
  trackFile(filepath, checksum) {
    this.fileChecksums.set(filepath, checksum);
  },

  /**
   * Get statistics
   */
  getStats() {
    return {
      uniqueContent: this.contentCache.size,
      totalFiles: this.fileChecksums.size,
      duplicates: this.fileChecksums.size - this.contentCache.size
    };
  },

  /**
   * Clear cache
   */
  clear() {
    this.contentCache.clear();
    this.validationCache.clear();
    this.fileChecksums.clear();
  }
};

// Global issue tracker for reporting
const migrationIssues = {
  warnings: [],
  errors: [],
  info: [],
  currentFile: '',
  processedFiles: new Set(),

  addWarning(line, issue, suggestion = '') {
    this.warnings.push({
      file: this.currentFile,
      line,
      issue,
      suggestion
    });
  },

  addRemoval(message, details) {
    this.info.push({
      file: this.currentFile,
      message,
      details
    });
  },

  addError(line, issue, suggestion = '') {
    this.errors.push({
      file: this.currentFile,
      line,
      issue,
      suggestion
    });
  },

  setCurrentFile(filepath) {
    this.currentFile = filepath;
  },

  reset() {
    this.warnings = [];
    this.errors = [];
    this.currentFile = '';
    this.processedFiles.clear();
  },

  generateReport() {
    const totalIssues = this.warnings.length + this.errors.length;
    if (totalIssues === 0) return '';

    let report = '\n' + '='.repeat(80) + '\n';
    report += ' MIGRATION REPORT\n';
    report += '='.repeat(80) + '\n\n';

    if (this.errors.length > 0) {
      report += ` ERRORS (${this.errors.length}) - These need manual fixes:\n`;
      report += '-'.repeat(40) + '\n';

      const errorsByFile = {};
      this.errors.forEach(err => {
        if (!errorsByFile[err.file]) errorsByFile[err.file] = [];
        errorsByFile[err.file].push(err);
      });

      Object.entries(errorsByFile).forEach(([file, errors]) => {
        report += `\n ${file}:\n`;
        errors.forEach(err => {
          report += `  Line ${err.line}: ${err.issue}\n`;
          if (err.suggestion) {
            report += `     Suggestion: ${err.suggestion}\n`;
          }
        });
      });
      report += '\n';
    }

    if (this.warnings.length > 0) {
      report += `  WARNINGS (${this.warnings.length}) - Automatically handled but please verify:\n`;
      report += '-'.repeat(40) + '\n';

      const warningsByFile = {};
      this.warnings.forEach(warn => {
        if (!warningsByFile[warn.file]) warningsByFile[warn.file] = [];
        warningsByFile[warn.file].push(warn);
      });

      Object.entries(warningsByFile).forEach(([file, warnings]) => {
        report += `\n ${file}:\n`;
        warnings.forEach(warn => {
          report += `  Line ${warn.line}: ${warn.issue}\n`;
          if (warn.suggestion) {
            report += `     Applied: ${warn.suggestion}\n`;
          }
        });
      });
    }

    // Report removed content that couldn't be safely converted
    if (this.info.length > 0) {
      report += `REMOVED CONTENT (${this.info.length}) - Content that was removed:\n`;
      report += '-'.repeat(40) + '\n';

      const infoByFile = {};
      this.info.forEach(info => {
        if (!infoByFile[info.file]) infoByFile[info.file] = [];
        infoByFile[info.file].push(info);
      });

      Object.entries(infoByFile).forEach(([file, infos]) => {
        report += `\n${file}:\n`;
        infos.forEach(info => {
          report += `  ${info.message}: ${info.details}\n`;
        });
      });
      report += '\n';
    }

    report += '\n' + '='.repeat(80) + '\n';
    report += `Summary: ${this.errors.length} errors, ${this.warnings.length} warnings`;
    if (this.info.length > 0) {
      report += `, ${this.info.length} removals`;
    }
    report += '\n';
    report += '='.repeat(80) + '\n';

    return report;
  }
};

/**
 * Fix common MDX parsing issues while preserving all code content.
 * Applies automatic fixes for known Docusaurus to Mintlify incompatibilities.
 *
 * @function fixMDXIssues
 * @param {string} content - The markdown content to fix
 * @param {string} [filepath=''] - Path to file being processed (for error context)
 * @returns {string} Fixed content with MDX issues resolved
 *
 * @description
 * Automatic fixes applied (in order):
 * 1. Escape underscores in table cells for proper rendering
 * 2. Fix invalid JSX comment escaping
 * 3. Fix expressions with hyphens that break JSX parsing
 * 4. Convert double backticks to single backticks
 * 5. Convert HTML comments to JSX comments
 * 6. Escape template variables outside code to inline code
 * 7. Fix unclosed braces in expressions
 * 8. Convert <details> to <Expandable> for Mintlify
 * 9. Fix backticks in link text for proper MDX rendering
 *
 * All transformations use safeProcessContent() to preserve code blocks.
 * Error reporting is handled separately in validateMDXContent().
 *
 * @see {@link safeProcessContent} - For code block preservation
 * @see {@link validateMDXContent} - For error reporting
 */
function fixMDXIssues(content, filepath = '') {
  // No error reporting in this function - only fixes
  // Error reporting is done in validateMDXContent()

  // ALL transformations happen inside safeProcessContent
  // This ensures code blocks are completely untouched
  return safeProcessContent(content, (nonCodeContent) => {
    // CRITICAL FIX 1: Escape underscores in table cells (epochs_number -> epochs\\_number)
    // This must be done FIRST before any other processing
    nonCodeContent = nonCodeContent.replace(/(\|[^|]*?)([a-zA-Z]+)_([a-zA-Z]+)([^|]*?\|)/g, (match, before, word1, word2, after) => {
      // Escape underscores within table cells (including placeholders - we handle them later)
      return `${before}${word1}\\_${word2}${after}`;
    });

    // CRITICAL FIX 1b: Escape template variables and JSON objects in table cells
    // This prevents acorn parsing errors for content like {"denom":"uatom"}
    nonCodeContent = nonCodeContent.replace(/(\|[^|\n]*)(\{[^}|\n]+\})([^|\n]*\|)/g, (match, before, templateVar, after) => {
      // Wrap template variables and JSON in backticks within table cells
      return `${before}\`${templateVar}\`${after}`;
    });

    // Fix invalid JSX comments with escaped characters
    // Handle complete escaped comments: {/\*...\*/}
    nonCodeContent = nonCodeContent.replace(/\{\/\\\*([^}]*)\\\*\/\}/g, (match, content) => {
      return '{/* ' + content.trim() + ' */}';
    });

    // Handle partial escaped comment starts: {/\*
    nonCodeContent = nonCodeContent.replace(/\{\/\\\*/g, '{/*');

    // Handle partial escaped comment ends: \*/}
    nonCodeContent = nonCodeContent.replace(/\\\*\/\}/g, '*/}');

    // Fix unclosed JSX comments - ensure all {/* have matching */}
    nonCodeContent = nonCodeContent.replace(/\{\/\*([^*]|\*(?!\/))*$/gm, (match) => {
      // Add closing */} if missing
      return match + ' */}';
    });

    // Fix orphaned comment closings */} without opening {/*
    nonCodeContent = nonCodeContent.replace(/^[^{]*\*\/\}/gm, (match) => {
      // Add opening {/* if missing
      return '{/* ' + match;
    });

    // Fix HTML elements with hyphens in tag names (e.g., <custom-element>)
    // Convert to PascalCase for JSX compatibility
    nonCodeContent = nonCodeContent.replace(/<([a-z]+(?:-[a-z]+)+)([^>]*>)/gi, (match, tagName, rest) => {
      // Skip if already in backticks
      if (match.includes('`')) return match;
      // Convert kebab-case to PascalCase
      const pascalCase = tagName.split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      return `<${pascalCase}${rest}`;
    });
    // Also convert closing tags
    nonCodeContent = nonCodeContent.replace(/<\/([a-z]+(?:-[a-z]+)+)>/gi, (match, tagName) => {
      const pascalCase = tagName.split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      return `</${pascalCase}>`;
    });

    // Fix expressions with hyphens that break JSX parsing
    nonCodeContent = nonCodeContent.replace(/`([^`]*<[^>]*-[^>]*>[^`]*)`/g, (match, content) => {
      if (content.match(/<-+>/)) {
        return '`' + content + '`';
      }
      return match;
    });

    // Fix double backticks to single backticks
    nonCodeContent = nonCodeContent.replace(/``([^`]+)``/g, (match, content) => {
      return '`' + content + '`';
    });

    // Convert HTML comments to JSX comments, handling incomplete ones
    nonCodeContent = nonCodeContent.replace(/<!--\s*(.*?)\s*-->/gs, '{/* $1 */}');
    // Handle incomplete HTML comments that never close
    nonCodeContent = nonCodeContent.replace(/<!--([^]*?)(?!-->)(?=\n|$)/g, '{/* $1 */}');

    // Convert URLs in angle brackets to proper markdown links
    nonCodeContent = nonCodeContent.replace(/<(https?:\/\/[^>]+)>/g, '[Link]($1)');

    // Fix arrow operators and comparison operators that break parsing
    // Don't wrap if it's already in backticks or part of HTML tag
    nonCodeContent = nonCodeContent.replace(/(?<!`)(<->)(?!`)/g, '`$1`');
    nonCodeContent = nonCodeContent.replace(/(?<!`)(<=>)(?!`)/g, '`$1`');

    // Fix version markers like **<= v0.45**: (must be done BEFORE general <= replacement)
    nonCodeContent = nonCodeContent.replace(/\*\*<=\s*v([\d.]+)\*\*:/g, '**v$1 and earlier**:');
    nonCodeContent = nonCodeContent.replace(/\*\*>=\s*v([\d.]+)\*\*:/g, '**v$1 and later**:');

    // Fix comparison operators in text (not in markdown emphasis)
    nonCodeContent = nonCodeContent.replace(/(\s)(<=)(\s)/g, '$1`$2`$3');
    nonCodeContent = nonCodeContent.replace(/(\s)(>=)(\s)/g, '$1`$2`$3');

    // Fix block quotes with template variables (lazy line issue)
    // Replace template variables at the end of block quotes
    nonCodeContent = nonCodeContent.replace(/(^>.*\n>.*\n>.*\n)(>\s*\{[^}]+\})/gm, (match, quote, templateLine) => {
      // Convert the template line to a regular line (not part of quote)
      const template = templateLine.replace(/^>\s*/, '');
      return quote + '\n' + template.replace(/\{([^}]+)\}/, '`{$1}`');
    });

    // CRITICAL FIX 5: Fix orphaned closing tags by removing them
    // First pass: identify and remove orphaned closing tags
    const lines = nonCodeContent.split('\n');
    const processedLines = [];
    const tagStack = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for opening tags
      const openingMatch = line.match(/<(Info|Warning|Note|Tip|Check|Accordion|details|Expandable)\b[^>]*>/);
      if (openingMatch) {
        tagStack.push({ tag: openingMatch[1], line: i });
        processedLines.push(line);
        continue;
      }

      // Check for closing tags
      const closingMatch = line.match(/^\s*<\/(Info|Warning|Note|Tip|Check|Accordion|details|Expandable)>/);
      if (closingMatch) {
        const tagName = closingMatch[1];

        // Find matching opening tag in stack
        let foundMatch = false;
        for (let j = tagStack.length - 1; j >= 0; j--) {
          if (tagStack[j].tag === tagName) {
            // Found matching opening tag, remove from stack
            tagStack.splice(j, 1);
            foundMatch = true;
            break;
          }
        }

        if (foundMatch) {
          processedLines.push(line); // Keep the closing tag
        } else {
          // Orphaned closing tag - remove it
        }
      } else {
        processedLines.push(line);
      }
    }

    // Check for unclosed opening tags
    if (tagStack.length > 0) {
      tagStack.forEach(({ tag, line }) => {
        processedLines.push(`</${tag}>`);
      });
    }

    nonCodeContent = processedLines.join('\n');

    // Convert any remaining <details> tags that weren't caught by AST processing
    // IMPORTANT: Make sure to close the Expandable tag properly
    nonCodeContent = nonCodeContent.replace(
      /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*([\s\S]*?)(<\/details>|$)/gi,
      (match, summary, content, closingTag) => {
        // Only add closing tag if we found </details>
        const expandableClose = closingTag.includes('</details>') ? '</Expandable>' : '';
        return `<Expandable title="${summary.trim()}">\n${content.trim()}\n${expandableClose}`;
      }
    );

    // Fix unclosed placeholder tags - convert to inline code
    nonCodeContent = nonCodeContent.replace(/<(appd|simd|gaiad|osmosisd|junod|yourapp|module)>/g, '`$1`');

    // Wrap template variables and expressions in backticks to avoid JSX parsing issues
    // But be careful not to double-wrap already wrapped content
    nonCodeContent = nonCodeContent
      // 1. Complete paths with template variables: /path{vars} → `/path{vars}`
      .replace(/(\/[a-zA-Z][a-zA-Z0-9/._-]*\{[^}]+\})/g, (match) => {
        // Check if already wrapped in backticks
        const beforeMatch = nonCodeContent.substring(0, nonCodeContent.indexOf(match));
        const lastChar = beforeMatch[beforeMatch.length - 1];
        if (lastChar === '`') return match; // Already wrapped
        return '`' + match + '`';
      })

      // 2. Template variables that look like placeholders
      .replace(/\{([a-zA-Z_][\w\s]*)\}/g, (match, content) => {
        if (content.includes('/*') || content.includes('*/')) return match;

        const pos = nonCodeContent.indexOf(match);
        if (pos > 0 && nonCodeContent[pos - 1] === '`') return match;

        if (match.includes('__INLINE_CODE_') || match.includes('__CODE_BLOCK_')) return match;
        return '`' + match + '`';
      })

      // 3. Fix template expressions with periods that break acorn parsing
      // e.g., {module.path} or {params.value}
      .replace(/\{([a-zA-Z_][\w]*\.[\w.]+)\}/g, (match) => {
        // Check if already wrapped
        const pos = nonCodeContent.indexOf(match);
        if (pos > 0 && nonCodeContent[pos - 1] === '`') return match;
        return '`' + match + '`';
      })

      // 4. Fix array/object access patterns that break acorn
      // e.g., {data[0]} or {obj['key']}
      .replace(/\{([a-zA-Z_][\w]*\[[^\]]+\])\}/g, (match) => {
        const pos = nonCodeContent.indexOf(match);
        if (pos > 0 && nonCodeContent[pos - 1] === '`') return match;
        return '`' + match + '`';
      })

    // Fix malformed HTML tags
    nonCodeContent = nonCodeContent.replace(/<([a-z][a-z0-9-]*)\s+([^>]+?)>/gi, (match, tag, content) => {
      if (!/=/.test(content) && /\s/.test(content)) {
        return `\`${tag} ${content}\``;
      }
      return match;
    });

    // Fix standalone closing tags
    nonCodeContent = nonCodeContent.replace(/^\s*<\/[^>]+>\s*$/gm, '');

    // Fix unclosed tags at the end of lines
    nonCodeContent = nonCodeContent.replace(/<([a-z][a-z0-9-]*)\s*$/gm, '`<$1>`');

    // Remove malformed import statements
    nonCodeContent = nonCodeContent.replace(/^import\s+[^;]*$/gm, '');

    // CRITICAL FIX 5: Fix JSX attributes with hyphens (convert to camelCase)
    // <Expandable custom-prop="value"> -> <Expandable customProp="value">
    nonCodeContent = nonCodeContent.replace(/<([A-Z][a-zA-Z]*)\s+([^>]+)>/g, (match, component, attrs) => {
      const fixedAttrs = attrs.replace(/([a-z]+-[a-z-]+)(=)/g, (attrMatch, attrName, equals) => {
        // Convert kebab-case to camelCase
        const camelCase = attrName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return camelCase + equals;
      });
      return `<${component} ${fixedAttrs}>`;
    });

    // CRITICAL FIX 6: Balance unclosed braces in expressions
    // Find expressions with unbalanced braces and escape them
    nonCodeContent = nonCodeContent.replace(/\{([^}]*(?:\{[^}]*)*[^}]*)\n/g, (match, expression) => {
      const openCount = (expression.match(/\{/g) || []).length;
      const closeCount = (expression.match(/\}/g) || []).length;

      if (openCount > closeCount) {
        // Expression has unclosed braces - escape it
        return '`' + match.trim() + '`\n';
      }
      return match;
    });

    // CRITICAL FIX 7: Fix <details> to <Expandable> conversion edge cases
    nonCodeContent = nonCodeContent.replace(/<details>/gi, '<Expandable title="Details">');
    nonCodeContent = nonCodeContent.replace(/<\/details>/gi, '</Expandable>');

    // CRITICAL FIX 8: Fix backticks inside link text for proper MDX rendering
    // Pattern: [`code`](link) causes formatting issues in Mintlify
    // Solution: Remove backticks when the entire link text is code
    // This prevents underscores and other characters from being misinterpreted
    nonCodeContent = nonCodeContent.replace(/\[`([^`\]]+)`\]\(([^)]+)\)/g, '[$1]($2)');

    return nonCodeContent;
  });
}

/**
 * Validate MDX content and report issues that require manual intervention.
 * This function only reports problems that couldn't be automatically fixed.
 *
 * @function validateMDXContent
 * @param {string} content - The markdown content to validate
 * @param {string} [filepath=''] - Path to file being processed
 * @returns {string} The original content (unchanged)
 *
 * @description
 * Validation checks performed:
 * 1. Double backticks that couldn't be fixed
 * 2. Unescaped template variables ({var} outside code)
 * 3. JSX attributes with hyphens converted to camelCase
 * 4. Invalid JSX comment syntax
 * 5. Unclosed JSX expressions (missing })
 * 6. Unclosed JSX comments
 * 7. Orphaned or mismatched JSX tags (<Tag> without </Tag>)
 *
 * Uses content fingerprinting to prevent duplicate validation of identical
 * content across different file paths.
 *
 * @example
 * // Validation happens after all automatic fixes:
 * let content = fixMDXIssues(rawContent);
 * content = validateMDXContent(content, 'path/to/file.md');
 * // Errors are added to migrationIssues for final report
 */
function validateMDXContent(content, filepath = '') {
  // Track current file for error reporting
  if (filepath) {
    migrationIssues.setCurrentFile(filepath);

    // Skip validation if we've already processed this file content
    const contentHash = content.substring(0, 200); // Simple content fingerprint
    const fileKey = `${filepath}:${contentHash}`;
    if (migrationIssues.processedFiles.has(fileKey)) {
      return content; // Skip duplicate processing
    }
    migrationIssues.processedFiles.add(fileKey);
  }

  // Use safeProcessContent to only validate non-code content
  return safeProcessContent(content, (nonCodeContent) => {
    const lines = nonCodeContent.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

    // Check for remaining double backticks
    if (/``[^`]+``/.test(line)) {
      migrationIssues.addError(
        lineNum,
        'Double backticks still present',
        'Manually change to single backticks or escape the content'
      );
    }

    // Check for unescaped template variables outside of backticks
    // But be more selective - only flag ones that look like actual template variables
    const templateVarMatch = line.match(/(?<!`)\{([a-zA-Z_][\w]*(?:_id|_Id|Id|Address|_name|_url|_urls)?)\}(?!`)/);
    if (templateVarMatch &&
        !templateVarMatch[0].includes('/*') &&
        !templateVarMatch[0].includes('*/')) {
      migrationIssues.addError(
        lineNum,
        `Unescaped template variable: ${templateVarMatch[0]}`,
        'Wrap in backticks or escape with backslash'
      );
    }

    // Check for JSX attribute names with hyphens
    const jsxAttrMatch = line.match(/<([A-Z][a-zA-Z]*)\s+([a-z]+-[a-z-]+)=/);
    if (jsxAttrMatch) {
      migrationIssues.addError(
        lineNum,
        `JSX attribute with hyphen: ${jsxAttrMatch[2]}`,
        `Convert to camelCase (e.g., ${jsxAttrMatch[2].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())})`
      );
    }

    // Don't check for orphaned tags line-by-line - this is handled better in the full content check below

    // Check for invalid JSX comments with backslashes
    if (/\{\/\\\*|\\\*\/\}/.test(line)) {
      migrationIssues.addError(
        lineNum,
        'Invalid JSX comment with escaped characters',
        'Change to proper JSX comment: {/* content */}'
      );
    }


    // Check for unclosed JSX expressions (not just any braces)
    const jsxExprMatch = line.match(/(?<!`)(\{[^}]*$)/);
    if (jsxExprMatch && !line.includes('*/}') && !line.includes('/*')) {
      // This looks like an unclosed JSX expression
      // Check if it continues on the next line
      let closedOnNextLines = false;
      for (let j = index + 1; j < Math.min(index + 5, lines.length); j++) {
        if (lines[j].includes('}')) {
          closedOnNextLines = true;
          break;
        }
      }

      if (!closedOnNextLines) {
        migrationIssues.addError(
          lineNum,
          'Unclosed JSX expression',
          'Missing closing brace for JSX expression'
        );
      }
    }


    // Check for expressions that are LIKELY to break acorn parsing
    // Only check for the most problematic patterns
    if (/\{\/\*/.test(line) && !/\{\/\*.*\*\/\}/.test(line)) {
      // Unclosed block comment in expression
      migrationIssues.addError(
        lineNum,
        'Unclosed comment in JSX expression',
        'Comments inside JSX expressions must be properly closed'
      );
    }
    });

    // Check for common patterns that span multiple lines
    const fullContent = lines.join('\n');

    // More accurate check for unclosed JSX tags using a stack-based approach
    const jsxTags = ['Info', 'Warning', 'Note', 'Tip', 'Check', 'Accordion', 'Expandable'];
    const tagStack = [];
    const tagRegex = new RegExp(`<(/?)(${jsxTags.join('|')})[^>]*>`, 'g');
    let match;

    while ((match = tagRegex.exec(fullContent)) !== null) {
      const isClosing = match[1] === '/';
      const tagName = match[2];

      if (!isClosing) {
        // Opening tag
        tagStack.push({ tag: tagName, index: match.index });
      } else {
        // Closing tag
        if (tagStack.length === 0 || tagStack[tagStack.length - 1].tag !== tagName) {
          // Orphaned closing tag or mismatched tag
          const lineNum = fullContent.substring(0, match.index).split('\n').length;
          migrationIssues.addError(
            lineNum,
            `Orphaned or mismatched closing tag </${tagName}>`,
            'Check for missing opening tag or remove this closing tag'
          );
        } else {
          // Matched pair, remove from stack
          tagStack.pop();
        }
      }
    }

    // Check for unclosed opening tags
    if (tagStack.length > 0) {
      tagStack.forEach(({ tag, index }) => {
        const lineNum = fullContent.substring(0, index).split('\n').length;
        migrationIssues.addError(
          lineNum,
          `Unclosed opening tag <${tag}>`,
          'Add matching closing tag or remove this opening tag'
        );
      });
    }

    // Return the non-code content unchanged (validation only)
    return nonCodeContent;
  });

}

/**
 * Create an AST processor plugin for fixing internal links.
 * Handles relative paths and versioned documentation links.
 *
 * @function createLinkFixerPlugin
 * @param {string} version - Target version (e.g., 'next', 'v0.50')
 * @param {string} product - Product name for namespacing (e.g., 'sdk', 'ibc')
 * @returns {Function} Unified plugin function
 *
 * @description
 * This remark plugin traverses the AST and fixes:
 * 1. Relative links to absolute paths
 * 2. Removes .md and .mdx extensions from internal links
 * 3. Adds product and version namespacing to internal links
 * 4. Maintains external links and anchors unchanged
 *
 * @example
 * // In AST pipeline:
 * unified()
 *   .use(createLinkFixerPlugin('v0.50', 'sdk'))
 *   // Transforms:
 *   // ../intro.md becomes /sdk/v0.50/intro
 *   // ./guide.mdx becomes /sdk/v0.50/guide
 *   // /learn/overview.md becomes /sdk/v0.50/learn/overview
 */
function createLinkFixerPlugin(version, product, sourceFilePath = '') {
  return () => {
    return (tree) => {
      visit(tree, 'link', (node) => {
        if (!node.url) return;

        // Skip external links
        if (node.url.startsWith('http://') || node.url.startsWith('https://')) {
          return;
        }

        // Skip anchor-only links
        if (node.url.startsWith('#')) {
          return;
        }

        // Get the directory of the source file (relative to doc root)
        const sourceDir = path.dirname(sourceFilePath || '');

        let resolvedPath = node.url;

        // Handle relative links - properly resolve using path.join and path.normalize
        if (node.url.startsWith('../') || node.url.startsWith('./')) {
          // Join the source directory with the relative link
          const joined = path.join(sourceDir, node.url);

          // Normalize to resolve .. and . segments
          resolvedPath = path.normalize(joined);

          // Ensure it starts with /
          if (!resolvedPath.startsWith('/')) {
            resolvedPath = '/' + resolvedPath;
          }
        } else if (!node.url.startsWith('/')) {
          // Implicit relative path (no ./ prefix)
          resolvedPath = path.join(sourceDir, node.url);
          if (!resolvedPath.startsWith('/')) {
            resolvedPath = '/' + resolvedPath;
          }
        } else {
          // Already absolute from doc root
          resolvedPath = node.url;
        }

        // Clean up any Windows-style backslashes
        resolvedPath = resolvedPath.replace(/\\/g, '/');

        // Remove numbered prefixes from the resolved path
        // Example: /01-learn/02-advanced/intro.md -> /learn/advanced/intro.md
        resolvedPath = resolvedPath.replace(/\/(\d+-)/g, '/').replace(/^(\d+-)/, '');

        // Remove .md or .mdx extensions from internal links
        resolvedPath = resolvedPath.replace(/\.mdx?(?=#|$)/g, '');

        // Add /product/version prefix for internal links
        if (resolvedPath.startsWith('/') && !resolvedPath.startsWith(`/${product}/`)) {
          node.url = `/${product}/${version}${resolvedPath}`;
        } else if (resolvedPath.includes(`/${product}/`) && !resolvedPath.includes(`/${product}/${version}/`)) {
          // Update existing product links to include version
          node.url = resolvedPath.replace(`/${product}/`, `/${product}/${version}/`);
        } else {
          node.url = resolvedPath;
        }
      });
    };
  };
}

/**
 * Create an AST processor plugin for fixing HTML elements and MDX incompatibilities.
 * Converts HTML to JSX-compatible syntax for Mintlify.
 *
 * @function createHTMLFixerPlugin
 * @returns {Function} Unified plugin function
 *
 * @description
 * This remark plugin traverses the AST and fixes:
 * 1. HTML comments to JSX comments
 * 2. Details tags to Expandable components
 * 3. Command placeholders to inline code
 * 4. Comparison operators wrapped in code
 * 5. Generic placeholders to inline code
 *
 * Special handling:
 * - Preserves content in code blocks and links
 * - Skips table cells to avoid double-wrapping
 * - Handles both complete and unclosed tags
 *
 * @example
 * // In AST pipeline:
 * unified()
 *   .use(createHTMLFixerPlugin())
 *   // Transforms:
 *   // Transforms HTML comments to JSX format
 *   // Converts details/summary to Expandable components
 *   // Wraps command placeholders in backticks
 */
function createHTMLFixerPlugin() {
  return () => {
    return (tree) => {
      // Process HTML nodes
      visit(tree, 'html', (node) => {
        if (!node.value) return;

        // Convert HTML comments to JSX comments
        node.value = node.value.replace(/<!--\s*(.*?)\s*-->/gs, '{/* $1 */}');

        // Convert <details> tags to Mintlify Expandable
        if (node.value.includes('<details')) {
          // First try to handle complete details tags
          node.value = node.value.replace(
            /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*([\s\S]*?)<\/details>/gi,
            (match, summary, content) => {
              return `<Expandable title="${summary.trim()}">\n${content.trim()}\n</Expandable>`;
            });

          // Then handle any remaining unclosed details tags
          // This catches cases where </details> is in a different node
          if (node.value.includes('<details') && !node.value.includes('</details>')) {
            node.value = node.value.replace(
              /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*([\s\S]*?)$/gi,
              (match, summary, content) => {
                // Add Expandable but DON'T add closing tag - it may be in another node
                return `<Expandable title="${summary.trim()}">\n${content.trim()}`;
              });
          }
        }
      });

      // Process text nodes to fix problematic angle brackets and template variables
      visit(tree, 'text', (node, index, parent) => {
        if (!node.value) return;

        // Skip if inside a code block or link
        if (parent && (parent.type === 'code' || parent.type === 'inlineCode' || parent.type === 'link')) {
          return;
        }

        // Don't process text in table cells here - we'll handle them properly below
        if (parent && parent.type === 'tableCell') {
          return; // Skip table cell text processing
        }

        // Fix command placeholders like <appd>, <simd>
        node.value = node.value.replace(/<(appd|simd|gaiad|osmosisd|junod|yourapp)>/g, '`$1`');

        // Fix comparison operators and arrows
        // Don't wrap if already in backticks
        node.value = node.value.replace(/(?<!`)(<=>)(?!`)/g, '`$1`');
        node.value = node.value.replace(/(?<!`)(<->)(?!`)/g, '`$1`');

        // Fix generic placeholders like <host>, <port>, <module>
        // Common placeholders that should be wrapped in backticks
        node.value = node.value.replace(/<(host|port|path|user|pass|module|version|namespace|service)>/g, '`<$1>`');
        // Fix hyphenated placeholders
        node.value = node.value.replace(/<([a-z]+-[a-z]+(?:-[a-z]+)*)>/g, '`<$1>`');
      });

      // Remove table cell processing - we handle template variables in fixMDXIssues instead
      // This avoids double-wrapping issues
    };
  };
}

/**
 * Fetch actual code content from GitHub repository URLs.
 * Converts blob URLs to raw URLs and retrieves file contents.
 *
 * @async
 * @function fetchGitHubCode
 * @param {string} url - GitHub blob URL to fetch from
 * @returns {Promise<string|null>} File content or null if fetch fails
 *
 * @description
 * Transforms GitHub blob URLs to raw.githubusercontent.com URLs
 * and fetches the actual file content. Used to replace Docusaurus
 * reference blocks with real code.
 *
 * URL transformation:
 * - github.com domain to raw.githubusercontent.com
 * - blob path segment removed for raw access
 *
 * @example
 * const url = 'https://github.com/cosmos/cosmos-sdk/blob/main/types/coin.go';
 * const code = await fetchGitHubCode(url);
 * // Returns actual Go code from the file
 *
 * @throws {Error} Logs warning if fetch fails but doesn't throw
 */
async function fetchGitHubCode(url) {
  try {
    // Convert GitHub blob URLs to raw URLs
    const rawUrl = url.replace('github.com', 'raw.githubusercontent.com')
                    .replace('/blob/', '/');

    const response = await fetch(rawUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const content = await response.text();
    return content.trim();
  } catch (error) {
    console.warn(`Failed to fetch GitHub code from ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Create an AST processor plugin for enhancing code blocks.
 * Handles reference URLs, adds expandable attributes, and detects languages.
 *
 * @function createCodeBlockEnhancerPlugin
 * @returns {Function} Async unified plugin function
 *
 * @description
 * This async remark plugin enhances code blocks by:
 * 1. Detecting and fetching GitHub reference URLs
 * 2. Adding 'expandable' attribute for blocks >10 lines
 * 3. Auto-detecting language from code content
 * 4. Formatting code based on language
 * 5. Removing 'reference' keyword from metadata
 *
 * Reference handling:
 * - Detects single-line GitHub URLs in code blocks
 * - Fetches actual code for 'go' language blocks
 * - Converts to comments for other languages
 *
 * Language detection based on common patterns:
 * - Go: package declarations, func keywords
 * - JavaScript: const, let, function, arrow functions
 * - Python: def, class keywords
 * - Bash: shell commands and scripts
 * - JSON: object notation
 * - Protobuf: message and service definitions
 *
 * @example
 * // In AST pipeline:
 * unified()
 *   .use(createCodeBlockEnhancerPlugin())
 * // Fetches GitHub references and enhances code blocks
 */
function createCodeBlockEnhancerPlugin() {
  return () => {
    return async (tree, file) => {
      const codeNodes = [];
      visit(tree, 'code', (node) => {
        codeNodes.push(node);
      });

      // Process code nodes with potential async operations
      for (const node of codeNodes) {
        let isReferenceBlock = false;

        // Handle Docusaurus "reference" syntax by detecting URL-only content
        // Check if the code block contains just a GitHub URL (reference pattern)
        if (node.value && node.value.trim().startsWith('https://github.com/') &&
            node.value.trim().split('\n').length === 1) {
          isReferenceBlock = true;
          const url = node.value.trim();
          const lang = node.lang || 'text';

          // Try to fetch actual content for go reference blocks
          if (lang === 'go' || lang === 'golang') {
            const fetchedContent = await fetchGitHubCode(url);
            if (fetchedContent) {
              node.value = fetchedContent;
            } else {
              node.value = `// Reference: ${url}`;
            }
          } else {
            // For other languages, convert to comment with the reference URL preserved
            if (lang === 'protobuf' || lang === 'proto') {
              node.value = `// Reference: ${url}`;
            } else if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts') {
              node.value = `// Reference: ${url}`;
            } else if (lang === 'python' || lang === 'py') {
              node.value = `# Reference: ${url}`;
            } else if (lang === 'bash' || lang === 'shell' || lang === 'sh') {
              node.value = `# Reference: ${url}`;
            } else {
              // Default to comment style
              node.value = `// Reference: ${url}`;
            }
          }
        }

        // Remove any "reference" from meta as well
        if (node.meta && node.meta.includes('reference')) {
          node.meta = node.meta.replace('reference', '').trim();
        }

        // Add expandable to long code blocks (but not to reference blocks that became comments)
        if (node.value && node.value.split('\n').length > 10) {
          // Skip adding expandable to reference blocks that became single-line comments
          const isShortReference = isReferenceBlock &&
            (node.value.startsWith('// Reference:') || node.value.startsWith('# Reference:')) &&
            node.value.split('\n').length <= 2;

          if (!isShortReference && (!node.meta || !node.meta.includes('expandable'))) {
            node.meta = node.meta ? `${node.meta} expandable` : 'expandable';
          }
        }

        // Ensure language is specified by detecting content
        if (!node.lang && node.value) {
          const codeContent = node.value.toLowerCase();

          if (codeContent.includes('package ') || codeContent.includes('func ') ||
              codeContent.includes('import "') || codeContent.includes('interface{')) {
            node.lang = 'go';
          } else if (codeContent.includes('const ') || codeContent.includes('let ') ||
                     codeContent.includes('function ') || codeContent.includes('=> ')) {
            node.lang = 'javascript';
          } else if (codeContent.includes('#!/bin/bash') || codeContent.includes('echo ') ||
                     codeContent.includes('npm ') || codeContent.includes('yarn ')) {
            node.lang = 'bash';
          } else if (codeContent.includes('def ') || codeContent.includes('class ')) {
            node.lang = 'python';
          } else if (codeContent.trim().startsWith('{') && codeContent.includes('"')) {
            node.lang = 'json';
          } else if (codeContent.includes('message ') || codeContent.includes('service ')) {
            node.lang = 'protobuf';
          }
        }

        // Format the code content if we have formatting functions available
        if (node.lang && node.value) {
          const formatted = formatCodeByLanguage(node.lang, node.value);
          if (formatted !== node.value) {
            node.value = formatted;
          }
        }
      }
    };
  };
}

/**
 * Format code content based on the programming language.
 * Delegates to language-specific formatters.
 *
 * @function formatCodeByLanguage
 * @param {string} lang - Language identifier (go, js, json, etc.)
 * @param {string} code - Raw code content to format
 * @returns {string} Formatted code or original if no formatter available
 *
 * @description
 * Routes code to appropriate language-specific formatter:
 * - Go/Golang uses formatGoCode()
 * - JavaScript/TypeScript uses formatJavaScriptCode()
 * - JSON/JSONC uses formatJsonCode()
 * - Others return unchanged
 *
 * @example
 * const formatted = formatCodeByLanguage('go', 'func main(){fmt.Println("hello")}');
 * // Returns properly formatted Go code
 */
function formatCodeByLanguage(lang, code) {
  switch (lang.toLowerCase()) {
    case 'go':
    case 'golang':
      return formatGoCode(code);
    case 'javascript':
    case 'js':
    case 'typescript':
    case 'ts':
      return formatJavaScriptCode(code);
    case 'json':
    case 'jsonc':
      return formatJsonCode(code);
    default:
      return code;
  }
}

/**
 * Process markdown content using AST transformations for accuracy.
 * Orchestrates all AST-based plugins in the correct order.
 *
 * @async
 * @function processMarkdownWithAST
 * @param {string} content - Raw markdown content
 * @param {string} version - Target version for link fixing
 * @param {string} product - Product name for link namespacing
 * @param {string} [sourceFilePath=''] - Source file path relative to doc root
 * @returns {Promise<string>} Transformed markdown content
 *
 * @description
 * Creates a unified processor pipeline with:
 * 1. remarkParse - Parse markdown to AST
 * 2. remarkGfm - Enable GitHub Flavored Markdown (tables, etc.)
 * 3. createLinkFixerPlugin - Fix internal links (with proper path resolution)
 * 4. createHTMLFixerPlugin - Convert HTML to JSX
 * 5. createCodeBlockEnhancerPlugin - Enhance code blocks
 * 6. remarkStringify - Convert AST back to markdown
 *
 * Falls back to original content if AST processing fails,
 * logging a warning but not breaking the conversion.
 *
 * @example
 * const processed = await processMarkdownWithAST(
 *   '# Title\n\nContent with [link](../other.md)',
 *   'v0.50',
 *   'sdk',
 *   'learn/advanced/staking.md'
 * );
 * // Returns markdown with fixed links and enhanced code blocks
 */
async function processMarkdownWithAST(content, version, product, sourceFilePath = '') {
  try {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)  // Enable GitHub Flavored Markdown for proper table parsing
      .use(createLinkFixerPlugin(version, product, sourceFilePath))
      .use(createHTMLFixerPlugin())
      .use(createCodeBlockEnhancerPlugin())
      .use(remarkStringify);

    const file = await processor.process(content);
    return String(file);
  } catch (error) {
    console.warn('AST processing failed, falling back to regex:', error.message);
    console.warn('Error details:', error);
    return content;
  }
}

/**
 * Convert a single Docusaurus markdown file to Mintlify MDX format.
 * This is the main conversion pipeline that orchestrates all transformations.
 *
 * @async
 * @function convertDocusaurusToMintlify
 * @param {string} content - Raw Docusaurus markdown content
 * @param {Object} [options={}] - Conversion options
 * @param {string} [options.version='next'] - Version directory (e.g., 'v0.50', 'next')
 * @param {string} [options.product='generic'] - Product name for link resolution (REQUIRED)
 * @param {boolean} [options.keepTitle=false] - Whether to keep H1 in content
 * @param {string} [options.filepath=''] - Source file path for error reporting
 * @returns {Promise<Object>} Conversion result
 * @returns {string} result.content - Converted MDX content with frontmatter
 * @returns {Object} result.metadata - Extracted metadata (title, sidebarPosition)
 *
 * @description
 * Conversion pipeline:
 * 1. Parse frontmatter (extract YAML metadata)
 * 2. Extract/generate title from frontmatter or content
 * 3. Extract description from first paragraph
 * 4. Convert HTML comments to JSX comments
 * 5. Process with AST for accurate transformations:
 *    - Fix internal links for versioning
 *    - Enhance code blocks (add expandable, fetch GitHub refs)
 * 6. Apply MDX fixes (escape underscores, fix JSX syntax)
 * 7. Convert Docusaurus admonitions to Mintlify callouts
 * 8. Fix internal links for product namespace
 * 9. Validate content and report unfixable issues
 * 10. Generate clean Mintlify-compatible frontmatter
 *
 * @example
 * const result = await convertDocusaurusToMintlify(content, {
 *   version: 'v0.50',
 *   product: 'sdk',
 *   filepath: 'learn/intro.md'
 * });
 * // result.content contains the converted MDX
 * // result.metadata contains { title, sidebarPosition }
 */
async function convertDocusaurusToMintlify(content, options = {}) {
  const { version = 'next', product = 'generic', keepTitle = false, filepath = '' } = options;

  // Parse frontmatter and content
  const { frontmatter, content: mainContent } = parseDocusaurusFrontmatter(content);

  // Extract or generate title
  let title = frontmatter.title || frontmatter.sidebar_label;
  let processedContent = mainContent;

  if (!title) {
    const extracted = extractTitleFromContent(processedContent);
    title = extracted.title;
    if (title) {
      processedContent = extracted.content;
    } else {
      // Generate title from filename if no title found
      if (filepath) {
        const filename = path.basename(filepath, path.extname(filepath));
        // Convert filename to title: adr-046-module-params -> ADR 046 Module Params
        title = filename
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, char => char.toUpperCase())
          .replace(/\bAdr\b/g, 'ADR'); // Special case for ADR
      } else {
        title = 'Documentation';
      }
    }
  } else if (!keepTitle) {
    // Remove H1 if we have title from frontmatter
    const extracted = extractTitleFromContent(processedContent);
    if (extracted.title) {
      processedContent = extracted.content;
    }
  }

  // Extract description from first paragraph after H1, or use frontmatter if it exists
  let description = frontmatter.description || null;

  if (!description) {
    // Look for first paragraph after H1 heading
    const afterTitle = processedContent.replace(/^#+\s+.*\n/m, '').trim();
    const firstParagraph = afterTitle.split(/\n\n/)[0];

    if (firstParagraph) {
      // Clean up the paragraph - remove markdown formatting
      const cleaned = firstParagraph
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
        .replace(/[*_`]/g, '') // Remove formatting
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Use as description if it's reasonable length and not structural content
      if (cleaned.length > 10 &&
          cleaned.length < 300 &&
          !cleaned.includes('|') && // Not table content
          !cleaned.includes(':::') && // Not admonition
          !cleaned.includes('```')) { // Not code
        description = cleaned;
      }
    }
  }

  // Apply conversions
  // Convert HTML comments to JSX comments for MDX compatibility
  // Handle both complete and incomplete HTML comments
  processedContent = processedContent.replace(/<!--\s*([\s\S]*?)\s*-->/g, (match, content) => {
    // For very long comments (>10 lines), just remove them as they're likely documentation notes
    const lineCount = content.split('\n').length;
    if (lineCount > 10) {
      // Track that we removed a long HTML comment
      if (filepath) {
        migrationIssues.setCurrentFile(filepath);
        migrationIssues.addRemoval(
          'Removed long HTML comment',
          `${lineCount}-line comment removed (likely documentation notes)`
        );
      }
      return '';
    }
    // Clean up the content - preserve structure but avoid nested comment syntax
    // Replace any /* or */ inside the comment to prevent JSX issues
    const cleaned = content
      .replace(/\/\*/g, '/')
      .replace(/\*\//g, '/')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(' '); // Join with space, not newline, to avoid JSX issues
    return `{/* ${cleaned} */}`;
  });

  // Handle malformed or incomplete HTML comments
  processedContent = processedContent.replace(/<!--([^>]*?)$/gm, (match, content) => {
    const cleaned = content.trim();
    return `{/* ${cleaned} */}`;
  });


  // Fix common MDX issues
  // Use AST processing first for better accuracy (handles code blocks)
  processedContent = await processMarkdownWithAST(processedContent, version, product, filepath);

  // Fix MDX issues and apply conversions
  processedContent = fixMDXIssues(processedContent, filepath);
  processedContent = convertAdmonitions(processedContent);
  processedContent = fixInternalLinks(processedContent, version, product);

  // Final cleanup: ensure all Expandable tags are closed
  // Count opening and closing Expandable tags
  const openExpandables = (processedContent.match(/<Expandable[^>]*>/g) || []).length;
  const closeExpandables = (processedContent.match(/<\/Expandable>/g) || []).length;

  // Add missing closing tags at the end if needed
  if (openExpandables > closeExpandables) {
    const missing = openExpandables - closeExpandables;
    for (let i = 0; i < missing; i++) {
      processedContent += '\n</Expandable>';
    }
  }

  // Validate the processed content and report any remaining issues
  processedContent = validateMDXContent(processedContent, filepath);

  // Build Mintlify frontmatter
  const mintlifyFrontmatter = {
    title
  };

  // Only include description if we have suitable content
  if (description) {
    mintlifyFrontmatter.description = description;
  }

  // Add icon if it actually exists in Docusaurus frontmatter
  // (This is rare - Docusaurus doesn't typically use icon field)
  if (frontmatter.icon) {
    mintlifyFrontmatter.icon = frontmatter.icon;
  }

  // Do NOT preserve Docusaurus navigation metadata in Mintlify frontmatter
  // These fields (sidebar_position, sidebar_label, slug) are handled by docs.json navigation

  // Use gray-matter to safely generate frontmatter
  const cleanFrontmatter = {};

  for (const [key, value] of Object.entries(mintlifyFrontmatter)) {
    const valueStr = String(value).trim();

    // Skip fields with problematic content entirely
    if (valueStr.includes('|') ||        // Tables
        valueStr.includes(':::') ||      // Admonitions
        valueStr.includes('```') ||      // Code blocks
        valueStr.includes('{') ||        // Template variables
        valueStr.includes('}') ||
        valueStr.includes('<') ||        // HTML/XML tags or template placeholders
        valueStr.includes('>') ||
        valueStr.length > 250) {
      continue; // Skip this field entirely
    }

    cleanFrontmatter[key] = valueStr.replace(/\s+/g, ' ').trim();
  }

  // Use gray-matter to generate safe YAML frontmatter
  let finalContent = matter.stringify(processedContent, cleanFrontmatter);

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
 * Process a directory of Docusaurus files and migrate them to Mintlify format.
 * Implements content caching to optimize processing of duplicate files.
 *
 * @async
 * @function processDirectory
 * @param {string} sourceDir - Source directory containing Docusaurus markdown
 * @param {string} targetDir - Target directory for Mintlify MDX output
 * @param {string} version - Version string (e.g., 'next', 'v0.50')
 * @param {string} [product='generic'] - Product name for link resolution
 * @returns {Promise<Array>} Array of converted file metadata
 *
 * @description
 * Processing workflow:
 * 1. Recursively find all .md/.mdx files and images
 * 2. Copy images to centralized images directory
 * 3. For each markdown file:
 *    a. Calculate SHA-256 checksum of content
 *    b. Check cache for previously processed identical content
 *    c. If cached: Use cached result and report cached errors
 *    d. If new: Process with full conversion pipeline and cache result
 * 4. Write converted content to target directory
 * 5. Update image paths in converted content
 * 6. Display conversion statistics
 *
 * Caching behavior:
 * - Identical content across files is processed only once
 * - Transformation results are cached by content checksum
 * - Validation errors are cached separately
 * - Each file still gets written to its target location
 *
 * @example
 * const results = await processDirectory(
 *   '/path/to/docs',
 *   '/path/to/output',
 *   'v0.50',
 *   'sdk'
 * );
 * // Output: Conversion stats for v0.50:
 * //   - Total files: 150
 * //   - Unique content processed: 120
 * //   - Cache hits (duplicates): 30
 */
async function processDirectory(sourceDir, targetDir, version, product = 'generic', dryRun = false) {
  const files = [];
  const images = [];
  const filenameMapping = {}; // Track old -> new filename mappings for link fixing

  // Recursively find all .md, .mdx, and image files
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
      } else if (item.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
        images.push({
          source: fullPath,
          relative: relativePath,
          name: item
        });
      }
    }
  }

  findFiles(sourceDir);

  console.log(`Found ${files.length} files to convert and ${images.length} images`);

  if (dryRun) {
    console.log('\n DRY RUN MODE - No files will be written\n');
  }

  // Copy images first
  if (images.length > 0 && !dryRun) {
    // Images directory should be at the same level as version directories
    const parentDir = path.dirname(targetDir);
    const imagesDir = path.join(parentDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    console.log(`Copying ${images.length} images to ${imagesDir}`);
    for (const image of images) {
      // Strip numbered prefixes from image paths (same as file paths)
      const cleanImagePath = image.relative.replace(/\/(\d+-)/g, '/').replace(/^(\d+-)/, '');
      const targetImagePath = path.join(imagesDir, cleanImagePath);
      const targetImageDir = path.dirname(targetImagePath);

      if (!fs.existsSync(targetImageDir)) {
        fs.mkdirSync(targetImageDir, { recursive: true });
      }

      fs.copyFileSync(image.source, targetImagePath);
    }
  } else if (images.length > 0 && dryRun) {
    console.log(`[DRY RUN] Would copy ${images.length} images`);
  }

  const converted = [];
  let cacheHits = 0;
  let uniqueProcessed = 0;

  for (const file of files) {
    const content = fs.readFileSync(file.source, 'utf-8');
    const checksum = migrationCache.getChecksum(content);

    // Track this file's checksum
    migrationCache.trackFile(`${version}/${file.relative}`, checksum);

    let result;
    let fromCache = false;

    // Check if we've already processed this exact content
    if (migrationCache.hasProcessed(checksum)) {
      // Use cached result
      console.log(`Converting (cached): ${file.relative}`);
      result = migrationCache.getCachedResult(checksum);
      fromCache = true;
      cacheHits++;

      // Add cached validation errors for this file path
      const cachedErrors = migrationCache.getCachedValidation(checksum);
      if (cachedErrors.length > 0) {
        migrationIssues.setCurrentFile(file.relative);
        cachedErrors.forEach(error => {
          migrationIssues.addError(error.line, error.issue, error.suggestion);
        });
      }
    } else {
      // Process new content
      console.log(`Converting (new): ${file.relative}`);
      migrationIssues.setCurrentFile(file.relative);

      // Track errors before processing
      const errorCountBefore = migrationIssues.errors.length;

      result = await convertDocusaurusToMintlify(content, {
        version,
        product,
        filepath: file.relative
      });

      // Cache the result
      migrationCache.cacheResult(checksum, result);

      // Cache validation errors for this content
      const newErrors = migrationIssues.errors.slice(errorCountBefore);
      if (newErrors.length > 0) {
        migrationCache.cacheValidation(checksum, newErrors.map(e => ({
          line: e.line,
          issue: e.issue,
          suggestion: e.suggestion
        })));
      }

      uniqueProcessed++;
    }

    // Determine target path - remove numbered prefixes from filenames
    let cleanRelativePath = file.relative.replace(/\/(\d+-)/g, '/').replace(/^(\d+-)/, '');
    const targetPath = path.join(targetDir, cleanRelativePath.replace('.md', '.mdx'));
    const targetSubdir = path.dirname(targetPath);

    // Track the filename mapping for link fixing
    // Store both with and without extensions for different link formats
    const originalWithoutExt = file.relative.replace(/\.(md|mdx)$/, '');
    const cleanWithoutExt = cleanRelativePath.replace(/\.(md|mdx)$/, '');
    filenameMapping[originalWithoutExt] = cleanWithoutExt;

    // Also track just the filename (not full path) for relative links
    const originalFilename = path.basename(originalWithoutExt);
    const cleanFilename = path.basename(cleanWithoutExt);
    if (originalFilename !== cleanFilename) {
      filenameMapping[originalFilename] = cleanFilename;
    }

    // Update image paths in content
    let processedContent = result.content;
    processedContent = updateImagePaths(processedContent, file.relative, version);

    // Write converted file (unless dry run)
    if (!dryRun) {
      // Ensure target directory exists
      if (!fs.existsSync(targetSubdir)) {
        fs.mkdirSync(targetSubdir, { recursive: true });
      }
      fs.writeFileSync(targetPath, processedContent);
    }

    converted.push({
      path: targetPath,
      relativePath: cleanRelativePath.replace('.md', '.mdx'),
      sidebarPosition: result.metadata.sidebarPosition || 999,
      title: result.metadata.title,
      ...result.metadata,
      fromCache
    });
  }

  console.log(`\nConversion stats for ${version}:`);
  console.log(`  - Total files: ${files.length}`);
  console.log(`  - Unique content processed: ${uniqueProcessed}`);
  console.log(`  - Cache hits (duplicates): ${cacheHits}`);

  return { converted, filenameMapping };
}

/**
 * Fix numbered prefix links in all migrated files using the filename mapping.
 * This runs as a post-processing step after all files are migrated.
 * @param {string} targetBase - Base directory containing migrated files
 * @param {Object} allMappings - Combined filename mappings from all versions
 */
function fixNumberedPrefixLinks(targetBase, allMappings) {
  console.log('\n--- Fixing numbered prefix links in migrated files ---');

  let totalFilesProcessed = 0;
  let totalReplacementsFixed = 0;

  // Process all MDX files recursively
  function processFiles(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        processFiles(fullPath);
      } else if (item.endsWith('.mdx')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let originalContent = content;
        let fileModified = false;

        // First, ensure there's an empty line after frontmatter
        const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[0];
          const afterFrontmatter = content.substring(frontmatter.length);

          // Check if there's already an empty line after frontmatter
          if (!afterFrontmatter.startsWith('\n')) {
            content = frontmatter + '\n' + afterFrontmatter;
            fileModified = true;
          }
        }

        // Fix numbered prefixes ONLY in markdown links and URL references
        // This ensures we don't accidentally replace text content or code examples

        // Pattern 1: Fix markdown links [text](url)
        content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
          // Skip external URLs (http/https)
          if (url.startsWith('http://') || url.startsWith('https://')) {
            return match;
          }

          // Skip anchor-only links
          if (url.startsWith('#')) {
            return match;
          }

          let fixedUrl = url;

          // Apply all mappings to this URL
          for (const [oldPath, newPath] of Object.entries(allMappings)) {
            if (oldPath === newPath) continue;

            // Escape special regex characters
            const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Replace the old path with new path in the URL
            // This regex ensures we match the pattern as part of a path
            const regex = new RegExp(`(^|/)${escapedOldPath}(/|#|$)`, 'g');
            const beforeFix = fixedUrl;
            fixedUrl = fixedUrl.replace(regex, `$1${newPath}$2`);

            if (fixedUrl !== beforeFix) {
              totalReplacementsFixed++;
              fileModified = true;
            }
          }

          return `[${text}](${fixedUrl})`;
        });

        // Pattern 2: Fix HTML anchor href attributes <a href="url">
        content = content.replace(/<a\s+([^>]*\s)?href="([^"]+)"([^>]*)>/g, (match, before, url, after) => {
          // Skip external URLs
          if (url.startsWith('http://') || url.startsWith('https://')) {
            return match;
          }

          // Skip anchor-only links
          if (url.startsWith('#')) {
            return match;
          }

          let fixedUrl = url;

          // Apply all mappings to this URL
          for (const [oldPath, newPath] of Object.entries(allMappings)) {
            if (oldPath === newPath) continue;

            const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(^|/)${escapedOldPath}(/|#|$)`, 'g');
            const beforeFix = fixedUrl;
            fixedUrl = fixedUrl.replace(regex, `$1${newPath}$2`);

            if (fixedUrl !== beforeFix) {
              totalReplacementsFixed++;
              fileModified = true;
            }
          }

          return `<a ${before || ''}href="${fixedUrl}"${after || ''}>`;
        });

        // Write back if content changed
        if (fileModified && content !== originalContent) {
          fs.writeFileSync(fullPath, content);
          totalFilesProcessed++;
        }
      }
    }
  }

  processFiles(targetBase);
  console.log(`  Fixed ${totalReplacementsFixed} replacements across ${totalFilesProcessed} files`);
}

/**
 * Resolve sidebar position conflicts by sorting alphabetically and renumbering.
 * Ensures unique positions for navigation ordering.
 *
 * @function resolveSidebarPositionConflicts
 * @param {Array<Object>} files - Array of file objects with sidebarPosition
 * @returns {Array<Object>} Files with resolved positions
 *
 * @description
 * Handles duplicate sidebar positions by:
 * 1. Sorting by original position, then alphabetically
 * 2. Assigning sequential positions starting from 1
 * 3. Preserving relative ordering from Docusaurus
 *
 * @example
 * const resolved = resolveSidebarPositionConflicts([
 *   { path: 'b.md', sidebarPosition: 1 },
 *   { path: 'a.md', sidebarPosition: 1 }
 * ]);
 * // Returns: [{path: 'a.md', sidebarPosition: 1}, {path: 'b.md', sidebarPosition: 2}]
 */
function resolveSidebarPositionConflicts(files) {
  // First, sort by position then alphabetically by path
  files.sort((a, b) => {
    if (a.sidebarPosition !== b.sidebarPosition) {
      return a.sidebarPosition - b.sidebarPosition;
    }
    // Same position - sort alphabetically by relative path
    return a.relativePath.localeCompare(b.relativePath);
  });

  // Group by directory to handle conflicts within each directory separately
  const groupedFiles = {};

  for (const file of files) {
    const dirPath = file.relativePath.includes('/')
      ? file.relativePath.split('/').slice(0, -1).join('/')
      : '';

    if (!groupedFiles[dirPath]) {
      groupedFiles[dirPath] = [];
    }
    groupedFiles[dirPath].push(file);
  }

  // Resolve conflicts within each directory
  const resolvedFiles = [];

  for (const [dirPath, dirFiles] of Object.entries(groupedFiles)) {
    let currentPosition = 1;

    for (let i = 0; i < dirFiles.length; i++) {
      const file = dirFiles[i];
      const nextFile = dirFiles[i + 1];

      // Assign current position
      file.resolvedPosition = currentPosition;

      // If next file exists and has same original position, increment for conflict resolution
      if (nextFile && nextFile.sidebarPosition === file.sidebarPosition) {
        currentPosition++;
      } else {
        // Jump to next original position if no conflict, or continue incrementing
        currentPosition = nextFile ? Math.max(currentPosition + 1, nextFile.sidebarPosition) : currentPosition + 1;
      }
    }

    resolvedFiles.push(...dirFiles);
  }

  // Final sort by resolved positions
  return resolvedFiles.sort((a, b) => {
    const aDirDepth = (a.relativePath.match(/\//g) || []).length;
    const bDirDepth = (b.relativePath.match(/\//g) || []).length;

    if (aDirDepth !== bDirDepth) {
      return aDirDepth - bDirDepth; // Root files first
    }

    return (a.resolvedPosition || a.sidebarPosition) - (b.resolvedPosition || b.sidebarPosition);
  });
}

/**
 * Get appropriate icon for product documentation.
 * Maps product names to Mintlify icon identifiers.
 *
 * @function getProductIcon
 * @param {string} product - Product name (sdk, ibc, evm, cometbft)
 * @returns {string} Icon identifier for Mintlify
 *
 * @description
 * Returns product-specific icons for navigation:
 * - sdk: 'gear' (configuration/tools)
 * - ibc: 'arrows-rotate' (interconnection)
 * - evm: 'ethereum' (EVM compatibility)
 * - cometbft: 'cube' (consensus)
 * - default: 'book-open' (documentation)
 *
 * @example
 * const icon = getProductIcon('sdk');
 * // Returns: 'gear'
 */
function getProductIcon(product) {
  const iconMap = {
    'sdk': 'gear',
    'ibc': 'link',
    'cometbft': 'star',
    'evm': 'code',
    'wasmd': 'cube',
    'hermes': 'rocket'
  };
  return iconMap[product.toLowerCase()] || 'book';
}

/**
 * Update docs.json and versions.json with complete navigation structure.
 * Integrates migrated documentation into Mintlify's navigation system.
 *
 * @async
 * @function updateDocsJson
 * @param {Object} allVersionData - Migrated version data with file metadata
 * @param {string} [product='generic'] - Product name for navigation grouping
 * @returns {Promise<void>}
 *
 * @description
 * Updates two configuration files:
 *
 * docs.json updates:
 * - Creates/updates product dropdown in navigation
 * - Adds version tabs with grouped pages
 * - Organizes files by directory structure
 * - Respects sidebar positions from Docusaurus
 *
 * versions.json updates:
 * - Adds all migrated versions for the product
 * - Sets appropriate default version
 * - Maintains version ordering
 *
 * Navigation structure:
 * - Groups files by directory (Learn, User, etc.)
 * - Creates nested navigation based on file paths
 * - Preserves Docusaurus sidebar_position ordering
 *
 * @example
 * await updateDocsJson({
 *   'v0.50': [{ relativePath: 'learn/intro.mdx', title: 'Intro' }]
 * }, 'sdk');
 * // Updates docs.json with SDK v0.50 navigation
 */
async function updateDocsJson(allVersionData, product = 'generic') {
  const docsJsonPath = path.join(__dirname, '../docs.json');
  let docsJson;

  try {
    docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf-8'));
  } catch (error) {
    console.error('Could not read docs.json:', error);
    return;
  }

  // Ensure navigation structure exists
  if (!docsJson.navigation) {
    docsJson.navigation = { dropdowns: [] };
  }
  if (!docsJson.navigation.dropdowns) {
    docsJson.navigation.dropdowns = [];
  }

  // Generate product name for dropdown
  const productName = product.toUpperCase();

  // Find or create product dropdown
  let productDropdown = docsJson.navigation.dropdowns.find(dropdown =>
    dropdown.dropdown === productName ||
    dropdown.dropdown === product ||
    dropdown.dropdown.toLowerCase() === product.toLowerCase()
  );

  if (!productDropdown) {
    productDropdown = {
      dropdown: productName,
      icon: getProductIcon(product),
      versions: []
    };
    docsJson.navigation.dropdowns.push(productDropdown);
  }

  // Clear existing versions
  productDropdown.versions = [];

  // Sort versions properly: highest first, 'next' at bottom
  const sortedVersionEntries = Object.entries(allVersionData).sort(([a], [b]) => {
    if (a === 'next') return 1;  // 'next' goes to bottom
    if (b === 'next') return -1;

    // Use semver comparison for version numbers
    const parseVersion = (v) => {
      const cleaned = v.replace(/^v/, ''); // Remove leading 'v'
      const parts = cleaned.split('.');
      return parts.map(p => parseInt(p) || 0);
    };

    const aParts = parseVersion(a);
    const bParts = parseVersion(b);

    // Compare major, minor, patch (descending order)
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return bVal - aVal;
    }
    return 0;
  });

  // Add version sections following the same structure as EVM
  for (const [version, files] of sortedVersionEntries) {
    const versionData = {
      version: version,
      tabs: [
        {
          tab: 'Documentation',
          groups: [
            {
              group: productName,
              pages: []
            }
          ]
        }
      ]
    };

    // Sort files by sidebar position with conflict resolution
    const sortedFiles = resolveSidebarPositionConflicts(files);

    // Group files by directory structure for better organization
    const groupedPages = {};

    for (const file of sortedFiles) {
      // Remove numbered prefixes from the path for navigation
      const cleanRelativePath = file.relativePath
        .replace(/\/(\d+-)/g, '/')  // Remove numbered prefixes from directories
        .replace(/^(\d+-)/, '')      // Remove numbered prefix from root files
        .replace('.mdx', '');

      const relativePath = cleanRelativePath;
      const parts = relativePath.split('/');

      if (parts.length === 1) {
        // Root level files
        versionData.tabs[0].groups[0].pages.push(`${product}/${version}/${relativePath}`);
      } else {
        // Group by first directory
        const groupName = parts[0].replace(/^\d+-/, '').replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        if (!groupedPages[groupName]) {
          groupedPages[groupName] = [];
        }
        groupedPages[groupName].push(`${product}/${version}/${relativePath}`);
      }
    }

    // Add grouped pages
    for (const [groupName, pages] of Object.entries(groupedPages)) {
      versionData.tabs[0].groups.push({
        group: groupName,
        pages: pages
      });
    }

    productDropdown.versions.push(versionData);
  }

  // Update versions.json as well
  const versionsJsonPath = path.join(__dirname, '../versions.json');
  let versionsJson;

  try {
    versionsJson = JSON.parse(fs.readFileSync(versionsJsonPath, 'utf-8'));
  } catch (error) {
    versionsJson = { products: {} };
  }

  // Add product configuration with proper version ordering
  // Sort versions: highest version first, 'next' at the bottom
  const versionKeys = Object.keys(allVersionData);
  const sortedVersions = versionKeys.sort((a, b) => {
    if (a === 'next') return 1;  // 'next' goes to bottom
    if (b === 'next') return -1;

    // Use semver comparison for version numbers
    const parseVersion = (v) => {
      const cleaned = v.replace(/^v/, ''); // Remove leading 'v'
      const parts = cleaned.split('.');
      return parts.map(p => parseInt(p) || 0);
    };

    const aParts = parseVersion(a);
    const bParts = parseVersion(b);

    // Compare major, minor, patch (descending order)
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return bVal - aVal;
    }
    return 0;
  });

  versionsJson.products[product] = {
    versions: sortedVersions,
    defaultVersion: sortedVersions[0] === 'next' ? sortedVersions[1] || 'next' : sortedVersions[0]
  };

  // Write updated files
  fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2));
  fs.writeFileSync(versionsJsonPath, JSON.stringify(versionsJson, null, 2));

  console.log(' Updated docs.json and versions.json');
}

/**
 * Write navigation snippet to file for staging mode
 */
async function writeNavigationSnippet(allVersionData, product = 'generic') {
  const productName = product.toUpperCase();

  // Build navigation structure (same logic as updateDocsJson)
  const productDropdown = {
    dropdown: productName,
    icon: getProductIcon(product),
    versions: []
  };

  for (const [version, files] of Object.entries(allVersionData)) {
    const versionData = {
      version: version,
      tabs: [
        {
          tab: 'Documentation',
          groups: [
            {
              group: productName,
              pages: []
            }
          ]
        }
      ]
    };

    // Sort files by sidebar position
    const sortedFiles = resolveSidebarPositionConflicts(files);

    // Group files by directory structure
    const groupedPages = {};

    for (const file of sortedFiles) {
      const cleanRelativePath = file.relativePath
        .replace(/\/(\d+-)/g, '/')
        .replace(/^(\d+-)/, '')
        .replace('.mdx', '');

      const relativePath = cleanRelativePath;
      const parts = relativePath.split('/');

      if (parts.length === 1) {
        versionData.tabs[0].groups[0].pages.push(`${product}/${version}/${relativePath}`);
      } else {
        const groupName = parts[0].replace(/^\d+-/, '').replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        if (!groupedPages[groupName]) {
          groupedPages[groupName] = [];
        }
        groupedPages[groupName].push(`${product}/${version}/${relativePath}`);
      }
    }

    for (const [groupName, pages] of Object.entries(groupedPages)) {
      versionData.tabs[0].groups.push({
        group: groupName,
        pages: pages
      });
    }

    productDropdown.versions.push(versionData);
  }

  // Write to tmp directory
  const tmpDir = './tmp/migration-staging';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const snippetPath = path.join(tmpDir, 'navigation-snippet.json');
  fs.writeFileSync(snippetPath, JSON.stringify(productDropdown, null, 2));

  console.log(`\n Navigation snippet written to: ${snippetPath}`);
  console.log(` Add this to docs.json under navigation.dropdowns`);
}

/**
 * Migrate all versions from a Docusaurus repository to Mintlify format.
 * Processes both current (docs/) and versioned (versioned_docs/) directories from source repository.
 *
 * @async
 * @function migrateAllVersions
 * @param {string} repositoryPath - Path to Docusaurus repository
 * @param {string} targetDirectory - Base output directory for migrated files
 * @param {string} [product='generic'] - Product name for link resolution (REQUIRED)
 * @param {Object} [options={}] - Migration options
 * @param {boolean} [options.updateNav=false] - Whether to update docs.json navigation
 * @returns {Promise<Object>} Migration results with file counts and statistics
 *
 * @description
 * Complete migration workflow:
 * 1. Discover all version directories (docs/ and versioned_docs/) in source repository
 * 2. Map Docusaurus versions to Mintlify format (docs becomes next)
 * 3. Process each version with content caching
 * 4. Display migration statistics and cache performance
 * 5. Generate error report for manual fixes
 * 6. Optionally update navigation in docs.json
 *
 * Version mapping (outputs to root-level product directories):
 * - docs/ becomes <product>/next/ (current development)
 * - versioned_docs/version-X.Y becomes <product>/vX.Y/
 *
 * @example
 * const results = await migrateAllVersions(
 *   '~/repos/cosmos-sdk-docs',
 *   './tmp',
 *   'sdk',
 *   { updateNav: true }
 * );
 * // Migrates all versions and updates navigation
 */
async function migrateAllVersions(repositoryPath, targetDirectory, product = 'generic', options = {}) {
  const { updateNavigation = false, dryRun = false } = options;

  if (!targetDirectory) {
    throw new Error('Target directory is required');
  }

  console.log(`=== Migrating All Versions ===\n`);

  // Reset migration issues tracker and cache for the entire migration
  migrationIssues.reset();
  migrationCache.clear();

  // Collect all filename mappings across versions for link fixing
  const allFilenameMappings = {};

  // Expand ~ to home directory if present
  if (repositoryPath.startsWith('~/')) {
    repositoryPath = repositoryPath.replace('~', process.env.HOME);
  }
  if (targetDirectory.startsWith('~/')) {
    targetDirectory = targetDirectory.replace('~', process.env.HOME);
  }

  const sourceBase = path.join(repositoryPath, 'versioned_docs');
  const currentDocsPath = path.join(repositoryPath, 'docs');
  const staticPath = path.join(repositoryPath, 'static');
  const targetBase = targetDirectory;


  const allVersionData = {};

  // Copy static assets first (if they exist)
  if (fs.existsSync(staticPath)) {
    // Images directory goes to ./assets/<product>/images
    const assetsDir = path.join(path.dirname(targetBase), 'assets', product, 'images');
    console.log(`\n--- Copying static assets to ${assetsDir} ---`);

    // Copy all image files from static folder
    copyStaticAssets(staticPath, assetsDir);
  }

  // 1. Process versioned docs
  if (fs.existsSync(sourceBase)) {
    const versions = fs.readdirSync(sourceBase)
      .filter(d => d.startsWith('version-'))
      .map(d => d.replace('version-', ''));

    console.log(`Found versions: ${versions.join(', ')}`);

    for (const version of versions) {
      // Format version with 'v' prefix for GitHub release format (e.g., v0.47, v0.50)
      const formattedVersion = version.startsWith('v') ? version : `v${version}`;
      console.log(`\n--- Processing ${version} -> ${formattedVersion} ---`);
      const sourceDir = path.join(sourceBase, `version-${version}`);
      const targetDir = path.join(targetBase, formattedVersion);

      const result = await processDirectory(sourceDir, targetDir, formattedVersion, product, dryRun);
      allVersionData[formattedVersion] = result.converted;

      // Merge filename mappings
      Object.assign(allFilenameMappings, result.filenameMapping);

      console.log(` Converted ${result.converted.length} files for ${formattedVersion}`);
    }
  }

  // 2. Process current docs as 'next' version
  if (fs.existsSync(currentDocsPath)) {
    console.log(`\n--- Processing current docs as 'next' ---`);
    const targetDir = path.join(targetBase, 'next');

    const result = await processDirectory(currentDocsPath, targetDir, 'next', product, dryRun);
    allVersionData['next'] = result.converted;

    // Merge filename mappings
    Object.assign(allFilenameMappings, result.filenameMapping);

    console.log(` Converted ${result.converted.length} files for 'next'`);
  }

  // 3. Fix numbered prefix links using the filename mappings
  if (Object.keys(allFilenameMappings).length > 0) {
    console.log(`\n--- Collected ${Object.keys(allFilenameMappings).length} filename mappings ---`);
    // Show a sample of the mappings for debugging
    const sampleMappings = Object.entries(allFilenameMappings).slice(0, 5);
    console.log('Sample mappings:');
    sampleMappings.forEach(([old, newPath]) => {
      console.log(`  "${old}" -> "${newPath}"`);
    });
    fixNumberedPrefixLinks(targetBase, allFilenameMappings);
  }

  // 4. Update navigation (only if explicitly requested and not dry run)
  if (updateNavigation && !dryRun) {
    console.log(`\n--- Updating navigation files ---`);
    await updateDocsJson(allVersionData, product);
  } else if (dryRun) {
    console.log(`\n--- Skipping navigation update (dry run mode) ---`);
  } else {
    console.log(`\n--- Skipping navigation update (disabled) ---`);
  }

  if (dryRun) {
    console.log(`\n DRY RUN COMPLETE - No files were written`);
    console.log(` Review the migration report below for any errors or warnings`);
    console.log(` Run without --dry-run to perform the actual migration`);
  } else {
    console.log(`\n Migration complete!`);
    console.log(` Files created in: ${targetBase}`);
    if (updateNavigation) {
      console.log(` Navigation updated in docs.json and versions.json`);
    }
  }

  // Generate and display the final migration report
  const report = migrationIssues.generateReport();
  if (report) {
    console.log(report);
  } else {
    console.log('\n No issues detected during migration!\n');
  }

  // Show cache statistics
  const cacheStats = migrationCache.getStats();
  console.log('\n Migration Cache Statistics:');
  console.log('='.repeat(50));
  console.log(`Total files processed: ${cacheStats.totalFiles}`);
  console.log(`Unique content blocks: ${cacheStats.uniqueContent}`);
  console.log(`Duplicate files (cache hits): ${cacheStats.duplicates}`);
  if (cacheStats.totalFiles > 0) {
    const duplicatePercentage = ((cacheStats.duplicates / cacheStats.totalFiles) * 100).toFixed(1);
    console.log(`Duplicate percentage: ${duplicatePercentage}%`);
  }
  console.log('='.repeat(50));

  return allVersionData;
}

/**
 * Main entry point for the migration script.
 * Handles both interactive and non-interactive modes.
 *
 * @async
 * @function main
 * @returns {Promise<void>}
 *
 * @description
 * Execution modes:
 *
 * Interactive mode (no arguments):
 * - Prompts for repository path
 * - Prompts for output directory
 * - Prompts for product selection (REQUIRED)
 * - Asks about navigation update
 * - Shows progress and statistics
 *
 * Non-interactive mode (with arguments):
 * - Args: <source> <target> <product> [--update-nav]
 * - No prompts, uses provided arguments
 * - Product parameter is REQUIRED
 * - Suitable for CI/CD pipelines
 *
 * Workflow:
 * 1. Parse command-line arguments or show prompts
 * 2. Validate product parameter
 * 3. Call migrateAllVersions with options
 * 4. Display final statistics and errors
 * 5. Exit with appropriate code
 *
 * @example
 * // Interactive:
 * node migrate-docusaurus.js
 *
 * // Non-interactive:
 * node migrate-docusaurus.js ~/cosmos-sdk-docs ./tmp sdk --update-nav
 */
async function main() {
  console.log('=== Docusaurus to Mintlify Converter ===\n');

  // Check for command line arguments for non-interactive mode
  const args = process.argv.slice(2);
  if (args.length >= 3) {
    const [repoPath, targetDirectory, product, ...restArgs] = args;
    let updateNavigation = false;

    // Product is required
    if (!product || product.startsWith('--')) {
      console.error('Error: Product name is required');
      console.error('Usage: node migrate-docusaurus.js <source-repo> <target-dir> <product> [options]');
      console.error('\nOptions:');
      console.error('  --update-nav     Update docs.json with navigation');
      console.error('  --dry-run        Process files but don\'t write anything');
      console.error('  --staging        Write to ./tmp/migration-staging instead of target');
      console.error('  --version <ver>  Migrate single version (e.g., --version v25)');
      console.error('\nExamples:');
      console.error('  All versions: node migrate-docusaurus.js ~/repos/gaia ./hub hub --dry-run');
      console.error('  Single version: node migrate-docusaurus.js ../gaia/docs/docs ./hub hub --version v25 --dry-run');
      console.error('\nValid products: sdk, ibc, evm, hub, cometbft, or your custom product name');
      process.exit(1);
    }

    // Parse additional arguments
    let dryRun = false;
    let useStaging = false;
    let singleVersion = null;
    for (let i = 0; i < restArgs.length; i++) {
      if (restArgs[i] === '--update-nav') {
        updateNavigation = true;
      } else if (restArgs[i] === '--dry-run') {
        dryRun = true;
      } else if (restArgs[i] === '--staging') {
        useStaging = true;
      } else if (restArgs[i] === '--version' && i + 1 < restArgs.length) {
        singleVersion = restArgs[i + 1];
        i++; // Skip next arg since we consumed it
      }
    }

    console.log('Running in non-interactive mode...');
    console.log(`Repository: ${repoPath}`);
    console.log(`Target directory: ${targetDirectory}`);
    console.log(`Product: ${product}`);
    console.log(`Update navigation: ${updateNavigation}`);
    console.log(`Dry run: ${dryRun}`);
    console.log(`Staging mode: ${useStaging}`);
    if (singleVersion) {
      console.log(`Single version mode: ${singleVersion}`);
    }

    // If staging mode, change target to temp directory
    let actualTargetDir = targetDirectory;
    if (useStaging) {
      console.log('\nStaging mode: Files will be written to ./tmp/migration-staging');
      console.log(`Paths will point to: /${product}/[version]/\n`);
      actualTargetDir = './tmp/migration-staging';
      // Note: Navigation can still be updated in staging mode if --update-nav is passed
    }

    // Handle single version or all versions
    if (singleVersion) {
      // Single version migration
      console.log(`\n=== Migrating Single Version: ${singleVersion} ===\n`);

      // Ensure version has 'v' prefix
      const finalVersion = singleVersion.startsWith('v') ? singleVersion : `v${singleVersion}`;

      // Build target path
      const versionTargetDir = path.join(actualTargetDir, finalVersion);

      if (!dryRun) {
        if (!fs.existsSync(versionTargetDir)) {
          fs.mkdirSync(versionTargetDir, { recursive: true });
        }
      }

      // Process the directory
      const { converted: convertedFiles } = await processDirectory(repoPath, versionTargetDir, finalVersion, product, dryRun);

      console.log(`\n Processed ${convertedFiles.length} files for version ${finalVersion}`);

      // Copy images if not dry run
      if (!dryRun) {
        const staticPath = path.join(path.dirname(repoPath), 'static');
        if (fs.existsSync(staticPath)) {
          const assetsDir = path.join(path.dirname(actualTargetDir), 'assets', product, 'images');
          console.log(`\nCopying images from ${staticPath} to ${assetsDir}...`);
          copyStaticAssets(staticPath, assetsDir);
        }
      }

      // Update navigation if requested and not in dry-run
      if (updateNavigation && !dryRun) {
        console.log('\nUpdating navigation...');
        const versionData = {
          [finalVersion]: convertedFiles
        };

        if (useStaging) {
          // In staging mode, write navigation snippet to file instead of updating docs.json
          await writeNavigationSnippet(versionData, product);
        } else {
          // In normal mode, update docs.json directly
          await updateDocsJson(versionData, product);
        }
      }
    } else {
      // All versions migration
      await migrateAllVersions(repoPath, actualTargetDir, product, { updateNavigation, dryRun });
    }

    if (useStaging) {
      console.log(`\n Files are in: ./tmp/migration-staging`);
      console.log(` Review and copy to: ./${product}/`);
    }

    return;
  } else if (args.length > 0 && args.length < 3) {
    console.error('Error: Not enough arguments');
    console.error('Usage: node migrate-docusaurus.js <source-repo> <target-dir> <product> [options]');
    console.error('\nOptions:');
    console.error('  --update-nav     Update docs.json with navigation');
    console.error('  --dry-run        Process files but don\'t write anything');
    console.error('  --staging        Write to ./tmp/migration-staging instead of target');
    console.error('  --version <ver>  Migrate single version (e.g., --version v25)');
    console.error('\nExamples:');
    console.error('  All versions: node migrate-docusaurus.js ~/repos/gaia ./hub hub --dry-run');
    console.error('  Single version: node migrate-docusaurus.js ../gaia/docs/docs ./hub hub --version v25 --dry-run');
    process.exit(1);
  }

  console.log('Migration options:');
  console.log('1. Migrate single version (from any docs directory)');
  console.log('2. Migrate all versions from repository (docs/ + versioned_docs/)');
  console.log('Enter choice (1 or 2):');

  const choice = await prompt('> ');

  if (choice.trim() === '2') {
    console.log('\nEnter repository path:');
    const repoPath = await prompt('> ');

    console.log('\nEnter target directory:');
    let targetDirectory = (await prompt('> ')).trim();
    if (!targetDirectory) {
      console.error('Error: Target directory is required');
      process.exit(1);
    }

    // Get product name (required)
    console.log('\nEnter product name (e.g., sdk, ibc, evm, cometbft):');
    let product = (await prompt('> ')).trim();

    while (!product) {
      console.log('Product name is required for proper link resolution.');
      console.log('Enter product name (e.g., sdk, ibc, evm, cometbft):');
      product = (await prompt('> ')).trim();
    }

    // Ask about dry-run mode
    console.log('\nDry run mode? (process files but don\'t write anything) (y/n):');
    const dryRun = (await prompt('> ')).trim().toLowerCase() === 'y';

    let actualTargetDir = targetDirectory;
    let useStaging = false;

    if (!dryRun) {
      // Ask about staging mode (only if not dry run)
      console.log('\nUse staging mode? (outputs to ./tmp but generates final paths) (y/n):');
      useStaging = (await prompt('> ')).trim().toLowerCase() === 'y';

      if (useStaging) {
        console.log('\nStaging mode enabled!');
        console.log('Files will be written to: ./tmp/migration-staging');
        console.log(`But paths will point to: /${product}/[version]/`);
        console.log('\nYou can then manually copy files from ./tmp/migration-staging to your final location.\n');
        actualTargetDir = './tmp/migration-staging';
      }
    }

    let updateNav = false;
    if (!dryRun && !useStaging) {
      console.log('\nUpdate navigation files? (y/n):');
      updateNav = (await prompt('> ')).trim().toLowerCase() === 'y';
    }

    await migrateAllVersions(repoPath.trim(), actualTargetDir, product, { updateNavigation: updateNav, dryRun });

    if (dryRun) {
      console.log(`\n To perform the actual migration, run again without dry-run mode`);
    } else if (useStaging) {
      console.log(`\n All versions are in: ${actualTargetDir}`);
      console.log(` Copy the sections you want to: ./${product}/`);
    }

    rl.close();
    return;
  }

  // Single-version flow (option 1)
  console.log('\nEnter source docs directory (e.g., ../gaia/docs/docs or ./versioned_docs/version-0.50):');
  const sourceDir = (await prompt('> ')).trim();

  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  console.log('\nEnter version to import as (e.g., v25 or 0.50):');
  let versionInput = (await prompt('> ')).trim();

  // Add 'v' prefix if not present and not already formatted
  let finalVersion = versionInput.startsWith('v') ? versionInput : `v${versionInput}`;

  console.log('\nEnter target directory (e.g., ./hub):');
  const targetBase = (await prompt('> ')).trim();

  console.log('\nEnter product name (e.g., hub, sdk, ibc):');
  let productName = (await prompt('> ')).trim();

  while (!productName) {
    console.log('Product name is required for proper link resolution.');
    console.log('Enter product name:');
    productName = (await prompt('> ')).trim();
  }

  // Ask about dry-run mode
  console.log('\nDry run mode? (process files but don\'t write anything) (y/n):');
  const dryRun = (await prompt('> ')).trim().toLowerCase() === 'y';

  let actualTargetDir = path.join(targetBase, finalVersion);
  let useStaging = false;

  if (!dryRun) {
    // Ask about staging mode (only if not dry run)
    console.log('\nUse staging mode? (outputs to ./tmp but generates final paths) (y/n):');
    useStaging = (await prompt('> ')).trim().toLowerCase() === 'y';

    if (useStaging) {
      console.log('\nStaging mode enabled!');
      console.log('Files will be written to: ./tmp/migration-staging');
      console.log(`But paths will point to: /${productName}/${finalVersion}/`);
      console.log('\nYou can then manually copy files from ./tmp/migration-staging to your final location.\n');

      actualTargetDir = './tmp/migration-staging';
    }
  }

  let updateNav = false;
  if (!dryRun && !useStaging) {
    // Ask about navigation update (only if not dry run or staging)
    console.log('\nUpdate navigation files (docs.json and versions.json)? (y/n):');
    updateNav = (await prompt('> ')).trim().toLowerCase() === 'y';
  }

  // Show summary and confirm
  console.log('\n=== Conversion Summary ===');
  console.log(`Source: ${sourceDir}`);
  console.log(`Target: ${actualTargetDir}`);
  console.log(`Version: ${finalVersion}`);
  console.log(`Product: ${productName}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('\nProceed? (y/n)');

  const confirm = await prompt('> ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Migration cancelled');
    rl.close();
    process.exit(0);
  }

  // Process files
  console.log('\nProcessing files...\n');

  // Reset migration issues tracker for single version migration
  migrationIssues.reset();

  const convertedFiles = await processDirectory(sourceDir, actualTargetDir, finalVersion, productName, dryRun);

  console.log(`\n Successfully converted ${convertedFiles.converted.length} files`);

  if (dryRun) {
    console.log('\n DRY RUN COMPLETE - No files were written');
    console.log(' Review the migration report above for any errors or warnings');
    console.log(' Run without --dry-run to perform the actual migration');
  } else if (useStaging) {
    console.log(`\n Files are in: ${actualTargetDir}`);
    console.log(` Copy to final location: ./${productName}/${finalVersion}/`);
  }

  // Create single-version data structure for navigation update
  const singleVersionData = {};
  singleVersionData[finalVersion] = convertedFiles.converted;

  // Optionally update navigation (skip if staging or dry run mode)
  if (updateNav && !useStaging && !dryRun) {
    await updateDocsJson(singleVersionData, productName);
  } else if (dryRun) {
    console.log('\n--- Skipping navigation update (dry run mode) ---');
  } else if (useStaging) {
    console.log('\n--- Skipping navigation update (staging mode) ---');
  } else {
    console.log('\n--- Skipping navigation update ---');
  }

  // Generate and display migration report
  const report = migrationIssues.generateReport();
  if (report) {
    console.log(report);
  } else {
    console.log('\n No issues detected during migration!\n');
  }

  rl.close();
}

// Export functions for use in other modules
export {
  convertDocusaurusToMintlify,
  processDirectory,
  convertAdmonitions,
  parseDocusaurusFrontmatter,
  fixMDXIssues,
  migrateAllVersions,
  updateDocsJson,
  resolveSidebarPositionConflicts,
  formatGoCode,
  formatJavaScriptCode,
  formatRustCode,
  formatJsonCode,
  updateImagePaths,
  copyStaticAssets,
  migrationIssues
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}