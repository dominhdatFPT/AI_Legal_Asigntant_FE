const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const page = fs.readFileSync(path.join(__dirname, '../AI_Legal/src/pages/detail-information.html'), 'utf8');

test('identity dates use native date pickers', () => {
  for (const id of ['dob', 'issue-date', 'expiry-date']) {
    assert.match(page, new RegExp(`id="${id}"[^>]*type="date"`));
  }
  assert.doesNotMatch(page, /expiry-no-limit|Không thời hạn|expiryNoLimit|noExpiry/);
});

test('administrative address parts are selects, not free-text inputs', () => {
  for (const id of ['origin-province', 'origin-district', 'origin-ward',
    'perm-province', 'perm-district', 'perm-ward', 'curr-province', 'curr-ward']) {
    assert.match(page, new RegExp(`<select[^>]*id="${id}"`));
    assert.doesNotMatch(page, new RegExp(`<input[^>]*id="${id}"`));
  }
});

test('CCCD and current addresses use the correct catalogue generations', () => {
  assert.match(page, /fetchAdministrativeUnits\('legacy\/provinces'\)/);
  assert.match(page, /fetchAdministrativeUnits\('current\/provinces'\)/);
  assert.match(page, /legacy\/districts\//);
  assert.match(page, /current\/provinces\//);
});

test('saved legacy ward includes its selected district', () => {
  assert.match(page, /\[selectedText\('perm-ward'\), selectedText\('perm-district'\)\]/);
  assert.match(page, /place_of_origin: text\('origin-place'\) \|\| null/);
});

test('OCR must match catalogue values before an address is considered complete', () => {
  assert.match(page, /const originComplete = origin && await fillLegacySelection/);
  assert.match(page, /permanent_address: addressComplete \? address : null/);
  assert.match(page, /place_of_origin: originComplete \? field\('origin-place'\)\.value : null/);
});

test('place of origin accepts either two or three administrative levels', () => {
  assert.match(page, /parts\.length < 2/);
  assert.match(page, /parts\.length >= 3 && !chooseByName\(`\$\{prefix\}-ward`/);
  assert.doesNotMatch(page, /'origin-ward': 'Xã \/ Phường quê quán'/);
  assert.match(page, /Xã \/ Phường \/ Thị trấn \(nếu có\)/);
});

test('address detail removes duplicated trailing administrative units for every input source', () => {
  assert.match(page, /const stripTrailingAdministrativeParts =/);
  assert.match(page, /names\.has\(normalizeAdmin\(parts\.at\(-1\)\)\)/);
  assert.match(page, /cleanAddressDetail\('perm'\)/);
  assert.match(page, /cleanAddressDetail\('curr'\)/);
  assert.match(page, /Chặn dữ liệu trùng dù nguồn là OCR, hồ sơ cũ hay người dùng nhập tay/);
});
