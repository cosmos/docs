#!/usr/bin/env node

/**
 * Documentation Version Manager
 * Main orchestration script for documentation version freezing
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Color codes for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function printInfo(msg) {
  console.log(`${colors.blue}${colors.reset} ${msg}`);
}

function printSuccess(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function printWarning(msg) {
  console.log(`${colors.yellow}${colors.reset} ${msg}`);
}

function printError(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

function listDocsSubdirs() {
  const docsRoot = path.join(__dirname, '..', '..', 'docs');
  if (!fs.existsSync(docsRoot)) return [];
  return fs
    .readdirSync(docsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !name.startsWith('.'));
}

// --- Versions registry helpers (per-product) ---
function loadVersionsRegistry() {
  const versionsPath = path.join(__dirname, '..', '..', 'versions.json');
  let data = {};
  if (fs.existsSync(versionsPath)) {
    try {
      data = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
    } catch (e) {
      data = {};
    }
  }

  // If already in new schema, return as-is
  if (data && data.products && typeof data.products === 'object') {
    return { data, path: versionsPath };
  }

  // Migrate old schema to new per-product schema by discovery
  const products = {};
  const subdirs = listDocsSubdirs();
  for (const subdir of subdirs) {
    const base = path.join(__dirname, '..', '..', 'docs', subdir);
    const entries = fs.readdirSync(base, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    const versions = [];
    if (entries.includes('next')) versions.push('next');
    for (const name of entries) {
      if (/^v\d+\.\d+(?:\.(?:\d+|x))?$/.test(name)) {
        versions.push(name);
      }
    }
    // Prefer a reasonable default: next if present else highest version
    const defaultVersion = entries.includes('next')
      ? 'next'
      : (versions.filter(v => v !== 'next').sort(compareVersionsDesc)[0] || 'next');
    products[subdir] = {
      versions: Array.from(new Set(versions)),
      defaultVersion
    };
  }

  return { data: { products }, path: versionsPath };
}

function saveVersionsRegistry(registry, versionsPath) {
  fs.writeFileSync(versionsPath, JSON.stringify(registry, null, 2) + '\n');
}

// Accepts vX.Y, vX.Y.Z, or vX.Y.x
function validateVersionFormat(version) {
  return /^v\d+\.\d+(?:\.(?:\d+|x))?$/.test(version);
}

function parseVersionTuple(v) {
  // Returns [major, minor, patchNum, isX]
  const m = v.match(/^v(\d+)\.(\d+)(?:\.(\d+|x))?$/);
  if (!m) return null;
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  const patch = m[3] === undefined ? 0 : (m[3] === 'x' ? Number.POSITIVE_INFINITY : parseInt(m[3], 10));
  const isX = m[3] === 'x';
  return [major, minor, patch, isX];
}

function compareVersionsDesc(a, b) {
  const at = parseVersionTuple(a) || [0, 0, -1, false];
  const bt = parseVersionTuple(b) || [0, 0, -1, false];
  if (bt[0] !== at[0]) return bt[0] - at[0];
  if (bt[1] !== at[1]) return bt[1] - at[1];
  if (bt[2] !== at[2]) return bt[2] - at[2];
  // Prefer specific patch over x for the same major/minor
  if (bt[3] !== at[3]) return (at[3] ? 1 : -1);
  return 0;
}

function getCurrentVersion(subdir) {
  try {
    const envCurrent = process.env.CURRENT_VERSION || process.env.FREEZE_VERSION;
    if (envCurrent) return envCurrent;
    // No implicit selection to avoid overwriting an existing frozen version.
    // Prompt the operator to specify the version to freeze.
    return null;
  } catch (error) {
    return null;
  }
}

function includesVersionInReleaseNotes(content, version) {
  if (!content || !version) return false;
  const minorOnly = /^v\d+\.\d+$/.test(version);
  const tuple = parseVersionTuple(version);
  if (!tuple) {
    return content.includes(`"${version}"`);
  }
  const [major, minor, patch, isX] = tuple;
  let re;
  if (isX) {
    // Match any patch or x for same major.minor
    re = new RegExp(`<Update[^>]*version="v?${major}\\.${minor}\\.(?:\\d+|x)"`);
  } else if (minorOnly) {
    // Provided only major.minor → accept optional patch
    re = new RegExp(`<Update[^>]*version="v?${major}\\.${minor}(?:\\.\\d+)?"`);
  } else {
    // Exact version
    re = new RegExp(`<Update[^>]*version="v?${major}\\.${minor}\\.${patch}"`);
  }
  return re.test(content);
}

async function checkReleaseNotes(currentVersion, subdir) {
  const releaseNotesPath = path.join(__dirname, '..', '..', 'docs', subdir, 'next', 'changelog', 'release-notes.mdx');
  if (!fs.existsSync(releaseNotesPath)) return false;
  const content = fs.readFileSync(releaseNotesPath, 'utf8');
  return includesVersionInReleaseNotes(content, currentVersion);
}

function updateVersionsRegistry({ subdir, freezeVersion, newVersion }) {
  const { data, path: versionsPath } = loadVersionsRegistry();
  if (!data.products) data.products = {};
  if (!data.products[subdir]) data.products[subdir] = { versions: [], defaultVersion: 'next' };

  const product = data.products[subdir];
  // Ensure 'next' appears if folder exists
  const nextPath = path.join(__dirname, '..', '..', 'docs', subdir, 'next');
  if (fs.existsSync(nextPath) && !product.versions.includes('next')) {
    product.versions.push('next');
  }
  if (freezeVersion && !product.versions.includes(freezeVersion)) {
    product.versions.push(freezeVersion);
  }
  // Maintain stable ordering: newest first for versions (excluding 'next')
  const stable = product.versions.filter(v => v !== 'next' && /^v\d+\.\d+(?:\.(?:\d+|x))?$/.test(v)).sort(compareVersionsDesc);
  const rest = product.versions.filter(v => v === 'next' || !/^v\d+\.\d+(?:\.(?:\d+|x))?$/.test(v));
  product.versions = [...rest, ...stable];

  // Track the upcoming development version label
  if (newVersion && validateVersionFormat(newVersion)) {
    product.nextDev = newVersion;
  }

  saveVersionsRegistry(data, versionsPath);
  printSuccess(`Versions registry updated for ${subdir}`);
}

function updateNavigation(version, subdir) {
  const docsJsonPath = path.join(__dirname, '..', '..', 'docs.json');
  const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));

  // Resolve dropdown label from subdir
  const dropdownLabel = (subdir || '').toUpperCase(); // evm -> EVM, sdk -> SDK, ibc -> IBC

  if (!docsJson.navigation) docsJson.navigation = {};
  if (!Array.isArray(docsJson.navigation.dropdowns)) docsJson.navigation.dropdowns = [];

  // Find or create dropdown for this subdir
  let dropdown = docsJson.navigation.dropdowns.find(d => d.dropdown === dropdownLabel);
  if (!dropdown) {
    dropdown = { dropdown: dropdownLabel, versions: [] };
    docsJson.navigation.dropdowns.push(dropdown);
  }
  if (!Array.isArray(dropdown.versions)) dropdown.versions = [];

  // Get base navigation from this dropdown's 'next' version
  const nextVersion = dropdown.versions.find(v => v.version === 'next');
  if (!nextVersion) {
    throw new Error(`No 'next' version found in navigation for dropdown ${dropdownLabel}. Please add a 'next' entry for ${subdir} in docs.json before freezing.`);
  }

  // Create versioned navigation by updating paths
  function updatePaths(obj, fromPrefix, toPrefix) {
    if (typeof obj === 'string') {
      return obj.startsWith(fromPrefix) ? obj.replace(fromPrefix, toPrefix) : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => updatePaths(item, fromPrefix, toPrefix));
    }
    if (typeof obj === 'object' && obj !== null) {
      const updated = {};
      for (const key in obj) {
        updated[key] = updatePaths(obj[key], fromPrefix, toPrefix);
      }
      return updated;
    }
    return obj;
  }

  const updatedFromNext = updatePaths(nextVersion, `docs/${subdir}/next/`, `docs/${subdir}/${version}/`);
  if (updatedFromNext && typeof updatedFromNext === 'object') {
    delete updatedFromNext.version; // ensure correct version label
  }
  const versionedNavigation = {
    ...updatedFromNext,
    version: version
  };

  // Remove version if it already exists
  const existingIndex = dropdown.versions.findIndex(v => v.version === version);
  if (existingIndex >= 0) {
    dropdown.versions[existingIndex] = versionedNavigation;
  } else {
    dropdown.versions.unshift(versionedNavigation); // Add at beginning
  }

  fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2) + '\n');
  printSuccess(`Navigation updated for version ${version}`);
}

function copyAndUpdateDocs(currentVersion, subdir) {
  printInfo('Creating version directory...');

  // Copy docs/<subdir>/next/ to docs/<subdir>/<VERSION>/ (contents only)
  const sourcePath = path.join(__dirname, '..', '..', 'docs', subdir, 'next');
  const targetPath = path.join(__dirname, '..', '..', 'docs', subdir, currentVersion);
  // reset target to avoid nested 'next/'
  execSync(`rm -rf "${targetPath}" && mkdir -p "${targetPath}"`);
  execSync(`cp -R "${sourcePath}/." "${targetPath}/"`);

  // Update internal links in frozen version
  printInfo('Updating internal links...');
  const findCmd = `find "${targetPath}" -name "*.mdx" -type f -exec sed -i '' "s|/docs/${subdir}/next/|/docs/${subdir}/${currentVersion}/|g" {} \\;`;
  execSync(findCmd);

  // Also ensure any remaining relative docs/ paths are properly prefixed
  const fixRelativeCmd = `find "${targetPath}" -name "*.mdx" -type f -exec sed -i '' 's|href="/docs/documentation/|href="/docs/${subdir}/${currentVersion}/documentation/|g' {} \\;`;
  execSync(fixRelativeCmd);

  printSuccess(`Documentation copied and links updated`);
}

function createVersionMetadata(currentVersion, newVersion, subdir) {
  const metadataPath = path.join(__dirname, '..', '..', 'docs', subdir, currentVersion, '.version-metadata.json');
  const frozenPath = path.join(__dirname, '..', '..', 'docs', subdir, currentVersion, '.version-frozen');

  const metadata = {
    version: currentVersion,
    frozenDate: new Date().toISOString().split('T')[0],
    frozenTimestamp: new Date().toISOString(),
    nextVersion: newVersion,
    eipSheetTab: currentVersion
  };

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  fs.writeFileSync(frozenPath, `${currentVersion} - Frozen on ${metadata.frozenDate}`);

  printSuccess('Version metadata created');
}

async function main() {
  // Interactive mode by default for manual execution
  const interactive = !['1','true','yes'].includes(String(process.env.NON_INTERACTIVE || '').toLowerCase());

  // Determine docs subdir to version first
  const choices = listDocsSubdirs();
  let subdir;
  if (interactive) {
    const pretty = choices.length ? ` [${choices.join(', ')}]` : '';
    subdir = (await prompt(`Enter the docs subdirectory to version${pretty}: `)).trim();
  } else {
    subdir = process.env.DOCS_SUBDIR || process.env.SUBDIR;
  }
  if (!subdir) {
    printError('No docs subdirectory provided');
    process.exit(1);
  }
  if (!choices.includes(subdir)) {
    printWarning(`Subdirectory "${subdir}" not found under docs/. Proceeding anyway.`);
  }

  // Load and display versions registry context for the selected product
  const { data: registry } = loadVersionsRegistry();
  const product = registry.products && registry.products[subdir];
  if (product) {
    console.log('\n Product versions (from versions.json):');
    console.log(`   - versions: ${JSON.stringify(product.versions || [])}`);
    if (product.defaultVersion) console.log(`   - defaultVersion: ${product.defaultVersion}`);
    if (product.nextDev) console.log(`   - nextDev: ${product.nextDev}`);
  } else {
    printWarning('No product entry found in versions.json for this subdir. A new entry will be created.');
  }

  // Determine the version we are freezing
  let currentVersion;
  if (interactive) {
    currentVersion = (await prompt('Enter the version to freeze (e.g., v0.4.x): ')).trim();
  } else {
    currentVersion = getCurrentVersion(subdir);
    if (!currentVersion) {
      printError('Freeze version not provided in non-interactive mode');
      process.exit(1);
    }
  }
  if (!validateVersionFormat(currentVersion)) {
    printError(`Invalid freeze version format: ${currentVersion}`);
    process.exit(1);
  }

  // Get new development version from environment or prompt (default to product.nextDev when available)
  let newVersion;
  if (interactive) {
    const defaultDev = product && product.nextDev ? ` [default: ${product.nextDev}]` : '';
    const input = (await prompt(`\nEnter the new development version (e.g., v0.5.0 or v0.5.x)${defaultDev}: `)).trim();
    newVersion = input || (product && product.nextDev) || '';
  } else {
    newVersion = process.env.NEW_VERSION;
  }
  if (!validateVersionFormat(newVersion)) {
    printError(`Invalid new development version format: ${newVersion}`);
    process.exit(1);
  }

  // Confirm release notes fetch intent (still auto if missing, default yes)
  let shouldFetchReleaseNotes = true;
  if (interactive) {
    const ans = (await prompt('If release notes are missing, fetch from the product repo? [Y/n]: ')).trim().toLowerCase();
    if (ans === 'n' || ans === 'no') shouldFetchReleaseNotes = false;
  }

  console.log('\n' + '='.repeat(50));
  console.log('   Documentation Version Manager');
  console.log('='.repeat(50));
  console.log(`\n Subdir:   ${colors.blue}${subdir}${colors.reset}`);
  console.log(` Freezing: ${colors.yellow}${currentVersion}${colors.reset}`);
  console.log(` Next dev: ${colors.green}${newVersion}${colors.reset}\n`);

  try {
    // 1. Check release notes and auto-fetch if missing
    if (!(await checkReleaseNotes(currentVersion, subdir))) {
      if (shouldFetchReleaseNotes) {
        printInfo(`Release notes missing for ${currentVersion} in ${subdir}. Fetching from GitHub...`);
        try {
          execSync(`node "${path.join(__dirname, 'release-notes.js')}" latest ${subdir}`, { stdio: 'inherit' });
        } catch (e) {
          printWarning('Failed to fetch release notes automatically (network/permissions). Proceeding.');
        }
        if (!(await checkReleaseNotes(currentVersion, subdir))) {
          printWarning(`${currentVersion} still not found in release notes after fetch.`);
        } else {
          printSuccess('Release notes updated.');
        }
      } else {
        printWarning('Skipping automatic release notes fetch by user choice.');
      }
    }

    // 2. Copy and update documentation
    copyAndUpdateDocs(currentVersion, subdir);

    // 3. Handle Google Sheets and EIP reference (EVM only)
    if (subdir === 'evm') {
      let shouldRunSheets = !['1','true','yes'].includes(String(process.env.SKIP_SHEETS || '').toLowerCase());
      if (interactive) {
        const ans = (await prompt('Create Google Sheets snapshot and versioned EIP reference for EVM? [Y/n]: ')).trim().toLowerCase();
        if (ans === 'n' || ans === 'no') shouldRunSheets = false;
      }
      if (shouldRunSheets) {
        printInfo('Processing Google Sheets and EIP reference (EVM only)...');
        execSync(`node "${path.join(__dirname, 'sheets-manager.js')}" "${currentVersion}" evm`, { stdio: 'inherit' });
      } else {
        printInfo('Skipping Google Sheets/EIP reference');
      }
    } else {
      printInfo('Skipping Google Sheets/EIP reference');
    }

    // 4. Update navigation and versions
    updateNavigation(currentVersion, subdir);
    updateVersionsRegistry({ subdir, freezeVersion: currentVersion, newVersion });

    // 5. Create metadata
    createVersionMetadata(currentVersion, newVersion, subdir);

    console.log('\n' + '='.repeat(50));
    console.log(' Version freeze completed successfully!');
    console.log('='.repeat(50));
    console.log(`\n Status:`);
    console.log(`   ✓ Version ${currentVersion} frozen at docs/${subdir}/${currentVersion}/`);
    console.log(`   ✓ Development continues with ${newVersion} in docs/${subdir}/next/`);
    console.log(`   ✓ Navigation and registry updated`);
    if (subdir === 'evm' && !['1','true','yes'].includes(String(process.env.SKIP_SHEETS || '').toLowerCase())) {
      console.log(`   ✓ Google Sheets tab created: ${currentVersion}`);
    }

  } catch (error) {
    printError(`Version freeze failed: ${error.message}`);
    process.exit(1);
  }
}

main();
