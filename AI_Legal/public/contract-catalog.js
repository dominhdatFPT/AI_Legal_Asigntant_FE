import { loadReferenceCatalog, filterReferences, domainLabels, procedureLabel, procedureChoices } from './reference-catalog.mjs';

const byId = (id) => document.getElementById(id);
const search = byId('catalog-search');
const domain = byId('catalog-domain');
const procedure = byId('catalog-procedure');
let items = [];
let page = 1;
const pageSize = 12;

function updateProcedures() {
  const previous = procedure.value;
  procedure.replaceChildren(new Option('Tất cả thủ tục', ''));
  const relevant = filterReferences(items, { domain: domain.value });
  const choices = procedureChoices(relevant);
  for (const [value, label] of choices) procedure.add(new Option(label, value));
  procedure.value = choices.has(previous) ? previous : '';
}

function render() {
  const matches = filterReferences(items, { query: search.value, domain: domain.value, procedure: procedure.value });
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  page = Math.min(page, pages);
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
  for (const item of shown) {
    const card = document.createElement('article'); card.className = 'template-card';
    const preview = document.createElement('div'); preview.className = 'document-thumbnail';
    const image = document.createElement('img'); image.src = item.pages[0]; image.alt = ''; image.loading = 'lazy';
    const format = document.createElement('span'); format.className = 'file-format'; format.textContent = `PDF · ${item.page_count} trang`;
    preview.append(image, format);
    const content = document.createElement('div'); content.className = 'card-content';
    const category = document.createElement('p'); category.className = 'card-category'; category.textContent = domainLabels[item.domain] || 'Biểu mẫu';
    const title = document.createElement('h3'); title.textContent = item.name; title.title = item.name;
    const description = document.createElement('p'); description.className = 'card-description'; description.textContent = item.description;
    const procedureInfo = document.createElement('p'); procedureInfo.className = 'card-procedure'; procedureInfo.textContent = procedureLabel(item);
    const bottom = document.createElement('div'); bottom.className = 'card-bottom';
    const link = document.createElement('a'); link.className = 'primary-button';
    link.href = `/xem-mau-don?template=${encodeURIComponent(item.id)}`;
    link.textContent = 'Xem mẫu'; link.setAttribute('aria-label', `Xem mẫu: ${item.name}`);
    bottom.append(link); content.append(category, title, description, procedureInfo, bottom); card.append(preview, content); results.append(card);
  }
}

async function load() {
  search.disabled = true; domain.disabled = true; procedure.disabled = true;
  items = []; page = 1;
  byId('catalog-retry').hidden = true; byId('catalog-status').hidden = true;
  byId('catalog-loading').hidden = false; byId('catalog-empty').hidden = true;
  byId('catalog-results').replaceChildren(); byId('catalog-count').textContent = 'Đang tải danh sách…';
  byId('catalog-pagination').hidden = true;
  try {
    const catalog = await loadReferenceCatalog(); items = catalog.items;
    const previousDomain = domain.value;
    domain.replaceChildren(new Option('Tất cả lĩnh vực', ''));
    for (const item of catalog.domains) domain.add(new Option(item.name, item.code));
    domain.value = catalog.domains.some((entry) => entry.code === previousDomain) ? previousDomain : '';
    updateProcedures(); render();
    search.disabled = false; domain.disabled = false; procedure.disabled = false;
  } catch {
    byId('catalog-status').textContent = 'Chưa tải được thư viện mẫu. Kiểm tra kết nối và thử lại.';
    byId('catalog-status').hidden = false; byId('catalog-retry').hidden = false;
    byId('catalog-count').textContent = 'Danh sách tạm thời chưa sẵn sàng';
  } finally { byId('catalog-loading').hidden = true; }
}

search.addEventListener('input', () => { page = 1; render(); });
domain.addEventListener('change', () => { page = 1; updateProcedures(); render(); });
procedure.addEventListener('change', () => { page = 1; render(); });
byId('catalog-reset').addEventListener('click', () => { search.value = ''; domain.value = ''; procedure.value = ''; page = 1; updateProcedures(); render(); });
byId('catalog-prev').addEventListener('click', () => { page -= 1; render(); byId('results-title').scrollIntoView({ block: 'start' }); });
byId('catalog-next').addEventListener('click', () => { page += 1; render(); byId('results-title').scrollIntoView({ block: 'start' }); });
byId('catalog-retry').addEventListener('click', load);
await load();
