
const LEGACY_SESSION_KEY = 'ai_legal_session'; // bản cũ lưu token trong localStorage
let configPromise;

// Backend trên Render gói free ngủ sau 15 phút, và request đi qua Gateway KHÔNG đánh thức được nó.
// Gọi thẳng URL của Backend (no-cors, không đọc kết quả) để Render khởi động lại service.
const BACKEND_WAKE_URLS = ['https://ai-legal-asigntant-be.onrender.com/api/v1/users/health'];
const wakeBackend = () => {
  BACKEND_WAKE_URLS.forEach((url) => {
    fetch(url, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  });
};

export const getApiBaseUrl = () => {
  if (!configPromise) {
    wakeBackend();
    configPromise = fetch('/api/app-config')
      .then((response) => (response.ok ? response.json() : {}))
      .then((config) => (config.apiBaseUrl || 'http://localhost:8080').replace(/\/+$/, ''))
      .catch(() => 'http://localhost:8080');
  }
  return configPromise;
};

// body: object → gửi JSON; FormData → gửi multipart (trình duyệt tự đặt Content-Type).
const request = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const baseUrl = await getApiBaseUrl();
  const isJson = body !== undefined && !(body instanceof FormData);
  // Render gói free ngủ sau 15 phút: lúc đang thức dậy, Render trả 502/503/504 dạng HTML (không phải JSON của Backend).
  // Gặp trường hợp đó thì chờ rồi gửi lại, tối đa khoảng 90 giây.
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: isJson ? { 'Content-Type': 'application/json', ...headers } : headers,
        body: isJson ? JSON.stringify(body) : body
      });
    } catch {
      throw Object.assign(new Error('backend-unreachable'), { code: 'backend/unreachable', baseUrl });
    }
    const waking = [502, 503, 504].includes(response.status)
      && !(response.headers.get('content-type') || '').includes('application/json');
    if (!waking || attempt >= 9) return response;
    wakeBackend();
    await new Promise((resolve) => setTimeout(resolve, 10000));
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

// Tự đăng ký tài khoản local ở Backend: { email, phone, password, confirm_password }.
export const registerAccount = (body) => postJson('/api/users/auth/register', body);

export const loginWithFirebaseToken = (idToken) =>
  postJson('/api/users/auth/firebase', { id_token: idToken });

// Backend đã set cookie khi đăng nhập; ở FE chỉ cần giữ thông tin user để chuyển trang.
// Xoá phiên kiểu cũ (token trong localStorage) nếu còn sót lại.
export const saveSession = (data) => {
  localStorage.removeItem(LEGACY_SESSION_KEY);
  return { user: data.user };
};

export const clearSession = () => localStorage.removeItem(LEGACY_SESSION_KEY);

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
    window.location.replace('/login');
    return new Promise(() => {}); // dừng code phía sau trong lúc chuyển trang
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.replace(homePathFor(user.role));
    return new Promise(() => {});
  }
  return user;
};

// Đăng xuất: thu hồi refresh token + xoá cookie ở Backend, đăng xuất Firebase, về /login.
export const logout = async () => {
  try {
    await authRequest('/api/users/auth/logout', { method: 'POST' });
  } catch {
    // Backend lỗi vẫn cho người dùng thoát ra
  }
  try {
    const [{ getApps, initializeApp }, { getAuth, signOut }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
    ]);
    const config = await fetch('/api/firebase-config').then((r) => (r.ok ? r.json() : null));
    if (config) await signOut(getAuth(getApps()[0] || initializeApp(config)));
  } catch {
    // Không tải được Firebase thì bỏ qua, phiên của hệ thống đã bị thu hồi ở trên
  }
  clearSession();
  window.location.replace('/login');
};

export const roleLabel = (role) =>
  ({ admin: 'Quản trị viên', lawyer: 'Luật sư', citizen: 'Công dân' })[role] || 'Người dùng';

export const displayName = (user) => user?.full_name || user?.username || user?.email || 'Người dùng';

// Gắn trang: ẩn nội dung tới khi xác thực xong, điền thông tin user, gắn nút đăng xuất.
//   <element data-user-field="name|email|role">   → thay bằng dữ liệu thật
//   <element data-logout>                         → bấm để đăng xuất
// requireProfile: trang tạo hồ sơ → bắt buộc đã cập nhật thông tin cá nhân.
export const protectPage = async (allowedRoles, { requireProfile = false } = {}) => {
  const user = await requireLogin(allowedRoles);
  if (requireProfile) await requireCitizenProfile();
  const values = { name: displayName(user), email: user.email || '', role: roleLabel(user.role) };
  document.querySelectorAll('[data-user-field]').forEach((element) => {
    const value = values[element.dataset.userField];
    if (value !== undefined) element.textContent = value;
  });
  document.querySelectorAll('[data-logout]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      element.setAttribute('aria-busy', 'true');
      logout();
    });
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
export const fetchMyApplications = ({ domain, status, page = 1, pageSize = 10 } = {}) =>
  getData(withQuery('/api/procedures/applications/me', { domain, status, page, page_size: pageSize }));

// Admin: hồ sơ của mọi người; q tìm theo tên, CCCD hoặc mã thủ tục → { items, pagination }
export const fetchAllApplications = ({ domain, status, q, page = 1, pageSize = 10 } = {}) =>
  getData(withQuery('/api/procedures/applications', { domain, status, q, page, page_size: pageSize }));

// Admin: { total, by_domain: { land, business }, by_status: { draft, submitted, processing, completed, cancelled } }
export const fetchApplicationSummary = () => getData('/api/procedures/applications/summary');

// Danh mục thủ tục công khai theo lĩnh vực ('land' | 'business') → mảng thủ tục
export const fetchProcedures = async (domain) =>
  (await readData(await request(`/api/procedures/domains/${domain}/procedures?include_details=false`))).items;

// Biểu mẫu riêng của một thủ tục (công khai) → { procedure_code, template_filename, sections, fields }
export const fetchFormSchema = async (code) =>
  readData(await request(`/api/procedures/form-schema/${encodeURIComponent(code)}`));

// Nộp/lưu nháp hồ sơ → bản ghi đã lưu
export const submitApplication = async ({ procedureCode, status = 'submitted', formData = {} }) =>
  readData(await authRequest('/api/procedures/applications', {
    method: 'POST',
    body: { procedure_code: procedureCode, status, form_data: formData }
  }));

// File người dùng đã upload → { items, pagination }
export const fetchMyDocuments = () => getData('/api/documents/');

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
