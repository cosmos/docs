#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question) => new Promise((resolve) => rl.question(question, resolve));

/**
 * Safely process content while preserving code blocks and inline code
 */
function safeProcessContent(content, processor) {
  // Extract all code blocks and inline code
  const codeBlocks = [];
  const inlineCode = [];

  let processed = content;

  // Replace code blocks with placeholders
  processed = processed.replace(/```[\s\S]*?```/g, (match) => {
    const index = codeBlocks.length;
    codeBlocks.push(match);
    return `__CODE_BLOCK_${index}__`;
  });

  // Replace inline code with placeholders
  processed = processed.replace(/`[^`\n]+`/g, (match) => {
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
 * Parse Docusaurus frontmatter using battle-tested gray-matter library
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
      content: content.replace(/^#\s+.+\n?/m, '').trim() // Only remove the heading line, not random content
    };
  }
  return { title: null, content };
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
    'details': 'Accordion' // For expandable sections
  };

  // Use line-by-line processing to handle complex nested cases
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
}

/**
 * Convert code blocks to Mintlify format with expandable for long blocks
 */
function convertCodeBlocks(content) {
  const lines = content.split('\n');
  const result = [];
  let inCodeBlock = false;
  let codeBlockStart = 0;
  let codeBlockLines = [];
  let codeBlockHeader = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockStart = i;
        codeBlockHeader = line;
        codeBlockLines = [];
      } else {
        // Ending a code block - decide if we need to add expandable
        const blockLength = codeBlockLines.length;

        if (blockLength > 10) {
          // Check if expandable is already present
          if (!codeBlockHeader.includes('expandable')) {
            // Add expandable parameter
            const parts = codeBlockHeader.split(' ');
            const language = parts[0].substring(3); // Remove ```
            const otherParams = parts.slice(1).filter(p => p.trim()).join(' ');

            if (language && language.trim()) {
              codeBlockHeader = otherParams
                ? `\`\`\`${language} ${otherParams} expandable`
                : `\`\`\`${language} expandable`;
            } else {
              codeBlockHeader = otherParams
                ? `\`\`\` ${otherParams} expandable`
                : `\`\`\` expandable`;
            }
          }
        }

        // Add the modified header
        result.push(codeBlockHeader);
        // Add all code lines
        result.push(...codeBlockLines);
        // Add closing
        result.push(line);

        inCodeBlock = false;
      }
    } else if (inCodeBlock) {
      codeBlockLines.push(line);
    } else {
      // Regular line outside code block
      result.push(line);
    }
  }

  // Ensure we don't have unclosed code blocks at the end
  if (inCodeBlock) {
    // Add any remaining code content and close the block
    if (codeBlockLines.length > 10 && !codeBlockHeader.includes('expandable')) {
      const parts = codeBlockHeader.split(' ');
      const language = parts[0].substring(3);
      codeBlockHeader = language ? `\`\`\`${language} expandable` : `\`\`\` expandable`;
    }
    result.push(codeBlockHeader);
    result.push(...codeBlockLines);
    result.push('```');
  }

  // Apply code formatting to Go and other language blocks
  const formattedResult = result.map(line => {
    if (line.match(/^```(go|golang)/)) {
      // Starting a Go code block - mark for formatting
      return line;
    }
    return line;
  });

  let finalResult = formattedResult.join('\n');

  // Format code blocks for all languages
  finalResult = formatCodeBlocks(finalResult);

  return finalResult;
}

/**
 * Basic code formatting for multiple languages
 */
function formatCodeBlocks(content) {
  return content.replace(/```(\w+)([^\n]*)\n([\s\S]*?)\n```/g, (match, lang, params, code) => {
    let formatted = code;

    // Apply language-specific formatting
    switch (lang.toLowerCase()) {
      case 'go':
      case 'golang':
        formatted = formatGoCode(code);
        break;
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
        formatted = formatJavaScriptCode(code);
        break;
      case 'rust':
      case 'rs':
        formatted = formatRustCode(code);
        break;
      case 'json':
      case 'jsonc':
        formatted = formatJsonCode(code);
        break;
      default:
        // Generic formatting for other languages
        formatted = formatGenericCode(code);
    }

    return '```' + lang + params + '\n' + formatted + '\n```';
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
 * Generic code formatting for other languages
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
 * Fix internal documentation links
 */
function fixInternalLinks(content, version, product = 'generic') {
  let result = content;

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
 * Fix common MDX parsing issues while preserving all code content
 */
function fixMDXIssues(content) {
  return safeProcessContent(content, (nonCodeContent) => {
    // Convert HTML comments to JSX comments, handling incomplete ones
    nonCodeContent = nonCodeContent.replace(/<!--\s*(.*?)\s*-->/gs, '{/* $1 */}');
    // Handle incomplete HTML comments that never close
    nonCodeContent = nonCodeContent.replace(/<!--([^]*?)(?!-->)(?=\n|$)/g, '{/* $1 */}');

    // Convert URLs in angle brackets to proper markdown links
    nonCodeContent = nonCodeContent.replace(/<(https?:\/\/[^>]+)>/g, '[Link]($1)');

    // Fix arrow operators that break parsing
    nonCodeContent = nonCodeContent.replace(/([^`])<->([^`])/g, '$1`<->`$2');

    // Remove stray closing tags
    nonCodeContent = nonCodeContent.replace(/^\s*<\/[A-Z][a-zA-Z]*>\s*$/gm, '');

    // Close unclosed details tags (add at end if missing)
    if (nonCodeContent.includes('<details>') && !nonCodeContent.includes('</details>')) {
      nonCodeContent += '\n</details>';
    }

    // Fix unclosed placeholder tags - these are template placeholders, not commands
    nonCodeContent = nonCodeContent.replace(/<(appd|simd|gaiad|osmosisd|junod)>\s*([^<\n]*?)(?=\n|$)/g, '&lt;$1&gt; $2');
    nonCodeContent = nonCodeContent.replace(/<(appd|simd|gaiad|osmosisd|junod)>\s+([^<>]+?)(?=\s|<|$)/g, '&lt;$1&gt; $2');

    // Convert all braces to proper inline code spans (complete units)
    nonCodeContent = nonCodeContent
      // 1. Complete API paths: /path{vars} → `complete path`
      .replace(/(\/[a-zA-Z][a-zA-Z0-9/._-]*\{[^}]+\})/g, '`$1`')

      // 2. Complete event expressions: key.action={value} → `complete expression`
      .replace(/([a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z][a-zA-Z0-9_]*\{[^}]+\})/g, '`$1`')

      // 3. Complete type references: map[type]interface{} → `complete type`
      .replace(/(map\[[^\]]+\]interface\{\})/g, '`$1`')
      .replace(/(\binterface\{\})(?!\s*[\{\"'])/g, '`$1`')

      // 4. Complete JSON objects: {"key":"value"} → `complete object`
      .replace(/(\{\"[^}]+\"\})/g, '`$1`')

      // 5. Template variables with safe boundaries: {var} or {multi word} → `{var}`
      .replace(/(?<![a-zA-Z0-9_`.])\{([a-zA-Z][a-zA-Z0-9_|\\\\s]*)\}(?![a-zA-Z0-9_`.])/g, '`{$1}`')

      // 6. Clean up any remaining lone braces (safety)
      .replace(/^\s*\{\s*$/gm, '') // Remove lone { lines
      .replace(/^\s*\}\s*$/gm, ''); // Remove lone } lines

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

    return nonCodeContent;
  });
}

/**
 * Convert a single Docusaurus file to Mintlify format
 */
function convertDocusaurusToMintlify(content, options = {}) {
  const { version = 'next', product = 'generic', keepTitle = false } = options;

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
  processedContent = processedContent.replace(/<!--\s*(.*?)\s*-->/gs, '{/* $1 */}');

  // Handle malformed or incomplete HTML comments
  processedContent = processedContent.replace(/<!--([^>]*?)$/gm, '{/* $1 */}');
  processedContent = processedContent.replace(/<!--([^>]*?)(?!-->)/g, '{/* $1 */}');

  // Fix common MDX issues
  processedContent = fixMDXIssues(processedContent);

  processedContent = convertAdmonitions(processedContent);
  processedContent = convertCodeBlocks(processedContent);
  processedContent = fixInternalLinks(processedContent, version, product);

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
 * Process a directory of Docusaurus files
 */
async function processDirectory(sourceDir, targetDir, version, product = 'generic') {
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
    const result = convertDocusaurusToMintlify(content, { version, product });

    // Determine target path - remove numbered prefixes from filenames
    let cleanRelativePath = file.relative.replace(/\/(\d+-)/g, '/').replace(/^(\d+-)/, '');
    const targetPath = path.join(targetDir, cleanRelativePath.replace('.md', '.mdx'));
    const targetSubdir = path.dirname(targetPath);

    // Ensure target directory exists
    if (!fs.existsSync(targetSubdir)) {
      fs.mkdirSync(targetSubdir, { recursive: true });
    }

    // Write converted file
    fs.writeFileSync(targetPath, result.content);

    converted.push({
      path: targetPath,
      relativePath: cleanRelativePath.replace('.md', '.mdx'),
      sidebarPosition: result.metadata.sidebarPosition || 999,
      title: result.metadata.title,
      ...result.metadata
    });
  }

  return converted;
}


/**
 * Resolve sidebar position conflicts by sorting alphabetically and renumbering
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
 * Get appropriate icon for product
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
 * Update docs.json and versions.json with complete navigation
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

  // Add version sections following the same structure as EVM
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

    // Sort files by sidebar position with conflict resolution
    const sortedFiles = resolveSidebarPositionConflicts(files);

    // Group files by directory structure for better organization
    const groupedPages = {};

    for (const file of sortedFiles) {
      const relativePath = file.relativePath.replace('.mdx', '');
      const parts = relativePath.split('/');

      if (parts.length === 1) {
        // Root level files
        versionData.tabs[0].groups[0].pages.push(`docs/${product}/${version}/${relativePath}`);
      } else {
        // Group by first directory
        const groupName = parts[0].replace(/^\d+-/, '').replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        if (!groupedPages[groupName]) {
          groupedPages[groupName] = [];
        }
        groupedPages[groupName].push(`docs/${product}/${version}/${relativePath}`);
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

  // Add product configuration
  versionsJson.products[product] = {
    versions: Object.keys(allVersionData).sort((a, b) => {
      if (a === 'next') return -1;
      if (b === 'next') return 1;
      return b.localeCompare(a); // Reverse sort for versions
    }),
    defaultVersion: 'next'
  };

  // Write updated files
  fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2));
  fs.writeFileSync(versionsJsonPath, JSON.stringify(versionsJson, null, 2));

  console.log('✅ Updated docs.json and versions.json');
}

/**
 * Migrate all versions from a Docusaurus repository
 */
async function migrateAllVersions(repositoryPath, product = 'generic', options = {}) {
  const { skipNavigation = false } = options;
  console.log(`=== Migrating All Versions for ${product.toUpperCase()} ===\n`);

  // Expand ~ to home directory if present
  if (repositoryPath.startsWith('~/')) {
    repositoryPath = repositoryPath.replace('~', process.env.HOME);
  }

  const sourceBase = path.join(repositoryPath, 'versioned_docs');
  const currentDocsPath = path.join(repositoryPath, 'docs');
  const targetBase = path.join(__dirname, `../docs/${product}`);

  console.log(`Debug: Repository path: ${repositoryPath}`);
  console.log(`Debug: Source base: ${sourceBase}`);
  console.log(`Debug: Current docs: ${currentDocsPath}`);
  console.log(`Debug: Target base: ${targetBase}\n`);

  const allVersionData = {};

  // 1. Process versioned docs
  if (fs.existsSync(sourceBase)) {
    const versions = fs.readdirSync(sourceBase)
      .filter(d => d.startsWith('version-'))
      .map(d => d.replace('version-', ''));

    console.log(`Found versions: ${versions.join(', ')}`);

    for (const version of versions) {
      console.log(`\n--- Processing ${version} ---`);
      const sourceDir = path.join(sourceBase, `version-${version}`);
      const targetDir = path.join(targetBase, version);

      const files = await processDirectory(sourceDir, targetDir, version, product);
      allVersionData[version] = files;

      console.log(`✅ Converted ${files.length} files for ${version}`);
    }
  }

  // 2. Process current docs as 'next' version
  if (fs.existsSync(currentDocsPath)) {
    console.log(`\n--- Processing current docs as 'next' ---`);
    const targetDir = path.join(targetBase, 'next');

    const files = await processDirectory(currentDocsPath, targetDir, 'next', product);
    allVersionData['next'] = files;

    console.log(`✅ Converted ${files.length} files for 'next'`);
  }

  // 3. Update navigation (optional)
  if (!skipNavigation) {
    console.log(`\n--- Updating navigation files ---`);
    await updateDocsJson(allVersionData, product);
  } else {
    console.log(`\n--- Skipping navigation update (disabled) ---`);
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`📁 Files created in: ${targetBase}`);
  console.log(`📋 Navigation updated in docs.json and versions.json`);

  return allVersionData;
}

/**
 * Main interactive flow
 */
async function main() {
  console.log('=== Docusaurus to Mintlify Converter ===\n');

  console.log('Migration options:');
  console.log('1. Migrate single version (original behavior)');
  console.log('2. Migrate all versions from repository');
  console.log('Enter choice (1 or 2):');

  const choice = await prompt('> ');

  if (choice.trim() === '2') {
    console.log('\nEnter repository path:');
    const repoPath = await prompt('> ');

    console.log('\nEnter product name:');
    const product = (await prompt('> ')).trim();

    await migrateAllVersions(repoPath.trim(), product);
    rl.close();
    return;
  }

  // Original single-version flow
  console.log('Enter source directory:');
  let sourceBase = await prompt('> ');
  sourceBase = sourceBase.trim();

  // List available versions
  if (fs.existsSync(sourceBase)) {
    const versions = fs.readdirSync(sourceBase)
      .filter(d => d.startsWith('version-'))
      .map(d => d.replace('version-', ''));

    console.log(`\nAvailable versions: ${versions.join(', ')}`);
    console.log('Enter version to convert:');
    const versionInput = await prompt('> ');
    const sourceVersion = `version-${versionInput.trim()}`;
    const sourceDir = path.join(sourceBase, sourceVersion);

    if (!fs.existsSync(sourceDir)) {
      console.error(`Source directory not found: ${sourceDir}`);
      process.exit(1);
    }

    // Get target directory
    console.log('\nEnter target directory:');
    let targetDir = await prompt('> ');
    targetDir = targetDir.trim();

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

    // Get product name
    console.log('\nEnter product name:');
    const productName = (await prompt('> ')).trim() || 'generic';

    // Process files
    console.log('\nProcessing files...\n');
    const convertedFiles = await processDirectory(sourceDir, targetDir, `v${versionInput.trim()}`, productName);

    console.log(`\n✅ Successfully converted ${convertedFiles.length} files`);

    // Create single-version data structure for navigation update
    const singleVersionData = {};
    singleVersionData[`v${versionInput.trim()}`] = convertedFiles;

    // Optionally update navigation
    await updateDocsJson(singleVersionData, productName);

  } else {
    console.error(`Source directory not found: ${sourceBase}`);
    process.exit(1);
  }

  rl.close();
}

// Export functions for use in other modules
export {
  convertDocusaurusToMintlify,
  processDirectory,
  convertAdmonitions,
  convertCodeBlocks,
  parseDocusaurusFrontmatter,
  fixMDXIssues,
  migrateAllVersions,
  updateDocsJson,
  resolveSidebarPositionConflicts,
  formatCodeBlocks,
  formatGoCode,
  formatJavaScriptCode,
  formatRustCode,
  formatJsonCode
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}