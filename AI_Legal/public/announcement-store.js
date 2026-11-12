// Thông báo chung admin gửi tới toàn bộ người dân và luật sư (cập nhật web, có loại hồ sơ mới).
// Khác phản hồi báo cáo: không gửi riêng cho ai, ai đăng nhập cũng thấy trong chuông thông báo.
// shortcut: Notification Service chưa có API nên localStorage đóng vai máy chủ giả, chỉ dùng chung trong cùng
// một trình duyệt; có API thì thay listAnnouncements/addAnnouncement bằng gọi Gateway (và đẩy realtime).

const KEY = 'ai_legal_announcements';
const CHANGED_EVENT = 'ai-legal:announcements-changed';
export const CATEGORIES = { update: 'Cập nhật web', forms: 'Hồ sơ mới' };
// Trang người dùng mà thông báo có thể dẫn tới khi bấm vào.
export const LINKS = {
  '': 'Không gắn liên kết',
  '/document-storages': 'Mẫu đơn',
  '/user-dashboard': 'Tổng quan hồ sơ',
  '/location-search': 'Tìm nơi nộp',
  '/chatbox': 'Hỗ trợ trực tuyến',
  '/report': 'Báo cáo'
};

const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
// Dữ liệu mẫu để demo không trống.
const SEED = [
  { id: 'seed-a-1', category: 'forms', title: 'Đã có mẫu đơn đăng ký hộ kinh doanh mới', content: 'Mẫu đơn đề nghị đăng ký hộ kinh doanh theo quy định mới đã có trong mục Mẫu đơn. Bạn có thể xem và tạo hồ sơ ngay.', link: '/document-storages', author: 'Quản trị viên', created_at: ago(60 * 5) },
  { id: 'seed-a-2', category: 'update', title: 'Bảo trì hệ thống tối thứ Bảy', content: 'Hệ thống tạm ngừng từ 22:00 đến 23:00 thứ Bảy để nâng cấp. Hồ sơ đã lưu không bị ảnh hưởng.', link: '', author: 'Quản trị viên', created_at: ago(60 * 52) }
];

export function listAnnouncements() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* hỏng hoặc bị chặn: dùng dữ liệu mẫu */ }
  return SEED.map((item) => ({ ...item }));
}

export function addAnnouncement(item) {
  const list = [item, ...listAnnouncements()].slice(0, 100);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* bị chặn: chỉ đổi trong trang */ }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

// Gọi lại khi có thông báo mới ở tab này hoặc tab khác (admin gửi ở tab khác → chuông người dùng cập nhật ngay).
export function onAnnouncementsChanged(callback) {
  window.addEventListener(CHANGED_EVENT, callback);
  window.addEventListener('storage', (event) => { if (event.key === KEY) callback(); });
}
