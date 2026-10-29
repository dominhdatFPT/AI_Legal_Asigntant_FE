const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '../AI_Legal');
const helper = import(pathToFileURL(path.join(root, 'public/reference-catalog.mjs')));
const id = '11111111-1111-4111-8111-111111111111';
const reference = {
  id, name: 'Mẫu PDF kiểm thử', text: '', domain: 'land', procedure: 'DD-001',
  procedure_name: 'Thủ tục đất đai', procedures: [{ key: 'DD-001', code: 'DD-001', name: 'Đất đai' }],
  content_status: 'source', view_only: true, can_fill: false, page_count: 2,
  pages: [1, 2].map(n => `/api/reference-assets/${id}-page-${n}.png`),
  page_dimensions: [{ width: 800, height: 1200 }, { width: 800, height: 1200 }]
};

test('public viewer accepts uploaded pages and rejects unsafe, reordered or incomplete images', async () => {
  const { loadReferenceCatalog } = await helper;
  const load = item => loadReferenceCatalog(async () => ({ ok: true, json: async () => ({
    data: { read_only: true, items: [item] }
  }) }));
  assert.equal((await load(reference)).items[0].id, id);
  for (const item of [
    { ...reference, pages: reference.pages.toReversed() },
    { ...reference, pages: [`https://outside.invalid/x.png`, reference.pages[1]] },
    { ...reference, pages: [`/api/reference-assets/${id}-page-3.png`, reference.pages[1]] },
    { ...reference, page_dimensions: [] },
    { ...reference, pages: reference.pages.slice(0, 1) }
  ]) await assert.rejects(load(item), /REFERENCE_CATALOG_INVALID/);
});

for (const [filename, domain] of [['LandForms-admin.html', 'land'], ['business-form-templates.html', 'business']]) {
  const page = fs.readFileSync(path.join(root, 'src/pages', filename), 'utf8');
  test(`${domain} form sends PDF multipart with the classification key and preserves server errors`, async () => {
    const source = page.slice(page.indexOf('async function uploadFormTemplate(values)'), page.indexOf("      templateForm?.addEventListener('submit'"));
    const requests = [];
    let response = { ok: true, json: async () => ({ data: reference }) };
    const upload = new Function('authModule', 'FORM_TEMPLATES_PATH', `${source}; return uploadFormTemplate;`)(
      { authRequest: async (...args) => { requests.push(args); return response; } }, '/api/contracts/reference-catalog');
    const file = new File(['%PDF-test'], 'test.pdf', { type: 'application/pdf' });
    const values = { file, name: 'Mẫu PDF thử', procedure: 'classification-key' };
    assert.equal((await upload(values)).id, id);
    const [url, options] = requests[0];
    assert.equal(url, '/api/contracts/reference-catalog');
    assert.equal(options.method, 'POST');
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('domain'), domain);
    assert.equal(options.body.get('procedure'), 'classification-key');
    assert.equal(options.body.get('file').name, 'test.pdf');
    assert.equal(options.headers, undefined); // browser owns multipart boundary
    response = { ok: false, status: 409, json: async () => ({ error: { message: 'PDF đã có trong kho' } }) };
    await assert.rejects(upload(values), /PDF đã có trong kho/);
    response = { ok: false, status: 413, json: async () => { throw Error(); } };
    await assert.rejects(upload(values), /dung lượng/);
  });

  test(`${domain} form blocks empty, oversized and non-PDF files before sending`, () => {
    const source = page.slice(page.indexOf('function validateTemplateForm()'), page.indexOf('      async function uploadFormTemplate'));
    let file;
    const elements = {
      'f-file': { get files() { return file ? [file] : []; } },
      'f-name': { value: 'Mẫu PDF kiểm thử' }, 'f-procedure': { value: 'key' },
      dropzone: { focus() {} }
    };
    for (const element of Object.values(elements)) element.focus ||= () => {};
    const errors = {};
    const validate = new Function('document', 'MAX_FILE_BYTES', 'setTemplateFieldError', `${source}; return validateTemplateForm;`)(
      { getElementById: id => elements[id] }, 10 * 1024 * 1024, (key, message) => { errors[key] = message; });
    for (file of [null, { name: 'x.docx', size: 5 }, { name: 'x.pdf', size: 0 },
                  { name: 'x.pdf', size: 10 * 1024 * 1024 + 1 }]) {
      assert.equal(validate(), null);
      assert.ok(errors.file);
    }
    file = { name: 'x.PDF', size: 10 * 1024 * 1024 };
    assert.ok(validate());
    assert.equal(errors.file, undefined);
  });

  test(`${domain} template search does not treat the page-size selector as a filter`, () => {
    assert.match(page, /querySelectorAll\('\[data-template-filter\]'\)/);
    assert.doesNotMatch(page, /querySelectorAll\('main select'\)/);
    assert.match(page, /protectPage\(\['admin'\]\)/);
  });

  test(`${domain} form builder and PDF upload open independently after merging develop`, () => {
    const builder = fs.readFileSync(path.join(root, 'public/form-templates-admin.js'), 'utf8');
    const bindings = new Map();
    const document = { getElementById: id => ({
      addEventListener: (event, handler) => {
        const key = `${id}:${event}`;
        bindings.set(key, [...(bindings.get(key) || []), handler]);
      }
    }) };
    const calls = [];
    const pdfBinding = page.match(/document\.getElementById\('add-pdf-template-card'\)\?\.addEventListener\('click', openTemplateDrawer\);/);
    const builderBinding = builder.match(/document\.getElementById\('add-template-card'\)\?\.addEventListener\('click', \(\) => openEditor\(null\)\);/);
    assert.ok(pdfBinding, 'PDF upload has a separate trigger');
    assert.ok(builderBinding, 'upstream form builder keeps its trigger');
    new Function('document', 'openTemplateDrawer', pdfBinding[0])(document, () => calls.push('pdf'));
    new Function('document', 'openEditor', builderBinding[0])(document, () => calls.push('builder'));
    for (const handler of bindings.get('add-template-card:click')) handler();
    assert.deepEqual(calls, ['builder']);
    for (const handler of bindings.get('add-pdf-template-card:click')) handler();
    assert.deepEqual(calls, ['builder', 'pdf']);
    assert.match(page, /<section id="ft-app"/);
    assert.match(page, /<table data-reference-table/);
    assert.match(page, /querySelector\('\[data-reference-table\]'\)/);
    assert.doesNotMatch(page, /querySelector\('table'\)/);
    assert.match(page, /type="module" src="\/admin-ai-chat\.js"/);
  });
}

test('FE proxies every catalog page and public assets without forwarding authentication', async () => {
  const app = require('../AI_Legal/src/index.js');
  const previous = process.env.BACKEND_URL;
  const calls = [];
  let invalidType = false;
  const upstream = http.createServer((req, res) => {
    calls.push({ url: req.url, cookie: req.headers.cookie, auth: req.headers.authorization });
    if (req.url.startsWith('/api/contracts/reference-catalog')) {
      const page = new URL(req.url, 'http://test').searchParams.get('page');
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ data: { read_only: true,
        items: Array.from({ length: page === '1' ? 100 : 1 }, (_, n) => ({ id: page + '-' + n })),
        pagination: { total_pages: 2 }
      } }));
    }
    res.setHeader('Content-Type', invalidType ? 'text/html' : 'image/png');
    res.end(Buffer.from([137, 80, 78, 71]));
  });
  const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await listen(upstream);
  process.env.BACKEND_URL = `http://127.0.0.1:${upstream.address().port}`;
  const server = http.createServer(app);
  await listen(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Cookie: 'access_token=private', Authorization: 'Bearer private' };
  try {
    const result = await fetch(base + '/api/reference-catalog', { headers });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data.items.length, 101);
    const image = await fetch(base + reference.pages[0], { headers });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [137, 80, 78, 71]);
    assert.ok(calls.every(call => !call.cookie && !call.auth));
    invalidType = true;
    assert.equal((await fetch(base + reference.pages[0])).status, 503);
    assert.equal((await fetch(base + '/api/reference-assets/private.pem')).status, 404);
    for (const route of ['/landforms', '/business-form-templates']) {
      const html = await (await fetch(base + route)).text();
      assert.match(html, /accept="\.pdf,application\/pdf"/);
      assert.match(html, /\/api\/contracts\/reference-catalog/);
      assert.match(html, /loadReferenceCatalog\(\)/);
      assert.match(html, /<tbody[^>]*><\/tbody>\s*<\/table>/);
    }
  } finally {
    if (previous === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previous;
    await Promise.all([server, upstream].map(item => new Promise(resolve => item.close(resolve))));
  }
});
