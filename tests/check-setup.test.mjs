import test from 'node:test';
import assert from 'node:assert/strict';
import { supportsNode } from '../scripts/check-setup.mjs';

test('accepts the documented minimum and later versions', () => {
  for (const version of ['22.22.0', 'v22.22.1', '22.23.0', '24.0.0']) {
    assert.equal(supportsNode(version), true, version);
  }
});

test('rejects older and malformed versions', () => {
  for (const version of ['18.19.1', '22.21.9', '20.99.0', '', '22', '22.22', 'invalid', '22.22.0-beta']) {
    assert.equal(supportsNode(version), false, version);
  }
});
