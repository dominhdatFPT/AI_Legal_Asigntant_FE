// Điền dữ liệu thật cho dashboard admin: số đếm và danh sách hồ sơ của mọi người dùng.
// Backend chỉ trả dữ liệu này cho token có role admin.
import {
  COMING_SOON_HTML,
  STATUS_LABELS,
  escapeHtml,
  fetchAllApplications,
  fetchApplicationSummary,
  formatDate
} from '/auth-api.js';

const PAGE_SIZE = 10;
const state = { page: 1, domain: '', q: '' };
const $ = (selector) => document.querySelector(selector);

const STATUS_STYLES = {
  draft: 'bg-stone-100 text-stone-700 border-stone-300',
  submitted: 'bg-amber-50 text-amber-800 border-amber-300',
  processing: 'bg-amber-100 text-amber-900 border-amber-400',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  cancelled: 'bg-red-50 text-red-800 border-red-300'
};

document.querySelectorAll('[data-coming-soon]').forEach((element) => {
  element.innerHTML = COMING_SOON_HTML;
});

async function renderSummary() {
  try {
    const summary = await fetchApplicationSummary();
    const values = {
      total: summary.total,
      land: summary.by_domain.land,
      business: summary.by_domain.business,
      in_progress: summary.by_status.submitted + summary.by_status.processing
    };
    document.querySelectorAll('[data-admin-stat]').forEach((element) => {
      element.textContent = values[element.dataset.adminStat].toLocaleString('vi-VN');
    });
    $('[data-domain-count="all"]').textContent = summary.total;
    $('[data-domain-count="land"]').textContent = summary.by_domain.land;
    $('[data-domain-count="business"]').textContent = summary.by_domain.business;
    $('#db-status').textContent = 'Trực tuyến';
  } catch {
    document.querySelectorAll('[data-admin-stat], [data-domain-count]').forEach((element) => { element.textContent = '—'; });
    $('#db-status').textContent = 'mất kết nối';
  }
}

function paintTabs() {
  document.querySelectorAll('[data-domain]').forEach((button) => {
    const active = button.dataset.domain === state.domain;
    ['bg-gradient-to-r', 'from-red-700', 'to-red-600', 'text-white', 'shadow-sm', 'font-bold']
      .forEach((cls) => button.classList.toggle(cls, active));
    ['text-stone-600', 'font-semibold'].forEach((cls) => button.classList.toggle(cls, !active));
    button.setAttribute('aria-pressed', String(active));
  });
}

async function renderTable() {
  const body = $('#admin-applications-body');
  paintTabs();
  try {
    const { items, pagination } = await fetchAllApplications({
      domain: state.domain, q: state.q, page: state.page, pageSize: PAGE_SIZE
    });
    body.innerHTML = items.length
      ? items.map((item) => `
        <tr class="hover:bg-amber-50/40 transition-colors">
          <td class="py-4 px-4">
            <div class="font-mono font-bold text-red-700">${escapeHtml(`${item.procedure_code}-${item.id.slice(0, 8).toUpperCase()}`)}</div>
            <div class="font-body-sm text-body-sm text-stone-500">${formatDate(item.created_at)}</div>
          </td>
          <td class="py-4 px-4">
            <div class="font-semibold text-stone-900">${escapeHtml(item.applicant_name || '—')}</div>
            <div class="font-body-sm text-body-sm text-stone-500">${item.applicant_id_number ? `CCCD: ${escapeHtml(item.applicant_id_number)}` : ''}</div>
          </td>
          <td class="py-4 px-4">
            <div class="font-semibold text-stone-900">${escapeHtml(item.procedure_name || item.procedure_code)}</div>
            <div class="font-body-sm text-body-sm text-stone-500">${escapeHtml(item.address || '')}</div>
          </td>
          <td class="py-4 px-4">${COMING_SOON_HTML}</td>
          <td class="py-4 px-4"><span class="px-2.5 py-1 rounded-full border font-label-sm text-label-sm font-bold ${STATUS_STYLES[item.status] || ''}">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span></td>
          <td class="py-4 px-4 text-right">${COMING_SOON_HTML}</td>
        </tr>`).join('')
      : `<tr><td class="py-6 px-4 text-center text-stone-500" colspan="6">${state.q || state.domain ? 'Không có hồ sơ phù hợp.' : 'Chưa có hồ sơ nào trong hệ thống.'}</td></tr>`;
    const from = pagination.total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
    const to = Math.min(pagination.page * pagination.page_size, pagination.total);
    $('#admin-applications-range').textContent = `Hiển thị ${from} - ${to} trên ${pagination.total} hồ sơ`;
    $('#admin-applications-page').textContent = `${pagination.page} / ${Math.max(pagination.total_pages, 1)}`;
    $('#admin-applications-prev').disabled = pagination.page <= 1;
    $('#admin-applications-next').disabled = pagination.page >= pagination.total_pages;
  } catch {
    body.innerHTML = `<tr><td class="py-6 px-4 text-center text-red-700" colspan="6" role="alert">Không tải được hồ sơ, thử lại sau. <button type="button" id="admin-table-retry" class="font-bold underline">Thử lại</button></td></tr>`;
    $('#admin-table-retry').addEventListener('click', renderTable);
  }
}

document.querySelectorAll('[data-domain]').forEach((button) => {
  button.addEventListener('click', () => {
    state.domain = button.dataset.domain;
    state.page = 1;
    renderTable();
  });
});

// Ô tìm kiếm lớn: tìm theo tên, CCCD hoặc mã thủ tục; ô chọn loại hồ sơ lọc theo lĩnh vực.
const searchInput = $('#globalSearchInput');
const searchType = $('#searchTypeFilter');
let searchTimer;
const runSearch = () => {
  state.q = searchInput.value.trim();
  state.domain = ['land', 'business'].includes(searchType.value) ? searchType.value : '';
  state.page = 1;
  renderTable();
};
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 300);
});
searchType.addEventListener('change', runSearch);
$('#admin-search-btn').addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') runSearch(); });

$('#admin-applications-prev').addEventListener('click', () => { state.page -= 1; renderTable(); });
$('#admin-applications-next').addEventListener('click', () => { state.page += 1; renderTable(); });

renderSummary();
renderTable();
