const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.join(__dirname, '../AI_Legal');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const page = read('src/pages/lawyer-management.html');
const script = read('public/admin-lawyers.js');
const api = read('public/admin-api.js');
const routes = read('src/index.js');
const sidebar = read('src/partials/admin-sidebar.html');

test('lawyer management is an admin-only page in the shared admin shell', () => {
  assert.match(routes, /app\.get\('\/lawyer-management', sendAdminPage\('lawyer-management\.html'\)\)/);
  assert.match(routes, /'\/lawyer-management': 'quan-ly-luat-su'/);
  assert.match(sidebar, /data-path="quan-ly-luat-su" href="\/lawyer-management"/);
  assert.match(page, /<!-- admin-sidebar -->/);
  assert.match(page, /protectPage\(\['admin'\]\)/);
  assert.match(page, /Quản lý hồ sơ luật sư<\/h1>/);
});

test('applications are listed per approval status and reviewed through the lawyer API', () => {
  for (const status of ['all', 'pending', 'approved', 'rejected', 'locked']) {
    assert.match(page, new RegExp(`data-filter="${status}"`));
  }
  assert.match(api, /approval_status=\$\{status\}/);
  assert.match(script, /fetchLawyerApplications\(\{ status/);
  assert.match(script, /reviewLawyerApplication\(a\.id, kind, body\)/);
  assert.match(script, /fetchUserCitizenProfile\(/);
  assert.match(script, /e\.status === 409/);
});

test('lawyer accounts without an approved application join the approved tab', () => {
  assert.match(api, /\/api\/users\?role=lawyer/);
  assert.match(script, /accounts\.filter\(\(u\) => !approvedUsers\.has\(u\.id\)\)\.map\(accountRow\)/);
  assert.match(script, /escapeHtml\(u\.email/);
  assert.match(script, /state\.lists\.locked = merged\.filter\(\(a\) => a\.locked\)/);
});

test('rejecting requires a reason and only pending applications get actions', () => {
  assert.match(script, /Nhập lý do để người gửi biết cần sửa gì\./);
  assert.match(script, /if \(a\.approval_status !== 'pending'\) \{\n    return `<div class="flex justify-end">\$\{close\}<\/div>`;/);
});

test('user-provided fields are escaped before rendering', () => {
  for (const field of ['full_name', 'bar_card_number', 'law_firm', 'rejected_reason', 'bio']) {
    assert.match(script, new RegExp(`escapeHtml\\(a\\.${field}`));
  }
});

test('sample data only replaces the API on localhost with ?demo', () => {
  assert.match(script, /has\('demo'\) && \/\^\(localhost\|127\\\.0\\\.0\\\.1\)\$\/\.test\(location\.hostname\)/);
  assert.match(page, /if \(!DEMO\)/);
  const sample = read('public/admin-lawyers-sample.js');
  for (const name of ['fetchLawyerApplications', 'fetchLawyerAccounts', 'fetchUserCitizenProfile', 'reviewLawyerApplication', 'lawyerCredentialUrl']) {
    assert.match(sample, new RegExp(`export async function ${name}`));
    assert.match(api, new RegExp(`export const ${name}`));
  }
});

test('tailwind build includes the page', () => {
  assert.match(fs.readFileSync(path.join(__dirname, '../tailwind.admin.config.js'), 'utf8'), /lawyer-management\.html/);
});
