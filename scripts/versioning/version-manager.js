#!/usr/bin/env node

/**
 * Documentation Version Manager
 *
 * Freezes documentation versions using a next → latest → archive model:
 *
 *   1. If latest/ exists: archive it as <version>/ (rewrite links, inject noindex/canonical)
 *   2. Promote next/ → latest/ (rewrite links next → latest)
 *   3. Update docs.json navigation and versions.json registry
 *
 * At release time the operator provides the new display version label (e.g. "v0.54").
 * The outgoing latest/ is archived using the label stored in versions.json latestDisplayVersion.
 *
 * Usage:
 *   npm run freeze              # interactive
 *   NON_INTERACTIVE=1 SUBDIR=sdk NEW_DISPLAY_VERSION=v0.54 npm run freeze
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'https://docs.cosmos.network';

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const colors = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', reset: '\x1b[0m' };

function printInfo(msg)    { console.log(`${colors.blue}${colors.reset} ${msg}`); }
function printSuccess(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function printWarning(msg) { console.log(`${colors.yellow}${colors.reset} ${msg}`); }
function printError(msg)   { console.log(`${colors.red}✗${colors.reset} ${msg}`); }

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

// ---------------------------------------------------------------------------
// Product / version discovery
// ---------------------------------------------------------------------------

function listDocsSubdirs() {
  const repoRoot = path.join(__dirname, '..', '..');
  if (!fs.existsSync(repoRoot)) return [];
  const ignore = new Set(['.', '..', 'node_modules', 'scripts', 'snippets', 'assets']);
  return fs.readdirSync(repoRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !ignore.has(d.name))
    .map(d => d.name)
    .filter(name => {
      const contents = fs.readdirSync(path.join(repoRoot, name), { withFileTypes: true });
      return contents.some(d => d.isDirectory() && (d.name === 'next' || d.name === 'latest' || /^v\d+/.test(d.name)));
    });
}

// ---------------------------------------------------------------------------
// Versions registry (versions.json)
// ---------------------------------------------------------------------------

function loadVersionsRegistry() {
  const versionsPath = path.join(__dirname, '..', '..', 'versions.json');
  let data = {};
  if (fs.existsSync(versionsPath)) {
    try { data = JSON.parse(fs.readFileSync(versionsPath, 'utf8')); } catch { data = {}; }
  }
  if (!data.products || typeof data.products !== 'object') data = { products: {} };

  // Auto-discover products and versions from filesystem
  const subdirs = listDocsSubdirs();
  for (const subdir of subdirs) {
    const base = path.join(__dirname, '..', '..', subdir);
    const entries = fs.readdirSync(base, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name);

    const discovered = [];
    if (entries.includes('next'))   discovered.push('next');
    if (entries.includes('latest')) discovered.push('latest');
    for (const name of entries) {
      if (/^v\d+\.\d+(?:\.(?:\d+|x))?$/.test(name)) discovered.push(name);
    }

    if (!data.products[subdir]) {
      data.products[subdir] = {
        versions: discovered,
        defaultVersion: entries.includes('latest') ? 'latest' : (entries.includes('next') ? 'next' : discovered[0] || 'next'),
        repository: `cosmos/${subdir}`,
        changelogPath: 'CHANGELOG.md'
      };
    } else {
      const existing = data.products[subdir].versions || [];
      const merged = Array.from(new Set([...discovered, ...existing]));
      const stable = merged.filter(v => /^v\d+\.\d+(?:\.(?:\d+|x))?$/.test(v)).sort(compareVersionsDesc);
      const special = ['next', 'latest'].filter(s => merged.includes(s));
      data.products[subdir].versions = [...special, ...stable];
      if (!data.products[subdir].repository)    data.products[subdir].repository    = `cosmos/${subdir}`;
      if (!data.products[subdir].changelogPath) data.products[subdir].changelogPath = 'CHANGELOG.md';
    }
  }

  return { data, path: versionsPath };
}

function saveVersionsRegistry(registry, versionsPath) {
  fs.writeFileSync(versionsPath, JSON.stringify(registry, null, 2) + '\n');
}

function validateVersionFormat(version) {
  return /^v\d+\.\d+(?:\.(?:\d+|x))?$/.test(version);
}

function parseVersionTuple(v) {
  const m = v.match(/^v(\d+)\.(\d+)(?:\.(\d+|x))?$/);
  if (!m) return null;
  const patch = m[3] === undefined ? 0 : (m[3] === 'x' ? Number.POSITIVE_INFINITY : parseInt(m[3], 10));
  return [parseInt(m[1], 10), parseInt(m[2], 10), patch, m[3] === 'x'];
}

function compareVersionsDesc(a, b) {
  const at = parseVersionTuple(a) || [0, 0, -1, false];
  const bt = parseVersionTuple(b) || [0, 0, -1, false];
  if (bt[0] !== at[0]) return bt[0] - at[0];
  if (bt[1] !== at[1]) return bt[1] - at[1];
  if (bt[2] !== at[2]) return bt[2] - at[2];
  return at[3] ? 1 : -1;
}

// ---------------------------------------------------------------------------
// Release notes helpers
// ---------------------------------------------------------------------------

function includesVersionInReleaseNotes(content, version) {
  if (!content || !version) return false;
  const tuple = parseVersionTuple(version);
  if (!tuple) return content.includes(`"${version}"`);
  const [major, minor, patch, isX] = tuple;
  const re = isX
    ? new RegExp(`<Update[^>]*version="v?${major}\\.${minor}\\.(?:\\d+|x)"`)
    : /^v\d+\.\d+$/.test(version)
      ? new RegExp(`<Update[^>]*version="v?${major}\\.${minor}(?:\\.\\d+)?"`)
      : new RegExp(`<Update[^>]*version="v?${major}\\.${minor}\\.${patch}"`);
  return re.test(content);
}

async function checkReleaseNotes(version, subdir) {
  // Check in both next/ and latest/ (whichever exists)
  for (const dir of ['latest', 'next']) {
    const p = path.join(__dirname, '..', '..', subdir, dir, 'changelog', 'release-notes.mdx');
    if (fs.existsSync(p)) {
      return includesVersionInReleaseNotes(fs.readFileSync(p, 'utf8'), version);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Link rewriting (URL-aware — preserves external https:// links)
// ---------------------------------------------------------------------------

/**
 * Rewrites internal doc links in all MDX files under dirPath.
 * Uses perl alternation: matches a full external URL first (preserves it),
 * or the internal path pattern (replaces it).
 * GitHub links with version strings in their paths are never modified.
 */
function rewriteInternalLinks(dirPath, fromSlug, toSlug) {
  // Main link rewrite: /fromSlug/ → /toSlug/
  const perlCmd = `find "${dirPath}" -name "*.mdx" -type f -exec perl -i'' -pe 's{(https?://\\S+)|/${fromSlug}/}{defined($1)?$1:"/${toSlug}/"}ge' {} \\;`;
  execSync(perlCmd);

  // Fix bare /documentation/ hrefs missing the product prefix (lookbehind keeps href= context)
  const fixRelativeCmd = `find "${dirPath}" -name "*.mdx" -type f -exec perl -i'' -pe 's{(https?://\\S+)|(?<=href=")/documentation/}{defined($1)?$1:"/${toSlug}/documentation/"}ge' {} \\;`;
  execSync(fixRelativeCmd);
}

// ---------------------------------------------------------------------------
// Archive: latest/ → <version>/
// ---------------------------------------------------------------------------

function archiveLatest(archiveVersion, subdir) {
  const latestPath = path.join(__dirname, '..', '..', subdir, 'latest');
  const targetPath = path.join(__dirname, '..', '..', subdir, archiveVersion);

  printInfo(`Archiving ${subdir}/latest/ → ${subdir}/${archiveVersion}/...`);
  execSync(`rm -rf "${targetPath}" && mkdir -p "${targetPath}"`);
  execSync(`cp -R "${latestPath}/." "${targetPath}/"`);

  rewriteInternalLinks(targetPath, `${subdir}/latest`, `${subdir}/${archiveVersion}`);
  printSuccess(`Archived latest/ → ${archiveVersion}/`);

  return { targetPath, latestPath };
}

// ---------------------------------------------------------------------------
// Promote: next/ → latest/
// ---------------------------------------------------------------------------

function promoteNextToLatest(subdir) {
  const nextPath   = path.join(__dirname, '..', '..', subdir, 'next');
  const latestPath = path.join(__dirname, '..', '..', subdir, 'latest');

  if (!fs.existsSync(nextPath)) {
    throw new Error(`next/ directory not found: ${nextPath}`);
  }

  printInfo(`Promoting ${subdir}/next/ → ${subdir}/latest/...`);
  execSync(`rm -rf "${latestPath}" && mkdir -p "${latestPath}"`);
  execSync(`cp -R "${nextPath}/." "${latestPath}/"`);

  rewriteInternalLinks(latestPath, `${subdir}/next`, `${subdir}/latest`);
  printSuccess('Promoted next/ → latest/');
}

// ---------------------------------------------------------------------------
// Inject noindex + canonical into archived version MDX files
// ---------------------------------------------------------------------------

/**
 * Walks every .mdx file in archivedPath and injects front matter:
 *   noindex: true
 *   canonical: <BASE_URL>/<subdir>/latest/<page>   (if matching page exists in latest/)
 *             <BASE_URL>/<subdir>/latest/           (fallback if page was deleted/renamed)
 *
 * Skips files that already have noindex: true.
 * Never overwrites existing canonical values.
 */
function injectNoindexCanonical(archivedPath, latestPath, subdir) {
  const output = execSync(`find "${archivedPath}" -name "*.mdx" -type f`, { encoding: 'utf8' });
  const mdxFiles = output.trim().split('\n').filter(Boolean);

  let tagged = 0, withSpecificCanonical = 0;

  for (const filePath of mdxFiles) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Already tagged — skip
    if (content.includes('noindex: true')) continue;

    // Determine canonical URL
    const relPath = path.relative(archivedPath, filePath);
    const latestEquivalent = path.join(latestPath, relPath);
    const hasMatch = fs.existsSync(latestEquivalent);
    const canonicalUrl = hasMatch
      ? `${BASE_URL}/${subdir}/latest/${relPath.replace(/\.mdx$/, '')}`
      : `${BASE_URL}/${subdir}/latest/`;
    if (hasMatch) withSpecificCanonical++;

    const injection = `noindex: true\ncanonical: '${canonicalUrl}'`;

    // Inject into existing front matter or prepend a new block
    if (content.startsWith('---\n')) {
      content = content.replace(/^---\n/, `---\n${injection}\n`);
    } else {
      content = `---\n${injection}\n---\n\n${content}`;
    }

    fs.writeFileSync(filePath, content);
    tagged++;
  }

  printSuccess(`Tagged ${tagged} files with noindex (${withSpecificCanonical} specific canonical, ${tagged - withSpecificCanonical} fallback to latest/ root)`);
}

// ---------------------------------------------------------------------------
// Navigation (docs.json)
// ---------------------------------------------------------------------------

/**
 * Deep-clones obj, replacing string values that start with fromPrefix.
 */
function cloneWithPathRewrite(obj, fromPrefix, toPrefix) {
  if (typeof obj === 'string') return obj.startsWith(fromPrefix) ? toPrefix + obj.slice(fromPrefix.length) : obj;
  if (Array.isArray(obj)) return obj.map(x => cloneWithPathRewrite(x, fromPrefix, toPrefix));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = cloneWithPathRewrite(obj[k], fromPrefix, toPrefix);
    return out;
  }
  return obj;
}

/**
 * Updates docs.json navigation for a freeze:
 *
 * - Clones the 'latest' nav entry → new archive entry with paths latest/ → archiveVersion/
 * - Updates the 'latest' entry's display version label and "Latest" tag
 * - Keeps 'next' hidden and untouched
 *
 * If no 'latest' entry exists yet (first freeze), falls back to cloning from 'next'.
 */
function updateNavigation(subdir, archiveVersion, newDisplayVersion) {
  const docsJsonPath = path.join(__dirname, '..', '..', 'docs.json');
  const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));

  const dropdownLabel = subdir.toUpperCase();
  if (!docsJson.navigation) docsJson.navigation = {};
  if (!Array.isArray(docsJson.navigation.dropdowns)) docsJson.navigation.dropdowns = [];

  let dropdown = docsJson.navigation.dropdowns.find(d => d.dropdown === dropdownLabel);
  if (!dropdown) {
    dropdown = { dropdown: dropdownLabel, versions: [] };
    docsJson.navigation.dropdowns.push(dropdown);
  }
  if (!Array.isArray(dropdown.versions)) dropdown.versions = [];

  // Find the 'latest' nav entry by checking tab paths for /subdir/latest/
  const latestEntry = dropdown.versions.find(v =>
    (v.tabs || []).some(t => JSON.stringify(t).includes(`${subdir}/latest/`))
  );

  // Fall back to 'next' entry if no 'latest' yet
  const templateEntry = latestEntry || dropdown.versions.find(v => v.version === 'next');
  if (!templateEntry) {
    throw new Error(`No 'latest' or 'next' nav entry found for ${dropdownLabel}. Add one before freezing.`);
  }

  const fromPrefix = latestEntry ? `${subdir}/latest/` : `${subdir}/next/`;

  // Clone template → archive entry
  const archiveEntry = cloneWithPathRewrite(templateEntry, fromPrefix, `${subdir}/${archiveVersion}/`);
  archiveEntry.version = archiveVersion;
  delete archiveEntry.tag;
  delete archiveEntry.hidden;

  // Update the 'latest' entry display version and badge
  if (latestEntry) {
    latestEntry.version = newDisplayVersion;
    latestEntry.tag = 'Latest';
    delete latestEntry.hidden;
  } else {
    // First freeze: clone next → latest entry, add it
    const newLatestEntry = cloneWithPathRewrite(templateEntry, `${subdir}/next/`, `${subdir}/latest/`);
    newLatestEntry.version = newDisplayVersion;
    newLatestEntry.tag = 'Latest';
    delete newLatestEntry.hidden;
    dropdown.versions.unshift(newLatestEntry);
  }

  // Remove existing entry for this archive version if present
  dropdown.versions = dropdown.versions.filter(v => v.version !== archiveVersion);

  // Rebuild order: [latest, ...stable versions newest-first, next (hidden)]
  const nextEntry  = dropdown.versions.find(v => v.version === 'next');
  const latestNav  = dropdown.versions.find(v => v.tag === 'Latest');
  const stableEntries = dropdown.versions.filter(v => v.version !== 'next' && v.tag !== 'Latest');

  // Insert archive entry in the right place
  stableEntries.push(archiveEntry);
  stableEntries.sort((a, b) => compareVersionsDesc(a.version, b.version));

  // Order: next → latest → stable archived (newest first)
  dropdown.versions = [
    ...(nextEntry  ? [nextEntry]  : []),
    ...(latestNav  ? [latestNav]  : []),
    ...stableEntries,
  ];

  fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2) + '\n');
  printSuccess(`Navigation updated: ${archiveVersion} archived, latest labeled as ${newDisplayVersion}`);
}

// ---------------------------------------------------------------------------
// Versions registry update
// ---------------------------------------------------------------------------

function updateVersionsRegistry({ subdir, archiveVersion, newDisplayVersion }) {
  const { data, path: versionsPath } = loadVersionsRegistry();
  if (!data.products[subdir]) data.products[subdir] = { versions: [], defaultVersion: 'latest' };

  const product = data.products[subdir];

  // Add archive version if not present
  if (archiveVersion && !product.versions.includes(archiveVersion)) {
    product.versions.push(archiveVersion);
  }

  // Ensure latest and next are tracked
  const repoRoot = path.join(__dirname, '..', '..');
  if (fs.existsSync(path.join(repoRoot, subdir, 'latest')) && !product.versions.includes('latest')) {
    product.versions.unshift('latest');
  }
  if (fs.existsSync(path.join(repoRoot, subdir, 'next')) && !product.versions.includes('next')) {
    product.versions.push('next');
  }

  // Sort: special first, then stable newest-first
  const stable  = product.versions.filter(v => /^v\d+\.\d+/.test(v)).sort(compareVersionsDesc);
  const special = ['latest', 'next'].filter(s => product.versions.includes(s));
  product.versions = [...special, ...stable];

  product.defaultVersion = 'latest';
  if (newDisplayVersion) product.latestDisplayVersion = newDisplayVersion;

  saveVersionsRegistry(data, versionsPath);
  printSuccess(`versions.json updated for ${subdir} (latestDisplayVersion: ${newDisplayVersion})`);
}

// ---------------------------------------------------------------------------
// Version metadata
// ---------------------------------------------------------------------------

function createVersionMetadata(archiveVersion, subdir, newDisplayVersion) {
  const metadataPath = path.join(__dirname, '..', '..', subdir, archiveVersion, '.version-metadata.json');
  const frozenPath   = path.join(__dirname, '..', '..', subdir, archiveVersion, '.version-frozen');
  const metadata = {
    version: archiveVersion,
    frozenDate: new Date().toISOString().split('T')[0],
    frozenTimestamp: new Date().toISOString(),
    nextDisplayVersion: newDisplayVersion
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  fs.writeFileSync(frozenPath, `${archiveVersion} - Frozen on ${metadata.frozenDate}`);
  printSuccess('Version metadata created');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const interactive = !['1', 'true', 'yes'].includes(String(process.env.NON_INTERACTIVE || '').toLowerCase());

  // 1. Subdir
  const choices = listDocsSubdirs();
  let subdir;
  if (interactive) {
    subdir = (await prompt(`Enter the docs subdirectory to freeze [${choices.join(', ')}]: `)).trim();
  } else {
    subdir = process.env.DOCS_SUBDIR || process.env.SUBDIR;
  }
  if (!subdir) { printError('No subdirectory provided'); process.exit(1); }

  const repoRoot    = path.join(__dirname, '..', '..');
  const latestPath  = path.join(repoRoot, subdir, 'latest');
  const nextPath    = path.join(repoRoot, subdir, 'next');
  const hasLatest   = fs.existsSync(latestPath);
  const hasNext     = fs.existsSync(nextPath);

  // Load registry to get latestDisplayVersion
  const { data: registry } = loadVersionsRegistry();
  const product = registry.products && registry.products[subdir];
  const storedDisplayVersion = product && product.latestDisplayVersion;

  console.log('\n' + '='.repeat(50));
  console.log('   Documentation Version Manager');
  console.log('='.repeat(50));
  console.log(`\n Subdir:  ${colors.blue}${subdir}${colors.reset}`);
  console.log(` latest/: ${hasLatest ? colors.green + 'exists' : colors.yellow + 'not yet created'}${colors.reset}`);
  console.log(` next/:   ${hasNext   ? colors.green + 'exists' : colors.red    + 'MISSING'}${colors.reset}`);
  if (storedDisplayVersion) console.log(` Current display version: ${storedDisplayVersion}`);

  if (!hasNext) { printError(`${subdir}/next/ does not exist. Create it before freezing.`); process.exit(1); }

  // 2. Archive version (what to call the outgoing latest/)
  let archiveVersion;
  if (hasLatest) {
    if (interactive) {
      const suggested = storedDisplayVersion ? ` [default: ${storedDisplayVersion}]` : '';
      const input = (await prompt(`Archive version label (what to call the outgoing latest/)${suggested}: `)).trim();
      archiveVersion = input || storedDisplayVersion || '';
    } else {
      archiveVersion = process.env.ARCHIVE_VERSION || storedDisplayVersion;
    }
    if (!archiveVersion || !validateVersionFormat(archiveVersion)) {
      printError(`Invalid archive version: ${archiveVersion}`); process.exit(1);
    }
  } else {
    printInfo('No latest/ found — this is a first-time setup. Skipping archive step.');
  }

  // 3. New display version for latest/ (e.g. "v0.54")
  let newDisplayVersion;
  if (interactive) {
    newDisplayVersion = (await prompt('New display version for latest/ (e.g. v0.54): ')).trim();
  } else {
    newDisplayVersion = process.env.NEW_DISPLAY_VERSION;
  }
  if (!newDisplayVersion || !validateVersionFormat(newDisplayVersion)) {
    printError(`Invalid display version: ${newDisplayVersion}`); process.exit(1);
  }

  // 4. Release notes check
  let shouldFetchReleaseNotes = true;
  if (interactive) {
    const ans = (await prompt('Fetch release notes from upstream if missing? [Y/n]: ')).trim().toLowerCase();
    if (ans === 'n' || ans === 'no') shouldFetchReleaseNotes = false;
  }

  console.log(`\n Freezing: ${colors.yellow}${archiveVersion || '(first run)'}${colors.reset} → archive`);
  console.log(` Latest label: ${colors.green}${newDisplayVersion}${colors.reset}\n`);

  try {
    // Step 1: Check / fetch release notes
    if (archiveVersion && !(await checkReleaseNotes(archiveVersion, subdir))) {
      if (shouldFetchReleaseNotes) {
        printInfo(`Release notes missing for ${archiveVersion}. Fetching from GitHub...`);
        try {
          execSync(`node "${path.join(__dirname, 'manage-changelogs.js')}" --product ${subdir} --target ${hasLatest ? 'latest' : 'next'} --freeze`, { stdio: 'inherit' });
        } catch { printWarning('Failed to fetch release notes automatically. Proceeding.'); }
      }
    }

    // Step 2: Archive latest/ → <archiveVersion>/
    let archivedPath;
    if (hasLatest && archiveVersion) {
      const result = archiveLatest(archiveVersion, subdir);
      archivedPath = result.targetPath;

      // Inject noindex + canonical into the archive
      printInfo('Injecting noindex and canonical into archived version...');
      injectNoindexCanonical(archivedPath, latestPath, subdir);

      // Generate version-specific changelog for the archive
      printInfo(`Generating changelog for ${archiveVersion}...`);
      try {
        execSync(`node "${path.join(__dirname, 'manage-changelogs.js')}" --product ${subdir} --target ${archiveVersion} --freeze`, { stdio: 'inherit' });
        printSuccess('Changelog generated');
      } catch { printWarning('Failed to generate changelog. Proceeding.'); }
    }

    // Step 3: Promote next/ → latest/
    promoteNextToLatest(subdir);

    // Step 4: Update navigation and registry
    if (archiveVersion) {
      updateNavigation(subdir, archiveVersion, newDisplayVersion);
      updateVersionsRegistry({ subdir, archiveVersion, newDisplayVersion });
      createVersionMetadata(archiveVersion, subdir, newDisplayVersion);
    } else {
      // First-time: just update versions.json to record the new latest
      updateVersionsRegistry({ subdir, archiveVersion: null, newDisplayVersion });
      printWarning('docs.json not updated (no archive version). Add the latest/ nav entry manually or re-run after latest/ is established.');
    }

    console.log('\n' + '='.repeat(50));
    console.log(' Version freeze completed!');
    console.log('='.repeat(50));
    if (archiveVersion) console.log(`   ✓ ${archiveVersion} archived at ${subdir}/${archiveVersion}/ (noindex injected)`);
    console.log(`   ✓ next/ promoted → latest/ (now labeled ${newDisplayVersion})`);
    console.log(`   ✓ Navigation and registry updated`);
    console.log(`\n   next/ is unchanged and continues as the dev workspace.\n`);

  } catch (error) {
    printError(`Version freeze failed: ${error.message}`);
    process.exit(1);
  }
}

main();
