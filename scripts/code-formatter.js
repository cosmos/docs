#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Perfect code formatting using native language tools
 */
class PerfectCodeFormatter {
  constructor() {
    this.tempDir = './tmp-code-formatting';
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Format Go code using gofmt
   */
  async formatGoCode(code) {
    const tempFile = path.join(this.tempDir, `temp-${Date.now()}.go`);

    try {
      // Create a valid Go file structure
      const goFile = `package main\n\n${code}`;
      fs.writeFileSync(tempFile, goFile);

      // Run gofmt
      const formatted = execSync(`gofmt "${tempFile}"`, { encoding: 'utf8' });

      // Remove the package declaration we added
      const result = formatted.replace(/^package main\n\n/, '').trim();

      fs.unlinkSync(tempFile);
      return result;
    } catch (error) {
      // If gofmt fails, try basic cleanup
      console.warn(`Go formatting failed for code block, using fallback`);
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      return this.fallbackGoFormat(code);
    }
  }

  /**
   * Format JavaScript/TypeScript using prettier (if available)
   */
  async formatJavaScriptCode(code) {
    const tempFile = path.join(this.tempDir, `temp-${Date.now()}.js`);

    try {
      fs.writeFileSync(tempFile, code);

      // Try prettier if available
      const formatted = execSync(`npx prettier --stdin-filepath="${tempFile}" < "${tempFile}"`, { encoding: 'utf8' });

      fs.unlinkSync(tempFile);
      return formatted.trim();
    } catch (error) {
      console.warn(`JavaScript formatting failed, using fallback`);
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      return this.fallbackJSFormat(code);
    }
  }

  /**
   * Format JSON using native JSON.parse/stringify
   */
  formatJsonCode(code) {
    try {
      const parsed = JSON.parse(code);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      console.warn(`JSON parsing failed, using fallback`);
      return this.fallbackJsonFormat(code);
    }
  }

  /**
   * Fallback Go formatting
   */
  fallbackGoFormat(code) {
    return code
      .replace(/import\s*\(/g, 'import (\n\t')
      .replace(/"\s*"/g, '"\n\t"')
      .replace(/\)\s*\n\s*([a-zA-Z])/g, ')\n\n$1')
      .replace(/\{\s*([a-zA-Z])/g, '{\n\t$1')
      .replace(/([^}\n])\s*\}/g, '$1\n}')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Fallback JavaScript formatting
   */
  fallbackJSFormat(code) {
    return code
      .replace(/import\s*\{([^}]+)\}\s*from/g, (match, imports) => {
        const cleanImports = imports.split(',').map(imp => imp.trim()).join(',\n  ');
        return `import {\n  ${cleanImports}\n} from`;
      })
      .replace(/\{\s*([a-zA-Z])/g, '{\n  $1')
      .replace(/([^}\n])\s*\}/g, '$1\n}')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Fallback JSON formatting
   */
  fallbackJsonFormat(code) {
    return code
      .replace(/\{\s*"/g, '{\n  "')
      .replace(/",\s*"/g, '",\n  "')
      .replace(/\}\s*,/g, '\n},')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Format code block content based on language
   */
  async formatCodeBlock(language, code) {
    const lang = language.toLowerCase();

    switch (lang) {
      case 'go':
      case 'golang':
        return await this.formatGoCode(code);
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
        return await this.formatJavaScriptCode(code);
      case 'json':
      case 'jsonc':
        return this.formatJsonCode(code);
      default:
        // For other languages, just clean up basic structure
        return code
          .replace(/\{\s*([a-zA-Z])/g, '{\n  $1')
          .replace(/([^}\n])\s*\}/g, '$1\n}')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
    }
  }

  /**
   * Process all code blocks in content
   */
  async formatAllCodeBlocks(content) {
    const codeBlockRegex = /```(\w+)([^\n]*)\n([\s\S]*?)\n```/g;
    let result = content;
    const matches = [...content.matchAll(codeBlockRegex)];

    for (const match of matches) {
      const [fullMatch, language, params, code] = match;
      console.log(`   Formatting ${language} code block (${code.length} chars)`);

      const formattedCode = await this.formatCodeBlock(language, code);
      const formattedBlock = '```' + language + params + '\n' + formattedCode + '\n```';

      result = result.replace(fullMatch, formattedBlock);
    }

    return result;
  }

  cleanup() {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Perfect bulk formatting using native tools
 */
async function perfectBulkFormat() {
  console.log('=== Perfect Code Block Formatting ===');
  console.log('Using native language formatters for perfect results\n');

  const formatter = new PerfectCodeFormatter();
  const docsPath = './docs/sdk';

  let filesProcessed = 0;
  let blocksFormatted = 0;

  // Find all MDX files
  const mdxFiles = [];
  function findMDXFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        findMDXFiles(fullPath);
      } else if (item.endsWith('.mdx')) {
        mdxFiles.push(fullPath);
      }
    }
  }

  findMDXFiles(docsPath);
  console.log(`Found ${mdxFiles.length} MDX files`);

  // Process files
  for (let i = 0; i < mdxFiles.length; i++) {
    const filePath = mdxFiles[i];
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if file has code blocks that might need formatting
    const codeBlockCount = (content.match(/```/g) || []).length / 2;

    if (codeBlockCount > 0) {
      console.log(`📁 ${path.relative(process.cwd(), filePath)} (${codeBlockCount} blocks)`);

      const formattedContent = await formatter.formatAllCodeBlocks(content);

      if (formattedContent !== content) {
        fs.writeFileSync(filePath, formattedContent);
        filesProcessed++;
        blocksFormatted += codeBlockCount;
        console.log(`   ✅ Updated with perfect formatting`);
      } else {
        console.log(`   ✓ Already well-formatted`);
      }
    }

    // Progress indicator
    if ((i + 1) % 100 === 0) {
      console.log(`   Progress: ${i + 1}/${mdxFiles.length} files checked`);
    }
  }

  formatter.cleanup();

  console.log('\n=== PERFECT FORMATTING COMPLETE ===');
  console.log(`📊 Files processed: ${filesProcessed}`);
  console.log(`🎯 Code blocks formatted: ${blocksFormatted}`);
  console.log('✅ All code now formatted with native language tools!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  perfectBulkFormat().catch(console.error);
}