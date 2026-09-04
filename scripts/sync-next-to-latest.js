#!/usr/bin/env node

/**
 * sync-next-to-latest.js
 *
 * The opposite of sync-latest-to-next.js: copies files from a product's next/
 * directory into latest/, rewriting /<product>/next/ links to /<product>/latest/.
 *
 * Usage:
 *   node scripts/sync-next-to-latest.js <file|dir> [file2|dir2 ...]
 *
 * This direction exists for one narrow case, and using it anywhere else is
 * almost certainly wrong. latest/ is a frozen snapshot of a released version,
 * and rewriting it between releases publishes content the version stamp does
 * not cover.
 *
 * The exception is the example chain tutorials. Those pages tell a reader to
 * `git clone https://github.com/cosmos/example` and `git checkout main`, so
 * they document whatever main is right now rather than a released version.
 * Freezing a copy of them protects nothing: it just leaves latest/ describing
 * code the reader is not running. They are synced from cosmos/example into
 * next/ by a bot, and this script carries that same content into latest/.
 *
 * ALLOWED lists the paths where that reasoning applies. Anything else is
 * refused rather than warned about, because the failure is silent: latest/
 * would look updated and start disagreeing with its own version stamp.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

const PRODUCTS = ['evm', 'sdk', 'hub', 'cometbft', 'ibc', 'skip-go', 'enterprise'];

// Paths, relative to <product>/next/, that may be carried forward into latest/.
// Each entry needs a reason that survives someone asking "why is this exempt
// from the freeze?" a year from now.
const ALLOWED = [
  {
    prefix: 'tutorials/example/',
    reason: 'the pages instruct `git checkout main`, so a frozen copy documents code the reader is not running',
  },
];

function usage() {
  console.error('Usage: node scripts/sync-next-to-latest.js <file> [file2 ...]');
  console.error('  Files must be paths relative to the repo root, e.g.:');
  console.error('  sdk/next/tutorials/example/05-run-and-test.mdx');
  process.exit(1);
}

function extractFrontMatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return match ? match[0] : '';
}

function extractBody(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

function rewriteLinks(content, product) {
  // Only rewrite this product's own next/ links. Cross-product links are left
  // alone: a latest/ page legitimately points at another product's latest/.
  const escapedProduct = product.replace(/-/g, '\\-');
  const re = new RegExp(`(https?:\\/\\/\\S+)|\\/${escapedProduct}\\/next\\/`, 'g');
  return content.replace(re, (match, externalUrl) => {
    if (externalUrl) return externalUrl;
    return `/${product}/latest/`;
  });
}

function allowanceFor(subPath) {
  return ALLOWED.find((entry) => subPath.startsWith(entry.prefix));
}

function syncFile(relPath) {
  relPath = relPath.replace(/^\.\//, '');

  const nextMatch = relPath.match(/^([^/]+)\/next\/(.+)$/);
  if (!nextMatch) {
    console.error(`✗ ${relPath}`);
    console.error("  Path must be under a product's next/ directory.");
    return false;
  }

  const [, product, subPath] = nextMatch;

  if (!PRODUCTS.includes(product)) {
    console.error(`✗ ${relPath}`);
    console.error(`  Unknown product "${product}". Expected one of: ${PRODUCTS.join(', ')}`);
    return false;
  }

  const allowance = allowanceFor(subPath);
  if (!allowance) {
    console.error(`✗ ${relPath}`);
    console.error('  This direction is only for pages exempt from the version freeze.');
    console.error('  latest/ documents a released version; copying next/ over it publishes');
    console.error('  content that version stamp does not cover.');
    console.error('  Currently exempt:');
    for (const entry of ALLOWED) {
      console.error(`    <product>/next/${entry.prefix}  ${entry.reason}`);
    }
    console.error('  If this page belongs on that list, add it with its reason.');
    return false;
  }

  const srcPath = path.join(REPO_ROOT, relPath);
  const destPath = path.join(REPO_ROOT, product, 'latest', subPath);

  if (!fs.existsSync(srcPath)) {
    console.error(`✗ ${relPath}`);
    console.error(`  File not found: ${srcPath}`);
    return false;
  }

  const srcContent = fs.readFileSync(srcPath, 'utf8');
  const rewrittenBody = rewriteLinks(extractBody(srcContent), product);

  let rewritten;
  if (fs.existsSync(destPath)) {
    // Keep latest/'s own front matter. It carries the version label a reader
    // sees under the page title, which next/'s copy does not have.
    rewritten = extractFrontMatter(fs.readFileSync(destPath, 'utf8')) + rewrittenBody;
  } else {
    rewritten = rewriteLinks(srcContent, product);
  }

  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`  Created directory: ${path.relative(REPO_ROOT, destDir)}`);
  }

  const destExists = fs.existsSync(destPath);
  fs.writeFileSync(destPath, rewritten, 'utf8');

  console.log(
    `✓ ${relPath} → ${path.relative(REPO_ROOT, destPath)} ${destExists ? '(updated)' : '(created)'}`,
  );
  return true;
}

function collectFiles(argPath) {
  const absPath = path.isAbsolute(argPath) ? argPath : path.join(REPO_ROOT, argPath);

  if (!fs.existsSync(absPath)) {
    console.error(`✗ Not found: ${argPath}`);
    return [];
  }

  if (fs.statSync(absPath).isFile()) {
    return [path.relative(REPO_ROOT, absPath)];
  }

  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.mdx')) files.push(path.relative(REPO_ROOT, full));
    }
  })(absPath);
  return files;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) usage();

  const files = args.flatMap(collectFiles);
  if (!files.length) {
    console.error('No .mdx files found in the given paths.');
    process.exit(1);
  }

  let synced = 0;
  let failed = 0;
  for (const file of files) {
    if (syncFile(file)) synced += 1;
    else failed += 1;
  }

  console.log(`\nDone. ${synced} file(s) synced to latest/.${failed ? ` ${failed} refused or failed.` : ''}`);
  console.log('Review the diff before committing.');
  if (failed) process.exit(1);
}

main();
