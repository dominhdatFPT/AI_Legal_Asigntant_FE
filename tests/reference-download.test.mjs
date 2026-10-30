import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../AI_Legal');

test('getPdfUrl resolves correct PDF link for local and API template items', async () => {
  const { getPdfUrl, sanitizeFileName } = await import('../AI_Legal/public/reference-catalog.mjs');

  // Direct pdf field
  assert.equal(getPdfUrl({ pdf: '/reference-templates/custom.pdf' }), '/reference-templates/custom.pdf');
  assert.equal(getPdfUrl({ pdf_url: '/reference-templates/custom_url.pdf' }), '/reference-templates/custom_url.pdf');

  // Extract from pages (local reference template)
  const localItem = {
    pages: ['/reference-templates/5be47c1d812697e3-page-1-f6ae830496fd.png']
  };
  assert.equal(getPdfUrl(localItem), '/reference-templates/5be47c1d812697e3.pdf');

  // Extract from pages (API asset)
  const apiItem = {
    pages: ['/api/reference-assets/11111111-1111-4111-8111-111111111111-page-1.png']
  };
  assert.equal(getPdfUrl(apiItem), '/api/reference-assets/11111111-1111-4111-8111-111111111111.pdf');

  // ID fallback
  assert.equal(getPdfUrl({ id: 'abcd-1234' }), '/api/reference-assets/abcd-1234.pdf');

  // sanitizeFileName
  assert.equal(sanitizeFileName('Hợp đồng / thuê: "mặt bằng"?'), 'Hợp đồng _ thuê_ _mặt bằng__');
});

test('contract-viewer.html and contract-viewer.js have download buttons and wiring', () => {
  const html = fs.readFileSync(path.join(root, 'src/pages/contract-viewer.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public/contract-viewer.js'), 'utf8');

  assert.match(html, /id="viewer-download-btn"/);
  assert.match(html, /id="reader-download-btn"/);
  assert.match(js, /downloadReferencePdf/);
  assert.match(js, /viewer-download-btn/);
  assert.match(js, /reader-download-btn/);
});

test('contract-catalog.js includes download button on each template card', () => {
  const js = fs.readFileSync(path.join(root, 'public/contract-catalog.js'), 'utf8');
  assert.match(js, /card-download-btn/);
  assert.match(js, /downloadReferencePdf/);
  assert.match(js, /Tải PDF/);
});

test('LandForms-admin and business-form-templates have download action buttons in tables', () => {
  for (const pageName of ['LandForms-admin.html', 'business-form-templates.html']) {
    const html = fs.readFileSync(path.join(root, 'src/pages', pageName), 'utf8');
    assert.match(html, /data-action="download"/);
    assert.match(html, /downloadRow\(row\)/);
    assert.match(html, /downloadReferencePdf/);
  }
});
