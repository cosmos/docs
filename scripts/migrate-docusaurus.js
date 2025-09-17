#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
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
 * Safely process content while preserving code blocks and inline code
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
  for (let i = 0; i < inlineCode.length; i++) {
    processed = processed.replace(`__INLINE_CODE_${i}__`, inlineCode[i]);
  }

  // STEP 6: Restore code blocks last
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

  // Fix relative links (../ or ./) but NOT for images
  // Only remove ./ and ../ from links to markdown files, not images
  result = result.replace(/\]\(\.\.\//g, (match, offset, string) => {
    // Check if this is followed by an image extension
    const afterMatch = string.slice(offset + match.length);
    if (afterMatch.match(/^[^)]+\.(png|jpg|jpeg|gif|svg|webp)/i)) {
      return match; // Keep the ../ for images
    }
    return ']('; // Remove ../ for non-images
  });
  result = result.replace(/\]\(\.\//g, (match, offset, string) => {
    // Check if this is followed by an image extension
    const afterMatch = string.slice(offset + match.length);
    if (afterMatch.match(/^[^)]+\.(png|jpg|jpeg|gif|svg|webp)/i)) {
      return match; // Keep the ./ for images
    }
    return ']('; // Remove ./ for non-images
  });

  return result;
}

/**
 * Copy static assets (images) from source to target
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
 * Update image paths to use centralized images folder
 */
function updateImagePaths(content, sourceRelativePath, version) {
  let result = content;

  // Calculate the depth of the source file to determine relative path to images
  const sourceDepth = sourceRelativePath.split('/').length - 1;
  const pathToRoot = sourceDepth > 0 ? '../'.repeat(sourceDepth) : './';
  // Images are at the same level as version directories (e.g., docs/sdk/images/)
  const pathToImages = `${pathToRoot}../images/`;

  // Update local image references (./image.png or ../image.png)
  // Match both markdown images ![alt](path) and HTML img tags
  result = result.replace(/(!\[[^\]]*\]\()(\.\.\/|\.\/)([^)]+\.(png|jpg|jpeg|gif|svg|webp))/gi,
    (match, prefix, relative, imagePath) => {
      const imageName = path.basename(imagePath);
      const imageDir = path.dirname(imagePath);
      const sourceDir = path.dirname(sourceRelativePath);

      if (relative === './' && imageDir === '.') {
        // Image in same directory as markdown
        return `${prefix}${pathToImages}${sourceDir}/${imageName}`;
      } else if (relative === '../') {
        // Image in parent directory
        const parentSourceDir = path.dirname(sourceDir);
        return `${prefix}${pathToImages}${parentSourceDir}/${imagePath}`;
      } else {
        // Image in subdirectory
        return `${prefix}${pathToImages}${sourceDir}/${imagePath}`;
      }
    });

  // Update HTML img tags
  result = result.replace(/(<img[^>]+src=")(\.\.\/|\.\/)([^"]+\.(png|jpg|jpeg|gif|svg|webp))/gi,
    (match, prefix, relative, imagePath) => {
      const imageName = path.basename(imagePath);
      const imageDir = path.dirname(imagePath);

      if (imageDir === '.') {
        const sourceDir = path.dirname(sourceRelativePath);
        return `${prefix}${pathToImages}${sourceDir}/${imageName}`;
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

    // Fix arrow operators and comparison operators that break parsing
    // Don't wrap if it's already in backticks or part of HTML tag
    nonCodeContent = nonCodeContent.replace(/(?<!`)(<->)(?!`)/g, '`$1`');

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

    // Fix orphaned closing tags by adding opening tags
    // Look for closing tags without matching opening tags
    nonCodeContent = nonCodeContent.replace(/(\n\s*\n)(\s*<\/(Info|Warning|Note|Tip|Check|Accordion|details)>)/gm, (match, emptyLine, closingTag, tagName) => {
      // Check if there's a matching opening tag
      const openTag = new RegExp(`<${tagName}[^>]*>`, 'i');
      if (!openTag.test(nonCodeContent)) {
        // Add the opening tag before the closing tag
        return `\n\n<${tagName}>\n${closingTag}`;
      }
      return match; // Keep as-is if there's already an opening tag
    });

    // Convert any remaining <details> tags that weren't caught by AST processing
    nonCodeContent = nonCodeContent.replace(
      /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*([\s\S]*?)(?:<\/details>|$)/gi,
      (match, summary, content) => {
        return `<Expandable title="${summary.trim()}">\n${content.trim()}\n</Expandable>`;
      }
    );

    // Fix unclosed placeholder tags - convert to inline code
    nonCodeContent = nonCodeContent.replace(/<(appd|simd|gaiad|osmosisd|junod|yourapp)>/g, '`$1`');

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

      // 5. Template placeholders like {positive consequences}
      .replace(/\{(positive|negative|neutral)\s+consequences\}/g, '`{$1 consequences}`')
      .replace(/\{context\s+body\}/g, '`{context body}`')

      // 6. Complex paths in tables: /cosmos.group.v1.Msg/UpdateGroup{Admin|Metadata|Members}
      // Wrap the whole path including braces in single backticks
      .replace(/(\/[\w.]+\/\w+\{[^}]+\})/g, '`$1`')

      // 7. Array syntax in tables: []string{msg_urls}
      .replace(/(\[\]\w+)\{([^}]+)\}/g, '$1`{$2}`')

      // 8. Template variables: {authorityAddress}
      // NOTE: Table cells are handled in AST processing with proper inlineCode nodes
      .replace(/\{(\w+Address|\w+Id|msg_urls|groupId)\}/g, (match, content, offset, str) => {
        // Check if we're in a table row
        const lineStart = str.lastIndexOf('\n', offset) + 1;
        const lineEnd = str.indexOf('\n', offset);
        const line = str.substring(lineStart, lineEnd === -1 ? str.length : lineEnd);

        // More robust table detection - check for pipes in the line
        const isProbablyTableRow = /^\s*\|/.test(line) || (line.split('|').length >= 3);
        if (isProbablyTableRow) {
          return match; // Already handled in AST processing
        }

        // Check if already wrapped in backticks of any length
        const before = str.slice(0, offset).match(/`+$/);
        const after = str.slice(offset + match.length).match(/^`+/);
        if (before && after) {
          return match; // Already wrapped
        }

        return '`{$1}`'.replace('$1', content);
      })

      // 9. General template variables (but skip JSX comments and already wrapped)
      .replace(/\{([a-zA-Z][\w\s]*)\}/g, (match, content, offset, str) => {
        // Skip if it looks like JSX comment
        if (content.includes('/*') || content.includes('*/')) return match;

        // Check if we're in a table row
        const lineStart = str.lastIndexOf('\n', offset) + 1;
        const lineEnd = str.indexOf('\n', offset);
        const line = str.substring(lineStart, lineEnd === -1 ? str.length : lineEnd);

        // More robust table detection - check for pipes in the line
        const isProbablyTableRow = /^\s*\|/.test(line) || (line.split('|').length >= 3);
        if (isProbablyTableRow) {
          return match; // Tables handled in AST processing
        }

        // Check if already wrapped in backticks of any length
        const before = str.slice(0, offset).match(/`+$/);
        const after = str.slice(offset + match.length).match(/^`+/);
        if (before && after) {
          return match; // Already wrapped
        }

        // Otherwise wrap it
        return '`' + match + '`';
      })

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
 * AST processor for fixing links
 */
function createLinkFixerPlugin(version, product) {
  return () => {
    return (tree) => {
      visit(tree, 'link', (node) => {
        if (node.url) {
          // Fix relative links
          if (node.url.startsWith('../') || node.url.startsWith('./')) {
            node.url = node.url.replace(/\.\.\//, '/');
          }
          // Fix versioned links for SDK docs
          if (product === 'sdk' && node.url.includes('/docs/')) {
            node.url = node.url.replace('/docs/', `/docs/sdk/${version}/`);
          }
        }
      });
    };
  };
}

/**
 * AST processor for fixing HTML elements and problematic syntax
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
          // Handle complete details tags
          node.value = node.value.replace(
            /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*([\s\S]*?)<\/details>/gi,
            (match, summary, content) => {
              return `<Expandable title="${summary.trim()}">\n${content.trim()}\n</Expandable>`;
            });

          // Handle unclosed details tags (missing </details>)
          node.value = node.value.replace(
            /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*([\s\S]+?)$/gm,
            (match, summary, content) => {
              // Only convert if there's no closing tag
              if (!match.includes('</details>')) {
                return `<Expandable title="${summary.trim()}">\n${content.trim()}\n</Expandable>`;
              }
              return match;
            });
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

        // Fix generic placeholders like <host>, <port>
        node.value = node.value.replace(/<([a-z]+(?:-[a-z]+)*)>/g, '`<$1>`');
      });

      // Remove table cell processing - we handle template variables in fixMDXIssues instead
      // This avoids double-wrapping issues
    };
  };
}

/**
 * AST processor for enhancing code blocks
 */
function createCodeBlockEnhancerPlugin() {
  return () => {
    return (tree, file) => {
      visit(tree, 'code', (node) => {
        // Handle Docusaurus "reference" syntax
        // e.g., ```go reference
        //       https://github.com/...
        //       ```
        if (node.lang && node.lang.includes(' reference')) {
          const parts = node.lang.split(' ');
          const lang = parts[0]; // Keep only the language part

          // Check if the code block contains just a URL (reference pattern)
          if (node.value && node.value.trim().startsWith('https://')) {
            const url = node.value.trim();
            // Convert to a comment with the reference URL preserved
            if (lang === 'go' || lang === 'golang') {
              node.value = `// Reference: ${url}`;
            } else if (lang === 'protobuf' || lang === 'proto') {
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

          // Clean the lang to remove 'reference'
          node.lang = lang;
        }

        // Remove any "reference" from meta as well
        if (node.meta && node.meta.includes('reference')) {
          node.meta = node.meta.replace('reference', '').trim();
        }

        // Add expandable to long code blocks
        if (node.value && node.value.split('\n').length > 10) {
          if (!node.meta || !node.meta.includes('expandable')) {
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
      });
    };
  };
}

/**
 * Helper function to format code by language
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
 * Process markdown with AST for better accuracy
 */
function processMarkdownWithAST(content, version, product) {
  try {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)  // Enable GitHub Flavored Markdown for proper table parsing
      .use(createLinkFixerPlugin(version, product))
      .use(createHTMLFixerPlugin())
      .use(createCodeBlockEnhancerPlugin())
      .use(remarkStringify);

    const file = processor.processSync(content);
    return String(file);
  } catch (error) {
    console.warn('AST processing failed, falling back to regex:', error.message);
    console.warn('Error details:', error);
    return content;
  }
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
  // Use AST processing first for better accuracy (handles code blocks)
  processedContent = processMarkdownWithAST(processedContent, version, product);

  // Fix MDX issues and apply conversions
  processedContent = fixMDXIssues(processedContent);
  processedContent = convertAdmonitions(processedContent);
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
  const images = [];

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

  // Copy images first
  if (images.length > 0) {
    // Images directory should be at the same level as version directories
    const parentDir = path.dirname(targetDir);
    const imagesDir = path.join(parentDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    console.log(`Copying ${images.length} images to ${imagesDir}`);
    for (const image of images) {
      const targetImagePath = path.join(imagesDir, image.relative);
      const targetImageDir = path.dirname(targetImagePath);

      if (!fs.existsSync(targetImageDir)) {
        fs.mkdirSync(targetImageDir, { recursive: true });
      }

      fs.copyFileSync(image.source, targetImagePath);
    }
  }

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

    // Update image paths in content
    let processedContent = result.content;
    processedContent = updateImagePaths(processedContent, file.relative, version);

    // Write converted file
    fs.writeFileSync(targetPath, processedContent);

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

  console.log('✅ Updated docs.json and versions.json');
}

/**
 * Migrate all versions from a Docusaurus repository
 */
async function migrateAllVersions(repositoryPath, targetDirectory, product = 'generic', options = {}) {
  const { updateNavigation = false } = options;

  if (!targetDirectory) {
    throw new Error('Target directory is required');
  }

  console.log(`=== Migrating All Versions ===\n`);

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
    // Images directory is at the same level as the target base (e.g., docs/sdk/images)
    const targetImagesDir = path.join(targetBase, 'images');
    console.log(`\n--- Copying static assets to ${targetImagesDir} ---`);

    // Copy all image files from static folder
    copyStaticAssets(staticPath, targetImagesDir);
  }

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

  // 3. Update navigation (only if explicitly requested)
  if (updateNavigation) {
    console.log(`\n--- Updating navigation files ---`);
    await updateDocsJson(allVersionData, product);
  } else {
    console.log(`\n--- Skipping navigation update (disabled) ---`);
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`📁 Files created in: ${targetBase}`);
  if (updateNavigation) {
    console.log(`📋 Navigation updated in docs.json and versions.json`);
  }

  return allVersionData;
}

/**
 * Main interactive flow
 */
async function main() {
  console.log('=== Docusaurus to Mintlify Converter ===\n');

  // Check for command line arguments for non-interactive mode
  const args = process.argv.slice(2);
  if (args.length >= 3) {
    const [repoPath, targetDirectory, product, ...restArgs] = args;
    let updateNavigation = false;

    // Parse additional arguments
    for (let i = 0; i < restArgs.length; i++) {
      if (restArgs[i] === '--update-nav') {
        updateNavigation = true;
      }
    }

    console.log('Running in non-interactive mode...');
    console.log(`Repository: ${repoPath}`);
    console.log(`Target directory: ${targetDirectory}`);
    console.log(`Product: ${product || 'generic'}`);
    console.log(`Update navigation: ${updateNavigation}`);

    await migrateAllVersions(repoPath, targetDirectory, product || 'generic', { updateNavigation });
    return;
  } else if (args.length > 0 && args.length < 3) {
    console.error('Error: Not enough arguments');
    console.error('Usage: node migrate-docusaurus.js <source-repo> <target-dir> [product] [--update-nav]');
    console.error('Example: node migrate-docusaurus.js ~/repos/cosmos-sdk-docs ./tmp/sdk sdk');
    process.exit(1);
  }

  console.log('Migration options:');
  console.log('1. Migrate single version (original behavior)');
  console.log('2. Migrate all versions from repository');
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

    // Extract product name from target directory (e.g., ./docs/sdk -> sdk)
    const targetParts = targetDirectory.split('/');
    const product = targetParts[targetParts.length - 1] || 'generic';

    console.log('\nUpdate navigation files? (y/n):');
    const updateNav = (await prompt('> ')).trim().toLowerCase() === 'y';

    await migrateAllVersions(repoPath.trim(), targetDirectory, product, { updateNavigation: updateNav });
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
  copyStaticAssets
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}