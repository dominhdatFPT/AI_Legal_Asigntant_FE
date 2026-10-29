// =============================================================================
// DỮ LIỆU MẪU cho /lawyer-management?demo=1 (chỉ bật trên localhost, xem admin-lawyers.js).
// Cùng tên hàm và cùng dạng dữ liệu với admin-api.js (LawyerProfile, CitizenProfileOut), giữ trong bộ nhớ:
// duyệt/từ chối có tác dụng tới khi tải lại trang. Không gọi Backend.
// =============================================================================
const at = (daysAgo, hour = 9, minute = 15) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const LAND = { id: 'spec-dat-dai', name: 'Đất đai' };
const BIZ = { id: 'spec-ho-kinh-doanh', name: 'Hộ kinh doanh' };
const doc = (type, n) => ({ type, document_id: `doc-${n}` });
const full = (n) => [doc('the_luat_su', n), doc('chung_chi_hanh_nghe', n + 1)];

const applications = [
  // Chờ duyệt (gửi sớm nhất trước)
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000001', user_id: 'u-mai', full_name: 'Trần Thị Mai', approval_status: 'pending', rejected_reason: null,
    bar_card_number: '10422/TP', law_firm: 'Công ty Luật TNHH Minh Phúc', years_experience: 6,
    bio: 'Tư vấn chuyển nhượng quyền sử dụng đất, tách thửa và tranh chấp ranh giới tại TP Hồ Chí Minh.\nTừng hỗ trợ hơn 40 hồ sơ cấp đổi Giấy chứng nhận ở Thủ Đức và Bình Chánh.',
    specializations: [LAND], credentials: [...full(1), doc('bang_cu_nhan', 3)], reviewed_at: null, created_at: at(6, 8, 40), updated_at: null },
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000002', user_id: 'u-phuc', full_name: 'Lê Văn Phúc', approval_status: 'pending', rejected_reason: null,
    bar_card_number: '8817/TP', law_firm: null, years_experience: 2, bio: null,
    specializations: [BIZ], credentials: [doc('the_luat_su', 4)], reviewed_at: null, created_at: at(4, 14, 5), updated_at: null },
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000003', user_id: 'u-anh', full_name: 'Nguyễn Hoàng Anh', approval_status: 'pending', rejected_reason: null,
    bar_card_number: '12930/TP', law_firm: 'Văn phòng Luật sư Hoàng Anh', years_experience: 11,
    bio: 'Đăng ký hộ kinh doanh, thay đổi nội dung đăng ký, tạm ngừng và chấm dứt hoạt động.\nNguyên chuyên viên Phòng Tài chính - Kế hoạch quận 3 (2014-2019).',
    specializations: [LAND, BIZ], credentials: full(5), reviewed_at: null, created_at: at(2, 10, 30), updated_at: null },
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000004', user_id: 'u-thao', full_name: 'Phan Ngọc Thảo', approval_status: 'pending', rejected_reason: null,
    bar_card_number: '13377/TP', law_firm: 'Công ty Luật Hợp danh Sài Gòn Việt', years_experience: 4,
    bio: 'Thế chấp, giải chấp quyền sử dụng đất và đăng ký biến động sau mua bán.',
    specializations: [LAND], credentials: [...full(7), doc('khac', 9)], reviewed_at: null, created_at: at(1, 16, 50), updated_at: null },
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000005', user_id: 'u-khang', full_name: 'Đỗ Minh Khang', approval_status: 'pending', rejected_reason: null,
    bar_card_number: '13502/TP', law_firm: null, years_experience: 0,
    bio: 'Mới gia nhập Đoàn luật sư TP Hồ Chí Minh, tập trung hồ sơ đăng ký hộ kinh doanh cho tiểu thương chợ Bến Thành.',
    specializations: [BIZ], credentials: [doc('chung_chi_hanh_nghe', 10)], reviewed_at: null, created_at: at(0, 8, 5), updated_at: null },
  // Đã duyệt
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000006', user_id: 'u-chau', full_name: 'Phạm Minh Châu', approval_status: 'approved', rejected_reason: null,
    bar_card_number: '9051/TP', law_firm: 'Công ty Luật Châu Á', years_experience: 8, bio: 'Thế chấp và giải chấp quyền sử dụng đất.',
    specializations: [LAND], credentials: full(11), reviewed_at: at(3, 16, 20), created_at: at(9), updated_at: at(3, 16, 20) },
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000007', user_id: 'u-tung', full_name: 'Võ Thanh Tùng', approval_status: 'approved', rejected_reason: null,
    bar_card_number: '11204/TP', law_firm: null, years_experience: 4, bio: null,
    specializations: [BIZ], credentials: full(13), reviewed_at: at(8, 10, 0), created_at: at(12), updated_at: at(8, 10, 0) },
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000008', user_id: 'u-ha', full_name: 'Hồ Thu Hà', approval_status: 'approved', rejected_reason: null,
    bar_card_number: '7408/TP', law_firm: 'Văn phòng Luật sư Thu Hà', years_experience: 15, bio: 'Tranh chấp đất đai và thừa kế quyền sử dụng đất.',
    specializations: [LAND, BIZ], credentials: [...full(15), doc('bang_cu_nhan', 17)], reviewed_at: at(15, 9, 45), created_at: at(18), updated_at: at(15, 9, 45) },
  // Bị từ chối
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000009', user_id: 'u-bao', full_name: 'Đặng Quốc Bảo', approval_status: 'rejected',
    rejected_reason: 'Ảnh thẻ luật sư bị mờ, không đọc được số thẻ. Vui lòng chụp lại rõ nét cả hai mặt.',
    bar_card_number: '7720/TP', law_firm: null, years_experience: 3, bio: null,
    specializations: [LAND], credentials: full(18), reviewed_at: at(1, 11, 10), created_at: at(5), updated_at: at(1, 11, 10) },
  { id: '5b1f0c2e-1a01-4c11-9a01-000000000010', user_id: 'u-linh', full_name: 'Bùi Mỹ Linh', approval_status: 'rejected',
    rejected_reason: 'Họ tên trên thẻ luật sư không khớp với hồ sơ CCCD của tài khoản.',
    bar_card_number: '12011/TP', law_firm: 'Công ty Luật TNHH An Bình', years_experience: 5, bio: 'Hồ sơ hộ kinh doanh và đăng ký thuế ban đầu.',
    specializations: [BIZ], credentials: full(20), reviewed_at: at(6, 15, 30), created_at: at(10), updated_at: at(6, 15, 30) }
];

const address = (detail, ward, province) => ({ detail, ward, province });
const citizen = (full_name, id_number, date_of_birth, gender, issue_date, phone, email, perm) => ({
  full_name, id_number, date_of_birth, gender, issue_date, issue_place: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
  phone, email, permanent_address: perm, current_same_as_permanent: true
});
const citizens = {
  'u-mai': citizen('Trần Thị Mai', '079190012345', '1990-04-12', 'Nữ', '2021-07-02', '0903112233', 'mai.tran@example.vn', address('45 Lê Văn Việt', 'Phường Tăng Nhơn Phú', 'TP Hồ Chí Minh')),
  'u-phuc': citizen('Lê Văn Phúc', '079196004411', '1996-09-03', 'Nam', '2022-03-18', '0911223344', 'phuc.le@example.vn', address('12 Nguyễn Trãi', 'Phường Bến Thành', 'TP Hồ Chí Minh')),
  'u-anh': citizen('Nguyễn Hoàng Anh', '079085004321', '1985-11-30', 'Nam', '2022-01-15', '0918665544', 'hoanganh.ls@example.vn', address('88 Võ Văn Tần', 'Phường Xuân Hòa', 'TP Hồ Chí Minh')),
  'u-thao': citizen('Phan Ngọc Thảo', '079193008899', '1993-02-14', 'Nữ', '2021-12-01', '0937445566', 'thao.phan@example.vn', address('3 Phạm Văn Đồng', 'Phường Hiệp Bình', 'TP Hồ Chí Minh')),
  'u-khang': null, // chưa khai hồ sơ CCCD
  'u-chau': citizen('Phạm Minh Châu', '079188007777', '1988-02-20', 'Nữ', '2021-09-09', '0938221100', 'chau.pham@example.vn', address('21 Hai Bà Trưng', 'Phường Sài Gòn', 'TP Hồ Chí Minh')),
  'u-tung': citizen('Võ Thanh Tùng', '079194006655', '1994-06-01', 'Nam', '2023-03-03', '0977000111', 'tung.vo@example.vn', address('9 Cách Mạng Tháng Tám', 'Phường Bàn Cờ', 'TP Hồ Chí Minh')),
  'u-ha': citizen('Hồ Thu Hà', '079180002233', '1980-07-27', 'Nữ', '2021-06-10', '0909334455', 'thuha.ls@example.vn', address('150 Nguyễn Thị Minh Khai', 'Phường Bàn Cờ', 'TP Hồ Chí Minh')),
  'u-bao': citizen('Đặng Quốc Bảo', '079192003322', '1992-08-08', 'Nam', '2022-05-05', '0909888777', 'bao.dang@example.vn', address('7 Lý Tự Trọng', 'Phường Sài Gòn', 'TP Hồ Chí Minh')),
  'u-linh': citizen('Bùi Mỹ Linh', '079195001188', '1995-12-19', 'Nữ', '2023-08-22', '0966112233', 'mylinh.bui@example.vn', address('60 Trần Hưng Đạo', 'Phường Cầu Ông Lãnh', 'TP Hồ Chí Minh')),
  'u-acc-ha': citizen('Phạm Thu Hà', '001186004455', '1986-03-09', 'Nữ', '2021-10-20', '0918334221', 'ha.pham@example.vn', address('25 Kim Mã', 'Phường Giảng Võ', 'Hà Nội')),
  'u-acc-lan': null
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (value) => JSON.parse(JSON.stringify(value));

export async function fetchLawyerApplications({ status = 'pending', order = 'asc' } = {}) {
  await delay(350);
  const items = applications.filter((a) => a.approval_status === status)
    .sort((x, y) => (order === 'asc' ? 1 : -1) * (new Date(x.created_at) - new Date(y.created_at)));
  return { items: clone(items), pagination: { page: 1, page_size: 100, total: items.length, total_pages: 1 } };
}

// Tài khoản role=lawyer (như /api/users?role=lawyer). u-chau, u-tung đã có hồ sơ được duyệt nên không hiện trùng; u-tung bị khóa.
const account = (id, full_name, email, phone, status, locked_reason, daysAgo) => ({
  id, email, username: email, full_name, avatar_url: null, phone, role: 'lawyer', status, locked_reason,
  locked_at: status === 'locked' ? at(2) : null, locked_until: null, created_at: at(daysAgo), updated_at: at(daysAgo)
});
const accounts = [
  account('u-chau', 'Phạm Minh Châu', 'chau.pham@example.vn', '0938221100', 'active', null, 9),
  account('u-tung', 'Võ Thanh Tùng', 'tung.vo@example.vn', '0977000111', 'locked', 'Tạm khóa để xác minh lại thẻ luật sư', 12),
  account('u-acc-ha', 'Phạm Thu Hà', 'ha.pham@example.vn', '0918334221', 'active', null, 45),
  account('u-acc-lan', 'Hoàng Thị Lan', 'lan.hoang@example.vn', '0965778899', 'locked', 'Giả mạo thẻ luật sư', 150)
];

export async function fetchLawyerAccounts() {
  await delay(300);
  return { items: clone(accounts), pagination: { page: 1, page_size: 100, total: accounts.length, total_pages: 1 } };
}

export async function fetchUserCitizenProfile(userId) {
  await delay(250);
  return clone(citizens[userId] ?? null);
}

export async function reviewLawyerApplication(applicationId, decision, body) {
  await delay(500);
  const a = applications.find((x) => x.id === applicationId);
  if (!a || a.approval_status !== 'pending') {
    throw Object.assign(new Error('Đơn này đã được xử lý trước đó.'), { status: 409, code: 'APPLICATION_NOT_PENDING' });
  }
  const now = new Date().toISOString();
  Object.assign(a, {
    approval_status: decision === 'approve' ? 'approved' : 'rejected',
    rejected_reason: decision === 'reject' ? body.reason : null,
    reviewed_at: now,
    updated_at: now
  });
  return clone(a);
}

// Giấy tờ mẫu: một trang HTML nhỏ ghi rõ là bản mô phỏng.
export async function lawyerCredentialUrl(applicationId, documentId) {
  const a = applications.find((x) => x.id === applicationId);
  const label = a?.credentials.find((c) => c.document_id === documentId)?.type || 'giấy tờ';
  const html = `<!doctype html><meta charset="utf-8"><title>Tệp mẫu</title><body style="font:16px system-ui;padding:40px">
    <h1>Tệp mẫu (dữ liệu thử)</h1><p>Loại: ${label}</p><p>Hồ sơ: ${a?.full_name || ''} · Số thẻ ${a?.bar_card_number || ''}</p></body>`;
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
}

// Tự kiểm tra dữ liệu mẫu: mỗi hồ sơ có hồ sơ CCCD (hoặc null có chủ đích) và trạng thái hợp lệ.
console.assert(applications.every((a) => a.user_id in citizens), 'admin-lawyers-sample: thiếu citizen cho một hồ sơ');
console.assert(applications.every((a) => ['pending', 'approved', 'rejected'].includes(a.approval_status)), 'admin-lawyers-sample: trạng thái sai');
console.assert(applications.filter((a) => a.approval_status === 'rejected').every((a) => a.rejected_reason), 'admin-lawyers-sample: hồ sơ bị từ chối thiếu lý do');
