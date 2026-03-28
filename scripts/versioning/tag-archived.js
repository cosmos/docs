#!/usr/bin/env node

/**
 * tag-archived.js
 *
 * Retroactively injects `noindex: true` and `canonical` front matter into
 * existing archived (versioned) documentation directories.
 *
 * This is a one-time or per-product maintenance tool. Run it whenever:
 *   - A product's existing versioned directories (e.g. sdk/v0.50, sdk/v0.47)
 *     need to be marked as non-indexable by search engines.
 *   - You want to point archived pages at the canonical /latest/ equivalent.
 *
 * Usage:
 *   node tag-archived.js --product sdk --version v0.50
 *   node tag-archived.js --product sdk --all
 *   node tag-archived.js --product ibc --version v8.5.x
 *   node tag-archived.js --all-products --all
 *
 * Options:
 *   --product <name>    Product name (sdk, ibc, evm, cometbft, hub, etc.)
 *   --version <ver>     Single version directory to tag (e.g. v0.53)
 *   --all               Tag all non-latest, non-next versioned dirs for the product
 *   --all-products      Run across every product discovered in the repo
 *   --dry-run           Print what would change without modifying files
 *   --base-url <url>    Override canonical base URL (default: https://docs.cosmos.network)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const BASE_URL = 'https://docs.cosmos.network';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { product: null, version: null, all: false, allProducts: false, dryRun: false, baseUrl: BASE_URL };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--product':     args.product     = argv[++i]; break;
      case '--version':     args.version     = argv[++i]; break;
      case '--all':         args.all         = true;      break;
      case '--all-products':args.allProducts = true;      break;
      case '--dry-run':     args.dryRun      = true;      break;
      case '--base-url':    args.baseUrl     = argv[++i]; break;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const colors = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', reset: '\x1b[0m' };
function info(msg)    { console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`); }
function success(msg) { console.log(`${colors.green}✓${colors.reset}  ${msg}`); }
function warn(msg)    { console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`); }
function skip(msg)    { console.log(`   ${msg}`); }

// ---------------------------------------------------------------------------
// Product / version discovery
// ---------------------------------------------------------------------------

function discoverProducts() {
  const ignore = new Set(['node_modules', 'scripts', 'snippets', 'assets', '.git']);
  return fs.readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !ignore.has(d.name))
    .map(d => d.name)
    .filter(name => {
      const entries = fs.readdirSync(path.join(REPO_ROOT, name), { withFileTypes: true });
      return entries.some(d => d.isDirectory() && /^v\d+/.test(d.name));
    });
}

function discoverArchivedVersions(product) {
  const productDir = path.join(REPO_ROOT, product);
  if (!fs.existsSync(productDir)) return [];
  return fs.readdirSync(productDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^v\d+/.test(d.name))
    .map(d => d.name);
}

// ---------------------------------------------------------------------------
// Front matter injection
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Returns the relative page path within a product+version dir.
 * e.g. sdk/v0.50/learn/concepts/accounts.mdx → learn/concepts/accounts
 */
function relativePagePath(filePath, productDir) {
  const rel = path.relative(productDir, filePath);
  return rel.replace(/\.mdx$/, '');
}

/**
 * Determines the canonical URL for an archived page.
 *
 * Prefers a specific page URL if the equivalent page exists in latest/.
 * Falls back to the product's /latest/ root if not found.
 */
function canonicalUrl(filePath, product, baseUrl) {
  const productDir = path.join(REPO_ROOT, product);
  const latestDir  = path.join(productDir, 'latest');
  const relPage    = relativePagePath(filePath, path.dirname(path.dirname(filePath))); // strip product/version prefix

  // Strip the version segment from the path to get the page-relative path
  // filePath: /repo/sdk/v0.50/learn/concepts/accounts.mdx
  // We want:  learn/concepts/accounts.mdx
  const versionDir = path.dirname(path.dirname(filePath)) === productDir
    ? path.dirname(filePath) // single-level
    : filePath;

  // Re-derive: get path relative to the version directory
  const versionDirPath = filePath.split(path.sep).slice(0, -1).join(path.sep); // parent dir
  // Walk up to find the version dir (first dir matching /^v\d+/)
  const parts = path.relative(REPO_ROOT, filePath).split(path.sep);
  // parts: ['sdk', 'v0.50', 'learn', 'concepts', 'accounts.mdx']
  const pageRelative = parts.slice(2).join(path.sep); // ['learn', 'concepts', 'accounts.mdx']
  const pageRelativeNoExt = pageRelative.replace(/\.mdx$/, '');

  const latestEquivalent = path.join(latestDir, pageRelative);
  if (fs.existsSync(latestEquivalent)) {
    return `${baseUrl}/${product}/latest/${pageRelativeNoExt}`;
  }
  return `${baseUrl}/${product}/latest/`;
}

/**
 * Injects `noindex: true` and `canonical: <url>` into MDX front matter.
 * Skips files that already have noindex set.
 * Returns true if the file was (or would be) modified.
 */
function injectFrontMatter(filePath, product, baseUrl, dryRun) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(FRONTMATTER_RE);

  if (match) {
    const fm = match[1];
    if (/^noindex\s*:/m.test(fm)) {
      return false; // already tagged
    }
    const canonical = canonicalUrl(filePath, product, baseUrl);
    const newFm = `noindex: true\ncanonical: '${canonical}'\n${fm}`;
    const newContent = raw.replace(FRONTMATTER_RE, `---\n${newFm}\n---`);
    if (!dryRun) fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  } else {
    // No front matter — prepend one
    const canonical = canonicalUrl(filePath, product, baseUrl);
    const newContent = `---\nnoindex: true\ncanonical: '${canonical}'\n---\n\n${raw}`;
    if (!dryRun) fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  }
}

// ---------------------------------------------------------------------------
// Walk and tag a version directory
// ---------------------------------------------------------------------------

function walkMdx(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMdx(full, results);
    else if (entry.name.endsWith('.mdx')) results.push(full);
  }
  return results;
}

function tagVersion(product, version, baseUrl, dryRun) {
  const versionDir = path.join(REPO_ROOT, product, version);
  if (!fs.existsSync(versionDir)) {
    warn(`Directory not found: ${product}/${version} — skipping`);
    return { tagged: 0, skipped: 0 };
  }

  const files = walkMdx(versionDir);
  let tagged = 0, skipped = 0;

  for (const file of files) {
    const modified = injectFrontMatter(file, product, baseUrl, dryRun);
    if (modified) {
      tagged++;
      const rel = path.relative(REPO_ROOT, file);
      if (dryRun) skip(`[dry-run] would tag: ${rel}`);
    } else {
      skipped++;
    }
  }
  return { tagged, skipped };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.product && !args.allProducts) {
    console.error('Error: --product <name> or --all-products is required');
    console.error('Run with --help for usage.');
    process.exit(1);
  }

  if (!args.version && !args.all) {
    console.error('Error: --version <ver> or --all is required');
    process.exit(1);
  }

  if (args.dryRun) info('Dry-run mode — no files will be modified.\n');

  const products = args.allProducts ? discoverProducts() : [args.product];
  const baseUrl  = args.baseUrl;

  let totalTagged = 0, totalSkipped = 0;

  for (const product of products) {
    const productDir = path.join(REPO_ROOT, product);
    if (!fs.existsSync(productDir)) {
      warn(`Product directory not found: ${product} — skipping`);
      continue;
    }

    const versions = args.all ? discoverArchivedVersions(product) : [args.version];
    if (versions.length === 0) {
      warn(`No archived versions found for ${product}`);
      continue;
    }

    info(`Product: ${product}  |  versions to tag: ${versions.join(', ')}`);

    for (const version of versions) {
      const { tagged, skipped } = tagVersion(product, version, baseUrl, args.dryRun);
      const label = args.dryRun ? '[dry-run] ' : '';
      success(`${label}${product}/${version}: tagged ${tagged} files, skipped ${skipped} already-tagged`);
      totalTagged  += tagged;
      totalSkipped += skipped;
    }
  }

  console.log('');
  info(`Total: ${totalTagged} files tagged, ${totalSkipped} already had noindex.`);
  if (args.dryRun) warn('Re-run without --dry-run to apply changes.');
}

main().catch(err => { console.error(err); process.exit(1); });
