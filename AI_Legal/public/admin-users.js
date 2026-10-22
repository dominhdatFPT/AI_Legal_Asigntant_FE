// =============================================================================
// QUẢN LÝ NGƯỜI DÙNG (tách từ user-management.html)
// Bảng người dùng, bộ lọc, thống kê, modal hồ sơ/tạo mới/xóa mềm, xuất CSV.
// =============================================================================
import { escapeHtml } from '/auth-api.js';
import {
  createUser,
  deleteUser,
  fetchUserCitizenProfile,
  fetchUsersPage,
  lockUser,
  restoreDeletedUser,
  unlockUser,
  updateUserRole
} from '/admin-api.js';
import { showToast, showToastWithUndo } from '/admin-toast.js';
import { openModal, closeModal, bindModalDismiss } from '/admin-modals.js';
    // Danh sách luôn lấy từ Backend; không khởi tạo bằng dữ liệu mẫu trên trình duyệt.
    let usersData = [];

    const ROLE_TO_TYPE = { citizen: 'personal', lawyer: 'business', admin: 'admin' };
    const TYPE_TO_ROLE = { personal: 'citizen', business: 'lawyer', admin: 'admin' };
    const ROLE_LABEL = { citizen: 'Công dân', lawyer: 'Luật sư', admin: 'Quản trị viên' };
    const STATUS_LABEL = { active: 'Hoạt động', pending: 'Chờ xác thực', locked: 'Đã khóa', suspended: 'Tạm ngưng' };
    const AVATAR_BGS = ['bg-[#a64031]', 'bg-secondary', 'bg-[#8f3627]', 'bg-[#763300]', 'bg-[#15803d]', 'bg-[#9333ea]', 'bg-[#0284c7]'];

    const pad2 = n => String(n).padStart(2, '0');
    function fmtDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    function fmtTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    }
    function fmtDay(value) {
      if (!value) return '';
      const [y, m, d] = String(value).slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    }
    function fmtPhone(phone) {
      if (!phone) return '—';
      return /^\d{10}$/.test(phone) ? `${phone.slice(0, 4)}.${phone.slice(4, 7)}.${phone.slice(7)}` : phone;
    }
    function initialsOf(name) {
      return name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'ND';
    }
    function avatarBgOf(id) {
      let hash = 0;
      for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      return AVATAR_BGS[hash % AVATAR_BGS.length];
    }

    function describeAccount(u, status) {
      if (status === 'suspended') {
        return 'Tài khoản đang tạm ngưng (đã xóa mềm). Có thể khôi phục lại tài khoản bất kỳ lúc nào.';
      }
      if (status === 'locked') {
        const until = u.locked_until ? `đến ${fmtDate(u.locked_until)} ${fmtTime(u.locked_until)}` : 'vĩnh viễn';
        return `Tài khoản bị khóa ${until}. Lý do: ${u.locked_reason || '(không ghi)'}.`;
      }
      if (status === 'pending') {
        return u.created_as_lawyer
          ? 'Tài khoản do quản trị viên cấp cho luật sư. Người dùng chưa khai hồ sơ CCCD.'
          : 'Người dùng chưa khai hồ sơ CCCD.';
      }
      return u.role === 'admin' ? 'Tài khoản quản trị viên.' : 'Đã khai hồ sơ CCCD.';
    }

    function toViewUser(u) {
      const name = u.full_name || u.username || u.email;
      let status = 'active';
      if (u.status === 'suspended' || u.is_deleted || u.deleted_at) {
        status = 'suspended';
      } else if (u.status === 'locked') {
        status = 'locked';
      } else if (u.role !== 'admin' && !u.has_citizen_profile) {
        status = 'pending';
      }

      return {
        id: u.id,
        shortId: u.id.slice(0, 8).toUpperCase(),
        raw: u,
        role: u.role,
        name,
        email: u.email,
        phone: fmtPhone(u.phone),
        type: ROLE_TO_TYPE[u.role] || 'personal',
        status,
        verified: !!u.has_citizen_profile,
        regDate: fmtDate(u.created_at),
        regTime: fmtTime(u.created_at),
        notes: describeAccount(u, status),
        initials: initialsOf(name),
        avatarBg: avatarBgOf(u.id),
        profileLoaded: false,
        cccd: '', dob: '', gender: '', nationality: '',
        cardIssueDate: '', cardIssuePlace: '', cardExpiry: '',
        hometown: '', permanentAddress: null, currentAddress: null,
        ethnicity: '', taxCode: '', isCommitted: false, isAgreedSave: false
      };
    }

    async function loadCitizenProfile(user) {
      if (user.profileLoaded) return;
      const p = await fetchUserCitizenProfile(user.id);
      user.profileLoaded = true;
      if (!p) return;
      const perm = p.permanent_address || {};
      const curr = p.current_same_as_permanent ? perm : (p.current_address || {});
      Object.assign(user, {
        cccd: p.id_number,
        dob: fmtDay(p.date_of_birth),
        gender: p.gender,
        nationality: p.nationality,
        cardIssueDate: fmtDay(p.issue_date),
        cardIssuePlace: p.issue_place,
        cardExpiry: fmtDay(p.expiry_date),
        hometown: p.place_of_origin || '',
        permanentAddress: { street: perm.detail || '', ward: perm.ward || '', city: perm.province || '' },
        currentAddress: {
          sameAsPermanent: !!p.current_same_as_permanent,
          street: curr.detail || '', ward: curr.ward || '', city: curr.province || ''
        },
        ethnicity: p.ethnicity || '',
        taxCode: p.tax_code || '',
        isCommitted: !!p.declared_at,
        isAgreedSave: !!p.consented_at
      });
    }

    function renderTableMessage(icon, message) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-stone-500">
            <span class="material-symbols-outlined text-[36px] text-stone-400 mb-2">${icon}</span>
            <p class="font-medium text-stone-600">${escapeHtml(message)}</p>
          </td>
        </tr>
      `;
    }

    // Backend: deleted=false (mặc định) chỉ trả tài khoản chưa xóa, deleted=true chỉ trả tài khoản đã xóa mềm.
    async function fetchAllUsers(deleted) {
      const all = [];
      let page = 1;
      let totalPages = 1;
      do {
        const data = await fetchUsersPage({ page, deleted });
        all.push(...data.items);
        totalPages = data.pagination.total_pages;
        page += 1;
      } while (page <= totalPages);
      return all;
    }

    async function loadUsers() {
      try {
        // Gộp cả hai danh sách để tab khôi phục vẫn có dữ liệu sau khi tải lại trang.
        const [alive, deleted] = await Promise.all([fetchAllUsers(false), fetchAllUsers(true)]);
        usersData = [...alive, ...deleted].map(toViewUser);
      } catch (e) {
        usersData = [];
        renderTableMessage('cloud_off', `Không tải được danh sách người dùng: ${e.message}`);
        showToast('Không tải được dữ liệu', e.message, true);
      }
      updateCounts();
      renderUserTable();
    }

    function exportUsersCsv() {
      const rows = [['ID', 'Họ và tên', 'Email', 'Số điện thoại', 'Ngày đăng ký', 'Vai trò', 'Trạng thái', 'Đã khai hồ sơ CCCD', 'Ghi chú']];
      usersData.forEach(u => rows.push([
        u.id, u.name, u.email, (u.raw && u.raw.phone) || u.phone || '', `${u.regDate} ${u.regTime}`,
        ROLE_LABEL[u.role] || u.role, STATUS_LABEL[u.status], u.verified ? 'Có' : 'Chưa', u.notes
      ]));
      const csv = '\ufeff' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = `danh-sach-nguoi-dung-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      showToast('Xuất danh sách thành công', `Đã xuất ${usersData.length} người dùng ra file CSV (mở được bằng Excel).`);
    }

    // State
    let currentModalUserId = null;
    let currentModalMode = 'view';
    let currentFilterTab = 'all';

    // DOM Elements
    const userTableBody = document.getElementById('user-table-body');
    const userModal = document.getElementById('user-modal');
    const createUserModal = document.getElementById('create-user-modal');
    const deleteModal = document.getElementById('deleteModal');

    // Counts
    const countAllEl = document.getElementById('count-all');
    const countPersonalEl = document.getElementById('count-personal');
    const countBusinessEl = document.getElementById('count-business');
    const countActiveEl = document.getElementById('count-active');
    const countPendingEl = document.getElementById('count-pending');
    const countLockedEl = document.getElementById('count-locked');
    const countSuspendedEl = document.getElementById('count-suspended');
    const displayUserCountEl = document.getElementById('display-user-count');
    const totalUsersTextEl = document.getElementById('total-users-text');

    // Filter & Search
    const userSearchInput = document.getElementById('user-search-input');
    const userTypeSelect = document.getElementById('user-type-select');
    const userStatusSelect = document.getElementById('user-status-select');
    const btnResetFilters = document.getElementById('btn-reset-filters');

    function updateCounts() {
      const activeList = usersData.filter(u => u.status !== 'suspended');
      const suspendedList = usersData.filter(u => u.status === 'suspended');

      const all = activeList.length;
      const personal = activeList.filter(u => u.type === 'personal').length;
      const business = activeList.filter(u => u.type === 'business').length;
      const active = activeList.filter(u => u.status === 'active').length;
      const pending = activeList.filter(u => u.status === 'pending').length;
      const locked = activeList.filter(u => u.status === 'locked').length;
      const suspended = suspendedList.length;

      if (countAllEl) countAllEl.textContent = all;
      if (countPersonalEl) countPersonalEl.textContent = personal;
      if (countBusinessEl) countBusinessEl.textContent = business;
      if (countActiveEl) countActiveEl.textContent = active;
      // Tab "Chờ xác thực" đếm hồ sơ luật sư chờ duyệt (chưa tải được thì hiện –)
      if (countPendingEl) countPendingEl.textContent = pendingApplicationsCount ?? '–';
      if (countLockedEl) countLockedEl.textContent = locked;
      const countSuspEl = document.getElementById('count-suspended');
      if (countSuspEl) countSuspEl.textContent = suspended;
      if (totalUsersTextEl) totalUsersTextEl.textContent = currentFilterTab === 'suspended' ? suspended : all;
    }

    function setFilterTab(tab) {
      currentFilterTab = tab;
      document.querySelectorAll('.filter-tab-btn').forEach(btn => {
        const filter = btn.getAttribute('data-filter');
        if (filter === currentFilterTab) {
          if (filter === 'suspended') {
            btn.className = 'filter-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-bold bg-gradient-to-r from-rose-700 to-rose-600 text-white shadow-sm transition-all flex items-center gap-1.5';
          } else {
            btn.className = 'filter-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-bold bg-gradient-to-r from-red-700 to-red-600 text-white shadow-sm transition-all' + (['active', 'pending', 'locked'].includes(filter) ? ' flex items-center gap-1.5' : '');
          }
        } else {
          if (filter === 'suspended') {
            btn.className = 'filter-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-rose-700 hover:bg-rose-50 transition-colors flex items-center gap-1.5';
          } else if (filter === 'active') {
            btn.className = 'filter-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-emerald-800 hover:bg-emerald-50 transition-colors flex items-center gap-1.5';
          } else if (filter === 'pending') {
            btn.className = 'filter-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-amber-800 hover:bg-amber-50 transition-colors flex items-center gap-1.5';
          } else if (filter === 'locked') {
            btn.className = 'filter-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1.5';
          } else {
            btn.className = 'filter-tab-btn px-3.5 py-1.5 rounded-lg font-label-md text-label-md font-medium text-stone-600 hover:text-red-700 hover:bg-amber-50 transition-colors';
          }
        }
      });
      notifyFilterTabChange();
      renderUserTable();
    }

    function renderUserTable() {
      const query = (userSearchInput?.value || '').trim().toLowerCase();
      const typeFilter = userTypeSelect?.value || '';
      const statusFilter = userStatusSelect?.value || '';

      const isViewingSuspended = currentFilterTab === 'suspended' || statusFilter === 'suspended';

      const filtered = usersData.filter(user => {
        if (isViewingSuspended) {
          if (user.status !== 'suspended') return false;
        } else {
          if (user.status === 'suspended') return false;

          if (currentFilterTab === 'personal' && user.type !== 'personal') return false;
          if (currentFilterTab === 'business' && user.type !== 'business') return false;
          if (currentFilterTab === 'active' && user.status !== 'active') return false;
          if (currentFilterTab === 'pending' && user.status !== 'pending') return false;
          if (currentFilterTab === 'locked' && user.status !== 'locked') return false;
        }

        if (typeFilter && user.type !== typeFilter) return false;
        if (statusFilter && statusFilter !== 'suspended' && user.status !== statusFilter) return false;

        if (query) {
          const matchName = user.name.toLowerCase().includes(query);
          const matchEmail = user.email.toLowerCase().includes(query);
          const queryDigits = query.replace(/\D/g, '');
          const matchPhone = queryDigits !== '' && user.phone.replace(/\D/g, '').includes(queryDigits);
          const matchId = user.id.toLowerCase().includes(query);
          if (!matchName && !matchEmail && !matchPhone && !matchId) return false;
        }

        return true;
      });

      if (displayUserCountEl) displayUserCountEl.textContent = filtered.length;

      if (filtered.length === 0) {
        if (isViewingSuspended) {
          userTableBody.innerHTML = `
            <tr>
              <td colspan="7" class="py-12 text-center text-stone-500">
                <p class="font-medium text-stone-600">Hiện không có tài khoản nào trong danh mục đã xóa.</p>
                <button type="button" data-empty-action="all" class="mt-3 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold">
                  Xem tất cả người dùng
                </button>
              </td>
            </tr>
          `;
        } else {
          userTableBody.innerHTML = `
            <tr>
              <td colspan="7" class="py-12 text-center text-stone-500">
                <span class="material-symbols-outlined text-[36px] text-stone-400 mb-2">person_search</span>
                <p class="font-medium text-stone-600">Không tìm thấy người dùng nào phù hợp với điều kiện tìm kiếm.</p>
                <button type="button" data-empty-action="reset" class="mt-3 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold">
                  Đặt lại bộ lọc
                </button>
              </td>
            </tr>
          `;
        }
        // Script là module nên không còn hàm toàn cục cho onclick; gắn sự kiện trực tiếp sau khi dựng HTML.
        userTableBody.querySelector('[data-empty-action="all"]')?.addEventListener('click', () => setFilterTab('all'));
        userTableBody.querySelector('[data-empty-action="reset"]')?.addEventListener('click', resetAllFilters);
        return;
      }

      userTableBody.innerHTML = filtered.map(user => {
        let statusBadge = '';
        if (user.status === 'active') {
          statusBadge = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#ecfdf5] text-[#15803d] border border-[#15803d]/20 shadow-2xs">
              <span class="w-1.5 h-1.5 rounded-full bg-[#15803d]"></span>Hoạt động
            </span>
          `;
        } else if (user.status === 'pending') {
          statusBadge = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f8ece6] text-[#8f3627] border border-[#bd5440]/30 shadow-2xs">
              <span class="w-1.5 h-1.5 rounded-full bg-[#bd5440] animate-pulse"></span>Chờ xác thực
            </span>
          `;
        } else if (user.status === 'suspended') {
          statusBadge = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f7e2db] text-[#8f3627] border border-[#ecc8bc]/30 shadow-2xs">
              <span class="w-1.5 h-1.5 rounded-full bg-[#a64031]"></span>Tài khoản đã xóa
            </span>
          `;
        } else {
          statusBadge = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f7e2db] text-red-700 border border-red-300 shadow-2xs">
              <span class="w-1.5 h-1.5 rounded-full bg-red-600"></span>Đã khóa
            </span>
          `;
        }

        const typeBadge = user.type === 'business'
          ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#a64031]/10 text-[#a64031] border border-[#a64031]/20">Luật sư</span>`
          : user.type === 'admin'
            ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">Quản trị viên</span>`
            : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-800 border border-stone-200">Công dân</span>`;

        let rowBgClass = 'hover:bg-amber-50/50 transition-colors group';
        if (user.status === 'locked') rowBgClass = 'hover:bg-red-50/50 bg-red-50/20 transition-colors group';
        if (user.status === 'pending') rowBgClass = 'hover:bg-amber-50/60 bg-amber-50/20 transition-colors group';
        if (user.status === 'suspended') rowBgClass = 'hover:bg-rose-50/60 bg-rose-50/20 transition-colors group';

        const actionButtons = user.status === 'suspended'
          ? `
            <div class="flex items-center justify-center gap-2">
              <button
                class="btn-view-user p-1.5 rounded-lg text-stone-600 hover:text-amber-800 hover:bg-amber-100 transition-colors"
                data-id="${user.id}"
                title="Xem chi tiết hồ sơ">
                <span class="material-symbols-outlined text-[19px] pointer-events-none">visibility</span>
              </button>

              <!-- NÚT KHÔI PHỤC (UNDO) TÀI KHOẢN -->
              <button
                class="btn-restore-user inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-label-md text-xs font-bold shadow-sm shadow-emerald-700/20 transition-all active:scale-95 cursor-pointer"
                data-id="${user.id}"
                data-name="${escapeHtml(user.name)}"
                title="Khôi phục tài khoản này (Undo)">
                <span class="material-symbols-outlined text-[17px] pointer-events-none">restart_alt</span>
                <span>Khôi phục (Undo)</span>
              </button>
            </div>
          `
          : `
            <div class="flex items-center justify-center gap-1.5">
              <!-- 1. BIỂU TƯỢNG CON MẮT: CHỈ XEM THÔI -->
              <button
                class="btn-view-user p-1.5 rounded-lg text-stone-600 hover:text-amber-800 hover:bg-amber-100 transition-colors"
                data-id="${user.id}"
                title="Xem chi tiết hồ sơ (chỉ đọc)">
                <span class="material-symbols-outlined text-[19px] pointer-events-none">visibility</span>
              </button>

              <!-- 2. BIỂU TƯỢNG CHỈNH SỬA: CÓ THỂ XEM VÀ CHỈNH SỬA -->
              <button
                class="btn-edit-user p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                data-id="${user.id}"
                title="Chỉnh sửa thông tin hồ sơ">
                <span class="material-symbols-outlined text-[19px] pointer-events-none">edit_note</span>
              </button>

              <!-- 3. BIỂU TƯỢNG XÓA (HIỆN POPUP XÁC NHẬN NGAY LẬP TỨC) -->
              <button
                class="btn-delete-user p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-100/50 transition-colors cursor-pointer"
                data-id="${user.id}"
                data-name="${escapeHtml(user.name)}"
                data-email="${escapeHtml(user.email)}"
                title="Xóa tài khoản người dùng">
                <span class="material-symbols-outlined text-[19px] pointer-events-none">delete</span>
              </button>
            </div>
          `;

        return `
          <tr class="${rowBgClass}" id="user-row-${user.id}">
            <td class="py-3.5 px-4 text-center">
              <input class="w-4 h-4 rounded text-red-600 accent-red-600 cursor-pointer user-checkbox" type="checkbox" data-id="${user.id}" />
            </td>
            
            <td class="py-3.5 px-4">
              <div class="flex items-center gap-3">
                <div class="relative shrink-0">
                  <div class="w-10 h-10 rounded-full ${user.avatarBg} text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-stone-200">
                    ${user.initials}
                  </div>
                  ${user.status === 'active' ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-[#15803d] rounded-full ring-2 ring-white" title="Trực tuyến"></span>' : ''}
                  ${user.status === 'pending' ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-[#bd5440] rounded-full ring-2 ring-white" title="Chờ xác thực"></span>' : ''}
                  ${user.status === 'locked' ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-red-600 rounded-full ring-2 ring-white" title="Đã khóa"></span>' : ''}
                  ${user.status === 'suspended' ? '<span class="absolute bottom-0 right-0 w-3 h-3 bg-rose-600 rounded-full ring-2 ring-white" title="Tài khoản đã xóa"></span>' : ''}
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-title-md text-title-md font-bold text-stone-900 truncate ${user.status === 'locked' ? 'line-through text-red-800' : ''} ${user.status === 'suspended' ? 'line-through text-stone-500' : ''}">${escapeHtml(user.name)}</span>
                    ${user.verified ? '<span class="material-symbols-outlined text-[16px] text-red-600" title="Đã khai hồ sơ CCCD">verified</span>' : ''}
                  </div>
                  <span class="text-xs text-stone-500 font-label-code" title="${user.id}">ID: ${user.shortId}</span>
                </div>
              </div>
            </td>

            <td class="py-3.5 px-4">
              <div class="flex flex-col">
                <span class="font-semibold text-red-700 text-xs underline underline-offset-2">${escapeHtml(user.email)}</span>
                <span class="text-[11px] text-stone-500 font-label-code mt-0.5">${escapeHtml(user.phone)}</span>
              </div>
            </td>

            <td class="py-3.5 px-4">
              <div class="flex flex-col font-label-code text-xs text-stone-800">
                <span class="font-semibold">${user.regDate}</span>
                <span class="text-[11px] text-stone-500">${user.regTime}</span>
              </div>
            </td>

            <td class="py-3.5 px-4">
              ${typeBadge}
            </td>

            <td class="py-3.5 px-4 text-center">
              ${statusBadge}
            </td>

            <td class="py-3.5 px-4 text-center">
              ${actionButtons}
            </td>
          </tr>
        `;
      }).join('');

      attachTableActionEvents();
    }

    function attachTableActionEvents() {
      // 1. NÚT CON MẮT
      document.querySelectorAll('.btn-view-user').forEach(btn => {
        btn.onclick = function(e) {
          e.stopPropagation();
          const userId = this.getAttribute('data-id');
          openUserModal(userId, 'view');
        };
      });

      // 2. NÚT CÂY BÚT
      document.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.onclick = function(e) {
          e.stopPropagation();
          const userId = this.getAttribute('data-id');
          openUserModal(userId, 'edit');
        };
      });

      // 3. NÚT XÓA: GỌI openDeleteModal NGAY KHI CLICK
      document.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          const userId = this.getAttribute('data-id');
          openDeleteModal(userId);
        };
      });

      // 4. NÚT KHÔI PHỤC (UNDO)
      document.querySelectorAll('.btn-restore-user').forEach(btn => {
        btn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          const userId = this.getAttribute('data-id');
          restoreUser(userId);
        };
      });
    }

    async function openUserModal(userId, mode = 'view') {
      const user = usersData.find(u => u.id === userId);
      if (!user) return;
      try {
        await loadCitizenProfile(user);
      } catch (e) {
        showToast('Không tải được hồ sơ CCCD', e.message, true);
      }

      currentModalUserId = userId;
      currentModalMode = mode;

      document.getElementById('modal-user-id-badge').textContent = user.shortId;
      document.getElementById('modal-user-id-badge').title = user.id;
      document.getElementById('modal-avatar').textContent = user.initials;
      document.getElementById('modal-avatar').className = `w-10 h-10 rounded-full ${user.avatarBg} text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-red-600/30 shrink-0`;
      document.getElementById('modal-avatar-name').textContent = user.name;
      document.getElementById('modal-meta-regdate').textContent = `Ngày tạo: ${user.regDate} ${user.regTime}`;
      document.getElementById('modal-meta-type-text').textContent = `Tài khoản ${(ROLE_LABEL[user.role] || '').toLowerCase()}`;

      document.getElementById('card-front-cccd').textContent = user.cccd || 'Chưa khai hồ sơ';
      document.getElementById('card-front-name').textContent = user.name;
      document.getElementById('card-front-dob').textContent = user.dob || '—';
      document.getElementById('card-front-gender').textContent = user.gender || '—';
      document.getElementById('card-front-expiry').textContent = user.cardExpiry || '—';
      document.getElementById('card-back-issuedate').textContent = user.cardIssueDate || '—';
      document.getElementById('card-back-issueplace').textContent = user.cardIssuePlace || '—';
      document.getElementById('card-back-mrz1').textContent = `IDVNM${user.cccd}<<<<<<<<<<<<<<`;
      document.getElementById('card-back-mrz3').textContent = `${user.name.toUpperCase().replace(/\s+/g, '<')}<<<<<<<<<<<<<<<<`;

      document.getElementById('modal-input-name').value = user.name;
      document.getElementById('modal-input-cccd').value = user.cccd;
      document.getElementById('modal-input-dob').value = user.dob;
      document.getElementById('modal-input-gender').value = user.gender;
      document.getElementById('modal-input-nationality').value = user.nationality || '';

      document.getElementById('modal-input-card-issuedate').value = user.cardIssueDate || '';
      document.getElementById('modal-input-card-issueplace').value = user.cardIssuePlace || '';
      document.getElementById('modal-input-card-expiry').value = user.cardExpiry || '';

      document.getElementById('modal-input-hometown').value = user.hometown || '';
      document.getElementById('modal-input-perm-street').value = user.permanentAddress?.street || '';
      document.getElementById('modal-input-perm-ward').value = user.permanentAddress?.ward || '';
      document.getElementById('modal-input-perm-city').value = user.permanentAddress?.city || '';

      const sameAddressCheck = document.getElementById('modal-check-same-address');
      sameAddressCheck.checked = !!user.currentAddress?.sameAsPermanent;
      
      document.getElementById('modal-input-curr-street').value = user.currentAddress?.street || '';
      document.getElementById('modal-input-curr-ward').value = user.currentAddress?.ward || '';
      document.getElementById('modal-input-curr-city').value = user.currentAddress?.city || '';

      syncCurrentAddressState();

      document.getElementById('modal-input-phone').value = user.phone;
      document.getElementById('modal-input-email').value = user.email;
      document.getElementById('modal-input-ethnicity').value = user.ethnicity || '';
      document.getElementById('modal-input-taxcode').value = user.taxCode || '';

      document.getElementById('modal-input-type').value = user.type;
      document.getElementById('modal-input-status').value = user.status;
      document.getElementById('modal-input-notes').value = user.notes || '';

      document.getElementById('modal-check-commit').checked = !!user.isCommitted;
      document.getElementById('modal-check-agree').checked = !!user.isAgreedSave;

      const statusBadgeContainer = document.getElementById('modal-status-badge-container');
      if (user.status === 'active') {
        statusBadgeContainer.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
            <span class="w-1.5 h-1.5 rounded-full bg-state-success"></span>
            <span>Đang hoạt động</span>
          </span>
        `;
      } else if (user.status === 'pending') {
        statusBadgeContainer.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
            <span class="w-1.5 h-1.5 rounded-full bg-[#bd5440] animate-pulse"></span>
            <span>Chờ xác thực</span>
          </span>
        `;
      } else if (user.status === 'suspended') {
        statusBadgeContainer.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            <span>Tài khoản đã xóa</span>
          </span>
        `;
      } else {
        statusBadgeContainer.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300 shadow-2xs">
            <span class="w-1.5 h-1.5 rounded-full bg-red-600"></span>
            <span>Tạm khóa</span>
          </span>
        `;
      }

      applyModalMode(mode, user.name);
      openModal(userModal);
    }

    function applyModalMode(mode, userName = '') {
      currentModalMode = mode;
      const inputs = document.querySelectorAll('.modal-input');
      const confirmCheckboxes = document.querySelectorAll('.modal-confirm-checkbox');
      const modalTitle = document.getElementById('modal-title');
      const modalModeBadge = document.getElementById('modal-mode-badge');
      const modalHeaderIcon = document.getElementById('modal-header-icon');
      const viewActions = document.getElementById('modal-view-actions');
      const editActions = document.getElementById('modal-edit-actions');
      const sameAddressCheck = document.getElementById('modal-check-same-address');

      if (mode === 'view') {
        modalTitle.textContent = `Chi tiết hồ sơ - ${userName}`;
        modalHeaderIcon.textContent = 'visibility';
        modalModeBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30';
        modalModeBadge.innerHTML = `<span class="material-symbols-outlined text-[13px]">visibility</span><span>Chế độ chỉ xem</span>`;

        inputs.forEach(input => {
          input.setAttribute('disabled', 'true');
          input.classList.remove('focus:ring-2', 'focus:ring-red-600/20', 'focus:border-red-600', 'bg-white');
          input.classList.add('bg-stone-100/70', 'cursor-default', 'text-stone-800');
        });

        confirmCheckboxes.forEach(cb => cb.setAttribute('disabled', 'true'));
        if (sameAddressCheck) sameAddressCheck.setAttribute('disabled', 'true');
        viewActions.classList.remove('hidden');
        editActions.classList.add('hidden');
      } else {
        modalTitle.textContent = `Chỉnh sửa hồ sơ - ${userName}`;
        modalHeaderIcon.textContent = 'edit_note';
        modalModeBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/25 text-blue-200 border border-blue-400/40';
        modalModeBadge.innerHTML = `<span class="material-symbols-outlined text-[13px]">edit</span><span>Chế độ chỉnh sửa</span>`;

        inputs.forEach(input => {
          input.removeAttribute('disabled');
          input.classList.remove('bg-stone-100/70', 'cursor-default');
          input.classList.add('focus:ring-2', 'focus:ring-red-600/20', 'focus:border-red-600', 'bg-white');
        });

        confirmCheckboxes.forEach(cb => cb.removeAttribute('disabled'));
        if (sameAddressCheck) sameAddressCheck.removeAttribute('disabled');
        const emailInput = document.getElementById('modal-input-email');
        if (emailInput) {
          emailInput.setAttribute('disabled', 'true');
          emailInput.classList.remove('bg-white');
          emailInput.classList.add('bg-stone-100/90', 'cursor-not-allowed');
        }

        syncCurrentAddressState();

        const adminEditableIds = ['modal-input-type', 'modal-input-status'];
        inputs.forEach(input => {
          if (adminEditableIds.includes(input.id)) return;
          input.setAttribute('disabled', 'true');
          input.classList.remove('focus:ring-2', 'focus:ring-red-600/20', 'focus:border-red-600', 'bg-white');
          input.classList.add('bg-stone-100/70', 'cursor-default', 'text-stone-800');
        });
        confirmCheckboxes.forEach(cb => cb.setAttribute('disabled', 'true'));
        if (sameAddressCheck) sameAddressCheck.setAttribute('disabled', 'true');

        viewActions.classList.add('hidden');
        editActions.classList.remove('hidden');
      }
    }

    function syncCurrentAddressState() {
      const sameAddressCheck = document.getElementById('modal-check-same-address');
      const currStreet = document.getElementById('modal-input-curr-street');
      const currWard = document.getElementById('modal-input-curr-ward');
      const currCity = document.getElementById('modal-input-curr-city');
      const hint = document.getElementById('curr-address-hint');

      const permStreet = document.getElementById('modal-input-perm-street').value;
      const permWard = document.getElementById('modal-input-perm-ward').value;
      const permCity = document.getElementById('modal-input-perm-city').value;

      if (sameAddressCheck.checked) {
        currStreet.value = permStreet;
        currWard.value = permWard;
        currCity.value = permCity;

        currStreet.setAttribute('disabled', 'true');
        currWard.setAttribute('disabled', 'true');
        currCity.setAttribute('disabled', 'true');
        currStreet.classList.add('bg-stone-100');
        currWard.classList.add('bg-stone-100');
        currCity.classList.add('bg-stone-100');
        if (hint) hint.classList.remove('hidden');
      } else {
        if (currentModalMode === 'edit') {
          currStreet.removeAttribute('disabled');
          currWard.removeAttribute('disabled');
          currCity.removeAttribute('disabled');
          currStreet.classList.remove('bg-stone-100');
          currWard.classList.remove('bg-stone-100');
          currCity.classList.remove('bg-stone-100');
          currStreet.classList.add('bg-white');
          currWard.classList.add('bg-white');
          currCity.classList.add('bg-white');
        }
        if (hint) hint.classList.add('hidden');
      }
    }

    async function saveUserRecord() {
      const user = usersData.find(u => u.id === currentModalUserId);
      if (!user) return;

      const newRole = TYPE_TO_ROLE[document.getElementById('modal-input-type').value];
      const newStatus = document.getElementById('modal-input-status').value;
      const wasLocked = user.raw && user.raw.status === 'locked';
      const wantLocked = newStatus === 'locked';
      const saveBtn = document.getElementById('btn-save-user-record');
      const changes = [];

      // Trạng thái "pending/active" được suy ra từ hồ sơ CCCD ở Backend.
      // Chỉ cho phép quản trị viên đổi trạng thái khóa qua API lock/unlock.
      if (newStatus !== user.status && newStatus !== 'locked' && !wasLocked) {
        showToast('Không thể lưu trạng thái', 'Trạng thái xác thực được quyết định từ hồ sơ người dùng.', true);
        return;
      }

      if (newRole === user.role && wantLocked === wasLocked && newStatus === user.status) {
        showToast('Không có thay đổi', 'Quản trị viên chỉ đổi được loại tài khoản (vai trò) và trạng thái. Thông tin CCCD do người dùng tự khai.');
        return;
      }

      if (saveBtn) saveBtn.disabled = true;
      try {
        if (newRole && newRole !== user.role) {
          await updateUserRole(user.id, newRole);
          changes.push(`vai trò: ${ROLE_LABEL[newRole]}`);
        }

        if (wantLocked && !wasLocked) {
          const reason = prompt(`Lý do khóa tài khoản "${user.name}" (người dùng sẽ thấy lý do này):`, '');
          if (reason !== null && !reason.trim()) alert('Bắt buộc nhập lý do khóa.');
          if (reason && reason.trim()) {
            const daysText = prompt('Khóa trong bao nhiêu ngày? (để trống = khóa vĩnh viễn)', '7');
            if (daysText !== null) {
              const days = daysText.trim() === '' ? null : Number(daysText);
              if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
                alert('Số ngày khóa phải là số nguyên từ 1 đến 3650.');
              } else {
                await lockUser(user.id, { reason: reason.trim(), durationDays: days });
                changes.push(days ? `khóa ${days} ngày` : 'khóa vĩnh viễn');
              }
            }
          }
        } else if (!wantLocked && wasLocked) {
          await unlockUser(user.id);
          changes.push('mở khóa');
        }
      } catch (e) {
        showToast('Không lưu được', e.message, true);
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }

      if (changes.length) {
        closeModal(userModal);
        await loadUsers();
        showToast('Đã lưu thay đổi', `"${user.name}": ${changes.join(', ')}.`);
      }
    }

    // =========================================================================
    // XÓA TÀI KHOẢN (XÓA MỀM VÀO TẠM NGƯNG + HỖ TRỢ HOÀN TÁC / UNDO)
    // =========================================================================
    let targetedDeleteUserId = null;
    function closeDeleteModal() {
      closeModal(deleteModal);
      targetedDeleteUserId = null;
    }

    function openDeleteModal(userId, name, email) {
      targetedDeleteUserId = userId;
      const user = usersData.find(u => u.id === userId);
      const displayName = name || (user ? user.name : '');
      const displayEmail = email || (user ? user.email : '');
      document.getElementById('delete-user-name').textContent = displayName;
      document.getElementById('delete-user-email').textContent = displayEmail;
      openModal(deleteModal);
    }

    async function confirmDeleteUser() {
      if (!targetedDeleteUserId) return;
      const user = usersData.find(u => u.id === targetedDeleteUserId);
      if (!user) return;
      const btn = document.getElementById('btn-confirm-delete');
      if (btn) btn.disabled = true;
      const deletedAt = new Date().toISOString();
      const deletedUser = {
        ...user,
        raw: { ...(user.raw || {}), status: 'suspended', is_deleted: true, deleted_at: deletedAt },
        status: 'suspended',
        previousStatus: user.status,
        deletedAt,
        notes: `Tài khoản đã xóa lúc ${fmtTime(deletedAt)} ngày ${fmtDate(deletedAt)}. Có thể khôi phục.`
      };

      try {
        await deleteUser(user.id);
      } catch (e) {
        if (btn) btn.disabled = false;
        showToast('Không thể xóa tài khoản', e.message, true);
        return;
      }

      if (btn) btn.disabled = false;
      closeDeleteModal();
      await loadUsers();
      // Một số Backend không trả bản ghi đã xóa trong API danh sách.
      // Dùng chính dữ liệu tài khoản vừa xóa để giữ nó trong tab khôi phục.
      const deletedIndex = usersData.findIndex(item => item.id === deletedUser.id);
      if (deletedIndex === -1) {
        usersData.push(deletedUser);
        updateCounts();
      } else if (usersData[deletedIndex].status !== 'suspended') {
        usersData[deletedIndex] = deletedUser;
        updateCounts();
      }
      setFilterTab('suspended');
      showToastWithUndo('Đã xóa tài khoản', `"${user.name}" đã được chuyển vào mục "Tài khoản đã xóa".`, () => restoreUser(user.id));
    }

    async function restoreUser(userId) {
      const user = usersData.find(u => u.id === userId);
      if (!user) return;

      try {
        await restoreDeletedUser(user.id);
      } catch (e) {
        showToast('Không thể khôi phục tài khoản', e.message, true);
        return;
      }

      await loadUsers();
      showToast('Khôi phục tài khoản thành công', `Tài khoản "${user.name}" đã được hoàn tác và kích hoạt trở lại.`);
    }

    async function submitCreateUser() {
      const name = document.getElementById('create-user-name').value.trim();
      const email = document.getElementById('create-user-email').value.trim();
      const phone = document.getElementById('create-user-phone').value.trim();
      const type = document.getElementById('create-user-type').value;
      const password = document.getElementById('create-user-password').value;
      const passwordConfirm = document.getElementById('create-user-password-confirm').value;

      if (!name || !email) {
        alert('Vui lòng nhập họ tên và email!');
        return;
      }
      if (password.length < 8) {
        alert('Mật khẩu phải có ít nhất 8 ký tự.');
        return;
      }
      if (password !== passwordConfirm) {
        alert('Mật khẩu xác nhận không khớp.');
        return;
      }

      const role = TYPE_TO_ROLE[type] || 'citizen';
      const btn = document.getElementById('btn-submit-create-user');
      if (btn) btn.disabled = true;
      try {
        await createUser({ email, password, full_name: name, phone: phone || null, account_type: role });
        closeModal(createUserModal);
        ['create-user-name', 'create-user-cccd', 'create-user-email', 'create-user-phone', 'create-user-password', 'create-user-password-confirm'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        await loadUsers();
        const lawyerNote = role === 'lawyer' ? ' Tài khoản luật sư vẫn là công dân cho tới khi được duyệt hồ sơ.' : '';
        showToast('Đã tạo tài khoản', `Đăng nhập bằng ${email} và mật khẩu vừa đặt.${lawyerNote}`);
      } catch (e) {
        // Không tạo bản ghi giả trên trình duyệt: báo đúng lỗi Backend trả về.
        showToast('Không thể tạo tài khoản', e.message, true);
      } finally {
        if (btn) btn.disabled = false;
      }
    }


    function resetAllFilters() {
      if (userSearchInput) userSearchInput.value = '';
      if (userTypeSelect) userTypeSelect.value = '';
      if (userStatusSelect) userStatusSelect.value = '';
      setFilterTab('all');
    }

    // =========================================================================
    // ĐIỂM GIAO TIẾP VỚI MODULE DUYỆT HỒ SƠ LUẬT SƯ
    // =========================================================================
    let filterTabListener = null;
    let pendingApplicationsCount = null; // số hồ sơ luật sư chờ xác thực (hiện trên tab)

    export function setPendingCount(value) {
      pendingApplicationsCount = value;
      updateCounts();
    }

    export function getUsersData() {
      return usersData;
    }

    export function getCurrentFilterTab() {
      return currentFilterTab;
    }

    export function onFilterTabChange(listener) {
      filterTabListener = listener;
    }

    function notifyFilterTabChange() {
      if (filterTabListener) filterTabListener();
    }

    export { loadUsers, openUserModal, updateCounts, initialsOf, avatarBgOf, fmtDate, fmtTime };

    // =========================================================================
    // KHỞI TẠO & GẮN SỰ KIỆN
    // =========================================================================
    export function initUsers() {
      window.addEventListener('admin-auth-ready', loadUsers, { once: true });

      const start = () => {
        updateCounts();
        renderUserTable();

        const checkAllBox = document.getElementById('check-all');
        if (checkAllBox) {
          checkAllBox.addEventListener('change', function () {
            document.querySelectorAll('.user-checkbox').forEach(cb => { cb.checked = checkAllBox.checked; });
          });
        }

        if (userSearchInput) userSearchInput.addEventListener('input', renderUserTable);
        if (userTypeSelect) userTypeSelect.addEventListener('change', renderUserTable);
        if (userStatusSelect) userStatusSelect.addEventListener('change', function () {
          if (this.value === 'suspended' && currentFilterTab !== 'suspended') {
            setFilterTab('suspended');
          } else if (this.value !== 'suspended' && currentFilterTab === 'suspended') {
            setFilterTab('all');
          } else {
            renderUserTable();
          }
        });
        if (btnResetFilters) btnResetFilters.addEventListener('click', resetAllFilters);

        document.querySelectorAll('.filter-tab-btn').forEach(btn => {
          btn.addEventListener('click', function () {
            setFilterTab(this.getAttribute('data-filter'));
          });
        });

        document.getElementById('btn-close-user-modal')?.addEventListener('click', () => closeModal(userModal));
        document.getElementById('btn-close-view-mode')?.addEventListener('click', () => closeModal(userModal));
        document.getElementById('btn-cancel-edit-mode')?.addEventListener('click', () => closeModal(userModal));

        document.getElementById('btn-switch-to-edit-mode')?.addEventListener('click', () => {
          const user = usersData.find(u => u.id === currentModalUserId);
          if (user) {
            applyModalMode('edit', user.name);
          }
        });

        document.getElementById('btn-save-user-record')?.addEventListener('click', saveUserRecord);

        const sameAddressCheck = document.getElementById('modal-check-same-address');
        if (sameAddressCheck) {
          sameAddressCheck.addEventListener('change', syncCurrentAddressState);
        }

        ['modal-input-perm-street', 'modal-input-perm-ward', 'modal-input-perm-city'].forEach(id => {
          document.getElementById(id)?.addEventListener('input', () => {
            if (sameAddressCheck && sameAddressCheck.checked) {
              syncCurrentAddressState();
            }
          });
        });

        bindModalDismiss(userModal);

        document.getElementById('btn-open-create-modal')?.addEventListener('click', () => openModal(createUserModal));
        document.getElementById('btn-close-create-modal')?.addEventListener('click', () => closeModal(createUserModal));
        document.getElementById('btn-cancel-create')?.addEventListener('click', () => closeModal(createUserModal));
        document.getElementById('btn-submit-create-user')?.addEventListener('click', submitCreateUser);
        bindModalDismiss(createUserModal);

        document.getElementById('btn-close-delete-modal')?.addEventListener('click', closeDeleteModal);
        document.getElementById('btn-cancel-delete')?.addEventListener('click', closeDeleteModal);
        document.getElementById('btn-confirm-delete')?.addEventListener('click', confirmDeleteUser);
        bindModalDismiss(deleteModal, closeDeleteModal);

        document.getElementById('btn-export-excel')?.addEventListener('click', exportUsersCsv);
      };

      // Script module chạy sau khi HTML đã được phân tích; vẫn kiểm tra readyState cho chắc.
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
      } else {
        start();
      }
    }
