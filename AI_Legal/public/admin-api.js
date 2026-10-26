// API quản trị cho trang /user-management: tài khoản người dùng + duyệt hồ sơ luật sư.
// Dùng lại tầng request của auth-api.js (cookie phiên + tự refresh khi 401) thay vì tự viết lại.
import { authRequest, getApiBaseUrl } from '/auth-api.js';

// Trang quản trị hiển thị thẳng message lên toast nên gộp cả chi tiết lỗi theo từng ô vào message.
const apiError = (response, payload) => {
  const error = payload?.error || {};
  const details = (error.details || []).map((d) => `${d.field}: ${d.message}`).join('; ');
  return Object.assign(new Error(error.message ? error.message + (details ? ` (${details})` : '') : `Lỗi ${response.status}`), {
    code: error.code,
    status: response.status
  });
};

// Export để form-template-service.js dùng lại (cùng cách báo lỗi + chuyển /login khi hết phiên).
export const api = async (path, options) => {
  let response;
  try {
    response = await authRequest(path, options);
  } catch (error) {
    if (error?.code === 'backend/unreachable') {
      throw new Error(`Không kết nối được Backend. Hãy kiểm tra Gateway (${error.baseUrl}) đã chạy chưa.`);
    }
    throw error;
  }
  if (response.status === 401) window.location.replace('/login');
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw apiError(response, payload);
  return payload ? payload.data : null;
};

// ===== Tài khoản người dùng =====

// deleted=false (mặc định) chỉ trả tài khoản chưa xóa, deleted=true chỉ trả tài khoản đã xóa mềm.
export const fetchUsersPage = ({ page = 1, pageSize = 100, deleted = false } = {}) =>
  api(`/api/users?page=${page}&page_size=${pageSize}&deleted=${deleted}`);

export const fetchUserCitizenProfile = (userId) =>
  api(`/api/users/${encodeURIComponent(userId)}/citizen-profile`);

export const updateUserRole = (userId, role) =>
  api(`/api/users/${encodeURIComponent(userId)}/role`, { method: 'PUT', body: { role } });

// durationDays = null → khóa vĩnh viễn.
export const lockUser = (userId, { reason, durationDays = null }) =>
  api(`/api/users/${encodeURIComponent(userId)}/lock`, { method: 'POST', body: { reason, duration_days: durationDays } });

export const unlockUser = (userId) =>
  api(`/api/users/${encodeURIComponent(userId)}/unlock`, { method: 'POST' });

export const deleteUser = (userId) =>
  api(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });

export const restoreDeletedUser = (userId) =>
  api(`/api/users/${encodeURIComponent(userId)}/restore`, { method: 'POST' });

export const createUser = (body) => api('/api/users', { method: 'POST', body });

// ===== Duyệt hồ sơ luật sư =====

export const fetchPendingLawyerApplications = ({ page = 1, pageSize = 100 } = {}) =>
  api(`/api/lawyers/applications?approval_status=pending&page=${page}&page_size=${pageSize}`);

// decision: 'approve' | 'reject'. body: { reason } khi từ chối.
export const reviewLawyerApplication = (applicationId, decision, body) =>
  api(`/api/lawyers/${encodeURIComponent(applicationId)}/${decision}`, { method: 'POST', body });

// Giấy tờ hành nghề chỉ đọc được khi request kèm cookie phiên → mở tab mới trỏ thẳng vào Gateway.
export const lawyerCredentialUrl = async (applicationId, documentId) =>
  `${await getApiBaseUrl()}/api/lawyers/${encodeURIComponent(applicationId)}/credentials/${encodeURIComponent(documentId)}`;
