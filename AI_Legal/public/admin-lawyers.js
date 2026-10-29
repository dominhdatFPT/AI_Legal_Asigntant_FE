// =============================================================================
// QUẢN LÝ HỒ SƠ LUẬT SƯ (/lawyer-management): bảng hồ sơ đăng ký làm luật sư theo trạng thái,
// modal xem chi tiết + duyệt/từ chối. Giao diện theo trang /user-management.
// API (services/lawyer-service/openapi.yaml):
//   GET  /api/lawyers/applications?approval_status=pending|approved|rejected
//   POST /api/lawyers/{id}/approve  ·  POST /api/lawyers/{id}/reject { reason }
//   GET  /api/lawyers/{id}/credentials/{document_id}   (mở giấy tờ, cần cookie phiên)
//   GET  /api/users/{user_id}/citizen-profile          (đối chiếu CCCD người gửi)
//   GET  /api/users?role=lawyer                         (tài khoản luật sư: không qua hồ sơ → Đã duyệt, bị khóa → Đã khóa)
// ?demo=1 trên localhost: dùng dữ liệu mẫu admin-lawyers-sample.js thay cho Backend.
// =============================================================================
import { escapeHtml } from '/auth-api.js';
import { showToast } from '/admin-toast.js';
import { openModal, closeModal, bindModalDismiss } from '/admin-modals.js';
import { PAGE_SIZE, clampPage, pageSlice, renderPager } from '/admin-pager.js';

export const DEMO = new URLSearchParams(location.search).has('demo') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const { fetchLawyerApplications, fetchLawyerAccounts, fetchUserCitizenProfile, lawyerCredentialUrl, reviewLawyerApplication } =
  DEMO ? await import('/admin-lawyers-sample.js') : await import('/admin-api.js');

const STATUSES = ['pending', 'approved', 'rejected']; // trạng thái hồ sơ (mỗi cái một lần gọi API)
const LISTS = [...STATUSES, 'locked']; // 'locked' tách từ danh sách đã duyệt theo trạng thái tài khoản
const TABS = ['all', ...LISTS];
const sourceOf = (list) => (list === 'locked' ? 'approved' : list);
const CREDENTIAL_LABEL = {
  the_luat_su: 'Thẻ luật sư',
  chung_chi_hanh_nghe: 'Chứng chỉ hành nghề luật sư',
  bang_cu_nhan: 'Bằng cử nhân hoặc thạc sĩ luật',
  khac: 'Giấy tờ khác'
};
const REQUIRED_CREDENTIALS = ['the_luat_su', 'chung_chi_hanh_nghe'];
const AVATAR_BGS = ['bg-[#a64031]', 'bg-secondary', 'bg-[#8f3627]', 'bg-[#763300]', 'bg-[#15803d]', 'bg-[#9333ea]', 'bg-[#0284c7]'];
const STATUS_BADGE = {
  pending: '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f8ece6] text-[#8f3627] border border-[#bd5440]/30 shadow-2xs whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-[#bd5440] animate-pulse"></span>Chờ duyệt</span>',
  approved: '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#ecfdf5] text-[#15803d] border border-[#15803d]/20 shadow-2xs whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-[#15803d]"></span>Đã duyệt</span>',
  rejected: '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f7e2db] text-red-700 border border-red-300 shadow-2xs whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-red-600"></span>Bị từ chối</span>'
};
const LOCKED_BADGE = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-300 shadow-2xs whitespace-nowrap"><span class="material-symbols-outlined text-[14px]">lock</span>Đã khóa</span>';
// Tab đang chọn: nền đỏ; tab khác: chữ theo màu trạng thái (giống filter-tab-btn của /user-management)
const TAB_CLASS = {
  active: 'lawyer-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-bold bg-gradient-to-r from-red-700 to-red-600 text-white shadow-sm transition-all flex items-center gap-1.5',
  all: 'lawyer-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-stone-600 hover:text-red-700 hover:bg-amber-50 transition-colors flex items-center gap-1.5',
  pending: 'lawyer-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-amber-800 hover:bg-amber-50 transition-colors flex items-center gap-1.5',
  approved: 'lawyer-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-emerald-800 hover:bg-emerald-50 transition-colors flex items-center gap-1.5',
  rejected: 'lawyer-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1.5',
  locked: 'lawyer-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-stone-700 hover:bg-stone-100 transition-colors flex items-center gap-1.5'
};

const initialTab = new URLSearchParams(location.search).get('status');
const state = {
  tab: TABS.includes(initialTab) ? initialTab : 'pending',
  lists: { pending: [], approved: [], rejected: [], locked: [] },
  load: { pending: 'idle', approved: 'idle', rejected: 'idle' },
  errors: {},
  query: '',
  field: '',
  docs: '',
  page: 1,
  pageSize: PAGE_SIZE, // 10 hồ sơ mỗi trang
  openId: null,
  action: null, // 'approve' | 'reject' khi đang xác nhận trong modal
  busy: false,
  loadedAt: null,
  citizen: {} // user_id -> { state, data, error }
};

const $ = (id) => document.getElementById(id);
const modal = () => $('lawyer-modal');
const pad2 = (n) => String(n).padStart(2, '0');
const fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtTime = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fmtDay = (value) => { if (!value) return '—'; const [y, m, d] = String(value).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
export const daysWaiting = (iso, now = Date.now()) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 864e5));
const waitText = (iso) => { const d = daysWaiting(iso); return d === 0 ? 'gửi hôm nay' : `đã chờ ${d} ngày`; };
const initialsOf = (name) => String(name || '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'LS';
const avatarBgOf = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATAR_BGS[h % AVATAR_BGS.length]; };
// Dòng "tài khoản": user role=lawyer chưa có hồ sơ được duyệt (admin tạo hoặc đổi vai trò ở Quản lí người dùng).
const isAccount = (a) => Boolean(a.account);
const badgeOf = (a) => (a.locked ? LOCKED_BADGE : STATUS_BADGE[a.approval_status] || '');
const accountRow = (u) => ({
  id: `tk-${u.id}`, user_id: u.id, full_name: u.full_name || u.username || u.email, approval_status: 'approved', account: u, locked: u.status === 'locked',
  credentials: [], specializations: [], created_at: u.created_at, reviewed_at: null
});
const missingCredentials = (a) => REQUIRED_CREDENTIALS.filter((t) => !(a.credentials || []).some((c) => c.type === t));
const specNames = (a) => (a.specializations || []).map((s) => s.name);
const allItems = () => LISTS.flatMap((s) => state.lists[s]);
const findApp = (id) => allItems().find((a) => a.id === id) || null;
const anyLoading = () => STATUSES.some((s) => state.load[s] === 'loading' || state.load[s] === 'idle');

// ---------------------------------------------------------------- dữ liệu
async function fetchPages(fetchPage) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const data = await fetchPage(page);
    all.push(...(data?.items || []));
    totalPages = data?.pagination?.total_pages || 1;
    page += 1;
  } while (page <= totalPages);
  return all;
}

// Chờ duyệt: cũ nhất trước (xử lý theo thứ tự gửi). Đã xử lý: mới nhất trước.
const fetchAll = (status) => fetchPages((page) => fetchLawyerApplications({ status, order: status === 'pending' ? 'asc' : 'desc', page }));

async function fetchAccounts() {
  try {
    return await fetchPages((page) => fetchLawyerAccounts({ page }));
  } catch (e) {
    showToast('Không tải được tài khoản luật sư', e.message, true);
    return [];
  }
}

async function loadStatus(status) {
  state.load[status] = 'loading';
  renderTable();
  try {
    state.lists[status] = await fetchAll(status);
    state.load[status] = 'ready';
  } catch (e) {
    state.lists[status] = [];
    state.load[status] = 'error';
    state.errors[status] = e.status === 404 || e.status === 405 ? 'Backend chưa có API hồ sơ luật sư (lawyer-service).' : e.message;
  }
}

async function loadAll() {
  const btn = $('btn-reload-lawyers');
  if (btn) btn.disabled = true;
  const [accounts] = await Promise.all([fetchAccounts(), ...STATUSES.map(loadStatus)]);
  if (state.load.approved === 'ready') {
    // Hồ sơ đã duyệt + tài khoản luật sư chưa có hồ sơ; tài khoản đang khóa sang tab Đã khóa.
    const locked = new Set(accounts.filter((u) => u.status === 'locked').map((u) => u.id));
    const approvedUsers = new Set(state.lists.approved.map((a) => a.user_id));
    const merged = [
      ...state.lists.approved.map((a) => ({ ...a, locked: locked.has(a.user_id) })),
      ...accounts.filter((u) => !approvedUsers.has(u.id)).map(accountRow)
    ];
    state.lists.approved = merged.filter((a) => !a.locked);
    state.lists.locked = merged.filter((a) => a.locked);
  }
  state.loadedAt = new Date();
  if (btn) btn.disabled = false;
  render();
  const failed = STATUSES.filter((s) => state.load[s] === 'error');
  if (failed.length) showToast('Không tải được hồ sơ luật sư', state.errors[failed[0]], true);
}

function visibleRows() {
  const base = state.tab === 'all' ? allItems() : state.lists[state.tab];
  const q = state.query.trim().toLowerCase();
  return base.filter((a) => {
    if (state.field && !specNames(a).includes(state.field)) return false;
    if (state.docs && isAccount(a)) return false;
    if (state.docs === 'missing' && !missingCredentials(a).length) return false;
    if (state.docs === 'complete' && missingCredentials(a).length) return false;
    if (!q) return true;
    return [a.full_name, a.bar_card_number, a.law_firm, specNames(a).join(' '), a.account?.email, a.account?.phone].some((v) => String(v || '').toLowerCase().includes(q));
  });
}

// ---------------------------------------------------------------- render
function render() {
  renderSummary();
  renderTabs();
  renderTable();
  if (state.openId) renderModal();
}

function renderSummary() {
  const pending = state.lists.pending;
  const finding = $('lawyer-finding');
  if (state.load.pending === 'ready') {
    finding.textContent = pending.length
      ? `${pending.length} hồ sơ chờ duyệt · hồ sơ cũ nhất ${waitText(pending[0].created_at)}.`
      : 'Không có hồ sơ nào chờ duyệt.';
  } else if (state.load.pending === 'error') {
    finding.textContent = 'Không tải được hồ sơ chờ duyệt.';
  }
  $('lawyer-fresh').textContent = state.loadedAt ? `Cập nhật lúc ${fmtTime(state.loadedAt.toISOString())}` : '';
}

function renderTabs() {
  document.querySelectorAll('.lawyer-tab-btn').forEach((btn) => {
    const tab = btn.dataset.filter;
    const active = tab === state.tab;
    btn.className = active ? TAB_CLASS.active : TAB_CLASS[tab];
    btn.setAttribute('aria-pressed', String(active));
  });
  const count = (s) => (state.load[sourceOf(s)] === 'ready' ? state.lists[s].length : '–');
  $('count-lawyer-all').textContent = STATUSES.every((s) => state.load[s] === 'ready') ? allItems().length : '–';
  LISTS.forEach((s) => { $(`count-lawyer-${s}`).textContent = count(s); });
}

function emptyRow(icon, message, retry = false) {
  return `<tr><td colspan="7" class="py-12 px-4 text-center">
    <div class="flex flex-col items-center gap-2 text-stone-500">
      <span class="material-symbols-outlined text-[36px] ${retry ? 'text-red-600' : 'text-amber-600'}">${icon}</span>
      <p class="text-body-md max-w-[52ch]">${escapeHtml(message)}</p>
      ${retry ? '<button type="button" data-lawyer-retry class="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-stone-800 font-semibold hover:bg-amber-50 hover:border-amber-400"><span class="material-symbols-outlined text-[18px] text-red-700">sync</span>Thử lại</button>' : ''}
    </div></td></tr>`;
}

function renderTable() {
  const body = $('lawyer-table-body');
  const statuses = state.tab === 'all' ? LISTS : [state.tab];
  const total = $('total-lawyers-text');
  if (statuses.some((s) => ['loading', 'idle'].includes(state.load[sourceOf(s)]))) {
    $('lawyer-pager').innerHTML = '';
    body.innerHTML = Array.from({ length: 5 }, () => `<tr class="animate-pulse">${'<td class="py-4 px-4"><span class="block h-3.5 rounded bg-stone-200"></span></td>'.repeat(7)}</tr>`).join('');
    total.textContent = '–';
    return;
  }
  const failed = statuses.map(sourceOf).find((s) => state.load[s] === 'error');
  if (failed) {
    $('lawyer-pager').innerHTML = '';
    body.innerHTML = emptyRow('cloud_off', `Không tải được danh sách: ${state.errors[failed]}`, true);
    total.textContent = '–';
    return;
  }
  const rows = visibleRows();
  state.page = clampPage(state.page, rows.length, state.pageSize);
  renderPager($('lawyer-pager'), { page: state.page, total: rows.length, size: state.pageSize, onChange: (p) => { state.page = p; renderTable(); } });
  const scopeTotal = statuses.reduce((n, s) => n + state.lists[s].length, 0);
  total.textContent = rows.length === scopeTotal ? `${scopeTotal}` : `${rows.length}/${scopeTotal}`;
  if (!rows.length) {
    const message = scopeTotal
      ? 'Không có hồ sơ khớp bộ lọc.'
      : { all: 'Chưa có hồ sơ đăng ký luật sư nào.', pending: 'Không còn hồ sơ nào chờ duyệt.', approved: 'Chưa có luật sư nào.', rejected: 'Chưa từ chối hồ sơ nào.', locked: 'Không có luật sư nào bị khóa.' }[state.tab];
    body.innerHTML = emptyRow(scopeTotal ? 'search' : 'task_alt', message);
    return;
  }
  body.innerHTML = pageSlice(rows, state.page, state.pageSize).map((a) => {
    const missing = missingCredentials(a);
    const name = a.full_name || 'Chưa có tên';
    const rowBg = a.approval_status === 'pending' ? 'hover:bg-amber-50/60 bg-amber-50/20' : a.approval_status === 'rejected' ? 'hover:bg-rose-50/60' : 'hover:bg-amber-50/50';
    const docs = isAccount(a)
      ? '<span class="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 whitespace-nowrap"><span class="material-symbols-outlined text-[16px]">manage_accounts</span>Không qua hồ sơ</span>'
      : missing.length
      ? `<span class="inline-flex items-center gap-1 text-xs font-bold text-amber-800"><span class="material-symbols-outlined text-[16px]">warning</span>Thiếu ${missing.length === 2 ? 'thẻ & chứng chỉ' : missing[0] === 'the_luat_su' ? 'thẻ luật sư' : 'chứng chỉ'}</span>`
      : `<span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><span class="material-symbols-outlined text-[16px]">check_circle</span>Đủ giấy tờ</span>`;
    const quick = a.approval_status === 'pending' ? `
        <button type="button" class="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition-colors" data-lawyer-open="${escapeHtml(a.id)}" data-lawyer-mode="approve" title="Duyệt hồ sơ" aria-label="Duyệt hồ sơ của ${escapeHtml(name)}">
          <span class="material-symbols-outlined text-[19px] pointer-events-none">check_circle</span></button>
        <button type="button" class="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-100/50 transition-colors" data-lawyer-open="${escapeHtml(a.id)}" data-lawyer-mode="reject" title="Từ chối hồ sơ" aria-label="Từ chối hồ sơ của ${escapeHtml(name)}">
          <span class="material-symbols-outlined text-[19px] pointer-events-none">close</span></button>` : '';
    return `<tr class="${rowBg} transition-colors">
      <td class="py-3.5 px-4">
        <button type="button" class="flex items-center gap-3 text-left" data-lawyer-open="${escapeHtml(a.id)}">
          <span class="w-10 h-10 rounded-full ${avatarBgOf(a.user_id || a.id)} text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-stone-200 shrink-0">${escapeHtml(initialsOf(name))}</span>
          <span class="flex flex-col min-w-0">
            <span class="font-title-md text-title-md font-bold text-stone-900 truncate hover:text-red-700">${escapeHtml(name)}</span>
            <span class="text-xs text-stone-500">${isAccount(a) ? 'Tài khoản luật sư' : a.approval_status === 'pending' ? escapeHtml(waitText(a.created_at)) : `Xử lý ${escapeHtml(fmtDate(a.reviewed_at))}`}</span>
          </span>
        </button>
      </td>
      <td class="py-3.5 px-4">
        <div class="flex flex-col">
          <span class="font-bold text-stone-900 text-sm tabular-nums">${escapeHtml(a.bar_card_number || '—')}</span>
          <span class="text-[12px] text-stone-500 truncate max-w-[220px]">${escapeHtml(isAccount(a) ? a.account.email : a.law_firm || 'Hành nghề cá nhân')}</span>
        </div>
      </td>
      <td class="py-3.5 px-4"><div class="flex flex-wrap gap-1">${specNames(a).map((n) => `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#a64031]/10 text-[#a64031] border border-[#a64031]/20 whitespace-nowrap">${escapeHtml(n)}</span>`).join('') || '<span class="text-stone-400">—</span>'}</div></td>
      <td class="py-3.5 px-4">
        <div class="flex flex-col text-xs text-stone-800 tabular-nums">
          <span class="font-semibold">${escapeHtml(fmtDate(a.created_at))}</span>
          <span class="text-[11px] text-stone-500">${escapeHtml(fmtTime(a.created_at))}</span>
        </div>
      </td>
      <td class="py-3.5 px-4">${docs}${isAccount(a) ? '' : `<span class="block text-[11px] text-stone-500 mt-0.5">${(a.credentials || []).length} tệp</span>`}</td>
      <td class="py-3.5 px-4 text-center">${badgeOf(a)}</td>
      <td class="py-3.5 px-4">
        <div class="flex items-center justify-center gap-1.5">
          <button type="button" class="p-1.5 rounded-lg text-stone-600 hover:text-amber-800 hover:bg-amber-100 transition-colors" data-lawyer-open="${escapeHtml(a.id)}" title="Xem chi tiết hồ sơ" aria-label="Xem hồ sơ của ${escapeHtml(name)}">
            <span class="material-symbols-outlined text-[19px] pointer-events-none">visibility</span></button>
          ${quick}
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ---------------------------------------------------------------- modal chi tiết
function field(label, value) {
  return `<div class="flex flex-col gap-0.5"><span class="text-[12px] font-semibold text-stone-500">${label}</span><span class="text-body-md text-stone-900 break-words">${value}</span></div>`;
}

function citizenBlock(a) {
  const c = state.citizen[a.user_id];
  if (!c || c.state === 'loading') {
    return '<div class="grid grid-cols-2 gap-3 animate-pulse">' + '<span class="h-9 rounded bg-stone-200"></span>'.repeat(6) + '</div>';
  }
  if (c.state === 'error') {
    return `<p class="text-body-md text-red-700">Không tải được hồ sơ CCCD: ${escapeHtml(c.error)} <button type="button" data-lawyer-citizen-retry class="font-semibold underline">Thử lại</button></p>`;
  }
  const p = c.data;
  if (!p) return '<div class="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-body-md"><span class="material-symbols-outlined text-[20px] text-amber-700">info</span><span>Người gửi chưa khai hồ sơ CCCD.</span></div>';
  const nameOnCard = String(p.full_name || '').trim().toLowerCase();
  const mismatch = nameOnCard && a.full_name && nameOnCard !== a.full_name.trim().toLowerCase();
  return `<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
      ${field('Họ tên trên CCCD', `<strong>${escapeHtml(p.full_name || '—')}</strong>`)}
      ${field('Số CCCD', `<span class="font-bold tabular-nums">${escapeHtml(p.id_number || '—')}</span>`)}
      ${field('Ngày sinh', escapeHtml(fmtDay(p.date_of_birth)))}
      ${field('Ngày cấp', escapeHtml(fmtDay(p.issue_date)))}
      ${field('Email', `<span class="text-red-700 underline underline-offset-2">${escapeHtml(p.email || '—')}</span>`)}
      ${field('Số điện thoại', `<span class="tabular-nums">${escapeHtml(p.phone || '—')}</span>`)}
    </div>
    ${mismatch ? '<p class="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs"><span class="material-symbols-outlined text-[18px] text-amber-700">warning</span>Họ tên trên hồ sơ luật sư khác họ tên trên CCCD.</p>' : ''}`;
}

function actionFooter(a) {
  const name = escapeHtml(a.full_name || 'người gửi');
  const close = '<button type="button" data-lawyer-close class="px-4 py-2.5 rounded-xl text-stone-700 font-semibold hover:bg-stone-200 transition-colors">Đóng</button>';
  if (a.approval_status !== 'pending') {
    return `<div class="flex justify-end">${close}</div>`;
  }
  if (state.action === 'reject') {
    return `<div class="space-y-2">
      <label for="lawyer-reject-reason" class="block font-semibold text-stone-900">Lý do từ chối <span class="text-red-600">*</span></label>
      <textarea id="lawyer-reject-reason" maxlength="500" rows="3" placeholder="Người gửi sẽ thấy lý do này để sửa và gửi lại, ví dụ: Ảnh thẻ luật sư bị mờ, không đọc được số thẻ."
        class="w-full px-3 py-2 bg-white rounded-xl border border-stone-300 text-body-md text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"></textarea>
      <p id="lawyer-reject-error" class="hidden text-[12px] text-red-700"></p>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" data-lawyer-cancel class="px-4 py-2.5 rounded-xl text-stone-700 font-semibold hover:bg-stone-200">Hủy</button>
        <button type="button" data-lawyer-confirm="reject" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-60" ${state.busy ? 'disabled' : ''}>
          <span class="material-symbols-outlined text-[18px]">close</span>${state.busy ? 'Đang gửi…' : 'Gửi từ chối'}</button>
      </div>
    </div>`;
  }
  if (state.action === 'approve') {
    return `<div class="flex flex-col gap-3">
      <p class="flex items-start gap-2 text-body-md text-stone-800"><span class="material-symbols-outlined text-[20px] text-amber-700">info</span><span>Duyệt hồ sơ của <strong>${name}</strong>? Tài khoản chuyển sang vai trò luật sư; người dùng cần đăng nhập lại để dùng chức năng luật sư.</span></p>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" data-lawyer-cancel class="px-4 py-2.5 rounded-xl text-stone-700 font-semibold hover:bg-stone-200">Hủy</button>
        <button type="button" data-lawyer-confirm="approve" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 disabled:opacity-60" ${state.busy ? 'disabled' : ''}>
          <span class="material-symbols-outlined text-[18px]">check</span>${state.busy ? 'Đang duyệt…' : 'Xác nhận duyệt'}</button>
      </div>
    </div>`;
  }
  return `<div class="flex flex-wrap items-center justify-between gap-2">
    ${close}
    <div class="flex flex-wrap gap-2">
      <button type="button" data-lawyer-action="reject" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-red-300 text-red-800 font-bold hover:bg-red-50">
        <span class="material-symbols-outlined text-[18px]">close</span>Từ chối</button>
      <button type="button" data-lawyer-action="approve" class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-white font-bold shadow-sm hover:from-red-800 hover:to-red-700">
        <span class="material-symbols-outlined text-[18px]">verified</span>Duyệt hồ sơ</button>
    </div>
  </div>`;
}

function renderModal() {
  const a = findApp(state.openId);
  if (!a) { closeLawyerModal(); return; }
  const name = a.full_name || 'Chưa có tên';
  const missing = missingCredentials(a);
  $('lawyer-modal-id').textContent = `${isAccount(a) ? 'TK' : 'LS'}-${a.id.slice(-6).toUpperCase()}`;
  $('lawyer-modal-id').title = a.id;
  $('lawyer-modal-status').innerHTML = badgeOf(a);
  $('lawyer-modal-title').textContent = name;
  $('lawyer-modal-avatar').textContent = initialsOf(name);
  $('lawyer-modal-avatar').className = `w-10 h-10 rounded-full ${avatarBgOf(a.user_id || a.id)} text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-red-600/30 shrink-0`;
  $('lawyer-modal-name').textContent = name;
  if (isAccount(a)) { renderAccountModal(a); return; }
  $('lawyer-modal-meta').textContent = `Gửi hồ sơ lúc ${fmtTime(a.created_at)} ${fmtDate(a.created_at)}${a.approval_status === 'pending' ? ` · ${waitText(a.created_at)}` : ''}`;

  const lockedNote = a.locked ? '<div class="flex items-start gap-2 p-3 rounded-xl bg-stone-100 border border-stone-300 text-stone-800 text-body-md"><span class="material-symbols-outlined text-[20px] text-stone-600">lock</span><span>Tài khoản của luật sư này đang bị khóa (mở khóa ở Quản lí người dùng).</span></div>' : '';
  const reviewed = a.approval_status === 'approved'
    ? `<div class="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-body-md"><span class="material-symbols-outlined text-[20px] text-emerald-700">check_circle</span><span>Đã duyệt lúc ${escapeHtml(fmtTime(a.reviewed_at))} ${escapeHtml(fmtDate(a.reviewed_at))}.</span></div>`
    : a.approval_status === 'rejected'
      ? `<div class="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-body-md"><span class="material-symbols-outlined text-[20px] text-red-700">error</span><span>Từ chối lúc ${escapeHtml(fmtTime(a.reviewed_at))} ${escapeHtml(fmtDate(a.reviewed_at))}.<br><strong>Lý do:</strong> ${escapeHtml(a.rejected_reason || '(không ghi)')}</span></div>`
      : '';
  const credentials = (a.credentials || []).map((c, i) => `
    <li class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200">
      <span class="material-symbols-outlined text-[20px] text-red-700">description</span>
      <span class="flex-1 min-w-0"><span class="block font-semibold text-stone-900">${escapeHtml(CREDENTIAL_LABEL[c.type] || 'Giấy tờ')}</span><span class="block text-[11px] text-stone-500">Tệp ${i + 1}</span></span>
      <a href="#" data-lawyer-doc="${escapeHtml(c.document_id)}" class="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-800 text-[12px] font-semibold hover:border-red-600 hover:text-red-700">
        <span class="material-symbols-outlined text-[16px]">visibility</span>Mở tệp</a>
    </li>`).join('');
  const section = (icon, title, inner) => `<section class="space-y-3">
      <h4 class="flex items-center gap-2 font-bold text-stone-900"><span class="material-symbols-outlined text-[20px] text-red-700">${icon}</span>${title}</h4>${inner}</section>`;

  $('lawyer-modal-body').innerHTML = `
    ${lockedNote}
    ${reviewed}
    ${missing.length ? `<div class="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-body-md"><span class="material-symbols-outlined text-[20px] text-amber-700">warning</span><span>Hồ sơ thiếu ${missing.map((t) => CREDENTIAL_LABEL[t].toLowerCase()).join(' và ')}.</span></div>` : ''}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="space-y-6">
        ${section('badge', 'Thông tin hành nghề', `<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 p-4 rounded-xl bg-stone-50 border border-stone-200">
          ${field('Số thẻ hành nghề', `<strong class="tabular-nums">${escapeHtml(a.bar_card_number || '—')}</strong>`)}
          ${field('Số năm hành nghề', a.years_experience != null ? `${escapeHtml(a.years_experience)} năm` : '—')}
          ${field('Tổ chức hành nghề', escapeHtml(a.law_firm || 'Hành nghề cá nhân'))}
          ${field('Lĩnh vực tư vấn', escapeHtml(specNames(a).join(', ') || '—'))}
        </div>`)}
        ${section('edit_note', 'Giới thiệu bản thân', `<p class="text-body-md text-stone-800 whitespace-pre-line ${a.bio ? '' : 'italic text-stone-500'}">${escapeHtml(a.bio || 'Người gửi không viết giới thiệu.')}</p>`)}
      </div>
      <div class="space-y-6">
        ${section('id_card', 'Đối chiếu CCCD người gửi', `<div id="lawyer-citizen-block" class="p-4 rounded-xl bg-stone-50 border border-stone-200">${citizenBlock(a)}</div>`)}
        ${section('folder_shared', `Giấy tờ đã gửi <span class="text-stone-500 font-normal">(${(a.credentials || []).length})</span>`, `<ul class="space-y-2">${credentials || '<li class="text-stone-500">Không có giấy tờ.</li>'}</ul>`)}
      </div>
    </div>`;
  $('lawyer-modal-footer').innerHTML = actionFooter(a);
  ensureCitizen(a);
}

function renderAccountModal(a) {
  const u = a.account;
  $('lawyer-modal-meta').textContent = `Tài khoản tạo lúc ${fmtTime(u.created_at)} ${fmtDate(u.created_at)}`;
  const section = (icon, title, inner) => `<section class="space-y-3">
      <h4 class="flex items-center gap-2 font-bold text-stone-900"><span class="material-symbols-outlined text-[20px] text-red-700">${icon}</span>${title}</h4>${inner}</section>`;
  $('lawyer-modal-body').innerHTML = `
    <div class="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-body-md"><span class="material-symbols-outlined text-[20px] text-amber-700">info</span><span>Tài khoản có vai trò luật sư nhưng không có hồ sơ đăng ký được duyệt (tạo hoặc đổi vai trò ở Quản lí người dùng), nên chưa có số thẻ, lĩnh vực và giấy tờ.</span></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      ${section('person', 'Thông tin tài khoản', `<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 p-4 rounded-xl bg-stone-50 border border-stone-200">
        ${field('Email', `<span class="text-red-700 underline underline-offset-2">${escapeHtml(u.email || '—')}</span>`)}
        ${field('Số điện thoại', `<span class="tabular-nums">${escapeHtml(u.phone || '—')}</span>`)}
        ${field('Tên đăng nhập', escapeHtml(u.username || '—'))}
        ${field('Trạng thái', u.status === 'locked' ? `Đã khóa${u.locked_reason ? ` · ${escapeHtml(u.locked_reason)}` : ''}` : 'Đang hoạt động')}
      </div>`)}
      ${section('id_card', 'Hồ sơ CCCD', `<div id="lawyer-citizen-block" class="p-4 rounded-xl bg-stone-50 border border-stone-200">${citizenBlock(a)}</div>`)}
    </div>`;
  $('lawyer-modal-footer').innerHTML = actionFooter(a);
  ensureCitizen(a);
}

function renderCitizenBlock(a) {
  const block = document.getElementById('lawyer-citizen-block');
  if (a && block) block.innerHTML = citizenBlock(a);
}

async function ensureCitizen(a) {
  if (!a.user_id || state.citizen[a.user_id]) return;
  state.citizen[a.user_id] = { state: 'loading' };
  try {
    state.citizen[a.user_id] = { state: 'ready', data: await fetchUserCitizenProfile(a.user_id) };
  } catch (e) {
    // 404 = chưa khai hồ sơ CCCD, không phải lỗi tải
    state.citizen[a.user_id] = e.status === 404 ? { state: 'ready', data: null } : { state: 'error', error: e.message };
  }
  // Chỉ vẽ lại khối CCCD: vẽ lại cả modal sẽ xoá lý do từ chối admin đang gõ.
  if (findApp(state.openId)?.user_id === a.user_id) renderCitizenBlock(a);
}

function openLawyerModal(id, mode = null) {
  state.openId = id;
  state.action = mode;
  state.lastFocus = document.activeElement;
  renderModal();
  openModal(modal());
  ($('lawyer-reject-reason') || modal().querySelector('[data-lawyer-confirm]') || $('btn-close-lawyer-modal')).focus();
}

function closeLawyerModal() {
  if (state.busy) return;
  state.openId = null;
  state.action = null;
  closeModal(modal());
  state.lastFocus?.focus?.();
}

// ---------------------------------------------------------------- duyệt / từ chối
async function submit(kind) {
  const a = findApp(state.openId);
  if (!a || state.busy) return;
  let body;
  if (kind === 'reject') {
    const input = $('lawyer-reject-reason');
    const reason = input.value.trim();
    if (!reason) {
      const err = $('lawyer-reject-error');
      err.textContent = 'Nhập lý do để người gửi biết cần sửa gì.';
      err.classList.remove('hidden');
      input.focus();
      return;
    }
    body = { reason };
  }
  state.busy = true;
  renderModal();
  if (body) $('lawyer-reject-reason').value = body.reason;
  try {
    const updated = await reviewLawyerApplication(a.id, kind, body);
    const target = kind === 'approve' ? 'approved' : 'rejected';
    state.lists.pending = state.lists.pending.filter((x) => x.id !== a.id);
    state.lists[target].unshift(updated?.id ? updated : {
      ...a, approval_status: target, reviewed_at: new Date().toISOString(), rejected_reason: body?.reason || null
    });
    state.busy = false;
    closeLawyerModal();
    showToast(kind === 'approve' ? 'Đã duyệt hồ sơ' : 'Đã từ chối hồ sơ',
      kind === 'approve' ? `${a.full_name || 'Người dùng'} đã trở thành luật sư.` : `Đã gửi lý do từ chối cho ${a.full_name || 'người dùng'}.`);
  } catch (e) {
    state.busy = false;
    showToast(kind === 'approve' ? 'Chưa duyệt được hồ sơ' : 'Chưa từ chối được hồ sơ', e.message, true);
    if (e.status === 409) { closeLawyerModal(); await loadStatus('pending'); } // admin khác đã xử lý
    else { renderModal(); if (body) $('lawyer-reject-reason').value = body.reason; }
  }
  render();
}

// ---------------------------------------------------------------- sự kiện
function setTab(tab) {
  if (!TABS.includes(tab)) return;
  state.tab = tab;
  state.page = 1;
  const url = new URL(location.href);
  url.searchParams.set('status', tab);
  history.replaceState(null, '', url);
  renderTabs();
  renderTable();
}

function bind() {
  document.querySelectorAll('.lawyer-tab-btn').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.filter)));
  // Đổi bộ lọc hoặc số dòng mỗi trang thì quay về trang 1.
  const refilter = (key) => (e) => { state[key] = key === 'pageSize' ? Number(e.target.value) || PAGE_SIZE : e.target.value; state.page = 1; renderTable(); };
  $('lawyer-search-input').addEventListener('input', refilter('query'));
  $('lawyer-field-select').addEventListener('change', refilter('field'));
  $('lawyer-docs-select').addEventListener('change', refilter('docs'));
  $('lawyer-page-size').addEventListener('change', refilter('pageSize'));
  $('btn-reset-lawyer-filters').addEventListener('click', () => {
    state.query = state.field = state.docs = '';
    state.page = 1;
    $('lawyer-search-input').value = '';
    $('lawyer-field-select').value = '';
    $('lawyer-docs-select').value = '';
    renderTable();
  });
  $('btn-reload-lawyers').addEventListener('click', () => { state.citizen = {}; loadAll(); });
  $('lawyer-table-body').addEventListener('click', (e) => {
    if (e.target.closest('[data-lawyer-retry]')) return loadAll();
    const open = e.target.closest('[data-lawyer-open]');
    if (open) openLawyerModal(open.dataset.lawyerOpen, open.dataset.lawyerMode || null);
  });
  $('btn-close-lawyer-modal').addEventListener('click', closeLawyerModal);
  bindModalDismiss(modal(), closeLawyerModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.openId) closeLawyerModal(); });
  modal().addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-lawyer-close]')) return closeLawyerModal();
    if (t.closest('[data-lawyer-citizen-retry]')) {
      const a = findApp(state.openId);
      delete state.citizen[a?.user_id];
      renderCitizenBlock(a);
      return ensureCitizen(a);
    }
    const action = t.closest('[data-lawyer-action]');
    if (action) {
      state.action = action.dataset.lawyerAction;
      renderModal();
      ($('lawyer-reject-reason') || modal().querySelector('[data-lawyer-confirm]'))?.focus();
      return;
    }
    if (t.closest('[data-lawyer-cancel]')) { state.action = null; return renderModal(); }
    const confirm = t.closest('[data-lawyer-confirm]');
    if (confirm) return submit(confirm.dataset.lawyerConfirm);
    const doc = t.closest('[data-lawyer-doc]');
    if (doc) {
      e.preventDefault();
      const tab = window.open('about:blank', '_blank'); // mở ngay trong cú bấm để không bị chặn popup
      const url = await lawyerCredentialUrl(state.openId, doc.dataset.lawyerDoc);
      if (tab) { tab.opener = null; tab.location.href = url; } else window.open(url, '_blank', 'noopener');
    }
  });
}

export function initLawyerManagement() {
  if (DEMO) $('lawyer-demo-badge').classList.remove('hidden');
  bind();
  render();
  window.addEventListener('admin-auth-ready', loadAll, { once: true });
}
