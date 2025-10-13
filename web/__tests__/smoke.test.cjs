const test = require('node:test');
const assert = require('node:assert/strict');

test('basic arithmetic sanity check', () => {
  assert.strictEqual(2 + 2, 4);
});
