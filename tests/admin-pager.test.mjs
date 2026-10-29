import assert from 'node:assert/strict';
import { test } from 'node:test';
const { pageNumbers, clampPage, pageSlice, pageCount } = await import('../AI_Legal/public/admin-pager.js');
test('pager math', () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(21), 3);
  assert.equal(clampPage(5, 21), 3);
  assert.equal(clampPage(0, 21), 1);
  assert.deepEqual(pageSlice([...Array(23).keys()], 3), [20, 21, 22]);
  assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbers(5, 12), [1, '…', 4, 5, 6, '…', 12]);
  assert.deepEqual(pageNumbers(1, 12), [1, 2, '…', 12]);
  assert.deepEqual(pageNumbers(12, 12), [1, '…', 11, 12]);
});
