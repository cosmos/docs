#!/usr/bin/env node

/**
 * Unified Changelog Management Script
 *
 * Usage:
 *   # Generate changelog for 'next' (all versions)
 *   node manage-changelogs.js --product evm --target next
 *
 *   # Generate changelog for specific version (e.g., v0.5.x releases for v0.5.0 directory)
 *   node manage-changelogs.js --product evm --target v0.5.0 --filter v0.5
 *
 *   # Generate all changelogs for a product
 *   node manage-changelogs.js --product evm --all
 *
 *   # Called by versioning script during version freeze
 *   node manage-changelogs.js --product evm --target v0.5.0 --freeze
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    product: 'evm',
    target: null,
    filter: null,
    all: false,
    freeze: false,
    source: 'main',
    staging: false,
    unreleasedAs: null,
    currentOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--product':
        config.product = args[++i];
        break;
      case '--target':
        config.target = args[++i];
        break;
      case '--filter':
        config.filter = args[++i];
        break;
      case '--all':
        config.all = true;
        break;
      case '--freeze':
        config.freeze = true;
        break;
      case '--source':
        config.source = args[++i];
        break;
      case '--staging':
        config.staging = true;
        break;
      case '--unreleased-as':
        config.unreleasedAs = args[++i];
        break;
      case '--current-only':
        config.currentOnly = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
Unified Changelog Management Script

Usage:
  node manage-changelogs.js [options]

Options:
  --product <name>      Product name (evm, sdk, ibc, etc.) [default: evm]
  --target <version>    Target version directory (next, v0.5.0, v0.4.x, etc.)
  --filter <pattern>    Version filter pattern (v0.5, v0.4, etc.)
  --all                 Generate changelogs for all versions of the product
  --freeze              Flag indicating this is a version freeze operation
  --source <ref>        Git ref to fetch from (main, tag, etc.) [default: main]
  --staging             Output to ./tmp directory instead of actual locations
  --help                Show this help message

Examples:
  # Generate 'next' changelog with all versions
  node manage-changelogs.js --product evm --target next

  # Generate v0.5.0 changelog with only v0.5.x releases
  node manage-changelogs.js --product evm --target v0.5.0 --filter v0.5

  # Generate all changelogs for EVM
  node manage-changelogs.js --product evm --all

  # Test generation for all products (output to ./tmp)
  node manage-changelogs.js --product evm --all --staging

  # Called during version freeze
  node manage-changelogs.js --product evm --target v0.5.0 --freeze
`);
}

// Load product configuration from versions.json
function getProductConfig(product) {
  const versionsPath = path.join(__dirname, '..', '..', 'versions.json');
  let config = {};

  if (fs.existsSync(versionsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
      if (data.products && data.products[product]) {
        config = data.products[product];
      }
    } catch (e) {
      console.warn('Could not load versions.json, using defaults');
    }
  }

  const defaultRepos = {
    evm: 'cosmos/evm',
    sdk: 'cosmos/cosmos-sdk',
    ibc: 'cosmos/ibc-go',
    hub: 'cosmos/gaia',
  };

  return {
    repository: config.repository || defaultRepos[product] || `cosmos/${product}`,
    changelogPath: config.changelogPath || 'CHANGELOG.md',
    versions: config.versions || ['next'],
  };
}

// Fetch changelog from repository
async function fetchChangelog(repo, source, changelogPath) {
  console.log(`  Fetching changelog from ${repo}: ${source}...`);

  const changelogPaths = [
    changelogPath,
    'CHANGELOG.md',
    'RELEASE_NOTES.md',
    'RELEASES.md',
    'CHANGELOG/CHANGELOG.md',
    'docs/CHANGELOG.md',
  ];

  const errors = [];
  for (const p of changelogPaths) {
    const url = `https://raw.githubusercontent.com/${repo}/${source}/${p}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        errors.push(`${p}: ${response.status}`);
        continue;
      }
      let changelog = await response.text();
      if (changelog && changelog.trim().length > 0) {
        // Remove HTML comments
        changelog = changelog.replace(/<!--[\s\S]*?-->/g, '');
        console.log(`  ✓ Fetched ${p} (${changelog.split('\n').length} lines)`);
        return changelog;
      }
      errors.push(`${p}: empty`);
    } catch (err) {
      errors.push(`${p}: ${err.message}`);
    }
  }

  throw new Error(`Failed to fetch changelog from ${repo}. Tried: ${errors.join('; ')}`);
}

// --- MDX-safe passthrough -------------------------------------------------
// The upstream changelog is already markdown, and MDX is a superset of it, so
// release-note bodies are copied through verbatim rather than decomposed into a
// data structure and rebuilt. Only two textual transforms are applied: heading
// demotion and escaping of characters MDX would read as JSX. Because the body is
// never reconstructed, no shape of markdown in it can be silently dropped.

// `<` opens a JSX element and `{` opens an expression, so both break the MDX
// build when they appear in prose. Inside code they are literal, and must be
// left alone.
function escapeMdxOutsideCode(line) {
  // String.split with a capturing group yields the code spans at odd indices.
  return line
    .split(/(`+[^`]*`+)/g)
    .map((part, i) =>
      i % 2 ? part : part.replace(/</g, '&lt;').replace(/\{/g, '&#123;')
    )
    .join('');
}

function mapOutsideFences(lines, fn) {
  let inFence = false;
  return lines.map(line => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    return inFence ? line : fn(line);
  });
}

const escapeMdx = lines => mapOutsideFences(lines, escapeMdxOutsideCode);

// Products differ in bullet marker (`*` upstream in the SDK, `-` in CometBFT).
// Normalizing keeps generated output uniform and, more usefully, keeps a
// regeneration diff limited to real content changes. Indentation is preserved so
// nesting depth survives.
const normalizeBullets = lines =>
  mapOutsideFences(lines, line =>
    line.replace(/^(\s*)\*(\s)/, '$1-$2').replace(/\s+$/, '')
  );

// Upstream sections are h3; inside <Update> they should render a level higher.
const demoteHeadings = lines =>
  mapOutsideFences(lines, line =>
    line.replace(/^(#{3,6})(\s+)/, (_, hashes, sp) => hashes.slice(1) + sp)
  );

// Upstream occasionally leaves a bullet marker with no text after it, which
// renders as a stray empty list item.
const dropEmptyBullets = lines =>
  mapOutsideFences(lines, line => (/^\s*[-*+]\s*$/.test(line) ? null : line)).filter(
    line => line !== null
  );

// Upstream ships section headers with nothing under them (e.g. a bare
// "### DEPENDENCIES"); rendering those as empty headings looks like a bug.
function dropEmptyHeadings(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^#{2,6}\s+/.test(lines[i])) {
      let hasContent = false;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{2,6}\s+/.test(lines[j])) break;
        if (lines[j].trim()) {
          hasContent = true;
          break;
        }
      }
      if (!hasContent) continue;
    }
    out.push(lines[i]);
  }
  return out;
}

function trimBlankEdges(lines) {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b);
}

// Slice the changelog on `##` version boundaries. Only header lines are
// interpreted; everything between them is body text.
function sliceByVersion(content, versionFilter = null, unreleasedAs = null) {
  const lines = content.split('\n');
  const updates = [];
  let current = null;
  let skipping = true;

  const flush = () => {
    if (!current) return;
    let body = trimBlankEdges(current.lines);

    // Some products put the release date on its own italic line under the
    // header rather than in it; lift it into the label instead of leaving it
    // stranded at the top of the body.
    if (body.length) {
      // Italic or bold, and upstream is inconsistent about the space after the
      // comma (e.g. "*January 23,2026*").
      const d = body[0].match(/^\*{1,2}([A-Z][a-z]+ \d{1,2},\s*\d{4})\*{1,2}$/);
      if (d) {
        if (!current.date) current.date = d[1].replace(/,\s*/, ', ');
        body = trimBlankEdges(body.slice(1));
      }
    }

    body = trimBlankEdges(
      dropEmptyHeadings(dropEmptyBullets(normalizeBullets(escapeMdx(demoteHeadings(body)))))
    );
    if (body.length) {
      updates.push({
        version: current.version,
        date: current.date,
        body: body.join('\n'),
      });
    }
    current = null;
  };

  for (const line of lines) {
    // Skip the document title
    if (/^#\s+Changelog/i.test(line)) continue;

    if (/^##\s*\[?Unreleased\]?(?:\([^)]*\))?/i.test(line)) {
      flush();
      if (unreleasedAs) {
        current = { version: unreleasedAs, date: '', lines: [] };
        skipping = false;
      } else {
        skipping = true;
      }
      continue;
    }

    const versionMatch = line.match(
      /^##\s*\[?([vV]?\d+\.\d+(?:\.(?:\d+|x))?)\]?(?:\([^)]*\))?\s*(?:-\s*(.+))?$/
    );
    if (versionMatch) {
      flush();
      current = {
        version: versionMatch[1],
        date: (versionMatch[2] || '').trim(),
        lines: [],
      };
      skipping = false;
      continue;
    }

    if (skipping || !current) continue;
    current.lines.push(line);
  }
  flush();

  // Fallback: a changelog with no recognizable version headers is emitted whole
  // rather than dropped, so a format change surfaces as odd output, not silence.
  if (updates.length === 0 && !versionFilter) {
    const body = trimBlankEdges(dropEmptyBullets(normalizeBullets(escapeMdx(demoteHeadings(content.split('\n'))))));
    if (body.length) {
      console.warn('  ⚠ No version headers found; emitting changelog as one entry');
      return [{ version: 'latest', date: '', body: body.join('\n') }];
    }
  }

  return versionFilter
    ? updates.filter(u => u.version.startsWith(versionFilter))
    : updates;
}

function generateMintlifyContent(updates, repo, product, target) {
  const productLabel = product.toUpperCase();
  const versionLabel = updates[0]?.version || target;
  const changelogUrl = `https://github.com/${repo}/blob/main/CHANGELOG.md`;

  const content = `---
title: "Changelog"
description: "Release history and changelog for Cosmos ${productLabel}"
mode: "wide"
---

<Info>
  This page tracks releases and changes for ${versionLabel}. For the full release history, see the [CHANGELOG](${changelogUrl}) on GitHub.
</Info>

${updates
  .map(update => {
    const label = update.date || 'Release';
    return `<Update label="${label}" description="${update.version}" tags={["${productLabel}", "Release"]}>
${update.body}
</Update>`;
  })
  .join('\n\n')}
`;

  return content;
}

// Write changelog to file
function writeChangelog(content, product, target, staging = false) {
  let outputPath;

  if (staging) {
    // Output to ./tmp directory for testing
    const tmpDir = path.join(__dirname, '..', '..', 'tmp', 'changelogs', product, target);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    outputPath = path.join(tmpDir, 'release-notes.mdx');
  } else {
    // Normal output path
    outputPath = path.join(__dirname, '..', '..', product, target, 'changelog', 'release-notes.mdx');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  fs.writeFileSync(outputPath, content);
  const versionCount = (content.match(/<Update/g) || []).length;

  if (staging) {
    console.log(`  ✓ [STAGING] Written to ${outputPath} with ${versionCount} version(s)`);
  } else {
    console.log(`  ✓ Updated ${outputPath} with ${versionCount} version(s)`);
  }

  return { outputPath, versionCount };
}

// Determine version filter from target
function getVersionFilter(target) {
  if (target === 'next') return null;

  // Extract version pattern (e.g., v0.5.0 -> v0.5, v0.4.x -> v0.4)
  const match = target.match(/^(v?\d+\.\d+)/);
  return match ? match[1] : null;
}

// Generate changelog for a specific target
async function generateChangelog(config, productConfig, target) {
  console.log(`\nGenerating changelog for ${config.product}/${target}...`);

  const versionFilter = config.filter || getVersionFilter(target);
  const changelog = await fetchChangelog(
    productConfig.repository,
    config.source,
    productConfig.changelogPath
  );

  let updates = sliceByVersion(changelog, versionFilter, config.unreleasedAs);

  if (config.currentOnly) updates = updates.slice(0, 1);

  if (updates.length === 0) {
    console.warn(`  ⚠ No versions found matching filter: ${versionFilter || 'none'}`);
    return null;
  }

  const content = generateMintlifyContent(
    updates,
    productConfig.repository,
    config.product,
    target
  );

  const result = writeChangelog(content, config.product, target, config.staging);
  console.log(`  Versions: ${updates.map(u => u.version).join(', ')}`);

  return result;
}

// Main execution
async function main() {
  const config = parseArgs();

  if (!config.target && !config.all) {
    console.error('Error: Must specify either --target or --all');
    printHelp();
    process.exit(1);
  }

  const productConfig = getProductConfig(config.product);

  console.log(`Changelog Management for ${config.product}`);
  console.log(`Repository: ${productConfig.repository}`);

  try {
    if (config.all) {
      // Generate changelogs for all versions
      console.log(`\nGenerating all changelogs for ${config.product}...`);

      for (const version of productConfig.versions) {
        await generateChangelog(config, productConfig, version);
      }

      console.log(`\n✓ All changelogs generated for ${config.product}`);
    } else {
      // Generate changelog for specific target
      await generateChangelog(config, productConfig, config.target);

      console.log(`\n✓ Changelog generation completed`);
    }
  } catch (error) {
    console.error(`\n✗ Failed to generate changelog:`, error.message);
    process.exit(1);
  }
}

main();
