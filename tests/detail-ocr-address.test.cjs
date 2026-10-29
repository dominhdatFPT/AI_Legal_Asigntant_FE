const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

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

test('OCR preserves card field names while mapping both card generations into the form', () => {
  assert.match(page, /const address = fields\.permanent_address \|\| additional\.residence_address/);
  assert.match(page, /const origin = additional\.place_of_origin \|\| additional\.registered_birth_place/);
  assert.doesNotMatch(page, /Nơi đăng ký khai sinh trên thẻ:/);
  assert.doesNotMatch(page, /Nơi cư trú trên thẻ:/);
});

test('OCR response maps each value to its intended form or card-data element', async () => {
  const start = page.indexOf('            const OCR_FIELD_LABELS = {');
  const end = page.indexOf("            ocrButton.addEventListener('click'", start);
  assert.ok(start > 0 && end > start);
  const elements = new Map();
  const field = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '',
      classList: { toggle() {} }
    });
    return elements.get(id);
  };
  const radios = [{ value: 'Nam', checked: false }, { value: 'Nữ', checked: false }];
  const calls = [];
  const context = {
    field, form: { querySelectorAll: () => radios }, fromIsoDate: (value) => value,
    splitParts: (value) => (value || '').split(',').map((part) => part.trim()).filter(Boolean),
    fillPermanentAddress: async (...args) => { calls.push(['permanent', ...args]); return true; },
    fillLegacySelection: async (...args) => {
      calls.push(['origin', ...args]); field('origin-place').value = args[1]; return true;
    }
  };
  vm.runInNewContext(page.slice(start, end) + '\nglobalThis.apply = applyOcrFields;', context);
  await context.apply({
    full_name: 'A B', identity_number: '012345678901', date_of_birth: '2000-01-01',
    issue_date: '2020-01-01', issue_place: 'Issuer', permanent_address: 'Permanent'
  }, {
    sex: 'male', nationality: 'Việt Nam', place_of_origin: 'Origin',
    registered_birth_place: 'Birth registration', residence_address: 'Residence',
    expiry_date: '2030-01-01'
  });
  assert.equal(field('full-name').value, 'A B');
  assert.equal(field('cccd-number').value, '012345678901');
  assert.equal(field('dob').value, '2000-01-01');
  assert.equal(field('issue-date').value, '2020-01-01');
  assert.equal(field('issue-place').value, 'Issuer');
  assert.equal(field('expiry-date').value, '2030-01-01');
  assert.equal(field('nationality').value, 'Việt Nam');
  assert.equal(field('origin-place').value, 'Origin');
  assert.equal(radios[0].checked, true);
  assert.deepEqual(calls, [['permanent', 'Permanent', null], ['origin', 'origin', 'Origin']]);
  calls.length = 0;
  await context.apply({ full_name: 'A B', identity_number: '012345678901',
    date_of_birth: '2000-01-01' }, {
    registered_birth_place: 'Registered birth', residence_address: 'Printed residence'
  });
  assert.deepEqual(calls, [['permanent', 'Printed residence', undefined],
    ['origin', 'origin', 'Registered birth']]);
  assert.equal(field('origin-place').value, 'Registered birth');
  calls.length = 0;
  await context.apply({}, {
    registered_birth_place: 'Ward X, District Y, Province Z',
    residence_address: 'Hamlet Ward X, District Y, Province Z'
  });
  assert.equal(calls[0][1], 'Hamlet Ward X, District Y, Province Z');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), {
    detail: 'Hamlet', ward: 'Ward X, District Y', province: 'Province Z'
  });
});
