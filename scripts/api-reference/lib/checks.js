// Guards over the parts of the reference that cannot be derived from upstream.
//
// The generator reads everything it can from the descriptor, but a few facts
// live outside the protos: what an encoding convention means, and how a
// well-known type is represented in JSON. Those are written by hand. These
// checks make sure the hand-written half stays complete as upstream changes,
// and that generated output can shrink as well as grow.

import fs from 'fs';
import path from 'path';

import { WELL_KNOWN_JSON, SPECIAL_JSON_TYPES } from './render.js';

/**
 * The generated pages annotate fields with scalar conventions taken from the
 * protos, as `Encoded as cosmos.Dec`. What those conventions mean is not in the
 * protos, so it is written by hand in grpc/index.mdx, and a hand-written list
 * next to generated content is exactly the thing that goes stale: upstream
 * added cosmos.ConsensusAddressString and the page did not know.
 *
 * The prose stays hand-written. Its completeness does not: every annotation the
 * descriptor actually uses must be defined on that page, or the run fails.
 */
export function checkScalarAnnotationsDocumented(types, outputRoot) {
  const used = new Map();
  for (const message of types.messages.values()) {
    for (const field of message.fields) {
      if (!field.scalarHint) continue;
      // Keep one example of where it is used, so whoever has to define it can
      // go and look at a real field rather than hunting for the annotation.
      if (!used.has(field.scalarHint)) {
        used.set(field.scalarHint, `${message.fullName}.${field.name}`);
      }
    }
  }

  const pagePath = path.join(outputRoot, 'grpc', 'index.mdx');
  if (!fs.existsSync(pagePath)) return [...used.keys()];

  const page = fs.readFileSync(pagePath, 'utf8');
  const undocumented = [...used.keys()].filter((name) => !page.includes(`\`${name}\``)).sort();

  if (undocumented.length) {
    const lines = undocumented.map((name) => `  ${name}  (used by ${used.get(name)})`);
    throw new Error(
      [
        `${undocumented.length} scalar annotation(s) appear in the protos but are not defined in ${path.relative(process.cwd(), pagePath)}:`,
        ...lines,
        '',
        'Field tables render "Encoded as <name>" with nowhere for a reader to look it up.',
        'Add a row to the Scalar encodings table on that page describing what the encoding means.',
      ].join('\n'),
    );
  }
  return [...used.keys()];
}

/**
 * Deletes generated pages for modules that no longer exist upstream.
 *
 * Without this a module removed in a new SDK version keeps its page on disk.
 * The nav rewrite drops it, so nobody notices, but the URL keeps serving a page
 * frozen at whatever the module looked like before it was deleted. Generated
 * output has to be able to shrink, not only grow.
 *
 * index.mdx is hand-written and lives in the same directory, so it is exempt.
 */
export function pruneRemovedModulePages(outputRoot, moduleNames) {
  const dir = path.join(outputRoot, 'grpc');
  if (!fs.existsSync(dir)) return [];

  const keep = new Set([...moduleNames.map((m) => `${m}.mdx`), 'index.mdx']);
  const removed = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx') && !keep.has(f));

  for (const file of removed) fs.unlinkSync(path.join(dir, file));
  return removed;
}

/**
 * Well-known types carry JSON representations unrelated to their proto fields,
 * and the renderer knows a fixed set of them. One it does not know gets expanded
 * structurally, which is how Duration shipped as {"seconds":0,"nanos":0} instead
 * of "604800s": confidently wrong, and silent.
 *
 * A new SDK version reaching for a well-known type we do not handle should stop
 * the build rather than produce examples nobody can use.
 */
export function checkWellKnownTypesHandled(types) {
  const unhandled = new Set();
  for (const message of types.messages.values()) {
    for (const field of message.fields) {
      const name = field.typeName;
      if (!name || !SPECIAL_JSON_TYPES.has(name)) continue;
      if (name === 'google.protobuf.Any' || name in WELL_KNOWN_JSON) continue;
      unhandled.add(name);
    }
  }

  if (unhandled.size) {
    throw new Error(
      `these types have a specification-defined JSON form but no representation in lib/render.js: ${[...unhandled].sort().join(', ')}\n` +
        'Expanding them structurally produces examples that do not match the wire format. Add each to WELL_KNOWN_JSON.',
    );
  }
}

/**
 * The transactions page lists the fields a transaction envelope carries beyond
 * the abridged example. That list mirrors cosmos.tx.v1beta1, so it goes stale
 * exactly the way the scalar table did: v0.55 added `unordered`,
 * `timeout_timestamp` and `tip`, and the page did not know.
 *
 * The prose stays hand-written. Its completeness is checked here.
 */
const ENVELOPE_MESSAGES = [
  'cosmos.tx.v1beta1.TxBody',
  'cosmos.tx.v1beta1.AuthInfo',
  'cosmos.tx.v1beta1.Fee',
];

export function checkTxEnvelopeDocumented(types, outputRoot) {
  const pagePath = path.join(outputRoot, 'transactions.mdx');
  if (!fs.existsSync(pagePath)) return [];

  const page = fs.readFileSync(pagePath, 'utf8');
  const missing = [];

  for (const messageName of ENVELOPE_MESSAGES) {
    const message = types.messages.get(messageName);
    if (!message) continue;
    for (const field of message.fields) {
      // Either spelling counts: named in prose as `memo`, or shown in the
      // envelope example as "memo".
      const mentioned =
        page.includes(`\`${field.name}\``) || page.includes(`"${field.name}"`);
      if (!mentioned) missing.push(`${messageName}.${field.name}`);
    }
  }

  if (missing.length) {
    throw new Error(
      [
        `${missing.length} transaction envelope field(s) are not mentioned in ${path.relative(process.cwd(), pagePath)}:`,
        ...missing.map((name) => `  ${name}`),
        '',
        'A reader comparing the page to real CLI output finds fields the page never explains.',
      ].join('\n'),
    );
  }
  return missing;
}
