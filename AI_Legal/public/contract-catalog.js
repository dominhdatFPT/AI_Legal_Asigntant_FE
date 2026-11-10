import { loadReferenceCatalog, filterReferences, domainLabels, procedureLabel, procedureChoices, downloadReferencePdf } from './reference-catalog.mjs';
import { formTemplates } from '/form-template-service.js';

const byId = (id) => document.getElementById(id);
const search = byId('catalog-search');
const domain = byId('catalog-domain');
const procedure = byId('catalog-procedure');

let items = [];
let page = 1;
const pageSize = 12;

// Bộ nhớ đệm tạm thời cho mẫu tự tạo (Custom Form Templates)
let customTemplatesCache = null;
let customTemplatesCacheTime = 0;
const CUSTOM_CACHE_TTL = 300000; // 5 phút

async function loadCustomTemplates(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && customTemplatesCache && (now - customTemplatesCacheTime) < CUSTOM_CACHE_TTL) {
    return customTemplatesCache;
  }
  if (!forceRefresh && typeof sessionStorage !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('custom_templates_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.timestamp && (now - parsed.timestamp) < CUSTOM_CACHE_TTL && parsed.payload) {
          customTemplatesCache = parsed.payload;
          customTemplatesCacheTime = parsed.timestamp;
          return customTemplatesCache;
        }
      }
    } catch {}
  }

  const res = await formTemplates.listPublished().catch(() => ({ items: [] }));
  customTemplatesCache = res;
  customTemplatesCacheTime = now;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem('custom_templates_cache', JSON.stringify({ timestamp: now, payload: res }));
    } catch {}
  }
  return res;
}

// Đọc trạng thái ban đầu: ưu tiên URL Query Params, sau đó đến sessionStorage
function getInitialState() {
  const urlParams = new URLSearchParams(window.location.search);
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem('catalog_last_state') || 'null');
  } catch {}

  const pageParam = parseInt(urlParams.get('page'), 10);
  const initialPage = !isNaN(pageParam) && pageParam > 0
    ? pageParam
    : (saved && typeof saved.page === 'number' && saved.page > 0 ? saved.page : 1);

  const initialDomain = urlParams.get('domain') ?? saved?.domain ?? '';
  const initialProcedure = urlParams.get('procedure') ?? saved?.procedure ?? '';
  const initialQuery = urlParams.get('q') ?? saved?.query ?? '';
  const initialScroll = saved?.scrollY ?? 0;

  return {
    page: initialPage,
    domain: initialDomain,
    procedure: initialProcedure,
    query: initialQuery,
    scrollY: initialScroll
  };
}

// Đồng bộ trạng thái vào URL và sessionStorage
function syncState(updateHistory = true) {
  const state = {
    page,
    domain: domain.value,
    procedure: procedure.value,
    query: search.value,
    scrollY: window.scrollY
  };

  try {
    sessionStorage.setItem('catalog_last_state', JSON.stringify(state));
  } catch {}

  if (updateHistory) {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page);
    if (domain.value) params.set('domain', domain.value);
    if (procedure.value) params.set('procedure', procedure.value);
    if (search.value.trim()) params.set('q', search.value.trim());

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({ ...state }, '', newUrl);
  }
}

function updateProcedures() {
  const previous = procedure.value;
  procedure.replaceChildren(new Option('Tất cả thủ tục', ''));
  const relevant = filterReferences(items, { domain: domain.value });
  const choices = procedureChoices(relevant);
  for (const [value, label] of choices) procedure.add(new Option(label, value));
  procedure.value = choices.has(previous) ? previous : '';
}

function render(shouldScroll = false) {
  const matches = filterReferences(items, { query: search.value, domain: domain.value, procedure: procedure.value });
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  page = Math.min(Math.max(1, page), pages);
  const first = (page - 1) * pageSize;
  const shown = matches.slice(first, first + pageSize);
  const results = byId('catalog-results');
  results.replaceChildren();

  byId('catalog-count').textContent = matches.length
    ? `Hiển thị ${first + 1}-${first + shown.length} trong ${matches.length} biểu mẫu${domain.value ? ` · ${domainLabels[domain.value]}` : ' · Tất cả lĩnh vực'}`
    : 'Không có biểu mẫu phù hợp với bộ lọc';
  byId('catalog-empty').hidden = matches.length > 0;
  byId('catalog-reset').hidden = !search.value && !domain.value && !procedure.value;
  byId('catalog-pagination').hidden = pages < 2;
  byId('catalog-prev').disabled = page === 1;
  byId('catalog-next').disabled = page === pages;
  byId('catalog-page').textContent = `Trang ${page} / ${pages}`;

  // Đồng bộ trạng thái hiện tại (trang, bộ lọc)
  syncState(true);

  if (shouldScroll) {
    byId('results-title').scrollIntoView({ block: 'start' });
  }

  for (const item of shown) {
    const card = document.createElement('article'); card.className = 'template-card';
    const preview = document.createElement('div'); preview.className = 'document-thumbnail';
    const docSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" fill="none"><rect width="200" height="280" rx="4" fill="%23ffffff" stroke="%23dfd1cc"/><path d="M40 35 h120 M40 50 h90 M40 75 h120 M40 90 h120 M40 105 h100 M40 130 h120 M40 145 h120 M40 160 h80 M40 185 h120 M40 200 h110 M40 225 h60" stroke="%23e2d9d5" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="40" r="14" fill="%23b91c1c" fill-opacity="0.15"/><path d="M95 38 l3 3 7-7" stroke="%23b91c1c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const image = document.createElement('img');
    image.src = (item.pages && item.pages[0]) ? item.pages[0] : docSvg;
    image.alt = item.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    const format = document.createElement('span'); format.className = 'file-format';
    format.textContent = item.is_custom_form ? (item.format || 'Mẫu tham khảo') : `PDF · ${item.page_count} trang`;
    preview.append(image, format);

    const content = document.createElement('div'); content.className = 'card-content';
    const category = document.createElement('p'); category.className = 'card-category'; category.textContent = domainLabels[item.domain] || 'Biểu mẫu';
    const title = document.createElement('h3'); title.textContent = item.name; title.title = item.name;
    const description = document.createElement('p'); description.className = 'card-description'; description.textContent = item.description;
    const procedureInfo = document.createElement('p'); procedureInfo.className = 'card-procedure'; procedureInfo.textContent = procedureLabel(item);
    const bottom = document.createElement('div'); bottom.className = 'card-bottom';
    const actions = document.createElement('div'); actions.className = 'card-actions';

    // Link "Xem mẫu" mang theo tham số trang và bộ lọc để khi quay lại vẫn giữ đúng vị trí
    const link = document.createElement('a'); link.className = 'primary-button';
    const linkParams = new URLSearchParams();
    linkParams.set('template', item.id);
    if (page > 1) linkParams.set('from_page', page);
    if (domain.value) linkParams.set('domain', domain.value);
    if (procedure.value) linkParams.set('procedure', procedure.value);
    if (search.value.trim()) linkParams.set('q', search.value.trim());

    link.href = `/xem-mau-don?${linkParams.toString()}`;
    link.textContent = 'Xem mẫu';
    link.setAttribute('aria-label', `Xem mẫu: ${item.name}`);
    link.addEventListener('click', () => {
      syncState(true);
    });

    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'card-download-btn';
    dlBtn.setAttribute('aria-label', `Tải PDF mẫu: ${item.name}`);
    dlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Tải PDF</span>';
    dlBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      dlBtn.disabled = true;
      const oldHtml = dlBtn.innerHTML;
      dlBtn.textContent = 'Đang tải…';
      try {
        if (item.is_custom_form && item.pdf) {
          const res = await fetch(item.pdf);
          if (!res.ok) throw new Error('Chưa thể tải file biểu mẫu.');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${item.name.replace(/[^\w\s\u00C0-\u024F\u1EA0-\u1EF9-]/gi, '').trim().replace(/\s+/g, '_') || 'mau-don'}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          await downloadReferencePdf(item);
        }
      } catch (err) {
        alert(err.message || 'Không thể tải tệp PDF.');
      } finally {
        dlBtn.disabled = false;
        dlBtn.innerHTML = oldHtml;
      }
    });

    actions.append(link, dlBtn);
    bottom.append(actions);
    content.append(category, title, description, procedureInfo, bottom);
    card.append(preview, content);
    results.append(card);
  }
}

async function load(forceRefresh = false) {
  const initialState = getInitialState();
  page = initialState.page;

  search.disabled = true; domain.disabled = true; procedure.disabled = true;
  byId('catalog-retry').hidden = true; byId('catalog-status').hidden = true;
  byId('catalog-loading').hidden = false; byId('catalog-empty').hidden = true;
  byId('catalog-results').replaceChildren(); byId('catalog-count').textContent = 'Đang tải danh sách…';
  byId('catalog-pagination').hidden = true;

  try {
    // Tối ưu hóa tải song song: gọi cả 2 nguồn cùng lúc (Catalog tĩnh + Mẫu tự tạo từ Admin)
    const [catalog, customRes] = await Promise.all([
      loadReferenceCatalog(fetch, forceRefresh),
      loadCustomTemplates(forceRefresh)
    ]);

    items = [...catalog.items];

    const customItems = customRes.items || [];
    for (const t of customItems) {
      const domainCode = t.domain === 'dat_dai' ? 'land' : 'business';
      const formCode = (t.content?.code || t.code || '').trim();
      const formCodeLabel = formCode ? (formCode.toLowerCase().startsWith('mẫu') ? formCode : `Mẫu số ${formCode}`) : '';
      const matchedProc = (catalog.classifications || []).find((c) =>
        t.procedure_id && (c.procedure_id === t.procedure_id || c.key === t.procedure_id || c.code === t.procedure_id)
      );
      const procKey = matchedProc ? matchedProc.key : (t.procedure_id || 'general');
      const procCode = matchedProc ? (matchedProc.code || formCodeLabel) : formCodeLabel;
      const procName = matchedProc ? matchedProc.name : (formCodeLabel || 'Mẫu đơn dùng chung');

      // Ưu tiên tệp PDF tham khảo do người dùng tải lên: nếu thủ tục đã có trong catalog.items thì không tạo thẻ trùng lặp
      const existingDoc = items.find((it) =>
        (procCode && (it.procedure_code === procCode || (it.procedures || []).some((p) => p.code === procCode))) ||
        (procKey && (it.procedure === procKey || (it.procedures || []).some((p) => p.key === procKey)))
      );
      if (existingDoc) {
        continue;
      }

      items.push({
        id: t.id,
        number: 9000,
        name: t.name,
        description: t.content?.description || 'Biểu mẫu do quản trị viên ban hành, dùng để tham khảo và đối chiếu.',
        domain: domainCode,
        procedure: procKey,
        procedure_code: procCode,
        procedure_name: procName,
        procedures: [{ key: procKey, code: procCode, name: procName }],
        page_count: 1,
        format: t.has_reference_pdf ? 'PDF tham khảo' : 'PDF · Word',
        pdf: `/api/procedures/form-templates/${t.id}/reference-pdf`,
        word_url: `/api/procedures/form-templates/${t.id}/document`,
        pages: [],
        page_dimensions: [],
        text: `${t.name} ${formCodeLabel} ${procName} ${procCode} ${t.content?.description || ''}`,
        content_status: 'source',
        review_notes: '',
        view_only: true,
        can_fill: false,
        is_custom_form: true
      });
    }

    // Thiết lập danh mục lĩnh vực
    domain.replaceChildren(new Option('Tất cả lĩnh vực', ''));
    for (const item of catalog.domains) domain.add(new Option(item.name, item.code));

    // Khôi phục bộ lọc đã chọn trước đó (nếu có)
    if (initialState.domain && catalog.domains.some((entry) => entry.code === initialState.domain)) {
      domain.value = initialState.domain;
    } else {
      domain.value = '';
    }

    updateProcedures();

    if (initialState.procedure) {
      procedure.value = initialState.procedure;
    }

    if (initialState.query) {
      search.value = initialState.query;
    }

    render(false);

    // Khôi phục vị trí cuộn chuột trước đó khi quay lại từ trang xem mẫu
    if (initialState.scrollY > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: initialState.scrollY, behavior: 'instant' });
      });
    }

    search.disabled = false; domain.disabled = false; procedure.disabled = false;
  } catch (err) {
    console.error('Catalog load error:', err);
    byId('catalog-status').textContent = 'Chưa tải được thư viện mẫu. Kiểm tra kết nối và thử lại.';
    byId('catalog-status').hidden = false; byId('catalog-retry').hidden = false;
    byId('catalog-count').textContent = 'Danh sách tạm thời chưa sẵn sàng';
  } finally {
    byId('catalog-loading').hidden = true;
  }
}

search.addEventListener('input', () => { page = 1; render(false); });
domain.addEventListener('change', () => { page = 1; updateProcedures(); render(false); });
procedure.addEventListener('change', () => { page = 1; render(false); });

byId('catalog-reset').addEventListener('click', () => {
  search.value = '';
  domain.value = '';
  procedure.value = '';
  page = 1;
  updateProcedures();
  render(false);
});

byId('catalog-prev').addEventListener('click', () => { page -= 1; render(true); });
byId('catalog-next').addEventListener('click', () => { page += 1; render(true); });
byId('catalog-retry').addEventListener('click', () => load(true));

// Hỗ trợ phím Back/Forward của trình duyệt cập nhật lại trang chính xác
window.addEventListener('popstate', () => {
  const state = getInitialState();
  page = state.page;
  search.value = state.query;
  domain.value = state.domain;
  updateProcedures();
  procedure.value = state.procedure;
  render(false);
});

await load();
