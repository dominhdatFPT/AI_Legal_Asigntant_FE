
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

const request = async (path, { method = 'GET', body } = {}) => {
  const baseUrl = await getApiBaseUrl();
  try {
    return await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw Object.assign(new Error('backend-unreachable'), { code: 'backend/unreachable', baseUrl });
  }
};

const readData = async (response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) {
    const error = payload?.error || {};
    throw Object.assign(new Error(error.message || 'backend-error'), {
      code: error.code || `backend/http-${response.status}`,
      status: response.status,
      backendMessage: error.message
    });
  }
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
export const protectPage = async (allowedRoles) => {
  const user = await requireLogin(allowedRoles);
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
