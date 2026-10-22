// Điền dữ liệu thật cho trang tổng quan của người dùng (citizen/lawyer).
// Mọi dữ liệu lấy từ Backend theo token đăng nhập; trang không chứa số liệu cứng.
import {
  AGENCY_LABELS,
  COMING_SOON_HTML,
  STATUS_LABELS,
  escapeHtml,
  fetchMyApplications,
  fetchMyCitizenProfile,
  fetchMyDocuments,
  fetchProcedures,
  formatDate,
  formatFee
} from '/auth-api.js';

const PAGE_SIZE = 10;
const state = { page: 1, status: '', domain: '' };

const STATUS_STYLES = {
  draft: 'bg-surface-container-high text-on-surface-variant',
  submitted: 'bg-secondary-fixed text-on-secondary-fixed',
  processing: 'bg-secondary-fixed text-on-secondary-fixed',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-error-container text-on-error-container'
};

const $ = (selector) => document.querySelector(selector);

const statusBadge = (status) =>
  `<span class="inline-flex items-center gap-1 font-label-sm text-label-sm px-space-sm py-1 rounded font-semibold ${STATUS_STYLES[status] || ''}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;

// Hạn trả chỉ có nghĩa khi hồ sơ đang chờ cơ quan giải quyết.
const dueDate = (item) => (['submitted', 'processing'].includes(item.status) ? item.due_date : null);

const applicationCode = (item) => `${item.procedure_code}-${item.id.slice(0, 8).toUpperCase()}`;

const errorBox = (message, retryId) =>
  `<div role="alert" class="flex flex-col items-start gap-space-xs text-error font-body-sm text-body-sm">${escapeHtml(message)}<button type="button" id="${retryId}" class="text-primary font-semibold hover:underline">Thử lại</button></div>`;

const fillComingSoon = () => {
  document.querySelectorAll('[data-coming-soon]').forEach((element) => {
    element.innerHTML = COMING_SOON_HTML;
  });
};

async function renderStats() {
  const count = (status) => fetchMyApplications({ status, pageSize: 1 }).then((data) => data.pagination.total);
  try {
    const [total, submitted, processing, completed, nextDue] = await Promise.all([
      count(), count('submitted'), count('processing'), count('completed'),
      fetchMyApplications({ status: 'processing', pageSize: 50 })
    ]);
    $('[data-stat="total"]').textContent = total;
    $('[data-stat="in_progress"]').textContent = submitted + processing;
    $('[data-stat="completed"]').textContent = completed;
    const dues = nextDue.items.map((item) => item.due_date).filter(Boolean).sort();
    if (dues.length) $('[data-stat-note="next_due"]').textContent = `Hạn trả gần nhất: ${formatDate(dues[0])}`;
  } catch {
    document.querySelectorAll('[data-stat]').forEach((element) => { element.textContent = '—'; });
  }
}

async function renderProcessing() {
  const list = $('#processing-list');
  try {
    const { items, pagination } = await fetchMyApplications({ status: 'processing', pageSize: 3 });
    $('#processing-count').textContent = `${pagination.total} hồ sơ đang xử lý`;
    list.innerHTML = items.length
      ? items.map((item) => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs bg-surface-container-low/50 p-space-md rounded-lg">
          <div class="flex flex-col">
            <span class="font-mono text-label-md text-primary font-bold">${escapeHtml(applicationCode(item))}</span>
            <span class="font-title-sm text-title-sm text-on-surface font-semibold">${escapeHtml(item.procedure_name || item.procedure_code)}</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant">Nộp ngày ${formatDate(item.created_at)}${dueDate(item) ? ` • Hạn trả ${formatDate(dueDate(item))}` : ''}</span>
          </div>
          ${statusBadge(item.status)}
        </div>`).join('')
      : '<p class="font-body-sm text-body-sm text-on-surface-variant">Không có hồ sơ nào đang xử lý.</p>';
  } catch {
    $('#processing-count').textContent = '—';
    list.innerHTML = errorBox('Không tải được hồ sơ, thử lại sau.', 'processing-retry');
    $('#processing-retry').addEventListener('click', renderProcessing);
  }
}

function paintFilters() {
  document.querySelectorAll('#status-filters [data-status]').forEach((button) => {
    const active = button.dataset.status === state.status;
    button.classList.toggle('bg-primary-container', active);
    button.classList.toggle('text-on-primary', active);
    button.classList.toggle('bg-surface-container-high', !active);
    button.classList.toggle('text-on-surface', !active);
    button.setAttribute('aria-pressed', String(active));
  });
}

async function renderTable() {
  const body = $('#my-applications-body');
  paintFilters();
  try {
    const { items, pagination } = await fetchMyApplications({
      status: state.status, domain: state.domain, page: state.page, pageSize: PAGE_SIZE
    });
    body.innerHTML = items.length
      ? items.map((item) => `
        <tr class="hover:bg-surface-container-low transition-colors">
          <td class="py-space-md px-space-md font-mono text-primary font-bold whitespace-nowrap">${escapeHtml(applicationCode(item))}</td>
          <td class="py-space-md px-space-md">
            <span class="font-title-sm text-title-sm text-on-surface block">${escapeHtml(item.procedure_name || item.procedure_code)}</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant">Lệ phí: ${escapeHtml(formatFee(item.fee))}</span>
          </td>
          <td class="py-space-md px-space-md text-on-surface-variant">${escapeHtml(AGENCY_LABELS[item.receiving_agency_level] || '—')}</td>
          <td class="py-space-md px-space-md whitespace-nowrap">${formatDate(item.created_at)}</td>
          <td class="py-space-md px-space-md whitespace-nowrap font-semibold text-secondary">${formatDate(dueDate(item))}</td>
          <td class="py-space-md px-space-md text-center whitespace-nowrap">${statusBadge(item.status)}</td>
          <td class="py-space-md px-space-md text-right whitespace-nowrap">${COMING_SOON_HTML}</td>
        </tr>`).join('')
      : `<tr><td class="py-space-lg px-space-md text-center text-on-surface-variant" colspan="7">${
          state.status || state.domain ? 'Không có hồ sơ phù hợp bộ lọc.' : 'Bạn chưa có hồ sơ nào. <a class="text-primary font-semibold hover:underline" href="/application-submission">Tạo hồ sơ</a>'
        }</td></tr>`;
    const from = pagination.total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
    const to = Math.min(pagination.page * pagination.page_size, pagination.total);
    $('#my-applications-range').textContent = `Hiển thị ${from} - ${to} trong tổng số ${pagination.total} hồ sơ`;
    $('#my-applications-page').textContent = `${pagination.page} / ${Math.max(pagination.total_pages, 1)}`;
    $('#my-applications-prev').disabled = pagination.page <= 1;
    $('#my-applications-next').disabled = pagination.page >= pagination.total_pages;
  } catch {
    body.innerHTML = `<tr><td class="py-space-lg px-space-md" colspan="7">${errorBox('Không tải được hồ sơ, thử lại sau.', 'table-retry')}</td></tr>`;
    $('#table-retry').addEventListener('click', renderTable);
  }
}

async function renderDocuments() {
  const box = $('#my-documents');
  try {
    const [profile, documents] = await Promise.all([
      fetchMyCitizenProfile().catch(() => null),
      fetchMyDocuments().catch(() => ({ items: [] }))
    ]);
    const rows = [];
    if (profile) {
      rows.push({ icon: 'badge', title: 'Căn cước công dân', note: `${String(profile.id_number).slice(0, 6)}****** • Đã xác nhận` });
    }
    documents.items.slice(0, 5).forEach((doc) => {
      rows.push({ icon: 'description', title: doc.original_filename || 'Tài liệu', note: `Tải lên ${formatDate(doc.created_at)}` });
    });
    box.innerHTML = rows.length
      ? rows.map((row) => `
        <div class="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container-low">
          <div class="w-9 h-9 rounded bg-primary-container/10 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-title-md">${row.icon}</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-title-sm text-title-sm text-on-surface font-semibold truncate">${escapeHtml(row.title)}</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant font-mono">${escapeHtml(row.note)}</span>
          </div>
        </div>`).join('')
      : '<p class="font-body-sm text-body-sm text-on-surface-variant">Chưa có giấy tờ nào. <a class="text-primary font-semibold hover:underline" href="/detail-information">Cập nhật CCCD</a></p>';
  } catch {
    box.innerHTML = errorBox('Không tải được tài liệu.', 'documents-retry');
    $('#documents-retry').addEventListener('click', renderDocuments);
  }
}

async function renderFeatured() {
  const box = $('#featured-procedures');
  try {
    const [land, business] = await Promise.all([fetchProcedures('land'), fetchProcedures('business')]);
    const picks = [...land.slice(0, 2), ...business.slice(0, 2)];
    box.innerHTML = picks.length
      ? picks.map((procedure) => `
        <a class="p-space-sm rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-between group" href="/application-submission?procedure=${encodeURIComponent(procedure.code)}">
          <div class="flex items-center gap-space-sm">
            <span class="material-symbols-outlined text-primary">${procedure.domain === 'land' ? 'landscape' : 'storefront'}</span>
            <div class="flex flex-col">
              <span class="font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors">${escapeHtml(procedure.name)}</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">${escapeHtml(procedure.code)} • ${escapeHtml(AGENCY_LABELS[procedure.receiving_agency_level] || 'Cơ quan tiếp nhận')}</span>
            </div>
          </div>
          <span class="material-symbols-outlined text-on-surface-variant text-title-sm">arrow_forward</span>
        </a>`).join('')
      : '<p class="font-body-sm text-body-sm text-on-surface-variant">Chưa có thủ tục nào.</p>';
  } catch {
    box.innerHTML = errorBox('Không tải được danh mục thủ tục.', 'featured-retry');
    $('#featured-retry').addEventListener('click', renderFeatured);
  }
}

// Gắn sự kiện mỗi lần khung tổng quan được vẽ lại (user-dashboard-navigation.js thay lại HTML gốc).
function render() {
  if (!$('#my-applications-body')) return; // đang ở màn hình tạo hồ sơ
  fillComingSoon();
  document.querySelectorAll('#status-filters [data-status]').forEach((button) => {
    button.addEventListener('click', () => {
      state.status = button.dataset.status;
      state.page = 1;
      renderTable();
    });
  });
  $('#domain-filter').value = state.domain;
  $('#domain-filter').addEventListener('change', (event) => {
    state.domain = event.target.value;
    state.page = 1;
    renderTable();
  });
  $('#my-applications-prev').addEventListener('click', () => { state.page -= 1; renderTable(); });
  $('#my-applications-next').addEventListener('click', () => { state.page += 1; renderTable(); });
  renderStats();
  renderProcessing();
  renderTable();
  renderDocuments();
  renderFeatured();
}

window.addEventListener('user-dashboard:shown', render);
render();
