// Điền dữ liệu thật cho trang tổng quan của người dùng (citizen/lawyer).
// Mọi dữ liệu lấy từ Backend theo token đăng nhập; trang không chứa số liệu cứng.
// Trang chỉ hiện loại hồ sơ và thời gian tạo, không hiện chi tiết đơn của người dùng.
import {
  AGENCY_LABELS,
  escapeHtml,
  fetchMyApplications,
  fetchMyCitizenProfile,
  fetchProcedures
} from '/auth-api.js';

const PAGE_SIZE = 10;
const state = { page: 1, domain: '', q: '' };

const $ = (selector) => document.querySelector(selector);

const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const errorBox = (message, retryId) =>
  `<div role="alert" class="flex flex-col items-start gap-space-xs text-error font-body-sm text-body-sm">${escapeHtml(message)}<button type="button" id="${retryId}" class="text-primary font-semibold hover:underline">Thử lại</button></div>`;

// Trang 1 khi không lọc: bảng và số mẫu đơn đã tạo dùng chung 1 request.
let dashboardPromise = null;
let featuredObserver = null;

function loadDashboardData() {
  if (!dashboardPromise) dashboardPromise = fetchMyApplications({ pageSize: PAGE_SIZE });
  return dashboardPromise;
}

const scheduleIdle = (callback) => {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout: 1200 });
  } else {
    setTimeout(callback, 120);
  }
};

async function renderSummary() {
  const box = $('#next-action');
  try {
    const applications = await loadDashboardData();
    if (box === $('#next-action')) {
      $('#forms-created-count').textContent = (applications?.pagination?.total || 0).toLocaleString('vi-VN');
    }
  } catch {
    if (box === $('#next-action')) {
      $('#forms-created-count').textContent = '—';
    }
  }

  // Trì hoãn kiểm tra nhắc cập nhật CCCD sang lúc rảnh để nhường băng thông cho bảng hồ sơ chính
  scheduleIdle(async () => {
    if (box !== $('#next-action')) return;
    try {
      const profile = await fetchMyCitizenProfile();
      if (box !== $('#next-action')) return;
      const missingProfile = !profile;
      box.innerHTML = missingProfile
        ? `<h2 class="font-title-lg text-title-lg text-on-surface font-bold">Việc tiếp theo: cập nhật thông tin CCCD</h2>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Thông tin này được điền sẵn vào đơn, nên bạn cần cập nhật trước khi tạo hồ sơ.</p>
          <a class="h-11 px-space-md rounded-lg transition-all flex items-center justify-center font-title-sm text-title-sm whitespace-nowrap bg-primary-container text-on-primary hover:bg-primary" href="/detail-information">Cập nhật thông tin</a>`
        : '';
      $('.next-panel')?.classList.toggle('has-action', missingProfile);
    } catch {
      // Không tải được thông tin CCCD thì không báo là thiếu.
    }
  });
}

function clearTableFilters() {
  state.domain = '';
  state.q = '';
  state.page = 1;
  $('#domain-filter').value = '';
  $('#dashboard-search-input').value = '';
  renderTable();
}

async function renderTable() {
  const body = $('#my-applications-body');
  try {
    const { page, domain, q } = state;
    const filtered = Boolean(domain || q);
    const res = !filtered && page === 1
      ? await loadDashboardData()
      : await fetchMyApplications({ domain, q, page, pageSize: PAGE_SIZE });
    const items = res.items || [];
    const total = res.pagination?.total || 0;

    body.innerHTML = items.length
      ? items.map((item) => `
        <tr class="hover:bg-surface-container-low transition-colors">
          <td class="py-space-md px-space-md font-title-sm text-title-sm text-on-surface font-semibold">${escapeHtml(item.procedure_name || item.procedure_code)}</td>
          <td class="py-space-md px-space-md whitespace-nowrap text-right">${formatDateTime(item.created_at)}</td>
        </tr>`).join('')
      : `<tr><td class="py-space-lg px-space-md text-center text-on-surface-variant" colspan="2">${
          filtered
            ? 'Không có hồ sơ phù hợp. <button type="button" id="table-clear-filters" class="text-primary font-semibold hover:underline">Xóa bộ lọc</button>'
            : 'Loại hồ sơ bạn tạo sẽ hiện ở đây.'
        }</td></tr>`;

    $('#table-clear-filters')?.addEventListener('click', clearTableFilters);

    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
    const to = Math.min(page * PAGE_SIZE, total);
    $('#my-applications-range').parentElement.classList.toggle('hidden', !total);
    $('#my-applications-range').textContent = `Hiển thị ${from} - ${to} trong tổng số ${total} hồ sơ`;
    $('#my-applications-page').textContent = `${page} / ${totalPages}`;
    $('#my-applications-prev').disabled = page <= 1;
    $('#my-applications-next').disabled = page >= totalPages;
  } catch {
    body.innerHTML = `<tr><td class="py-space-lg px-space-md" colspan="2">${errorBox('Không tải được hồ sơ, thử lại sau.', 'table-retry')}</td></tr>`;
    $('#table-retry').addEventListener('click', () => {
      dashboardPromise = null;
      renderTable();
    });
  }
}

async function renderFeatured() {
  const box = $('#featured-procedures');
  if (!box) return;
  try {
    const [land, business] = await Promise.all([
      fetchProcedures('land').catch(() => []),
      fetchProcedures('business').catch(() => [])
    ]);
    if (box !== $('#featured-procedures')) return;
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
    $('#featured-retry')?.addEventListener('click', renderFeatured);
  }
}

function observeFeatured() {
  const box = $('#featured-procedures');
  if (!box) return;
  featuredObserver?.disconnect();
  if (!('IntersectionObserver' in window)) {
    renderFeatured();
    return;
  }
  featuredObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      featuredObserver?.disconnect();
      featuredObserver = null;
      renderFeatured();
    }
  }, { rootMargin: '150px 0px' });
  featuredObserver.observe(box);
}

// Gắn sự kiện mỗi lần khung tổng quan được vẽ lại (user-dashboard-navigation.js thay lại HTML gốc).
function render() {
  if (!$('#my-applications-body')) return; // đang ở màn hình tạo hồ sơ
  $('#domain-filter').value = state.domain;
  $('#domain-filter').addEventListener('change', (event) => {
    state.domain = event.target.value;
    state.page = 1;
    renderTable();
  });
  $('#my-applications-prev').addEventListener('click', () => { state.page -= 1; renderTable(); });
  $('#my-applications-next').addEventListener('click', () => { state.page += 1; renderTable(); });

  // Mỗi lần khung được vẽ lại phải lấy dữ liệu mới, vì có thể vừa tạo thêm hồ sơ ở màn hình tạo hồ sơ.
  dashboardPromise = null;
  renderSummary();
  renderTable();
  observeFeatured();

  const searchBtn = $('#dashboard-search-btn');
  const searchInput = $('#dashboard-search-input');
  if (searchBtn && !searchBtn.dataset.bound) {
    searchBtn.dataset.bound = 'true';
    searchBtn.addEventListener('click', handleSearch);
  }
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }
}

const handleSearch = () => {
  state.q = $('#dashboard-search-input').value.trim();
  state.page = 1;
  renderTable();
};

window.addEventListener('user-dashboard:shown', render);
render();
