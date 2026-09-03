import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const PRODUCT = 'sdk';

export function parseArgs(argv) {
  const args = { version: null, modules: null, ref: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--version') args.version = argv[i + 1];
    if (argv[i] === '--ref') args.ref = argv[i + 1];
    if (argv[i] === '--modules') args.modules = argv[i + 1].split(',').map((m) => m.trim());
  }
  if (!['next', 'latest'].includes(args.version)) {
    throw new Error('--version must be next or latest');
  }
  return args;
}

/**
 * next documents unreleased main. latest documents the released branch, whose
 * name follows from versions.json rather than being written down here, so a
 * freeze to v0.56 carries the generator with it.
 *
 * An explicit ref overrides that resolution and nothing else. The release
 * procedure needs to generate next's pages from the release branch before a
 * freeze, while the pages still carry next's version stamp, so the ref and the
 * displayed version are deliberately independent.
 */
export function resolveRef(version, { ref = null } = {}) {
  const versions = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'versions.json'), 'utf8'));
  const product = versions.products[PRODUCT];
  if (!product) throw new Error(`versions.json has no ${PRODUCT} product`);

  const displayVersion = product.latestDisplayVersion;
  const match = displayVersion.match(/^v(\d+)\.(\d+)/);
  if (!match) throw new Error(`cannot parse latestDisplayVersion ${displayVersion}`);

  const derived = version === 'next' ? 'main' : `release/v${match[1]}.${match[2]}.x`;

  return {
    repository: product.repository,
    ref: ref ?? derived,
    displayVersion: version === 'next' ? `${displayVersion} (unreleased)` : displayVersion,
  };
}
