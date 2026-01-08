const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const chalk = require('chalk');
const https = require('https');
const http = require('http');

let hasBrokenLinks = false;
let checkedLinks = 0;
let brokenLinks = [];
let skippedLinks = [];

// Track files and their links
const fileLinks = new Map();

/**
 * Check if a URL is accessible
 */
function checkUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        timeout: timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const req = client.request(options, (res) => {
        resolve({
          status: res.statusCode,
          broken: res.statusCode >= 400,
          url: url
        });
      });

      req.on('error', (error) => {
        resolve({
          status: 'Error',
          broken: true,
          url: url,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'Timeout',
          broken: true,
          url: url,
          error: 'Request timeout'
        });
      });

      req.end();
    } catch (error) {
      resolve({
        status: 'Invalid URL',
        broken: true,
        url: url,
        error: error.message
      });
    }
  });
}

/**
 * Extract links from markdown/MDX content
 */
function extractLinks(content, filePath) {
  const links = [];
  
  // Markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const url = match[2].trim();
    if (url && !url.startsWith('#') && !url.startsWith('mailto:')) {
      links.push({
        url: url,
        text: match[1],
        type: 'markdown',
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }

  // HTML anchor tags: <a href="url">
  const htmlLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlLinkRegex.exec(content)) !== null) {
    const url = match[1].trim();
    if (url && !url.startsWith('#') && !url.startsWith('mailto:')) {
      links.push({
        url: url,
        text: match[0],
        type: 'html',
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }

  // Card components with href: <Card href="url">
  const cardLinkRegex = /<Card[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = cardLinkRegex.exec(content)) !== null) {
    const url = match[1].trim();
    if (url && !url.startsWith('#') && !url.startsWith('mailto:')) {
      links.push({
        url: url,
        text: match[0],
        type: 'card',
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }

  return links;
}

/**
 * Resolve relative URLs to absolute
 */
function resolveUrl(url, basePath, baseUrl = '') {
  // Already absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Internal link (starts with /)
  if (url.startsWith('/')) {
    return baseUrl ? `${baseUrl}${url}` : url;
  }

  // Relative link (./ or ../)
  if (url.startsWith('./') || url.startsWith('../')) {
    const dir = path.dirname(basePath);
    const resolved = path.resolve(dir, url);
    const relativePath = path.relative(process.cwd(), resolved);
    
    // Convert to web path
    const webPath = '/' + relativePath.replace(/\\/g, '/').replace(/\.mdx?$/, '');
    return baseUrl ? `${baseUrl}${webPath}` : webPath;
  }

  // Implicit relative (no prefix)
  const dir = path.dirname(basePath);
  const resolved = path.resolve(dir, url);
  const relativePath = path.relative(process.cwd(), resolved);
  const webPath = '/' + relativePath.replace(/\\/g, '/').replace(/\.mdx?$/, '');
  return baseUrl ? `${baseUrl}${webPath}` : webPath;
}

/**
 * Check if file exists (for internal links)
 */
function checkInternalLink(url, basePath, projectRoot) {
  // Remove query params and hash
  const cleanUrl = url.split('?')[0].split('#')[0];
  
  // Handle absolute paths (starting with /)
  if (cleanUrl.startsWith('/')) {
    const possiblePaths = [
      path.join(projectRoot, cleanUrl.slice(1) + '.mdx'),
      path.join(projectRoot, cleanUrl.slice(1) + '.md'),
      path.join(projectRoot, cleanUrl.slice(1), 'index.mdx'),
      path.join(projectRoot, cleanUrl.slice(1), 'index.md'),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        return { exists: true, path: filePath };
      }
    }
  } else {
    // Relative path - resolve from basePath
    const baseDir = path.dirname(basePath);
    const resolved = path.resolve(baseDir, cleanUrl);
    
    const possiblePaths = [
      resolved + '.mdx',
      resolved + '.md',
      path.join(resolved, 'index.mdx'),
      path.join(resolved, 'index.md'),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath) && filePath.startsWith(projectRoot)) {
        return { exists: true, path: filePath };
      }
    }
  }

  return { exists: false, path: null };
}

/**
 * Recursively find all MDX/MD files
 */
function findMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and .git
      if (!file.startsWith('.') && file !== 'node_modules') {
        findMarkdownFiles(filePath, fileList);
      }
    } else if (file.endsWith('.mdx') || file.endsWith('.md')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Main function
 */
async function main() {
  const baseUrl = process.env.BASE_URL || '';
  const checkExternal = process.argv.includes('--external') || process.argv.includes('-e');
  const checkInternal = !process.argv.includes('--external-only');
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  // Determine project root (go up from scripts/link-validation if needed)
  let projectRoot = process.cwd();
  if (projectRoot.endsWith('scripts/link-validation')) {
    projectRoot = path.join(projectRoot, '../..');
  }

  console.log(chalk.blue('\n🔍 Scanning MDX/MD files for links...\n'));
  console.log(chalk.gray(`   Project root: ${projectRoot}\n`));

  // Find all markdown files (exclude node_modules and scripts/link-validation)
  const files = findMarkdownFiles(projectRoot).filter(file => {
    const relativePath = path.relative(projectRoot, file);
    return !relativePath.includes('node_modules') && 
           !relativePath.startsWith('scripts/link-validation');
  });
  console.log(chalk.gray(`   Found ${files.length} markdown files\n`));

  // Extract all links
  const allLinks = [];
  files.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const links = extractLinks(content, filePath);
      
      links.forEach(link => {
        link.file = filePath;
        link.resolvedUrl = resolveUrl(link.url, filePath, baseUrl);
        allLinks.push(link);
      });

      if (links.length > 0) {
        fileLinks.set(filePath, links);
      }
    } catch (error) {
      console.error(chalk.red(`Error reading ${filePath}: ${error.message}`));
    }
  });

  console.log(chalk.blue(`   Found ${allLinks.length} links to check\n`));

  // Check links
  for (const link of allLinks) {
    const isExternal = link.resolvedUrl.startsWith('http://') || link.resolvedUrl.startsWith('https://');
    const isInternal = link.url.startsWith('/') || link.url.startsWith('./') || link.url.startsWith('../') || (!link.url.startsWith('http') && !link.url.startsWith('#') && !link.url.startsWith('mailto:'));

    if (isExternal && !checkExternal) {
      skippedLinks.push(link);
      continue;
    }

    if (isInternal && !checkInternal) {
      skippedLinks.push(link);
      continue;
    }

    checkedLinks++;

    if (verbose) {
      process.stdout.write(chalk.gray(`Checking: ${link.resolvedUrl || link.url}... `));
    }

    if (isExternal) {
      // Check external URL
      const result = await checkUrl(link.resolvedUrl);
      if (result.broken) {
        hasBrokenLinks = true;
        brokenLinks.push({
          ...link,
          status: result.status,
          error: result.error
        });
        
        if (verbose) {
          console.log(chalk.red('❌'));
        } else {
          const relativeFile = path.relative(projectRoot, link.file);
          console.error(
            chalk.red(`❌ BROKEN: ${link.resolvedUrl}`),
            chalk.yellow(`\n   File: ${relativeFile}:${link.line}`),
            chalk.gray(`\n   Status: ${result.status}${result.error ? ` - ${result.error}` : ''}`)
          );
        }
      } else {
        if (verbose) {
          console.log(chalk.green('✓'));
        } else {
          process.stdout.write(chalk.gray('.'));
        }
      }
    } else {
      // Check internal link
      const result = checkInternalLink(link.url, link.file, projectRoot);
      if (!result.exists) {
        hasBrokenLinks = true;
        brokenLinks.push({
          ...link,
          status: 'File not found',
          error: 'Internal file does not exist'
        });
        
        if (verbose) {
          console.log(chalk.red('❌'));
        } else {
          const relativeFile = path.relative(projectRoot, link.file);
          console.error(
            chalk.red(`❌ BROKEN: ${link.url}`),
            chalk.yellow(`\n   File: ${relativeFile}:${link.line}`),
            chalk.gray(`\n   Status: File not found`)
          );
        }
      } else {
        if (verbose) {
          console.log(chalk.green('✓'));
        } else {
          process.stdout.write(chalk.gray('.'));
        }
      }
    }

    // Small delay to avoid overwhelming servers
    if (isExternal) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Summary
  console.log(chalk.blue(`\n\n📊 Summary:`));
  console.log(chalk.blue(`   Files scanned: ${files.length}`));
  console.log(chalk.blue(`   Links found: ${allLinks.length}`));
  console.log(chalk.blue(`   Links checked: ${checkedLinks}`));
  if (skippedLinks.length > 0) {
    console.log(chalk.yellow(`   Links skipped: ${skippedLinks.length}`));
  }
  console.log(chalk.blue(`   Broken links: ${brokenLinks.length}`));

  if (hasBrokenLinks) {
    console.error(chalk.red('\n❌ Broken links found!'));
    process.exit(1);
  } else {
    console.log(chalk.green('\n✅ No broken links found!'));
    process.exit(0);
  }
}

main().catch(error => {
  console.error(chalk.red('\n❌ Error:'), error);
  process.exit(1);
});
