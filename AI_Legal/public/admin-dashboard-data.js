// Điền dữ liệu thật cho dashboard admin: số đếm và danh sách hồ sơ của mọi người dùng.
// Backend chỉ trả dữ liệu này cho token có role admin.
import {
  STATUS_LABELS,
  escapeHtml,
  fetchAllApplications,
  fetchApplicationSummary,
  formatDate
} from '/auth-api.js';

const PAGE_SIZE = 10;
const state = { page: 1, domain: '', q: '' };
const $ = (selector) => document.querySelector(selector);
const formatPercent = (value, total) => `${Math.round(total > 0 ? (value / total) * 100 : 0)}%`;
const setTextIfPresent = (selector, text) => {
  const element = $(selector);
  if (element) element.textContent = text;
};
const COMING_SOON_BADGE = '<span class="admin-coming-soon"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>Sắp ra mắt</span>';

const STATUS_STYLES = {
  draft: 'admin-status--draft',
  submitted: 'admin-status--submitted',
  processing: 'admin-status--processing',
  completed: 'admin-status--completed',
  cancelled: 'admin-status--cancelled'
};

document.querySelectorAll('[data-coming-soon]').forEach((element) => {
  element.innerHTML = COMING_SOON_BADGE;
});

async function renderSummary() {
  try {
    const summary = await fetchApplicationSummary();
    const total = summary.total || 0;
    const values = {
      total,
      land: summary.by_domain.land,
      business: summary.by_domain.business,
      in_progress: summary.by_status.submitted + summary.by_status.processing
    };
    const orchardValues = {
      intake: formatPercent(summary.by_status.draft + summary.by_status.submitted, total),
      business: formatPercent(summary.by_domain.business, total),
      land: formatPercent(summary.by_domain.land, total),
      completed: formatPercent(summary.by_status.completed, total)
    };
    document.querySelectorAll('[data-admin-stat]').forEach((element) => {
      element.textContent = values[element.dataset.adminStat].toLocaleString('vi-VN');
    });
    document.querySelectorAll('[data-orchard-stat]').forEach((element) => {
      element.textContent = orchardValues[element.dataset.orchardStat] ?? '—';
    });
    $('[data-domain-count="all"]').textContent = summary.total.toLocaleString('vi-VN');
    $('[data-domain-count="land"]').textContent = summary.by_domain.land.toLocaleString('vi-VN');
    $('[data-domain-count="business"]').textContent = summary.by_domain.business.toLocaleString('vi-VN');
    setTextIfPresent('#db-status', 'Trực tuyến');
  } catch {
    document.querySelectorAll('[data-admin-stat], [data-domain-count], [data-orchard-stat]').forEach((element) => { element.textContent = '—'; });
    setTextIfPresent('#db-status', 'mất kết nối');
  }
}

function paintTabs() {
  document.querySelectorAll('[data-domain]').forEach((button) => {
    const active = button.dataset.domain === state.domain;
    button.classList.toggle('is-active', active);
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
        <tr>
          <td><div class="admin-table__code">${escapeHtml(`${item.procedure_code}-${item.id.slice(0, 8).toUpperCase()}`)}</div><span class="admin-table__secondary">${formatDate(item.created_at)}</span></td>
          <td><div class="admin-table__primary">${escapeHtml(item.applicant_name || '—')}</div><span class="admin-table__secondary">${item.applicant_id_number ? `CCCD: ${escapeHtml(item.applicant_id_number)}` : ''}</span></td>
          <td><div class="admin-table__primary">${escapeHtml(item.procedure_name || item.procedure_code)}</div><span class="admin-table__secondary">${escapeHtml(item.address || '')}</span></td>
          <td>${COMING_SOON_BADGE}</td>
          <td><span class="admin-status ${STATUS_STYLES[item.status] || ''}">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span></td>
          <td class="admin-table__action-cell">${COMING_SOON_BADGE}</td>
        </tr>`).join('')
      : `<tr><td class="admin-table__message" colspan="6">${state.q || state.domain ? 'Không có hồ sơ phù hợp.' : 'Chưa có hồ sơ nào trong hệ thống.'}</td></tr>`;

    const from = pagination.total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
    const to = Math.min(pagination.page * pagination.page_size, pagination.total);
    $('#admin-applications-range').textContent = `Hiển thị ${from} - ${to} trên ${pagination.total.toLocaleString('vi-VN')} hồ sơ`;
    $('#admin-applications-page').textContent = `${pagination.page} / ${Math.max(pagination.total_pages, 1)}`;
    $('#admin-applications-prev').disabled = pagination.page <= 1;
    $('#admin-applications-next').disabled = pagination.page >= pagination.total_pages;
  } catch {
    body.innerHTML = '<tr><td class="admin-table__message" colspan="6" role="alert">Không tải được hồ sơ, thử lại sau. <button type="button" id="admin-table-retry" class="admin-table__retry">Thử lại</button></td></tr>';
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

// Tìm theo mã, CCCD, tên hoặc thửa đất; Ctrl/Cmd+K tập trung vào ô tìm kiếm.
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
