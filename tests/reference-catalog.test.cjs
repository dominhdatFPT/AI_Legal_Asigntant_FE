const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '../AI_Legal');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public/reference-templates/catalog.json'), 'utf8'));
const helper = import(pathToFileURL(path.join(root, 'public/reference-catalog.mjs')));

test('search matches Vietnamese without accents, mixed case and reordered words', async () => {
  const { filterReferences, normalizeSearch } = await helper;
  assert.equal(normalizeSearch('ĐẤT ĐAI'), 'dat dai');
  assert.equal(filterReferences(catalog.items, { query: 'MAT BANG thue' }).length, 1);
  assert.equal(filterReferences(catalog.items, { query: 'khong-co-mau-nay' }).length, 0);
});

test('domain and procedure filters combine without assigning a false procedure to a general reference', async () => {
  const { filterReferences } = await helper;
  const items = [...catalog.items, { id: 'land-form', name: 'Đơn đất đai', domain: 'land', procedure: 'land-001' }];
  assert.equal(filterReferences(items, { domain: 'land', procedure: 'land-001' }).length, 1);
  assert.equal(filterReferences(items, { domain: 'business', procedure: 'DN-006' }).length, 1);
  assert.equal(filterReferences(items, { domain: 'business', procedure: 'general' }).length, 0);
  assert.equal(filterReferences(items, { domain: 'business', procedure: 'land-001' }).length, 0);
  assert.equal(filterReferences(catalog.items, { domain: 'land' }).length, 18);
});

test('lease template links to DN-006 and is searchable by its procedure code or name', async () => {
  const { filterReferences, procedureLabel } = await helper;
  const item = catalog.items[0];
  assert.equal(item.procedure, 'DN-006');
  assert.equal(item.procedure_id, '0a2e901e-51d7-4df4-8e5c-2fb720628374');
  assert.match(procedureLabel(item), /^DN-006 · Thủ tục thuê nhà\/mặt bằng/);
  assert.equal(filterReferences(catalog.items, { query: 'DN-006' }).length, 1);
  assert.equal(filterReferences(catalog.items, { query: 'tru so chinh' }).length, 1);
});

test('reference loading performs only a public GET and preserves errors instead of inventing data', async () => {
  const { loadReferences } = await helper;
  const requests = [];
  const items = await loadReferences(async (...args) => {
    requests.push(args);
    return { ok: true, json: async () => catalog };
  });
  assert.equal(items.length, 30);
  assert.deepEqual(requests, [['/api/reference-catalog', { cache: 'no-cache' }]]);
  await assert.rejects(loadReferences(async () => ({ ok: false })), /UNAVAILABLE/);
});

test('reference schema rejects external document assets and incomplete page lists', async () => {
  const { loadReferences } = await helper;
  for (const item of [
    { ...catalog.items[0], pages: ['https://outside.invalid/private.png'] },
    { ...catalog.items[0], pages: [], page_count: 0 },
    { ...catalog.items[0], page_count: 4 }
  ]) {
    await assert.rejects(loadReferences(async () => ({ ok: true, json: async () => ({ items: [item] }) })), /INVALID/);
  }
});

test('all 30 sources and 114 pages are packaged, immutable and classified by actual content', async () => {
  const { createHash } = require('node:crypto');
  const { filterReferences } = await helper;
  assert.equal(catalog.items.length, 30);
  assert.equal(new Set(catalog.items.map((i) => i.id)).size, 30);
  assert.equal(catalog.items.reduce((n, i) => n + i.pages.length, 0), 114);
  for (const item of catalog.items) {
    assert.equal(item.view_only, true);
    assert.equal(item.can_fill, false);
    assert.equal(item.pages.length, item.page_dimensions.length);
    assert.ok(item.procedures.length);
    assert.equal(fs.readFileSync(path.join(root, 'public', item.pdf)).subarray(0, 5).toString(), '%PDF-');
  }
  for (const [asset, hash] of Object.entries(catalog.asset_hashes)) {
    const data = fs.readFileSync(path.join(root, 'public/reference-templates', asset));
    assert.equal(createHash('sha256').update(data).digest('hex'), hash);
  }
  assert.equal(filterReferences(catalog.items, { domain: 'social_insurance' }).length, 1);
  assert.equal(filterReferences(catalog.items, { domain: 'cooperative' }).length, 1);
  assert.equal(filterReferences(catalog.items, { domain: 'business' }).length, 10);
  assert.equal(filterReferences(catalog.items, { status: 'needs_review' }).length, 2);
  assert.equal(filterReferences(catalog.items, { status: 'specific_case' }).length, 2);
  assert.equal(filterReferences(catalog.items, { procedure: 'DD-008' }).length, 4);
  assert.equal(filterReferences(catalog.items, { procedure: 'DD-006' }).length, 4);
});

test('HTTP serves the public catalogue and all document pages with no backend, and redirects the old editor', async () => {
  const app = require('../AI_Legal/src/index.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const previousBackend = process.env.BACKEND_URL;
  process.env.BACKEND_URL = 'http://127.0.0.1:1';
  try {
    const page = await fetch(`${base}/document-storages`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /contract-catalog\.js/);
    for (const [route, filename] of [
      ['/lawyer-registration', 'lawyer-registration.html'],
      ['/form-library', 'form-library.html']
    ]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      // Server chèn navbar chung vào chỗ đánh dấu; phần còn lại của trang giữ nguyên.
      const served = await response.text();
      const [, body] = fs.readFileSync(path.join(root, 'src/pages', filename), 'utf8').split('<!-- user-header -->');
      assert.match(served, /<header class="unav"/);
      assert.ok(served.includes(body));
    }
    const viewer = await (await fetch(`${base}/xem-mau-don`)).text();
    assert.doesNotMatch(viewer, /<form|<input|<textarea|contenteditable|data-action=/i);
    const index = await (await fetch(`${base}/reference-templates/catalog.json`)).json();
    const fallback = await fetch(`${base}/api/reference-catalog`);
    assert.equal(fallback.headers.get('x-reference-catalog-source'), 'bundled-contract-snapshot');
    assert.equal((await fallback.json()).data.items.length, 30);
    for (const item of index.items) for (const asset of [...item.pages, item.pdf]) {
      const response = await fetch(base + asset);
      assert.equal(response.status, 200);
      assert.ok(Number(response.headers.get('content-length')) > 0);
    }
    const redirect = await fetch(`${base}/dien-mau-don?template=test`, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/xem-mau-don?template=test');
    assert.equal((await fetch(`${base}/contract-template.js`)).status, 404);
  } finally {
    if (previousBackend === undefined) delete process.env.BACKEND_URL; else process.env.BACKEND_URL = previousBackend;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the FE server prefers Contract API and does not forward user cookies or authorization', async () => {
  const http = require('node:http');
  const app = require('../AI_Legal/src/index.js');
  const previousBackend = process.env.BACKEND_URL;
  let upstreamRequest;
  const upstream = http.createServer((req, res) => {
    upstreamRequest = { url: req.url, cookie: req.headers.cookie, authorization: req.headers.authorization, method: req.method };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: catalog, error: null }));
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => upstream.once('listening', resolve));
  process.env.BACKEND_URL = `http://127.0.0.1:${upstream.address().port}`;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reference-catalog`, {
      headers: { Cookie: 'test_cookie=synthetic', Authorization: 'Bearer synthetic-test-token' }
    });
    assert.equal(response.headers.get('x-reference-catalog-source'), 'contract-api');
    assert.equal((await response.json()).data.items.length, 30);
    assert.deepEqual(upstreamRequest, { url: '/api/contracts/reference-catalog?page=1&page_size=100', cookie: undefined, authorization: undefined, method: 'GET' });
  } finally {
    if (previousBackend === undefined) delete process.env.BACKEND_URL; else process.env.BACKEND_URL = previousBackend;
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => upstream.close(resolve));
  }
});
