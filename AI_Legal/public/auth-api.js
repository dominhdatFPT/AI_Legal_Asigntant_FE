// Gọi API đăng nhập của Backend (qua Gateway) và lưu phiên đăng nhập.
const SESSION_KEY = 'ai_legal_session';
let configPromise;

const getApiBaseUrl = () => {
  if (!configPromise) {
    configPromise = fetch('/api/app-config')
      .then((response) => (response.ok ? response.json() : {}))
      .then((config) => (config.apiBaseUrl || 'http://localhost:8080').replace(/\/+$/, ''))
      .catch(() => 'http://localhost:8080');
  }
  return configPromise;
};

const postJson = async (path, body) => {
  const baseUrl = await getApiBaseUrl();
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw Object.assign(new Error('backend-unreachable'), { code: 'backend/unreachable', baseUrl });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) {
    const error = payload?.error || {};
    throw Object.assign(new Error(error.message || 'backend-error'), {
      code: error.code || `backend/http-${response.status}`,
      backendMessage: error.message
    });
  }
  return payload.data;
};

export const loginWithPassword = (username, password) =>
  postJson('/api/users/auth/login', { username, password });

export const loginWithFirebaseToken = (idToken) =>
  postJson('/api/users/auth/firebase', { id_token: idToken });

export const saveSession = (data) => {
  const session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 0) * 1000,
    user: data.user
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

export const getSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
};

export const clearSession = () => localStorage.removeItem(SESSION_KEY);

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
