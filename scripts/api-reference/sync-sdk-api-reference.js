#!/usr/bin/env node

/**
 * sync-sdk-api-reference.js
 *
 * Generates the Cosmos SDK API reference for one documented version:
 *
 *   sdk/<version>/api-reference/grpc/<module>.mdx   from the proto descriptor
 *   sdk/<version>/api-reference/rest/openapi.yaml   from upstream's gateway spec
 *
 * and rewrites its own groups in docs.json so a module that appears upstream
 * gets a page and a navigation entry in the same run.
 *
 * Nothing here is a hand-maintained list. The upstream repository and the
 * released version come from versions.json; the module set, the service set and
 * the ordering come from the descriptor. The ref is resolved to a commit SHA
 * before anything is generated, so the output records exactly what it was built
 * from and regenerating at that SHA produces the same bytes.
 *
 * Usage:
 *   node sync-sdk-api-reference.js --version next
 *   node sync-sdk-api-reference.js --version latest --modules auth,bank
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

import { parseArgs, resolveRef } from './lib/refs.js';
import { parseDescriptor } from './lib/descriptor.js';
import { renderModulePage, buildMethodHeadings } from './lib/render.js';
import { buildInventory } from './lib/inventory.js';
import {
  checkScalarAnnotationsDocumented,
  dropFullyDeprecatedModules,
  pruneRemovedModulePages,
  checkWellKnownTypesHandled,
  checkTxEnvelopeDocumented,
} from './lib/checks.js';
import {
  convertToOpenApi3,
  joinSpecToDescriptor,
  applyServers,
  dropIdenticalPathTemplates,
  useProtoFieldNames,
  requireDeclaredFields,
  allowGatewayNulls,
  correctResponseSchemas,
  findSchemaDrift,
  applyInfo,
  moduleFromPath,
} from './lib/openapi.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const PRODUCT = 'sdk';
const BUF = path.join(HERE, 'node_modules/.bin/buf');

const SWAGGER_PATH = 'client/docs/swagger-ui/swagger.yaml';

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cosmos-docs-api-reference',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'cosmos-docs-api-reference' } });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response.text();
}

async function resolveSha(repository, ref) {
  const commit = await fetchJson(`https://api.github.com/repos/${repository}/commits/${ref}`);
  return commit.sha;
}

function buildDescriptor(repository, sha) {
  const out = path.join(os.tmpdir(), `sdk-descriptor-${sha.slice(0, 12)}.json`);
  const input = `https://github.com/${repository}.git#ref=${sha},subdir=proto`;
  execFileSync(BUF, ['build', input, '-o', out], { stdio: ['ignore', 'ignore', 'inherit'] });
  return JSON.parse(fs.readFileSync(out, 'utf8'));
}

function writeFile(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

/**
 * The generator owns its groups in docs.json. A generated page with no
 * navigation entry is unreachable, which is worse than not generating it, so
 * the two are written together and this stays idempotent.
 */
function updateDocsJson(version, moduleNames) {
  const docsPath = path.join(REPO_ROOT, 'docs.json');
  const docs = JSON.parse(fs.readFileSync(docsPath, 'utf8'));

  const dropdown = docs.navigation.dropdowns.find((d) => d.dropdown === 'Cosmos SDK');
  if (!dropdown) throw new Error('docs.json has no Cosmos SDK dropdown');

  // Version entries are labelled with the display version, so the latest/ entry
  // reads "v0.55" and is renamed at every freeze. The directory its pages point
  // at is the stable identifier.
  const prefix = `"${PRODUCT}/${version}/`;
  const entry = dropdown.versions.find((v) => JSON.stringify(v).includes(prefix));
  if (!entry) throw new Error(`no Cosmos SDK version entry serving ${PRODUCT}/${version}/`);

  const base = `${PRODUCT}/${version}/api-reference`;
  const tab = {
    tab: 'API Reference',
    groups: [
      { group: 'Overview', pages: [`${base}/index`, `${base}/transactions`] },
      {
        group: 'gRPC Services',
        pages: [`${base}/grpc/index`, ...moduleNames.map((m) => `${base}/grpc/${m}`)],
      },
      {
        group: 'REST (gRPC Gateway)',
        openapi: { source: `${base}/rest/openapi.yaml`, directory: `${base}/rest` },
      },
    ],
  };

  const existing = entry.tabs.findIndex((t) => t.tab === 'API Reference');
  if (existing >= 0) entry.tabs[existing] = tab;
  else entry.tabs.push(tab);

  fs.writeFileSync(docsPath, `${JSON.stringify(docs, null, 2)}\n`);
}

function filterSpecToModules(spec, moduleNames) {
  const allowed = new Set(moduleNames);
  for (const routePath of Object.keys(spec.paths ?? {})) {
    if (!allowed.has(moduleFromPath(routePath))) delete spec.paths[routePath];
  }
  return spec;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { repository, ref, displayVersion } = resolveRef(args.version, { ref: args.ref });

  console.log(`Resolving ${repository}@${ref}`);
  const sha = await resolveSha(repository, ref);
  const context = { repository, ref, sha, displayVersion, version: args.version };
  console.log(`  ${sha}`);

  console.log('Building proto descriptor');
  const descriptor = buildDescriptor(repository, sha);
  const { modules, types } = parseDescriptor(descriptor);

  let selected = args.modules
    ? modules.filter((m) => args.modules.includes(m.name))
    : modules;
  if (args.modules && selected.length !== args.modules.length) {
    const found = selected.map((m) => m.name);
    throw new Error(`unknown modules: ${args.modules.filter((m) => !found.includes(m)).join(', ')}`);
  }
  const { kept, dropped: fullyDeprecated } = dropFullyDeprecatedModules(selected);
  if (fullyDeprecated.length) {
    console.log(
      `  dropped ${fullyDeprecated.length} module(s) whose every method is deprecated: ${fullyDeprecated.join(', ')}`,
    );
  }
  selected = kept;

  console.log(`  ${selected.length} modules, ${types.messages.size} message types`);

  // One source of truth for method headings, shared by the module pages and
  // the REST cross-links, so an anchor cannot drift from what it points at.
  const headings = buildMethodHeadings(selected);

  const outputRoot = path.join(REPO_ROOT, PRODUCT, args.version, 'api-reference');

  checkWellKnownTypesHandled(types);
  checkTxEnvelopeDocumented(types, outputRoot);
  const annotations = checkScalarAnnotationsDocumented(types, outputRoot);
  console.log(`  ${annotations.length} scalar annotations, all documented`);

  console.log('Rendering module pages');
  for (const module of selected) {
    writeFile(path.join(outputRoot, 'grpc', `${module.name}.mdx`), renderModulePage(module, types, context, headings));
  }

  const inventory = buildInventory(selected);
  writeFile(
    path.join(outputRoot, 'inventory.json'),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
  console.log(`  ${inventory.queries.length} query methods, ${inventory.messages.length} messages`);

  console.log('Converting gateway spec');
  const swaggerUrl = `https://raw.githubusercontent.com/${repository}/${sha}/${SWAGGER_PATH}`;
  const swagger = yaml.load(await fetchText(swaggerUrl));
  let spec = await convertToOpenApi3(swagger);
  if (args.modules) spec = filterSpecToModules(spec, args.modules);

  const { spec: joined, problems, unrepresented } = joinSpecToDescriptor(spec, selected, {
    grpcPagePath: `/${PRODUCT}/${args.version}/api-reference/grpc`,
    headings,
  });

  if (unrepresented.length) {
    console.warn(`  ${unrepresented.length} annotated methods absent from upstream's REST spec:`);
    for (const entry of unrepresented) console.warn(`    ${entry}`);
  }

  if (problems.length) {
    console.error(`\n${problems.length} join problems:`);
    for (const problem of problems) console.error(`  ${problem}`);
    throw new Error('descriptor and REST spec disagree; refusing to emit a reference with unverified cross-links');
  }

  const { renamed } = useProtoFieldNames(joined, types);
  console.log(`  ${renamed} schema properties renamed to proto field names`);

  // Map each operation to the message its 200 response carries, so the inline
  // schemas the validator actually reads get corrected.
  const outputByMethod = new Map();
  for (const module of selected) {
    for (const service of module.services) {
      for (const method of service.methods) {
        outputByMethod.set(`${service.fullName}/${method.name}`, method.outputType);
      }
    }
  }
  // Measured before the correction runs, so it names what upstream lags on.
  // Worth keeping visible: it is the signal that upstream's swagger and its own
  // protos have drifted, and it is worth raising there.
  const drift = findSchemaDrift(joined, types, outputByMethod);
  if (drift.length) {
    console.log(
      `  ${drift.length} response fields upstream's spec omits, added from the protos:`,
    );
    for (const entry of drift.slice(0, 12)) console.log(`    ${entry}`);
    if (drift.length > 12) console.log(`    ... and ${drift.length - 12} more`);
  }

  const inline = correctResponseSchemas(joined, types, outputByMethod);
  console.log(
    `  inline responses: ${inline.marked} nullable, ${inline.strict} strict, ${inline.added} added`,
  );

  // A repaired field the descriptor could not fully describe becomes an open
  // object, which conformance accepts unconditionally and the drift check below
  // reports nothing about, because the property does exist. Under-describing is
  // not a build failure, but it must not be silent.
  if (inline.declined.length) {
    console.warn(`  ${inline.declined.length} repaired fields left under-described:`);
    for (const entry of inline.declined) console.warn(`    ${entry}`);
  }

  // The repair has to close the gap it just reported, or a conformance run
  // fails on a response the generator already knew it was not describing.
  const remaining = findSchemaDrift(joined, types, outputByMethod);
  if (remaining.length) {
    throw new Error(
      `${remaining.length} response fields still absent after the repair: ${remaining.join(', ')}`,
    );
  }

  const { marked } = allowGatewayNulls(joined, types);
  const { strict, exempt } = requireDeclaredFields(joined, types);
  console.log(
    `  ${strict} schemas made strict, ${exempt} exempt for carrying an Any, ` +
      `${marked} properties marked nullable`,
  );

  const { dropped } = dropIdenticalPathTemplates(joined);
  if (dropped.length) {
    console.warn(`  dropped ${dropped.length} routes that OpenAPI cannot represent alongside their siblings:`);
    for (const routePath of dropped) console.warn(`    ${routePath}`);
  }

  applyInfo(applyServers(joined), context);
  writeFile(path.join(outputRoot, 'rest', 'openapi.yaml'), yaml.dump(joined, { lineWidth: 100, noRefs: true }));
  console.log(`  ${Object.keys(joined.paths).length} REST paths`);

  const pruned = pruneRemovedModulePages(outputRoot, selected.map((m) => m.name));
  if (pruned.length) console.log(`  pruned ${pruned.length} page(s) for modules no longer documented: ${pruned.join(', ')}`);

  updateDocsJson(args.version, selected.map((m) => m.name));
  console.log(`\nWrote ${outputRoot}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
