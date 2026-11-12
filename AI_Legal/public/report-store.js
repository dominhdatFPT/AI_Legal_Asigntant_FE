// Kho báo cáo dùng chung cho /report (người dân, luật sư), /report-management (admin) và chuông thông báo.
// shortcut: BE chưa có API báo cáo nên localStorage đóng vai máy chủ giả: chỉ dùng chung trong cùng một trình duyệt
// (demo: gửi báo cáo bằng tài khoản user, đăng nhập admin để xử lý). Có API thì thay listReports/addReport/updateReport bằng gọi Gateway.
// Trạng thái theo bảng consultation_reports của BE: pending / resolved / dismissed.

const KEY = 'ai_legal_reports';
export const CHANGED_EVENT = 'ai-legal:reports-changed';
export const TYPES = { bug: 'Lỗi trang web', user: 'Báo cáo người dùng' };
export const STATUS = { pending: 'Chờ xử lý', resolved: 'Đã xử lý', dismissed: 'Đã bỏ qua' };
// Gợi ý để người gửi chọn thay cho tự gõ tiêu đề; lựa chọn được lưu vào report.title.
export const BUG_ISSUES = [
  'Trang không tải được hoặc tải rất chậm',
  'Nút bấm không phản hồi',
  'Hiển thị sai hoặc vỡ giao diện',
  'Không tải lên hoặc tải xuống được tệp',
  'Thông tin hiển thị không đúng',
  'Lỗi đăng nhập hoặc tài khoản',
  'Khác'
];
export const USER_REASONS = [
  'Lời lẽ xúc phạm, thô tục',
  'Quấy rối hoặc đe dọa',
  'Spam, quảng cáo',
  'Lừa đảo, đòi chuyển tiền',
  'Tư vấn sai lệch, thiếu chuyên nghiệp',
  'Khác'
];
export const BUG_PAGES = ['Tổng quan hồ sơ', 'Mẫu đơn', 'Tạo hồ sơ', 'Tìm nơi nộp', 'Đăng ký luật sư', 'Hỗ trợ trực tuyến', 'Tài khoản', 'Khác'];

// Nhóm nút chọn một (radio) dạng chip cho các gợi ý trên; CSS ở report.css (.report-chip).
export function choiceChips(name, options) {
  return options.map((option) => {
    const label = document.createElement('label');
    label.className = 'report-chip';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name, value: option });
    const text = document.createElement('span');
    text.textContent = option;
    label.append(input, text);
    return label;
  });
}

const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
// Dữ liệu mẫu để trang admin không trống khi demo.
const SEED = [
  { id: 'seed-1', type: 'user', title: 'Dùng lời lẽ xúc phạm trong cuộc tư vấn', detail: 'Người dùng liên tục nhắn tin thô tục sau khi tôi trả lời câu hỏi về thủ tục tách thửa.', target: 'Nguyễn Văn B', page: '', reporter: { id: 'seed-law-1', name: 'Luật sư Trần Thị Mai', role: 'lawyer' }, status: 'pending', created_at: ago(10) },
  { id: 'seed-2', type: 'bug', title: 'Trang Tìm nơi nộp không hiện kết quả', detail: 'Chọn Hà Nội, phường Dịch Vọng rồi bấm Tìm nơi nộp nhưng danh sách trống.', target: '', page: 'Tìm nơi nộp', reporter: { id: 'seed-cit-1', name: 'Lê Văn Hùng', role: 'citizen' }, status: 'pending', created_at: ago(65) },
  { id: 'seed-3', type: 'bug', title: 'Không tải được giấy tờ đính kèm', detail: 'Bấm tải tệp PDF trong cuộc tư vấn thì báo lỗi mạng.', target: '', page: 'Hỗ trợ trực tuyến', reporter: { id: 'seed-law-2', name: 'Luật sư Phạm Quốc Anh', role: 'lawyer' }, status: 'pending', created_at: ago(60 * 26) },
  { id: 'seed-4', type: 'bug', title: 'Không tải được đơn PDF', detail: 'Mẫu đơn đăng ký biến động đất đai bấm tải PDF không phản hồi.', target: '', page: 'Mẫu đơn', reporter: { id: 'seed-cit-2', name: 'Đỗ Thu Trang', role: 'citizen' }, status: 'resolved', note: 'Đã sửa lỗi tải PDF, bạn thử lại giúp nhé.', handled_at: ago(60 * 30), created_at: ago(60 * 48) },
  { id: 'seed-5', type: 'user', title: 'Spam quảng cáo dịch vụ', detail: 'Người này gửi nhiều câu hỏi giống nhau chỉ để quảng cáo.', target: 'Hoàng Minh C', page: '', reporter: { id: 'seed-law-1', name: 'Luật sư Trần Thị Mai', role: 'lawyer' }, status: 'dismissed', note: 'Chưa đủ căn cứ, sẽ tiếp tục theo dõi.', handled_at: ago(60 * 70), created_at: ago(60 * 72) }
];

export function listReports() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* hỏng hoặc bị chặn: dùng dữ liệu mẫu */ }
  return SEED.map((report) => ({ ...report }));
}

const save = (list) => {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))); } catch { /* bị chặn: chỉ đổi trong trang */ }
  window.dispatchEvent(new Event(CHANGED_EVENT));
};

export function addReport(report) {
  save([report, ...listReports()]);
}

export function updateReport(id, patch) {
  save(listReports().map((report) => (report.id === id ? { ...report, ...patch } : report)));
}

// Gọi lại khi kho đổi ở tab này hoặc tab khác (vd. admin xử lý xong ở tab khác → chuông người gửi cập nhật).
export function onReportsChanged(callback) {
  window.addEventListener(CHANGED_EVENT, callback);
  window.addEventListener('storage', (event) => { if (event.key === KEY) callback(); });
}

export const timeAgo = (iso) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} giờ trước`;
  if (minutes < 60 * 48) return 'Hôm qua';
  return new Date(iso).toLocaleDateString('vi-VN');
};
