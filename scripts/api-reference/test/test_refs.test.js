import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, resolveRef } from '../lib/refs.js';

describe('parseArgs', () => {
  test('accepts a ref override', () => {
    const args = parseArgs(['--version', 'next', '--ref', 'release/v0.54.x']);
    assert.equal(args.version, 'next');
    assert.equal(args.ref, 'release/v0.54.x');
  });

  test('leaves ref null when not given', () => {
    assert.equal(parseArgs(['--version', 'latest']).ref, null);
  });

  test('rejects a version that is not next or latest', () => {
    assert.throws(() => parseArgs(['--version', 'v0.53']), /must be next or latest/);
  });
});

describe('resolveRef', () => {
  test('next resolves to main by default', () => {
    assert.equal(resolveRef('next', {}).ref, 'main');
  });

  test('latest resolves to the release branch from versions.json', () => {
    assert.match(resolveRef('latest', {}).ref, /^release\/v\d+\.\d+\.x$/);
  });

  test('an override wins over the derived ref for either version', () => {
    assert.equal(resolveRef('next', { ref: 'release/v0.54.x' }).ref, 'release/v0.54.x');
    assert.equal(resolveRef('latest', { ref: 'v0.54.0' }).ref, 'v0.54.0');
  });

  test('an override does not change the version stamp on the pages', () => {
    const derived = resolveRef('next', {});
    const overridden = resolveRef('next', { ref: 'release/v0.54.x' });
    assert.equal(overridden.displayVersion, derived.displayVersion);
  });
});
