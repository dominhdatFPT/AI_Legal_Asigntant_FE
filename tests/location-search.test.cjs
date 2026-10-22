const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.join(__dirname, '../AI_Legal');
const page = fs.readFileSync(path.join(root, 'src/pages/location-search.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/location-search.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'public/auth-api.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');

test('standalone search page is authenticated and available as a route', () => {
  assert.match(routes, /app\.get\('\/location-search'/);
  assert.match(page, /protectPage\(\['citizen', 'lawyer'\]\)/);
  assert.match(page, /id="location-form"/);
  assert.match(page, /id="results"/);
});

test('catalogue is reused with both address versions and stale replies are ignored', () => {
  assert.match(script, /fetchAdministrativeUnits\(/);
  assert.match(script, /\$\{selectedVersion\}\/provinces/);
  assert.match(script, /legacy\/districts/);
  assert.match(script, /sequence !== catalogueSequence/);
  assert.match(script, /sequence === searchSequence/);
  assert.match(script, /setOptions\(ward, \[\]/);
});

test('paid search occurs only on submit and sends numeric codes with null legacy ward', () => {
  assert.match(script, /form\.addEventListener\('submit'/);
  assert.equal((script.match(/searchNearbyOffices\(/g) || []).length, 1);
  assert.match(script, /province_code: Number\(province\.value\)/);
  assert.match(script, /ward_code: ward\.value \? Number\(ward\.value\) : null/);
  assert.match(api, /authRequest\('\/api\/locations\/offices\/search'/);
});

test('provider text is rendered as text, distances and links are explicitly labeled', () => {
  assert.match(script, /heading\.textContent = item\.name/);
  assert.match(script, /address\.textContent = item\.address/);
  assert.match(script, /Khoảng cách đường thẳng/);
  assert.match(script, /link\.rel = 'noopener noreferrer'/);
  assert.match(script, /url\.hostname === 'www\.google\.com'/);
  assert.doesNotMatch(script, /innerHTML/);
});
