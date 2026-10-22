
const LEGACY_SESSION_KEY = 'ai_legal_session'; // bản cũ lưu token trong localStorage
let configPromise;

export const getApiBaseUrl = () => {
  if (!configPromise) {
    configPromise = fetch('/api/app-config')
      .then((response) => (response.ok ? response.json() : {}))
      .then((config) => (config.apiBaseUrl || 'http://localhost:8080').replace(/\/+$/, ''))
      .catch(() => 'http://localhost:8080');
  }
  return configPromise;
};

// Gọi ngầm trước API base URL để sẵn sàng ngay khi người dùng thao tác
getApiBaseUrl().catch(() => {});

// body: object → gửi JSON; FormData → gửi multipart (trình duyệt tự đặt Content-Type).
const request = async (path, { method = 'GET', body, headers = {}, signal } = {}) => {
  const baseUrl = await getApiBaseUrl();
  const isJson = body !== undefined && !(body instanceof FormData);
  try {
    return await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: isJson ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: isJson ? JSON.stringify(body) : body,
      signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error; // người dùng chủ động huỷ, không phải lỗi mạng
    throw Object.assign(new Error('backend-unreachable'), { code: 'backend/unreachable', baseUrl });
  }
};

const apiError = (response, payload) => {
  const error = payload?.error || {};
  return Object.assign(new Error(error.message || 'backend-error'), {
    code: error.code || `backend/http-${response.status}`,
    status: response.status,
    backendMessage: error.message,
    details: error.details // 422: [{ field, message }] theo từng ô
  });
};

const readData = async (response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) throw apiError(response, payload);
  return payload.data;
};

const postJson = async (path, body) => readData(await request(path, { method: 'POST', body }));

// Gọi API cần đăng nhập. Access token hết hạn (401) → refresh bằng cookie rồi gọi lại 1 lần.
const authRequest = async (path, options) => {
  let response = await request(path, options);
  if (response.status === 401) {
    const refreshed = await request('/api/users/auth/refresh', { method: 'POST' });
    if (refreshed.ok) response = await request(path, options);
  }
  return response;
};

export const loginWithPassword = (username, password) =>
  postJson('/api/users/auth/login', { username, password });

export const loginWithFirebaseToken = (idToken) =>
  postJson('/api/users/auth/firebase', { id_token: idToken });

// Backend đã set cookie khi đăng nhập; ở FE chỉ cần giữ thông tin user để chuyển trang.
// Xoá phiên kiểu cũ (token trong localStorage) nếu còn sót lại.
export const saveSession = (data) => {
  clearSession(); // đăng nhập mới: bỏ thông tin hiển thị của phiên trước
  return { user: data.user };
};

// Nhớ tạm thông tin hiển thị của user trong tab (không có token) để chuyển trang không phải chờ /api/users/me.
// Tên khoá trùng với script chèn trong <head> ở index.js (USER_HEADER_HEAD).
const USER_CACHE_KEY = 'ai_legal_user';
const readCachedUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem(USER_CACHE_KEY));
  } catch {
    return null;
  }
};
const cacheUser = (user) => {
  try {
    const { id, role, full_name, username, email } = user;
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify({ id, role, full_name, username, email }));
  } catch {
    // Trình duyệt chặn sessionStorage: vẫn chạy, chỉ là không nhanh hơn
  }
};

export const clearSession = () => {
  localStorage.removeItem(LEGACY_SESSION_KEY);
  try {
    sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // như trên
  }
};

// Lấy user đang đăng nhập từ Backend. Chưa đăng nhập / phiên hết hạn → null.
export const fetchCurrentUser = async () => {
  const response = await authRequest('/api/users/me');
  if (!response.ok) return null;
  return readData(response);
};

// Hồ sơ cá nhân theo CCCD của user đang đăng nhập. Chưa khai → null.
export const fetchMyCitizenProfile = async () => {
  const response = await authRequest('/api/users/me/citizen-profile');
  if (!response.ok) return readData(response); // ném lỗi kèm mã từ Backend
  const payload = await response.json().catch(() => null);
  return payload?.data ?? null;
};

export const saveMyCitizenProfile = async (profile) =>
  readData(await authRequest('/api/users/me/citizen-profile', { method: 'PUT', body: profile }));

// OCR CCCD hai mặt (Document service). Trả về { session_id, fields, warnings }.
// fields: full_name, identity_number, date_of_birth, issue_date, issue_place, permanent_address (đọc không chắc → null).
export const readIdentityCardOcr = async (front, back) => {
  const form = new FormData();
  form.append('front', front);
  form.append('back', back);
  return readData(await authRequest('/api/documents/identity-ocr', {
    method: 'POST',
    body: form,
    headers: { 'Idempotency-Key': crypto.randomUUID() }
  }));
};

export const fetchAdministrativeUnits = async (path) =>
  readData(await request(`/api/locations/administrative/${path}`));

// Location search dùng cùng cookie/refresh flow; không đưa Goong key ra frontend.
export const searchNearbyOffices = async (payload) =>
  readData(await authRequest('/api/locations/offices/search', { method: 'POST', body: payload }));

// Lưu 6 trường CCCD người dùng đã kiểm tra vào Document (nguồn: phiên OCR) để hợp đồng dùng lại.
export const saveIdentityProfileFromOcr = async (sessionId, fields) => {
  const current = await authRequest('/api/documents/identity-profile/me');
  const payload = await current.json().catch(() => null);
  if (!current.ok && current.status !== 404) throw apiError(current, payload);
  const revision = current.ok ? payload?.data?.revision : payload?.error?.current_revision;
  return readData(await authRequest('/api/documents/identity-profile/me', {
    method: 'PUT',
    body: { source_session_id: sessionId, expected_revision: revision ?? 0, fields }
  }));
};

export const PROFILE_PATH = '/detail-information';

// Muốn tạo hồ sơ phải cập nhật thông tin cá nhân trước. Chưa có → chuyển sang trang cập nhật.
const requireCitizenProfile = async () => {
  const profile = await fetchMyCitizenProfile().catch(() => null);
  if (profile) return profile;
  window.location.replace(`${PROFILE_PATH}?required=1`);
  return new Promise(() => {}); // dừng code phía sau trong lúc chuyển trang
};

// Chặn trang cần đăng nhập. Chưa đăng nhập → /login. Sai vai trò → trang chủ đúng vai trò.
// Trả về user khi được phép ở lại trang.
export const requireLogin = async (allowedRoles) => {
  let user = null;
  try {
    user = await fetchCurrentUser();
  } catch {
    user = null; // Backend không chạy cũng coi như chưa đăng nhập
  }
  if (!user) {
    clearSession();
    window.location.replace('/login');
    return new Promise(() => {}); // dừng code phía sau trong lúc chuyển trang
  }
  cacheUser(user);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.replace(homePathFor(user.role));
    return new Promise(() => {});
  }
  return user;
};

// Đăng xuất: Xoá session ngay lập tức, gửi lệnh thu hồi token lên Backend (keepalive), về /login?loggedOut=1.
export const logout = async () => {
  // 1. Dọn dẹp session phía Client ngay lập tức
  clearSession();

  // 2. Bắn request hủy phiên lên Backend (sử dụng keepalive để trình duyệt đảm bảo hoàn tất kể cả khi chuyển trang)
  getApiBaseUrl()
    .then((baseUrl) => {
      fetch(`${baseUrl}/api/users/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        keepalive: true
      }).catch(() => {});
    })
    .catch(() => {});

  // 3. Đăng xuất Firebase nếu trang có khởi tạo phiên Firebase
  try {
    if (window.firebase?.apps?.length) {
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
        .then(({ getAuth, signOut }) => signOut(getAuth(window.firebase.apps[0])))
        .catch(() => {});
    }
  } catch {
    // Không làm gián đoạn điều hướng người dùng
  }

  // 4. Chuyển hướng ngay lập tức về trang đăng nhập bên ngoài (không để người dùng chờ)
  window.location.replace('/login?loggedOut=1');
};

// Hộp thoại xác nhận đăng xuất (thay cho confirm() của trình duyệt).
// CSS viết sẵn ở đây vì file trong public/ không được Tailwind quét.
const LOGOUT_DIALOG_CSS = `
.logout-dialog{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(28,19,18,.65);font-family:'Be Vietnam Pro',system-ui,sans-serif}
.logout-dialog__card{width:100%;max-width:480px;border-radius:16px;background:#fff;color:#1c1917;border:1px solid #e7e5e4;box-shadow:0 28px 80px rgba(18,10,9,.45);overflow:hidden}
.logout-dialog__bar{height:8px;background:linear-gradient(90deg,#8a1538,#b40006,#ecc15a)}
.logout-dialog__body{padding:24px 28px}
.logout-dialog__head{display:flex;align-items:center;gap:14px}
.logout-dialog__icon{width:48px;height:48px;border-radius:16px;background:#fff1f0;border:1px solid #ffdad5;color:#b40006;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.logout-dialog__eyebrow{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#930004}
.logout-dialog__title{margin:2px 0 0;font-size:20px;font-weight:700;color:#1c1917}
.logout-dialog__user{margin-top:20px;padding:14px 16px;border-radius:12px;background:#faf6f0;border:1px solid #e9dec9;display:flex;align-items:center;gap:12px}
.logout-dialog__avatar{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#b40006,#8a1538);color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.logout-dialog__name{font-size:14px;font-weight:700;color:#1c1917;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.logout-dialog__role{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:6px;background:#ffdf99;color:#5a4300;font-size:11px;font-weight:700;vertical-align:middle}
.logout-dialog__email{margin-top:2px;font-size:12px;color:#57534e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.logout-dialog__list{margin:16px 0 0;padding:14px;list-style:none;border-radius:12px;background:#fafaf9;border:1px solid #e7e5e4;font-size:12.5px;line-height:1.55;color:#57534e}
.logout-dialog__list li+li{margin-top:8px}
.logout-dialog__actions{margin-top:24px;display:flex;gap:12px}
.logout-dialog__btn{flex:1;height:48px;padding:0 20px;border-radius:12px;font:600 14px/1 inherit;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background-color .15s}
.logout-dialog__btn--cancel{background:#fff;color:#292524;border:1px solid #d6d3d1}
.logout-dialog__btn--cancel:hover{background:#f5f5f4}
.logout-dialog__btn--confirm{background:#b40006;color:#fff;border:0;box-shadow:0 6px 20px rgba(180,0,6,.28)}
.logout-dialog__btn--confirm:hover{background:#930004}
.logout-dialog__btn:disabled{opacity:.75;cursor:wait}
.logout-dialog__btn:focus-visible{outline:3px solid #ecc15a;outline-offset:2px}
.logout-dialog__spinner{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:logout-spin .8s linear infinite}
@keyframes logout-spin{to{transform:rotate(360deg)}}
@media (max-width:480px){.logout-dialog__actions{flex-direction:column-reverse}.logout-dialog__body{padding:20px}}
@media (prefers-reduced-motion:reduce){.logout-dialog__spinner{animation-duration:2s}}
`;

const initialsOf = (name) =>
  name.split(/\s+/).filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() || 'ND';

// Mở hộp thoại; bấm "Xác nhận đăng xuất" thì gọi logout(). Esc, bấm nền hoặc "Ở lại trang" thì đóng.
export const confirmLogout = (user) => {
  if (document.querySelector('.logout-dialog')) return;
  if (!document.getElementById('logout-dialog-style')) {
    const style = document.createElement('style');
    style.id = 'logout-dialog-style';
    style.textContent = LOGOUT_DIALOG_CSS;
    document.head.append(style);
  }
  const name = displayName(user);
  const previousFocus = document.activeElement;
  const dialog = document.createElement('div');
  dialog.className = 'logout-dialog';
  dialog.innerHTML = `
    <div class="logout-dialog__card" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title">
      <div class="logout-dialog__bar"></div>
      <div class="logout-dialog__body">
        <div class="logout-dialog__head">
          <div class="logout-dialog__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
          </div>
          <div>
            <div class="logout-dialog__eyebrow">Bảo mật phiên làm việc</div>
            <h2 class="logout-dialog__title" id="logout-dialog-title">Xác nhận đăng xuất?</h2>
          </div>
        </div>
        <div class="logout-dialog__user">
          <div class="logout-dialog__avatar" aria-hidden="true">${escapeHtml(initialsOf(name))}</div>
          <div style="min-width:0">
            <div class="logout-dialog__name">${escapeHtml(name)}<span class="logout-dialog__role">${escapeHtml(roleLabel(user?.role))}</span></div>
            <div class="logout-dialog__email">${escapeHtml(user?.email || user?.username || '')}</div>
          </div>
        </div>
        <ul class="logout-dialog__list">
          <li>Phiên đăng nhập trên thiết bị này sẽ được đóng an toàn.</li>
          <li>Hồ sơ nháp và thông tin cá nhân đã lưu vẫn còn cho lần đăng nhập sau.</li>
        </ul>
        <div class="logout-dialog__actions">
          <button type="button" class="logout-dialog__btn logout-dialog__btn--cancel" data-logout-cancel>Ở lại trang</button>
          <button type="button" class="logout-dialog__btn logout-dialog__btn--confirm" data-logout-confirm>
            <span data-logout-label>Xác nhận đăng xuất</span>
          </button>
        </div>
      </div>
    </div>`;

  const confirmButton = dialog.querySelector('[data-logout-confirm]');
  const cancelButton = dialog.querySelector('[data-logout-cancel]');
  let busy = false;
  const close = () => {
    if (busy) return;
    dialog.remove();
    document.removeEventListener('keydown', onKeydown);
    previousFocus?.focus?.();
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      // Giữ Tab trong hộp thoại
      const first = cancelButton;
      const last = confirmButton;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  cancelButton.addEventListener('click', close);
  confirmButton.addEventListener('click', () => {
    busy = true;
    confirmButton.disabled = true;
    cancelButton.disabled = true;
    confirmButton.innerHTML = '<span class="logout-dialog__spinner" aria-hidden="true"></span><span>Đang đăng xuất...</span>';
    logout();
  });
  document.addEventListener('keydown', onKeydown);
  document.body.append(dialog);
  cancelButton.focus();
};

export const roleLabel = (role) =>
  ({ admin: 'Quản trị viên', lawyer: 'Luật sư', citizen: 'Công dân' })[role] || 'Người dùng';

export const displayName = (user) => user?.full_name || user?.username || user?.email || 'Người dùng';

// Gắn trang: ẩn nội dung tới khi xác thực xong, điền thông tin user, gắn nút đăng xuất.
//   <element data-user-field="name|email|role">   → thay bằng dữ liệu thật
//   <element data-logout>                         → bấm để mở hộp thoại xác nhận đăng xuất
// requireProfile: trang tạo hồ sơ → bắt buộc đã cập nhật thông tin cá nhân.
// Đã có user nhớ tạm (cùng tab) → hiện trang ngay, kiểm tra lại với Backend ở nền: hết phiên thì vẫn về /login.
export const protectPage = async (allowedRoles, { requireProfile = false } = {}) => {
  const cached = readCachedUser();
  const verified = requireLogin(allowedRoles);
  const useCache = cached && !requireProfile && (!allowedRoles || allowedRoles.includes(cached.role));
  const user = useCache ? cached : await verified;
  if (requireProfile) await requireCitizenProfile();
  const fillUserFields = (current) => {
    const values = { name: displayName(current), email: current.email || '', role: roleLabel(current.role) };
    document.querySelectorAll('[data-user-field]').forEach((element) => {
      const value = values[element.dataset.userField];
      if (value !== undefined) element.textContent = value;
    });
  };
  fillUserFields(user);
  let currentUser = user;
  if (useCache) verified.then((fresh) => { currentUser = fresh; fillUserFields(fresh); });
  document.querySelectorAll('[data-logout]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      confirmLogout(currentUser);
    });
  });
  // Đăng xuất rồi bấm Back: trang cũ trong bộ nhớ trình duyệt không được hiện lại dữ liệu.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && !readCachedUser()) window.location.replace('/login');
  });
  document.getElementById('auth-pending')?.remove();
  return user;
};

// admin → giao diện quản trị, còn lại (citizen, lawyer) → giao diện người dùng.
export const homePathFor = (role) => (role === 'admin' ? '/dashboard' : '/user-dashboard');

export const describeLoginError = (error) => {
  const messages = {
    'backend/unreachable': `Không kết nối được máy chủ Backend (${error.baseUrl || 'http://localhost:8080'}). Hãy kiểm tra Backend đã chạy chưa.`,
    'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác.',
    'auth/invalid-login-credentials': 'Email hoặc mật khẩu không chính xác.',
    'auth/user-not-found': 'Email hoặc mật khẩu không chính xác.',
    'auth/wrong-password': 'Email hoặc mật khẩu không chính xác.',
    'auth/invalid-email': 'Địa chỉ email không hợp lệ.',
    'auth/too-many-requests': 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
    'auth/operation-not-allowed': 'Phương thức đăng nhập này chưa được bật trong Firebase Authentication.',
    'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup rồi thử lại.',
    'auth/popup-closed-by-user': 'Cửa sổ đăng nhập Google đã được đóng.',
    'auth/unauthorized-domain': 'Hãy thêm localhost vào Authorized domains trong Firebase.',
    'firebase/config-unavailable': 'Không tải được cấu hình Firebase. Vui lòng thử lại.'
  };
  return messages[error?.code] || error?.backendMessage || 'Không thể đăng nhập. Vui lòng thử lại.';
};

// ===== Hồ sơ, thủ tục, tài liệu (dữ liệu thật từ Backend) =====
// Không bao giờ gửi user_id: Backend lấy chủ hồ sơ từ token.

const withQuery = (path, params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ).toString();
  return query ? `${path}?${query}` : path;
};

const getData = async (path) => readData(await authRequest(path));

// Hồ sơ của người đang đăng nhập → { items, pagination }
export const fetchMyApplications = ({ domain, status, q, page = 1, pageSize = 10 } = {}) =>
  getData(withQuery('/api/procedures/applications/me', { domain, status, q, page, page_size: pageSize }));

// Tra cứu chi tiết tờ đơn hồ sơ bằng mã (DD-001-XXXXXXXX), tiền tố ID, hoặc UUID
export const lookupApplication = async (code) =>
  readData(await authRequest(`/api/procedures/applications/lookup/${encodeURIComponent(code)}`));

// Tải file PDF tờ đơn chính thức từ Backend (A4 chuẩn, không chứa URL hay thành phần giao diện web)
export const exportApplicationPdf = async (code) => {
  const response = await authRequest(`/api/procedures/applications/lookup/${encodeURIComponent(code)}/export-pdf`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw apiError(response, payload);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `To-don-${code}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

// Admin: hồ sơ của mọi người; q tìm theo tên, CCCD hoặc mã thủ tục → { items, pagination }
export const fetchAllApplications = ({ domain, status, q, page = 1, pageSize = 10 } = {}) =>
  getData(withQuery('/api/procedures/applications', { domain, status, q, page, page_size: pageSize }));

// Admin: { total, by_domain: { land, business }, by_status: { draft, submitted, processing, completed, cancelled } }
export const fetchApplicationSummary = () => getData('/api/procedures/applications/summary');

// Danh mục thủ tục công khai theo lĩnh vực ('land' | 'business') → mảng thủ tục
export const fetchProcedures = async (domain) =>
  (await readData(await request(`/api/procedures/domains/${domain}/procedures?include_details=false`))).items;

// Tên & mã thủ tục rút gọn theo lĩnh vực (cho Dropdown select) → [{ id, code, name, domain }]
export const fetchProcedureNames = async (domain = 'all') =>
  (await readData(await request(`/api/procedures/domains/${encodeURIComponent(domain)}/names`))).items;

// Biểu mẫu riêng của một thủ tục (công khai) → { procedure_code, template_filename, sections, fields }
export const fetchFormSchema = async (code) =>
  readData(await request(`/api/procedures/form-schema/${encodeURIComponent(code)}`));

// Kho mẫu đơn tham khảo (công khai) → { items: [{ id, name, procedure, domain, domain_label, format, size, ... }], total }
export const fetchFormTemplates = async ({ domain, procedure_code, q } = {}) =>
  readData(await request(withQuery('/api/procedures/templates', { domain, procedure_code, q })));

// Nộp/lưu nháp hồ sơ → bản ghi đã lưu
export const submitApplication = async ({ procedureCode, status = 'submitted', formData = {} }) =>
  readData(await authRequest('/api/procedures/applications', {
    method: 'POST',
    body: { procedure_code: procedureCode, status, form_data: formData }
  }));

// File người dùng đã upload → { items, pagination }
export const fetchMyDocuments = () => getData('/api/documents/');

// Agent chat
export const createAgentConversation = async () =>
  readData(await authRequest('/api/agent/conversations', { method: 'POST' }));

// documentIds: tối đa 3 id tài liệu đã xử lý xong (uploadAgentDocument). Backend không nhớ tài liệu giữa các lượt.
export const sendAgentMessage = async (conversationId, content, documentIds) =>
  readData(await authRequest(`/api/agent/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: documentIds?.length ? { content, document_ids: documentIds } : { content },
  }));

const DOCUMENT_POLL_INTERVAL_MS = 2500;
const DOCUMENT_POLL_TIMEOUT_MS = 3 * 60 * 1000;

const documentError = (code, message) => Object.assign(new Error(message), { code, backendMessage: message });

const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

const waitFor = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(abortError());
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  const onAbort = () => {
    clearTimeout(timer);
    reject(abortError());
  };
  signal?.addEventListener('abort', onAbort, { once: true });
});

// Tải tệp cho Agent: upload (202) rồi poll /processing tới khi trích chữ xong → trả document_id.
// idempotencyKey: dùng lại cùng key khi retry cùng một tệp. onStatus('uploading' | 'processing').
// Huỷ bằng signal → ném AbortError. Quá 3 phút chưa xong → ném lỗi code 'document/timeout'.
export const uploadAgentDocument = async (file, { signal, idempotencyKey = crypto.randomUUID(), onStatus } = {}) => {
  onStatus?.('uploading');
  const form = new FormData();
  form.append('file', file);
  form.append('purpose', 'supporting_document');
  form.append('document_type', 'other');
  const { document_id: documentId } = await readData(await authRequest('/api/documents/', {
    method: 'POST',
    body: form,
    headers: { 'Idempotency-Key': idempotencyKey },
    signal
  }));

  onStatus?.('processing');
  const deadline = Date.now() + DOCUMENT_POLL_TIMEOUT_MS;
  while (true) {
    const { status } = await readData(await authRequest(`/api/documents/${documentId}/processing`, { signal }));
    if (status === 'completed') return documentId;
    if (status === 'failed') {
      throw documentError('document/failed', 'Không đọc được tài liệu, vui lòng thử tệp khác.');
    }
    if (Date.now() + DOCUMENT_POLL_INTERVAL_MS > deadline) {
      throw documentError('document/timeout', 'Tài liệu đang xử lý quá lâu, thử lại sau.');
    }
    await waitFor(DOCUMENT_POLL_INTERVAL_MS, signal);
  }
};

export const STATUS_LABELS = {
  draft: 'Bản nháp',
  submitted: 'Đã nộp',
  processing: 'Đang xử lý',
  completed: 'Đã hoàn tất',
  cancelled: 'Đã hủy'
};

export const AGENCY_LABELS = { commune: 'UBND cấp xã', district: 'UBND cấp huyện', province: 'UBND cấp tỉnh' };

export const COMING_SOON_HTML =
  '<span class="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800"><span class="material-symbols-outlined text-sm" aria-hidden="true">schedule</span>Sắp ra mắt</span>';

// Chèn chữ người dùng/DB vào HTML an toàn
export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// '2026-10-13T08:00:00+00:00' → '13/10/2026'
export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—');

// 100000 → '100.000 đ'; 0 → 'Miễn phí'; null → '—'
export const formatFee = (fee) => (fee === null || fee === undefined ? '—' : fee === 0 ? 'Miễn phí' : `${fee.toLocaleString('vi-VN')} đ`);
