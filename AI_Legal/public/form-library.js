// Trang "Kho mẫu đơn tham khảo": lấy danh sách mẫu đơn từ Backend (procedure-service),
// tìm kiếm và lọc ngay trên trình duyệt; nút Xem/Tải mở file do Backend trả về.
import { fetchFormTemplates, getApiBaseUrl } from '/auth-api.js';

const formListEl = document.getElementById('form-list');
const formSearchEl = document.getElementById('form-search');
const formFiltersEl = document.getElementById('form-filters');
const formCountEl = document.getElementById('form-count');
const formEmptyEl = document.getElementById('form-empty');

const ALL_CATEGORIES = 'Tất cả';

let forms = [];
let activeCategory = ALL_CATEGORIES;
let apiBaseUrl = '';

const filterClasses = {
  active: 'bg-primary-container text-on-primary shadow-[0_2px_8px_rgba(185,28,28,0.35)]',
  inactive: 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
};
const buttonClasses = {
  primary: 'shrink-0 h-9 px-space-md flex items-center gap-space-xs rounded-lg bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-colors',
  secondary: 'shrink-0 h-9 px-space-sm flex items-center rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors'
};

// Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu.
function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Link file mẫu trên Backend: inline để xem, download=true để tải về.
function fileUrl(id, download) {
  return `${apiBaseUrl}/api/procedures/templates/${encodeURIComponent(id)}/file${download ? '?download=true' : ''}`;
}

function renderFilters() {
  const categories = [ALL_CATEGORIES, ...new Set(forms.map((form) => form.domain_label))];
  formFiltersEl.innerHTML = '';

  categories.forEach((category) => {
    const button = document.createElement('button');
    const isActive = category === activeCategory;
    button.type = 'button';
    button.className = `h-9 px-space-md rounded-lg font-label-lg text-label-lg transition-colors ${isActive ? filterClasses.active : filterClasses.inactive}`;
    button.setAttribute('aria-pressed', String(isActive));
    button.textContent = category;
    button.addEventListener('click', () => {
      activeCategory = category;
      renderFilters();
      renderForms();
    });
    formFiltersEl.appendChild(button);
  });
}

function createLink(label, icon, href, className, title) {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  link.title = title;
  link.innerHTML = `<span class="material-symbols-outlined text-title-sm" aria-hidden="true">${icon}</span>`;
  if (label) {
    const text = document.createElement('span');
    text.textContent = label;
    link.appendChild(text);
  } else {
    link.setAttribute('aria-label', title);
  }
  return link;
}

function createFormItem(form) {
  const item = document.createElement('li');
  item.className = 'bg-surface-container-lowest rounded-xl shadow-[0_2px_12px_rgba(28,25,23,0.06)] p-space-md flex items-center gap-space-md';

  const icon = document.createElement('div');
  const isPdf = form.format === 'PDF';
  icon.className = `w-12 h-12 shrink-0 rounded-lg flex flex-col items-center justify-center ${isPdf ? 'bg-primary-fixed text-primary' : 'bg-blue-50 text-blue-700'}`;
  icon.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">description</span>';
  const format = document.createElement('span');
  format.className = 'font-label-sm text-label-sm';
  format.textContent = form.format;
  icon.appendChild(format);

  const info = document.createElement('div');
  info.className = 'flex-1 min-w-0 flex flex-col gap-space-xs';
  const name = document.createElement('h2');
  name.className = 'font-title-sm text-title-sm text-on-surface';
  name.textContent = form.name;
  const meta = document.createElement('div');
  meta.className = 'flex flex-wrap items-center gap-space-sm';
  const category = document.createElement('span');
  category.className = 'px-space-sm py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed-variant font-label-md text-label-md';
  category.textContent = form.domain_label;
  const size = document.createElement('span');
  size.className = 'font-label-md text-label-md text-on-surface-variant';
  size.textContent = formatSize(form.size);
  meta.append(category, size);
  info.append(name, meta);

  item.append(icon, info);
  // viewable do Backend tính: PDF/ảnh, hoặc mẫu Word đã có bản PDF xem trước.
  if (form.viewable) {
    item.append(
      createLink('Xem', 'visibility', fileUrl(form.id, false), buttonClasses.primary, `Xem ${form.name}`),
      createLink('', 'download', fileUrl(form.id, true), buttonClasses.secondary, `Tải ${form.name}`)
    );
  } else {
    item.append(createLink('Tải về', 'download', fileUrl(form.id, true), buttonClasses.primary, `Tải ${form.name} (${form.format})`));
  }
  return item;
}

function renderForms() {
  const keyword = normalizeText(formSearchEl.value.trim());
  const visible = forms.filter(
    (form) =>
      (activeCategory === ALL_CATEGORIES || form.domain_label === activeCategory) &&
      (normalizeText(form.name).includes(keyword) || normalizeText(form.procedure).includes(keyword))
  );

  formListEl.replaceChildren(...visible.map(createFormItem));
  formCountEl.textContent = `Hiển thị ${visible.length} / ${forms.length} mẫu đơn`;
  formEmptyEl.textContent = 'Không tìm thấy mẫu đơn phù hợp.';
  formEmptyEl.classList.toggle('hidden', visible.length > 0);
}

function renderError(error) {
  formCountEl.textContent = '';
  formListEl.replaceChildren();
  formEmptyEl.textContent = error?.code === 'backend/unreachable'
    ? 'Không kết nối được máy chủ. Vui lòng kiểm tra Backend đang chạy rồi tải lại trang.'
    : error?.backendMessage || 'Không tải được danh sách mẫu đơn. Vui lòng thử lại sau.';
  formEmptyEl.classList.remove('hidden');
}

async function loadForms() {
  formCountEl.textContent = 'Đang tải danh sách mẫu đơn...';
  try {
    [apiBaseUrl, { items: forms }] = await Promise.all([getApiBaseUrl(), fetchFormTemplates()]);
    renderFilters();
    renderForms();
  } catch (error) {
    renderError(error);
  }
}

formSearchEl.addEventListener('input', renderForms);
loadForms();
