// =============================================================================
// DUYỆT HỒ SƠ LUẬT SƯ (tab "Chờ xác thực") - tách từ user-management.html
// API theo services/lawyer-service/openapi.yaml:
//   GET  /api/lawyers/applications?approval_status=pending  -> { items: [LawyerProfile], pagination }
//   POST /api/lawyers/{lawyer_id}/approve                   -> duyệt, BE đổi vai trò người dùng sang lawyer
//   POST /api/lawyers/{lawyer_id}/reject  { reason }        -> từ chối, người gửi thấy lý do
// Mở giấy tờ: GET /api/lawyers/{lawyer_id}/credentials/{document_id} (Lawyer Service đọc file từ Document Service).
// =============================================================================
import { escapeHtml } from '/auth-api.js';
import {
  fetchPendingLawyerApplications,
  lawyerCredentialUrl,
  reviewLawyerApplication
} from '/admin-api.js';
import { showToast } from '/admin-toast.js';
import {
  avatarBgOf,
  fmtDate,
  fmtTime,
  getCurrentFilterTab,
  getUsersData,
  initialsOf,
  loadUsers,
  onFilterTabChange,
  openUserModal,
  setPendingCount
} from '/admin-users.js';
    const CREDENTIAL_LABEL = {
      the_luat_su: 'Thẻ luật sư',
      chung_chi_hanh_nghe: 'Chứng chỉ hành nghề luật sư',
      bang_cu_nhan: 'Bằng cử nhân hoặc thạc sĩ luật',
      khac: 'Giấy tờ khác'
    };
    const review = { items: [], selectedId: null, state: 'idle', error: '', query: '', action: null, busy: false };

    const reviewSection = document.getElementById('lawyer-review');
    const reviewList = document.getElementById('review-list');
    const reviewDetail = document.getElementById('review-detail');
    const reviewCountEl = document.getElementById('review-count');
    const reviewSearch = document.getElementById('review-search');

    function daysAgoText(iso) {
      const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
      if (Number.isNaN(days)) return '';
      return days <= 0 ? 'Hôm nay' : days === 1 ? 'Hôm qua' : `${days} ngày trước`;
    }

    async function fetchPendingApplications() {
      const all = [];
      let page = 1;
      let totalPages = 1;
      do {
        const data = await fetchPendingLawyerApplications({ page });
        all.push(...(data?.items || []));
        totalPages = data?.pagination?.total_pages || 1;
        page += 1;
      } while (page <= totalPages);
      return all;
    }

    async function loadApplications() {
      review.state = 'loading';
      renderReview();
      try {
        review.items = await fetchPendingApplications();
        review.state = 'ready';
        if (!review.items.some(a => a.id === review.selectedId)) review.selectedId = review.items[0]?.id || null;
      } catch (e) {
        review.items = [];
        review.state = 'error';
        review.error = e.status === 404 || e.status === 405
          ? 'Backend chưa có API duyệt hồ sơ luật sư (lawyer-service).'
          : e.message;
      }
      setPendingCount(review.state === 'ready' ? review.items.length : null);
      renderReview();
    }

    function visibleApplications() {
      const q = review.query.trim().toLowerCase();
      if (!q) return review.items;
      return review.items.filter(a => [a.full_name, a.bar_card_number, a.law_firm].some(v => String(v || '').toLowerCase().includes(q)));
    }

    function renderReview() {
      reviewCountEl.textContent = review.state === 'ready' ? review.items.length : '–';
      if (review.state === 'loading') {
        reviewList.innerHTML = Array.from({ length: 4 }, () => `
          <li class="px-4 py-3.5 flex gap-3 animate-pulse"><span class="w-10 h-10 rounded-full bg-stone-200 shrink-0"></span>
            <span class="flex-1 space-y-2"><span class="block h-3.5 w-3/4 rounded bg-stone-200"></span><span class="block h-3 w-1/2 rounded bg-stone-200"></span></span></li>`).join('');
        reviewDetail.innerHTML = '<div class="p-8 space-y-4 animate-pulse"><div class="h-6 w-1/2 rounded bg-stone-200"></div><div class="h-28 rounded-xl bg-stone-100"></div><div class="h-40 rounded-xl bg-stone-100"></div></div>';
        return;
      }
      if (review.state === 'error') {
        reviewList.innerHTML = '';
        reviewDetail.innerHTML = reviewMessage('cloud_off', 'Không tải được hồ sơ luật sư', review.error, true);
        return;
      }
      const rows = visibleApplications();
      reviewList.innerHTML = rows.length ? rows.map(a => {
        const name = a.full_name || 'Chưa có tên';
        const active = a.id === review.selectedId;
        return `<li>
          <button type="button" data-review-id="${escapeHtml(a.id)}" aria-current="${active ? 'true' : 'false'}"
            class="w-full text-left px-4 py-3.5 flex gap-3 items-start transition-colors ${active ? 'bg-red-50 shadow-[inset_3px_0_0_#a64031]' : 'hover:bg-amber-50/60'}">
            <span class="w-10 h-10 rounded-full ${avatarBgOf(a.user_id || a.id)} text-white flex items-center justify-center font-bold text-sm shrink-0">${escapeHtml(initialsOf(name))}</span>
            <span class="flex-1 min-w-0">
              <span class="flex items-baseline justify-between gap-2">
                <span class="font-semibold text-stone-900 truncate">${escapeHtml(name)}</span>
                <span class="text-[11px] text-stone-500 whitespace-nowrap">${escapeHtml(daysAgoText(a.created_at))}</span>
              </span>
              <span class="block text-[12px] text-stone-600 truncate">Số thẻ ${escapeHtml(a.bar_card_number || '—')}${a.law_firm ? ` · ${escapeHtml(a.law_firm)}` : ''}</span>
              <span class="mt-1 flex flex-wrap gap-1">${(a.specializations || []).slice(0, 3).map(s => `<span class="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 text-[11px]">${escapeHtml(s.name)}</span>`).join('')}</span>
            </span>
          </button>
        </li>`;
      }).join('') : `<li class="px-4 py-8 text-center text-stone-500 text-body-md">${review.items.length ? 'Không có hồ sơ khớp từ khóa.' : 'Không có hồ sơ nào.'}</li>`;

      const selected = review.items.find(a => a.id === review.selectedId);
      if (!review.items.length) {
        reviewDetail.innerHTML = reviewMessage('task_alt', 'Không còn hồ sơ nào chờ xác thực', 'Khi có người gửi hồ sơ đăng ký làm luật sư, hồ sơ sẽ hiện ở danh sách bên trái.');
        return;
      }
      reviewDetail.innerHTML = selected ? renderApplication(selected) : reviewMessage('person_search', 'Chọn một hồ sơ để xem', 'Bấm vào một hồ sơ ở danh sách bên trái.');
    }

    function reviewMessage(icon, title, text, retry = false) {
      return `<div class="h-full min-h-[420px] flex flex-col items-center justify-center text-center gap-2 px-6 py-12">
        <span class="w-14 h-14 rounded-2xl ${retry ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'} flex items-center justify-center"><span class="material-symbols-outlined text-[28px]">${icon}</span></span>
        <p class="font-headline-sm text-headline-sm text-stone-900">${escapeHtml(title)}</p>
        <p class="text-body-md text-stone-600 max-w-[46ch]">${escapeHtml(text)}</p>
        ${retry ? '<button type="button" data-review-retry class="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-stone-300 text-stone-800 font-semibold hover:bg-amber-50 hover:border-amber-400"><span class="material-symbols-outlined text-[18px] text-red-700">sync</span>Thử lại</button>' : ''}
      </div>`;
    }

    function renderApplication(a) {
      const name = a.full_name || 'Chưa có tên';
      const account = getUsersData().find(u => u.id === a.user_id);
      const field = (label, value) => `<div><dt class="text-[12px] font-semibold text-stone-500">${label}</dt><dd class="mt-0.5 text-body-md text-stone-900 break-words">${value}</dd></div>`;
      const credentials = (a.credentials || []).map((c, i) => `
        <li class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200">
          <span class="material-symbols-outlined text-[20px] text-red-700">description</span>
          <span class="flex-1 min-w-0"><span class="block font-semibold text-stone-900">${escapeHtml(CREDENTIAL_LABEL[c.type] || 'Giấy tờ')}</span><span class="block text-[11px] text-stone-500 truncate">Tệp ${i + 1} · ${escapeHtml(c.document_id)}</span></span>
          <a data-doc-id="${escapeHtml(c.document_id)}" href="#" target="_blank" rel="noopener" class="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-800 text-[12px] font-semibold hover:border-red-600 hover:text-red-700">
            <span class="material-symbols-outlined text-[16px]">visibility</span>Mở tệp</a>
        </li>`).join('');
      const required = ['the_luat_su', 'chung_chi_hanh_nghe'].filter(t => !(a.credentials || []).some(c => c.type === t));
      const actionPanel = review.action === 'reject' ? `
        <div class="space-y-2">
          <label for="review-reject-reason" class="block font-semibold text-stone-900">Lý do từ chối <span class="text-red-600">*</span></label>
          <textarea id="review-reject-reason" maxlength="500" rows="3" placeholder="Người gửi sẽ thấy lý do này để sửa và gửi lại, ví dụ: Ảnh thẻ luật sư bị mờ, không đọc được số thẻ."
            class="w-full px-3 py-2 bg-white rounded-xl border border-stone-300 text-body-md text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"></textarea>
          <p id="review-reject-error" class="hidden text-[12px] text-red-700"></p>
          <div class="flex flex-wrap justify-start gap-2">
            <button type="button" data-review-cancel class="px-4 py-2 rounded-xl text-stone-700 font-semibold hover:bg-stone-200">Hủy</button>
            <button type="button" data-review-confirm="reject" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-60" ${review.busy ? 'disabled' : ''}>
              <span class="material-symbols-outlined text-[18px]">close</span>${review.busy ? 'Đang gửi…' : 'Gửi từ chối'}</button>
          </div>
        </div>` : review.action === 'approve' ? `
        <div class="flex flex-col items-start gap-3">
          <p class="text-body-md text-stone-800 max-w-[60ch]">Duyệt hồ sơ của <strong>${escapeHtml(name)}</strong>? Tài khoản sẽ chuyển sang vai trò luật sư, người dùng cần đăng nhập lại để dùng chức năng luật sư.</p>
          <div class="flex gap-2 justify-start">
            <button type="button" data-review-cancel class="px-4 py-2 rounded-xl text-stone-700 font-semibold hover:bg-stone-200">Hủy</button>
            <button type="button" data-review-confirm="approve" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 disabled:opacity-60" ${review.busy ? 'disabled' : ''}>
              <span class="material-symbols-outlined text-[18px]">check</span>${review.busy ? 'Đang duyệt…' : 'Xác nhận duyệt'}</button>
          </div>
        </div>` : `
        <div class="flex flex-wrap justify-start gap-2">
          <button type="button" data-review-action="reject" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-red-300 text-red-800 font-bold hover:bg-red-50">
            <span class="material-symbols-outlined text-[18px]">close</span>Từ chối</button>
          <button type="button" data-review-action="approve" class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-white font-bold shadow-sm hover:from-red-800 hover:to-red-700">
            <span class="material-symbols-outlined text-[18px]">verified</span>Duyệt hồ sơ</button>
        </div>`;

      return `
        <header class="px-6 py-5 bg-gradient-to-r from-[#9e3b2d] via-[#a8442f] to-[#b74f3b] text-white flex flex-wrap items-center gap-4">
          <span class="w-14 h-14 rounded-full ${avatarBgOf(a.user_id || a.id)} ring-2 ring-white/40 flex items-center justify-center font-bold text-lg shrink-0">${escapeHtml(initialsOf(name))}</span>
          <div class="flex-1 min-w-0">
            <h2 class="font-headline-sm text-headline-sm font-extrabold truncate">${escapeHtml(name)}</h2>
            <p class="text-[13px] text-red-100">Gửi hồ sơ lúc ${escapeHtml(fmtTime(a.created_at))} ${escapeHtml(fmtDate(a.created_at))}${a.updated_at && a.updated_at !== a.created_at ? ` · cập nhật ${escapeHtml(fmtDate(a.updated_at))}` : ''}</p>
          </div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-stone-950 text-[12px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-stone-950/70"></span>Chờ xác thực</span>
        </header>

        <div class="p-6 space-y-6">
          ${required.length ? `<div class="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-body-md"><span class="material-symbols-outlined text-[20px] text-amber-700">info</span><span>Hồ sơ thiếu ${required.map(t => CREDENTIAL_LABEL[t].toLowerCase()).join(' và ')}.</span></div>` : ''}

          <section class="space-y-3">
            <h3 class="flex items-center gap-2 font-bold text-stone-900"><span class="material-symbols-outlined text-[20px] text-red-700">badge</span>Thông tin hành nghề</h3>
            <dl class="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
              ${field('Số thẻ hành nghề', `<span class="font-bold tabular-nums">${escapeHtml(a.bar_card_number || '—')}</span>`)}
              ${field('Tổ chức hành nghề', escapeHtml(a.law_firm || 'Hành nghề cá nhân'))}
              ${field('Số năm hành nghề', a.years_experience != null ? `${escapeHtml(a.years_experience)} năm` : 'Không khai')}
            </dl>
          </section>

          <section class="space-y-3">
            <h3 class="flex items-center gap-2 font-bold text-stone-900"><span class="material-symbols-outlined text-[20px] text-red-700">fact_check</span>Lĩnh vực tư vấn</h3>
            <div class="flex flex-wrap gap-2">${(a.specializations || []).map(s => `<span class="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-900 text-[12px] font-semibold">${escapeHtml(s.name)}</span>`).join('') || '<span class="text-stone-500">Chưa chọn lĩnh vực</span>'}</div>
          </section>

          <section class="space-y-3">
            <h3 class="flex items-center gap-2 font-bold text-stone-900"><span class="material-symbols-outlined text-[20px] text-red-700">edit_note</span>Giới thiệu bản thân</h3>
            <p class="text-body-md text-stone-800 whitespace-pre-line ${a.bio ? '' : 'italic text-stone-500'}">${escapeHtml(a.bio || 'Người gửi không viết giới thiệu.')}</p>
          </section>

          <section class="space-y-3">
            <h3 class="flex items-center gap-2 font-bold text-stone-900"><span class="material-symbols-outlined text-[20px] text-red-700">folder_shared</span>Giấy tờ đã gửi <span class="text-stone-500 font-normal">(${(a.credentials || []).length})</span></h3>
            <ul class="space-y-2">${credentials || '<li class="text-stone-500">Không có giấy tờ.</li>'}</ul>
          </section>

          <section class="space-y-3">
            <h3 class="flex items-center gap-2 font-bold text-stone-900"><span class="material-symbols-outlined text-[20px] text-red-700">manage_accounts</span>Tài khoản người gửi</h3>
            ${account ? `
            <div class="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-xl bg-stone-50 border border-stone-200">
              <dl class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                ${field('Email', escapeHtml(account.email || '—'))}
                ${field('Ngày đăng ký', escapeHtml(account.regDate))}
                ${field('Hồ sơ CCCD', account.verified ? '<span class="text-emerald-700 font-semibold">Đã khai</span>' : '<span class="text-amber-800 font-semibold">Chưa khai</span>')}
              </dl>
              <button type="button" data-review-open-user="${escapeHtml(account.id)}" class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-300 text-stone-800 font-semibold hover:bg-amber-50 hover:border-amber-400">
                <span class="material-symbols-outlined text-[18px] text-red-700">id_card</span>Xem hồ sơ CCCD</button>
            </div>` : '<p class="text-body-md text-stone-500">Không tìm thấy tài khoản này trong danh sách người dùng.</p>'}
          </section>
        </div>

        <footer class="sticky bottom-0 px-6 py-4 bg-stone-50/95 backdrop-blur border-t border-stone-200">${actionPanel}</footer>`;
    }

    async function submitReview(kind) {
      const a = review.items.find(x => x.id === review.selectedId);
      if (!a || review.busy) return;
      let body;
      if (kind === 'reject') {
        const reason = document.getElementById('review-reject-reason').value.trim();
        if (!reason) {
          const err = document.getElementById('review-reject-error');
          err.textContent = 'Nhập lý do để người gửi biết cần sửa gì.';
          err.classList.remove('hidden');
          document.getElementById('review-reject-reason').focus();
          return;
        }
        body = { reason };
      }
      const keepReason = body?.reason;
      review.busy = true;
      renderReview();
      if (keepReason) document.getElementById('review-reject-reason').value = keepReason;
      try {
        await reviewLawyerApplication(a.id, kind, body);
        const index = review.items.findIndex(x => x.id === a.id);
        review.items.splice(index, 1);
        review.selectedId = (review.items[index] || review.items[index - 1])?.id || null;
        review.action = null;
        setPendingCount(review.items.length);
        showToast(kind === 'approve' ? 'Đã duyệt hồ sơ' : 'Đã từ chối hồ sơ',
          kind === 'approve' ? `${a.full_name || 'Người dùng'} đã trở thành luật sư.` : `Đã gửi lý do từ chối cho ${a.full_name || 'người dùng'}.`);
        if (kind === 'approve') loadUsers(); // vai trò đã đổi sang luật sư
      } catch (e) {
        showToast(kind === 'approve' ? 'Chưa duyệt được hồ sơ' : 'Chưa từ chối được hồ sơ', e.message, true);
        if (e.status === 409) await loadApplications(); // hồ sơ đã được người khác xử lý
      } finally {
        review.busy = false;
        renderReview();
        if (keepReason && review.action === 'reject') document.getElementById('review-reject-reason').value = keepReason;
      }
    }

    reviewList.addEventListener('click', e => {
      const btn = e.target.closest('[data-review-id]');
      if (!btn) return;
      review.selectedId = btn.dataset.reviewId;
      review.action = null;
      renderReview();
      if (window.matchMedia('(max-width: 1023px)').matches) reviewDetail.scrollIntoView({ block: 'start' });
    });
    reviewDetail.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('[data-review-retry]')) return loadApplications();
      const action = t.closest('[data-review-action]');
      if (action) {
        review.action = action.dataset.reviewAction;
        renderReview();
        (document.getElementById('review-reject-reason') || reviewDetail.querySelector('[data-review-confirm]'))?.focus();
        return;
      }
      if (t.closest('[data-review-cancel]')) { review.action = null; renderReview(); return; }
      const confirmBtn = t.closest('[data-review-confirm]');
      if (confirmBtn) return submitReview(confirmBtn.dataset.reviewConfirm);
      const openUser = t.closest('[data-review-open-user]');
      if (openUser) return openUserModal(openUser.dataset.reviewOpenUser, 'view');
      const doc = t.closest('[data-doc-id]');
      if (doc) {
        e.preventDefault();
        window.open(await lawyerCredentialUrl(review.selectedId, doc.dataset.docId), '_blank', 'noopener');
      }
    });
    reviewSearch.addEventListener('input', () => { review.query = reviewSearch.value; renderReview(); });

    // Bật/tắt màn duyệt khi đổi tab: tab "Chờ xác thực" thay bảng người dùng bằng màn duyệt
    function syncReviewView() {
      const reviewing = getCurrentFilterTab() === 'pending';
      reviewSection.classList.toggle('hidden', !reviewing);
      document.getElementById('users-table-card').classList.toggle('hidden', reviewing);
      document.getElementById('user-search-row').classList.toggle('hidden', reviewing);
      if (reviewing && review.state === 'idle') loadApplications();
    }

    // =========================================================================
    // KHỞI TẠO
    // =========================================================================
    export function initLawyerReview() {
      window.addEventListener('admin-auth-ready', loadApplications, { once: true });
      onFilterTabChange(syncReviewView);
    }

    export { loadApplications };
