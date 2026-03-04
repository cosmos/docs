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
  const repoRoot = path.join(__dirname, '..', '..');
  if (!fs.existsSync(repoRoot)) return [];
  // List subdirectories at repo root that are products (evm, sdk, ibc, hub, etc.)
  // Filter out non-product directories
  const allDirs = fs.readdirSync(repoRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !name.startsWith('.') && name !== 'node_modules' && name !== 'scripts' && name !== 'snippets' && name !== 'assets');

  // Only return directories that have version subdirectories (next, v0.x.x, etc.)
  return allDirs.filter(dirName => {
    const dirPath = path.join(repoRoot, dirName);
    const contents = fs.readdirSync(dirPath, { withFileTypes: true });
    return contents.some(d => d.isDirectory() && (d.name === 'next' || /^v\d+/.test(d.name)));
  });
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

  // Ensure products object exists
  if (!data.products || typeof data.products !== 'object') {
    data = { products: {} };
  }

  // Auto-discover products from repo root and merge with existing config
  const subdirs = listDocsSubdirs();
  for (const subdir of subdirs) {
    const base = path.join(__dirname, '..', '..', subdir);
    const entries = fs.readdirSync(base, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    // Discover versions from filesystem
    const discoveredVersions = [];
    if (entries.includes('next')) discoveredVersions.push('next');
    for (const name of entries) {
      if (/^v\d+\.\d+(?:\.(?:\d+|x))?$/.test(name)) {
        discoveredVersions.push(name);
      }
    }

    // Merge with existing product config or create new
    if (!data.products[subdir]) {
      // New product - create default config
      data.products[subdir] = {
        versions: discoveredVersions,
        defaultVersion: entries.includes('next') ? 'next' : discoveredVersions[0] || 'next',
        repository: `cosmos/${subdir}`,
        changelogPath: 'CHANGELOG.md'
      };
    } else {
      // Existing product - merge discovered versions with configured ones
      const existingVersions = data.products[subdir].versions || [];
      const mergedVersions = Array.from(new Set([...discoveredVersions, ...existingVersions]));

      // Ensure 'next' is always first if it exists
      const hasNext = mergedVersions.includes('next');
      const otherVersions = mergedVersions.filter(v => v !== 'next').sort(compareVersionsDesc);
      data.products[subdir].versions = hasNext ? ['next', ...otherVersions] : otherVersions;

      // Ensure defaultVersion is set
      if (!data.products[subdir].defaultVersion) {
        data.products[subdir].defaultVersion = hasNext ? 'next' : otherVersions[0] || 'next';
      }

      // Ensure repository is set
      if (!data.products[subdir].repository) {
        data.products[subdir].repository = `cosmos/${subdir}`;
      }

      // Ensure changelogPath is set
      if (!data.products[subdir].changelogPath) {
        data.products[subdir].changelogPath = 'CHANGELOG.md';
      }
    }
  }

  return { data, path: versionsPath };
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
  const releaseNotesPath = path.join(__dirname, '..', '..', subdir, 'next', 'changelog', 'release-notes.mdx');
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
  const nextPath = path.join(__dirname, '..', '..', subdir, 'next');
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

  // Try to find 'next' version first, if not use the latest version as template
  let nextVersion = dropdown.versions.find(v => v.version === 'next');
  let templateVersion = nextVersion;

  if (!nextVersion) {
    // If 'next' doesn't exist, try to use the latest existing version as template
    if (dropdown.versions.length > 0) {
      // Use the first version (should be the most recent) as template
      templateVersion = dropdown.versions[0];
      printWarning(`No 'next' version found. Using '${templateVersion.version}' as template for creating frozen version '${version}'.`);

      // Create a 'next' version from the template
      nextVersion = updatePaths(templateVersion, `${subdir}/${templateVersion.version}/`, `${subdir}/next/`);
      if (nextVersion && typeof nextVersion === 'object') {
        nextVersion.version = 'next';
      }
    } else {
      throw new Error(`No versions found in navigation for dropdown ${dropdownLabel}.

Please add at least one version entry to docs.json before freezing:
{
  "dropdown": "${dropdownLabel}",
  "versions": [
    {
      "version": "next",
      "tabs": [ /* your navigation structure */ ]
    }
  ]
}`);
    }
  }

  // Create the frozen version navigation from the template
  const sourcePrefix = templateVersion.version === 'next'
    ? `${subdir}/next/`
    : `${subdir}/${templateVersion.version}/`;
  const targetPrefix = `${subdir}/${version}/`;

  const versionedNavigation = updatePaths(templateVersion, sourcePrefix, targetPrefix);
  if (versionedNavigation && typeof versionedNavigation === 'object') {
    versionedNavigation.version = version;
  }

  // Now reorganize versions list:
  // 1. Remove the version being added if it already exists
  dropdown.versions = dropdown.versions.filter(v => v.version !== version);

  // 2. Separate 'next' from other versions
  const nextEntry = dropdown.versions.find(v => v.version === 'next');
  const otherVersions = dropdown.versions.filter(v => v.version !== 'next');

  // 3. Add the new frozen version at the top of other versions
  otherVersions.unshift(versionedNavigation);

  // 4. Rebuild versions list with frozen versions first, then 'next' at the bottom
  dropdown.versions = [...otherVersions];

  // 5. Always ensure 'next' exists at the bottom
  if (!dropdown.versions.find(v => v.version === 'next')) {
    dropdown.versions.push(nextVersion);
  }

  fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2) + '\n');
  printSuccess(`Navigation updated for version ${version}`);
  if (!nextEntry) {
    printSuccess(`Added 'next' version to navigation (will remain at bottom for continued development)`);
  }
}

function copyAndUpdateDocs(currentVersion, subdir) {
  printInfo('Creating version directory...');

  // The 'next' directory is the working directory containing latest documentation.
  // It gets COPIED to create a frozen version snapshot, but the original 'next' remains unchanged
  // for continued development. This allows us to:
  // 1. Preserve historical documentation at <subdir>/<version>/
  // 2. Continue updating docs in <subdir>/next/ for future releases
  const sourcePath = path.join(__dirname, '..', '..', subdir, 'next');
  const targetPath = path.join(__dirname, '..', '..', subdir, currentVersion);

  // Verify source exists
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source directory does not exist: ${sourcePath}\n\nThe 'next' directory must exist before freezing a version.`);
  }

  // Reset target to avoid nested 'next/' and copy contents
  execSync(`rm -rf "${targetPath}" && mkdir -p "${targetPath}"`);
  execSync(`cp -R "${sourcePath}/." "${targetPath}/"`);

  // Update internal links in frozen version only (source 'next' remains unchanged)
  printInfo('Updating internal links in frozen version...');
  // Convert /{subdir}/next/ links to /{subdir}/{version}/
  const findCmd = `find "${targetPath}" -name "*.mdx" -type f -exec sed -i '' "s|/${subdir}/next/|/${subdir}/${currentVersion}/|g" {} \\;`;
  execSync(findCmd);

  // Convert incomplete paths that are missing the subdir prefix
  // /documentation/ → /{subdir}/{version}/documentation/
  const fixRelativeCmd = `find "${targetPath}" -name "*.mdx" -type f -exec sed -i '' 's|href="/documentation/|href="/${subdir}/${currentVersion}/documentation/|g' {} \\;`;
  execSync(fixRelativeCmd);

  printSuccess(`Documentation copied from 'next' to '${currentVersion}' and links updated`);
  printInfo(`The 'next' directory remains unchanged for continued development`);
}

function createVersionMetadata(currentVersion, newVersion, subdir) {
  const metadataPath = path.join(__dirname, '..', '..', subdir, currentVersion, '.version-metadata.json');
  const frozenPath = path.join(__dirname, '..', '..', subdir, currentVersion, '.version-frozen');

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
    printWarning(`Subdirectory "${subdir}" not found at repo root. Proceeding anyway.`);
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
          execSync(`node "${path.join(__dirname, 'manage-changelogs.js')}" --product ${subdir} --target next --freeze`, { stdio: 'inherit' });
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

    // 2.5. Generate version-specific changelog for frozen version
    printInfo(`Generating version-specific changelog for ${currentVersion}...`);
    try {
      execSync(`node "${path.join(__dirname, 'manage-changelogs.js')}" --product ${subdir} --target ${currentVersion} --freeze`, { stdio: 'inherit' });
      printSuccess('Version-specific changelog generated');
    } catch (e) {
      printWarning('Failed to generate version-specific changelog. Proceeding.');
    }

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
    console.log(`   ✓ Version ${currentVersion} frozen at ${subdir}/${currentVersion}/`);
    console.log(`   ✓ Development continues with ${newVersion} in ${subdir}/next/`);
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
