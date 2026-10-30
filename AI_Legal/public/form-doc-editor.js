// =============================================================================
// BƯỚC "3. SOẠN VĂN BẢN" CỦA KHUNG THÊM MẪU ĐƠN (form-templates-admin.js): soạn văn bản kiểu Google Docs.
// Tải PDF → lấy chữ và chỗ chấm thành thẻ → sửa trong Quill → chèn thẻ (của mẫu hoặc tự thêm) → xuất .docx.
// Văn bản lưu trong content.document = { ops, fields } của mẫu, nên Lưu nháp/Xuất bản của khung dựng mẫu lưu luôn.
// Thư viện (Quill, pdf.js, docx) và CSS nạp lười qua CDN ở lần mở đầu tiên.
// =============================================================================
import { escapeHtml } from '/auth-api.js';

const CDN = {
  quillCss: 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css',
  quill: 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  docx: 'https://cdn.jsdelivr.net/npm/docx@9.0.2/build/index.umd.js'
};
const addCss = (href) => document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
const loadScript = (src) => new Promise((resolve, reject) => {
  document.head.append(Object.assign(document.createElement('script'), { src, onload: resolve, onerror: () => reject(new Error(`Không tải được ${src}`)) }));
});
let libsReady;
const loadLibs = () => (libsReady ??= (async () => {
  addCss(CDN.quillCss);
  addCss('/form-doc-editor.css');
  await Promise.all([loadScript(CDN.quill), loadScript(CDN.pdf), loadScript(CDN.docx)]);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
  registerQuillFormats();
})().catch((error) => { libsReady = null; throw error; }));

const TYPES = { text: 'Chữ', textarea: 'Đoạn dài', number: 'Số', date: 'Ngày', select: 'Chọn', checkbox: 'Ô tích', cccd: 'CCCD', phone: 'SĐT', email: 'Email' };
const FONTS = ['Arial', 'Roboto', 'Be Vietnam Pro', 'Courier New']; // mặc định (false) = Times New Roman
const DEFAULT_FONT = 'Times New Roman';
const DEFAULT_SIZE = 13;
// Quốc hiệu, tiêu ngữ đầu mọi văn bản hành chính (Nghị định 30/2020/NĐ-CP): in hoa đậm / đậm gạch chân, căn giữa.
const NATIONAL_HEADER = [
  { insert: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', attributes: { bold: true } }, { insert: '\n', attributes: { align: 'center' } },
  { insert: 'Độc lập - Tự do - Hạnh phúc', attributes: { bold: true, underline: true, size: '14pt' } }, { insert: '\n', attributes: { align: 'center' } },
  { insert: '\n' }
];
const hasNationalHeader = (ops) => ops.some((op) => typeof op.insert === 'string' && /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/i.test(op.insert));
// Văn bản trống hoặc PDF không có quốc hiệu → thêm quốc hiệu lên đầu.
const withNationalHeader = (ops) => (hasNationalHeader(ops) ? ops : [...NATIONAL_HEADER, ...ops]);

// Nhãn chip lấy từ phiên đang mở (thẻ của mẫu + thẻ riêng của văn bản).
let session = null;
const fieldOf = (id) => session?.allFields().get(id);
// Ô thẻ trong văn bản: rộng theo kiểu thẻ (CSS data-type), nhãn + mã chỉ hiện khi rê chuột / trình đọc màn hình.
function paintChip(node) {
  const field = fieldOf(node.dataset.id);
  node.dataset.type = field?.type || 'missing';
  node.title = field ? `${field.label} · {{${field.name}}}` : 'Thẻ đã xoá';
  node.setAttribute('aria-label', `Ô điền: ${field?.label || 'thẻ đã xoá'}`);
}

function registerQuillFormats() {
  const { Quill } = window;
  const Parchment = Quill.import('parchment');
  // Trình duyệt trả font-family có ngoặc kép ('"Courier New"') nên bỏ ngoặc trước khi so whitelist.
  class FontStyle extends Parchment.StyleAttributor {
    value(node) { const value = (node.style.fontFamily || '').replace(/["']/g, ''); return this.canAdd(node, value) ? value : ''; }
  }
  Quill.register(new FontStyle('font', 'font-family', { scope: Parchment.Scope.INLINE, whitelist: FONTS }), true);
  Quill.register(new Parchment.StyleAttributor('size', 'font-size', { scope: Parchment.Scope.INLINE }), true);
  Quill.register({ 'formats/lineheight': new Parchment.StyleAttributor('lineheight', 'line-height', { scope: Parchment.Scope.BLOCK, whitelist: ['1.15', '1.5', '2'] }) }, true);
  const Embed = Quill.import('blots/embed');
  class FieldBlot extends Embed {
    static create(id) {
      const node = super.create();
      node.dataset.id = id;
      node.textContent = ' '; // ô trống để điền; nhãn nằm ở chữ văn bản phía trước
      paintChip(node);
      return node;
    }
    static value(node) { return node.dataset.id; }
  }
  Object.assign(FieldBlot, { blotName: 'field', tagName: 'span', className: 'ql-field' });
  Quill.register(FieldBlot, true);
  // Ô tích kiểu mẫu đơn hành chính: giá trị true = ☒, false = ☐.
  class TickBlot extends Embed {
    static create(checked) {
      const node = super.create();
      node.dataset.checked = checked ? '1' : '';
      node.textContent = checked ? '☒' : '☐';
      node.title = 'Bấm để đổi ☐/☒';
      return node;
    }
    static value(node) { return node.dataset.checked === '1'; }
  }
  Object.assign(TickBlot, { blotName: 'tick', tagName: 'span', className: 'ql-tick' });
  Quill.register(TickBlot, true);
}

// ===== Đoán mã và kiểu thẻ theo nhãn (bỏ dấu) =====
const slugify = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const GUESSES = [
  [/ngay_cap/, 'applicant_id_issue_date', 'date'], [/noi_cap/, 'applicant_id_issue_place', 'text'],
  [/ho_(va_)?ten/, 'applicant_name', 'text'], [/ngay_sinh|sinh_ngay/, 'applicant_dob', 'date'], [/gioi_tinh/, 'applicant_gender', 'select'],
  [/cccd|can_cuoc|cmnd|dinh_danh/, 'applicant_id_number', 'cccd'], [/dien_thoai|sdt/, 'applicant_phone', 'phone'],
  [/email|thu_dien_tu/, 'applicant_email', 'email'], [/thuong_tru/, 'applicant_permanent_address', 'textarea'],
  [/noi_o/, 'applicant_current_address', 'textarea'], [/ma_so_(thue|doanh_nghiep)|ma_so_dang_ky/, 'business_code', 'text'],
  [/kinh_gui/, 'receiving_agency', 'text'], [/thua_dat_so|^thua_so/, 'plot_number', 'text'], [/to_ban_do/, 'map_sheet_number', 'text'],
  [/dia_chi_thua_dat/, 'land_address', 'textarea'], [/muc_dich_su_dung/, 'land_use_purpose', 'select'], [/dien_tich/, 'land_area', 'number'],
  [/ten_(doanh_nghiep|ho_kinh_doanh|cong_ty)/, 'business_name_vn', 'text'], [/dia_chi_tru_so|dia_diem_kinh_doanh/, 'headquarters_address', 'textarea'],
  [/von_(dieu_le|kinh_doanh)/, 'charter_capital', 'number'], [/nganh_nghe/, 'main_business_lines', 'textarea'],
  [/dia_chi/, null, 'textarea'], [/ngay|thoi_diem/, null, 'date'], [/so_tien|von|so_luong/, null, 'number']
];

// ===== Thư viện thẻ theo bộ thẻ BE (procedure_form_service.py) cho thủ tục đất đai và kinh doanh =====
// domains: lĩnh vực của mẫu (content.domain) mà nhóm hiện mặc định; person: có chọn người khai (tiền tố BE).
const LAND = ['dat_dai'];
const BIZ = ['ho_kinh_doanh', 'doanh_nghiep'];
const PERSONS = { applicant: 'Người làm đơn', authorizer: 'Bên ủy quyền', authorized_person: 'Bên được ủy quyền', lessor: 'Bên cho thuê', lessee: 'Bên thuê' };
const LIBRARY = [
  { title: 'Người làm đơn', person: true, fields: [['name', 'Họ và tên', 'text'], ['gender', 'Giới tính', 'select'], ['dob', 'Ngày sinh', 'date'],
    ['phone', 'Số điện thoại', 'phone'], ['email', 'Email', 'email'], ['permanent_address', 'Nơi thường trú', 'textarea'], ['current_address', 'Nơi ở hiện nay', 'textarea']] },
  { title: 'CCCD / giấy tờ định danh', person: true, fields: [['id_type', 'Loại giấy tờ', 'select'], ['id_number', 'Số CCCD', 'cccd'],
    ['id_issue_date', 'Ngày cấp', 'date'], ['id_issue_place', 'Nơi cấp', 'text']] },
  { title: 'Cơ quan tiếp nhận & cam đoan', fields: [['receiving_agency', 'Kính gửi (cơ quan tiếp nhận)', 'text'],
    ['attached_documents', 'Giấy tờ nộp kèm', 'textarea'], ['declarer_signature_name', 'Họ tên người viết đơn', 'text']] },
  { title: 'Thửa đất / Giấy chứng nhận', domains: LAND, fields: [['plot_number', 'Thửa đất số', 'text'], ['map_sheet_number', 'Tờ bản đồ số', 'text'],
    ['land_address', 'Địa chỉ thửa đất', 'textarea'], ['land_area', 'Diện tích (m²)', 'number'], ['land_use_purpose', 'Mục đích sử dụng đất', 'select'],
    ['land_use_term', 'Thời hạn sử dụng', 'text'], ['land_use_origin', 'Nguồn gốc sử dụng', 'text'], ['certificate_number', 'Số seri Giấy chứng nhận', 'text'],
    ['certificate_book_number', 'Số vào sổ cấp GCN', 'text'], ['certificate_issue_date', 'Ngày cấp GCN', 'date'], ['certificate_issue_agency', 'Cơ quan cấp GCN', 'text']] },
  { title: 'Biến động: chuyển nhượng, tặng cho, thừa kế (Mẫu 18)', domains: LAND, fields: [['change_content', 'Nội dung biến động', 'textarea'],
    ['tax_exemption_info', 'Miễn, giảm nghĩa vụ tài chính', 'textarea']] },
  { title: 'Cấp đổi, cấp lại, đính chính GCN', domains: LAND, fields: [['reissue_reason', 'Lý do cấp đổi / cấp lại', 'select'],
    ['loss_reason', 'Lý do bị mất GCN', 'textarea'], ['loss_report_date', 'Ngày khai báo mất', 'date'], ['loss_commitment', 'Cam kết không mang đi thế chấp', 'checkbox'],
    ['correction_wrong_value', 'Thông tin ghi sai', 'textarea'], ['correction_correct_value', 'Thông tin đúng', 'textarea']] },
  { title: 'Tách / hợp thửa', domains: LAND, fields: [['split_merge_type', 'Hình thức (tách / hợp)', 'select'], ['split_plots_count', 'Số thửa dự kiến', 'number'],
    ['split_target_area', 'Diện tích từng thửa dự kiến', 'textarea'], ['split_reason', 'Lý do tách / hợp thửa', 'textarea']] },
  { title: 'Chuyển mục đích, gia hạn sử dụng đất', domains: LAND, fields: [['conversion_from_purpose', 'Mục đích hiện tại', 'text'],
    ['conversion_to_purpose', 'Mục đích xin chuyển sang', 'select'], ['conversion_area', 'Diện tích xin chuyển (m²)', 'number'], ['conversion_reason', 'Lý do chuyển mục đích', 'textarea'],
    ['current_expired_date', 'Ngày hết hạn sử dụng đất', 'date'], ['extension_duration_years', 'Số năm xin gia hạn', 'number'], ['extension_reason', 'Lý do gia hạn', 'textarea']] },
  { title: 'Thế chấp, xoá thế chấp', domains: LAND, fields: [['mortgage_party_name', 'Bên nhận thế chấp', 'text'], ['mortgage_party_address', 'Địa chỉ bên nhận thế chấp', 'textarea'],
    ['mortgage_contract_number', 'Số hợp đồng thế chấp', 'text'], ['mortgage_contract_date', 'Ngày ký hợp đồng thế chấp', 'date'],
    ['secured_obligation_amount', 'Giá trị nghĩa vụ bảo đảm (VNĐ)', 'number'], ['mortgage_registration_number', 'Số hồ sơ thế chấp trước đây', 'text'],
    ['mortgage_release_reason', 'Lý do xoá thế chấp', 'text']] },
  { title: 'Đăng ký lần đầu, cung cấp thông tin đất', domains: LAND, fields: [['land_origin_detail', 'Thời điểm, nguồn gốc sử dụng đất', 'textarea'],
    ['house_construction_year', 'Tài sản gắn liền với đất', 'textarea'], ['dispute_commitment', 'Cam kết không tranh chấp', 'checkbox'],
    ['data_request_purpose', 'Mục đích khai thác thông tin', 'textarea'], ['requested_data_type', 'Loại thông tin yêu cầu', 'select']] },
  { title: 'Doanh nghiệp / Hộ kinh doanh', domains: BIZ, fields: [['business_name_vn', 'Tên doanh nghiệp / hộ kinh doanh', 'text'],
    ['business_name_en', 'Tên tiếng nước ngoài', 'text'], ['business_name_abbr', 'Tên viết tắt', 'text'], ['business_code', 'Mã số doanh nghiệp / mã số thuế', 'text'],
    ['headquarters_address', 'Địa chỉ trụ sở / địa điểm kinh doanh', 'textarea'], ['headquarters_phone', 'Điện thoại trụ sở', 'phone'],
    ['headquarters_email', 'Email trụ sở', 'email'], ['charter_capital', 'Vốn điều lệ / vốn kinh doanh (VNĐ)', 'number'],
    ['charter_capital_in_words', 'Vốn bằng chữ', 'text'], ['main_business_lines', 'Ngành nghề kinh doanh', 'textarea'], ['total_employees', 'Số lao động', 'number']] },
  { title: 'Loại hình & người đại diện', domains: BIZ, fields: [['legal_representative_title', 'Chức danh người đại diện', 'select'],
    ['llc_type', 'Loại hình Công ty TNHH', 'select'], ['founding_shareholders_count', 'Số cổ đông sáng lập', 'number'], ['total_shares', 'Tổng số cổ phần', 'number'],
    ['par_value_per_share', 'Mệnh giá cổ phần (VNĐ)', 'number'], ['general_partners_count', 'Số thành viên hợp danh', 'number'],
    ['owner_commitment', 'Cam kết của chủ DNTN', 'checkbox']] },
  { title: 'Ủy quyền, thuê trụ sở', domains: BIZ, fields: [['authorization_scope', 'Phạm vi ủy quyền', 'textarea'], ['authorization_term', 'Thời hạn ủy quyền', 'text'],
    ['rental_address', 'Địa chỉ mặt bằng thuê', 'textarea'], ['rental_area', 'Diện tích thuê (m²)', 'number'], ['rental_price', 'Giá thuê / tháng (VNĐ)', 'number'],
    ['rental_deposit', 'Tiền đặt cọc (VNĐ)', 'number'], ['rental_term_months', 'Thời hạn thuê (tháng)', 'number']] },
  { title: 'Thay đổi, tạm ngừng, giải thể, chấm dứt', domains: BIZ, fields: [['change_items', 'Nội dung đăng ký thay đổi', 'select'],
    ['change_content_before', 'Nội dung trước khi thay đổi', 'textarea'], ['change_content_after', 'Nội dung sau khi thay đổi', 'textarea'],
    ['suspension_from_date', 'Ngày bắt đầu tạm ngừng', 'date'], ['suspension_to_date', 'Ngày kết thúc tạm ngừng', 'date'], ['suspension_reason', 'Lý do tạm ngừng', 'textarea'],
    ['dissolution_reason', 'Lý do giải thể', 'textarea'], ['debt_settlement_commitment', 'Cam kết thanh toán hết nợ', 'checkbox'],
    ['termination_reason', 'Lý do chấm dứt hoạt động', 'textarea'], ['termination_date', 'Ngày dự kiến chấm dứt', 'date'], ['tax_clearance_status', 'Tình trạng nghĩa vụ thuế', 'select']] },
  { title: 'Đăng ký thuế ban đầu', domains: BIZ, fields: [['tax_accounting_method', 'Chế độ kế toán', 'select'], ['vat_calculation_method', 'Phương pháp tính thuế GTGT', 'select'],
    ['fiscal_year_start', 'Ngày bắt đầu năm tài chính', 'text']] }
];
// Thẻ thư viện → { name, label, type } theo người khai (chỉ nhóm person mới thêm tiền tố và ghi chú bên).
const libField = (group, [key, label, type], person) => (group.person
  ? { name: `${person}_${key}`, label: person === 'applicant' ? label : `${label} (${PERSONS[person]})`, type }
  : { name: key, label, type });
function guess(label) {
  const slug = slugify(label) || 'the';
  const hit = GUESSES.find(([re]) => re.test(slug));
  return { name: hit?.[1] || slug, type: hit?.[2] || 'text' };
}
const DOTS = /[.…_·]{4,}/g;
// Chữ đứng trước chỗ chấm → nhãn: bỏ số thứ tự, dấu hai chấm, lấy phần sau dấu phẩy cuối.
const labelBefore = (text) => text.replace(/^\s*(\d+|[IVX]+|[a-zđ])[.)]\s+/i, '').split(/[,;]/).pop().replace(/[:\s]+$/, '').replace(/^[\s\-–•]+/, '').trim();
const toHex = (color) => {
  if (!color) return undefined;
  if (color.startsWith('#')) return color.length === 4 ? color.slice(1).replace(/./g, '$&$&') : color.slice(1);
  const rgb = color.match(/\d+/g);
  return rgb ? rgb.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : undefined;
};

// ===== Thanh công cụ kiểu Google Docs =====
// Phần tử class ql-* do Quill xử lý và vẽ icon; phần tử data-tb do trình soạn tự xử lý.
const svg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
const ICONS = {
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  undo: 'M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7.98 7.98 0 0 1 12.5 10.5c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
  redo: 'M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16a8 8 0 0 1 7.6-5.5c1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z',
  print: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-1-9H6v4h12V3z',
  spell: 'M12.45 16h2.09L9.43 3H7.57L2.46 16h2.09l1.12-3h5.64l1.14 3zm-6.02-5L8.5 5.48 10.57 11H6.43zm15.16.59l-8.09 8.09L9.83 16l-1.41 1.41 5.09 5.09L23 13l-1.41-1.41z',
  paint: 'M18 4V3a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6h1v4H9v11a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-9h8V4h-3z',
  spacing: 'M6 7h2.5L5 3.5 1.5 7H4v10H1.5L5 20.5 8.5 17H6V7zm4-2v2h12V5H10zm0 14h12v-2H10v2zm0-6h12v-2H10v2z',
  tick: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14z',
  table: 'M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z',
  tag: 'M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'
};
const sep = '<span class="fde-sep" aria-hidden="true"></span>';
const TOOLBAR = `<div class="fde-docs-bar" role="toolbar" aria-label="Định dạng văn bản">
  <label class="fde-menu-search" title="Tìm lệnh trên thanh công cụ (gõ rồi Enter)">${svg(ICONS.search)}
    <input type="search" data-tb="search" placeholder="Trình đơn" aria-label="Tìm lệnh trên thanh công cụ"></label>
  <button type="button" data-tb="undo" title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác">${svg(ICONS.undo)}</button>
  <button type="button" data-tb="redo" title="Làm lại (Ctrl+Y)" aria-label="Làm lại">${svg(ICONS.redo)}</button>
  <button type="button" data-tb="print" title="In (Ctrl+P)" aria-label="In">${svg(ICONS.print)}</button>
  <button type="button" data-tb="spell" title="Kiểm tra chính tả" aria-label="Kiểm tra chính tả" aria-pressed="true">${svg(ICONS.spell)}</button>
  <button type="button" data-tb="paint" title="Sao chép định dạng" aria-label="Sao chép định dạng" aria-pressed="false">${svg(ICONS.paint)}</button>
  <select data-tb="zoom" title="Thu phóng" aria-label="Thu phóng">${[50, 75, 90, 100, 125, 150, 200].map((z) => `<option value="${z}"${z === 100 ? ' selected' : ''}>${z}%</option>`).join('')}</select>
  ${sep}
  <select class="ql-header" title="Kiểu đoạn" aria-label="Kiểu đoạn"><option selected></option><option value="1"></option><option value="2"></option><option value="3"></option></select>
  ${sep}
  <select class="ql-font" title="Phông chữ" aria-label="Phông chữ"><option selected></option>${FONTS.map((f) => `<option value="${f}"></option>`).join('')}</select>
  ${sep}
  <span class="fde-size">
    <button type="button" data-tb="size-down" title="Giảm cỡ chữ" aria-label="Giảm cỡ chữ">−</button>
    <input type="text" inputmode="numeric" data-tb="size" value="${DEFAULT_SIZE}" title="Cỡ chữ" aria-label="Cỡ chữ">
    <button type="button" data-tb="size-up" title="Tăng cỡ chữ" aria-label="Tăng cỡ chữ">+</button>
  </span>
  ${sep}
  <button type="button" class="ql-bold" title="In đậm (Ctrl+B)" aria-label="In đậm"></button>
  <button type="button" class="ql-italic" title="In nghiêng (Ctrl+I)" aria-label="In nghiêng"></button>
  <button type="button" class="ql-underline" title="Gạch chân (Ctrl+U)" aria-label="Gạch chân"></button>
  <select class="ql-color" title="Màu chữ" aria-label="Màu chữ"></select>
  <select class="ql-background" title="Màu đánh dấu" aria-label="Màu đánh dấu"></select>
  ${sep}
  <button type="button" class="ql-link" title="Chèn đường liên kết (Ctrl+K)" aria-label="Chèn đường liên kết"></button>
  <label class="fde-tag-pick" title="Chèn thẻ tại con trỏ">${svg(ICONS.tag)}
    <select data-tb="field" aria-label="Chèn thẻ"><option value="">Chèn thẻ</option></select></label>
  <button type="button" class="ql-image" title="Chèn hình ảnh" aria-label="Chèn hình ảnh"></button>
  <button type="button" data-tb="tick" title="Chèn ô tích ☐ (bấm vào ô để đổi ☐/☒)" aria-label="Chèn ô tích">${svg(ICONS.tick)}</button>
  <label class="fde-table-pick" title="Bảng: chèn bảng, thêm/xoá hàng, cột">${svg(ICONS.table)}
    <select data-tb="table" aria-label="Bảng"><option value="">Bảng</option>
      <optgroup label="Chèn bảng (hàng × cột)">${['2x2', '2x3', '3x2', '3x3', '4x3', '4x4', '5x3', '5x5'].map((size) => `<option value="${size}">${size.replace('x', ' × ')}</option>`).join('')}</optgroup>
      <optgroup label="Bảng đang chọn"><option value="row-below">Thêm hàng bên dưới</option><option value="row-above">Thêm hàng bên trên</option>
        <option value="col-right">Thêm cột bên phải</option><option value="col-left">Thêm cột bên trái</option>
        <option value="del-row">Xoá hàng</option><option value="del-col">Xoá cột</option><option value="del-table">Xoá bảng</option></optgroup>
    </select></label>
  ${sep}
  <select class="ql-align" title="Căn chỉnh" aria-label="Căn chỉnh"></select>
  <label class="fde-spacing" title="Giãn cách dòng">${svg(ICONS.spacing)}
    <select data-tb="lineheight" aria-label="Giãn cách dòng"><option value="">Đơn</option><option value="1.15">1,15</option><option value="1.5">1,5</option><option value="2">Kép</option></select></label>
  <button type="button" class="ql-list" value="check" title="Danh sách kiểm tra" aria-label="Danh sách kiểm tra"></button>
  <button type="button" class="ql-list" value="bullet" title="Danh sách có dấu đầu dòng" aria-label="Danh sách có dấu đầu dòng"></button>
  <button type="button" class="ql-list" value="ordered" title="Danh sách được đánh số" aria-label="Danh sách được đánh số"></button>
  <button type="button" class="ql-indent" value="-1" title="Giảm thụt lề" aria-label="Giảm thụt lề"></button>
  <button type="button" class="ql-indent" value="+1" title="Tăng thụt lề" aria-label="Tăng thụt lề"></button>
  <button type="button" class="ql-clean" title="Xoá định dạng" aria-label="Xoá định dạng"></button>
  <span class="fde-bar-end"><label class="fde-mode-pick" title="Chế độ">${svg(ICONS.edit)}
    <select data-tb="mode" aria-label="Chế độ"><option value="edit">Chỉnh sửa</option><option value="view">Xem</option></select></label></span>
</div>`;

const INLINE_CLEAR = { bold: false, italic: false, underline: false, strike: false, color: false, background: false, font: false, size: false, script: false };
const BLOCK_FORMATS = ['header', 'align', 'list', 'indent', 'lineheight', 'blockquote', 'code-block'];

/**
 * Gắn trình soạn vào container. opts:
 *  doc: object lưu văn bản ({ ops, fields }) — sửa trực tiếp, nằm trong content của mẫu.
 *  templateFields(): [{ id, name, label, type, section }] thẻ mẫu cũ ngoài các thẻ của văn bản.
 *  removeTemplateField(id): xoá thẻ của mẫu cũ khỏi mẫu.
 *  onChange(): đánh dấu mẫu có thay đổi. templateName(): tên mẫu (đặt tên file .docx).
 *  domain(): lĩnh vực của mẫu (dat_dai | ho_kinh_doanh | doanh_nghiep) để thư viện thẻ hiện đúng nhóm.
 */
// Bản xem trước chỉ đọc của văn bản (tab Tổng hợp): vẽ bằng Quill từ cùng doc.ops, thẻ hiện thành ô điền có nhãn.
export async function renderDocPreview(container, doc, templateFields) {
  container.innerHTML = '<p class="ft-muted">Đang tải bản xem trước văn bản…</p>';
  try { await loadLibs(); } catch (error) {
    container.innerHTML = '<div class="ft-alert">Không tải được thư viện để xem trước văn bản.</div>';
    return;
  }
  const fields = new Map([...templateFields(), ...(doc.fields || [])].map((field) => [field.id, field]));
  const previous = session;
  session = { allFields: () => fields }; // nhãn chip lấy từ đúng mẫu đang xem
  container.innerHTML = '<div class="fde fde-preview"><div class="fde-page"></div></div>';
  const quill = new window.Quill(container.querySelector('.fde-page'), { theme: 'snow', readOnly: true, modules: { toolbar: false } });
  quill.setContents(doc.ops, 'silent');
  session = previous;
}

export async function mountDocEditor(container, opts) {
  container.innerHTML = '<p class="ft-muted">Đang tải trình soạn văn bản…</p>';
  try { await loadLibs(); } catch (error) {
    console.error(error);
    container.innerHTML = '<div class="ft-alert">Không tải được thư viện soạn thảo (cần mạng tới cdn.jsdelivr.net và cdnjs.cloudflare.com).</div>';
    return;
  }
  const doc = opts.doc;
  doc.fields ??= [];
  doc.ops ??= [];
  let seq = doc.fields.reduce((max, field) => Math.max(max, Number(String(field.id).replace(/\D/g, '')) || 0), 0);

  container.innerHTML = `<div class="fde">
    <div class="fde-head">
      <div><h2>b. Soạn văn bản mẫu đơn</h2>
        <p class="ft-muted">Tải PDF để lấy nội dung, chỉnh như Google Docs, chèn thẻ rồi xuất file Word. Văn bản được lưu cùng mẫu khi Lưu nháp.</p></div>
      <div class="fde-head__actions">
        <label class="fde-export-mode">Thẻ khi xuất<select data-de="export-mode"><option value="dots">Dòng chấm</option><option value="code">Mã thẻ {{mã}}</option><option value="label">Tên thẻ [nhãn]</option></select></label>
        <button type="button" class="ft-btn" data-de="export">Xuất .docx</button>
      </div>
    </div>
    <div class="fde-body">
      <aside class="fde-side" aria-label="Tải PDF và thẻ">
        <section><h3>Tải PDF</h3>
          <label class="fde-drop" data-de-drop><input type="file" accept="application/pdf" hidden data-de="pdf">
            <strong>Kéo thả hoặc bấm để chọn file PDF</strong><span>Lấy chữ và các chỗ cần điền thành thẻ</span></label></section>
        <section><h3>Thẻ của mẫu đã lưu</h3><ul class="fde-list" data-de-list="template"></ul></section>
        <section><h3>Thẻ trong văn bản (ô công dân điền)</h3><ul class="fde-list" data-de-list="doc"></ul>
          <button type="button" class="ft-btn ft-btn--sm" data-de="free">+ Thẻ tự do</button></section>
        <section><h3>Thẻ chèn vào văn bản (theo luật)</h3>
          <p class="fde-hint">Theo bộ thẻ của 26 thủ tục đất đai và kinh doanh. "Chèn" đưa thẻ vào văn bản tại con trỏ; "Chèn cả khối" chèn từng dòng "Nhãn: thẻ".</p>
          <div class="fde-row fde-lib-filter">
            <label>Lĩnh vực<select data-de-lib="domain"><option value="auto">Theo mẫu</option><option value="land">Đất đai</option><option value="biz">Kinh doanh</option><option value="all">Tất cả</option></select></label>
            <label>Người khai<select data-de-lib="person">${Object.entries(PERSONS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
          </div>
          <div data-de-lib-groups></div></section>
      </aside>
      <div class="fde-main">${TOOLBAR}<div class="fde-scroll"><div class="fde-page"></div></div></div>
    </div>
    <p class="fde-status" role="status" aria-live="polite" data-de-status></p>
  </div>`;
  const root = container.querySelector('.fde');
  const $ = (sel) => root.querySelector(sel);
  const setStatus = (text, error = false) => { const el = $('[data-de-status]'); el.textContent = text; el.classList.toggle('is-error', error); };

  // ----- Thẻ -----
  const docFields = new Map(doc.fields.map((field) => [field.id, field]));
  const templateFields = () => new Map(opts.templateFields().map((field) => [field.id, field]));
  const allFields = () => new Map([...templateFields(), ...docFields]);
  session = { allFields };
  const saveFields = () => { doc.fields = [...docFields.values()]; };
  const uniqueName = (name) => {
    const used = new Set([...allFields().values()].map((field) => field.name));
    let result = name || 'the';
    for (let n = 2; used.has(result); n += 1) result = `${name}_${n}`;
    return result;
  };
  const addDocField = ({ name, label, type = 'text', source }) => {
    seq += 1;
    const field = { id: `doc_${seq}.value`, name: uniqueName(name), label, type, required: true, source };
    docFields.set(field.id, field);
    return field;
  };

  // ----- Quill -----
  const { Quill } = window;
  const quill = new Quill($('.fde-page'), {
    theme: 'snow',
    placeholder: 'Soạn nội dung mẫu đơn hoặc tải PDF ở khung bên trái…',
    modules: { history: { userOnly: true }, toolbar: $('.fde-docs-bar'), table: true }
  });
  const bar = $('.fde-docs-bar');
  // Theme snow biến mọi <select> thành picker; select tự xử lý (data-tb) thì trả lại dạng gốc.
  bar.querySelectorAll('select[data-tb]').forEach((select) => {
    if (select.previousElementSibling?.classList.contains('ql-picker')) select.previousElementSibling.remove();
    select.style.display = '';
  });
  bar.querySelectorAll('select[class^="ql-"]').forEach((select) => {
    const picker = select.previousElementSibling;
    if (picker?.classList.contains('ql-picker')) { picker.title = select.title; picker.querySelector('.ql-picker-label')?.setAttribute('aria-label', select.title); }
  });
  // Mẫu mới (văn bản trống) luôn bắt đầu bằng quốc hiệu; mẫu đã lưu thì giữ nguyên như đã soạn.
  const isNew = !doc.ops.some((op) => typeof op.insert !== 'string' || op.insert.trim());
  quill.setContents(isNew ? NATIONAL_HEADER : doc.ops, 'silent');
  if (isNew) doc.ops = quill.getContents().ops;
  quill.history.clear();

  const chipNodes = (id) => quill.root.querySelectorAll(`.ql-field[data-id="${CSS.escape(id)}"]`);
  let lastRange = { index: isNew ? quill.getLength() - 1 : 0, length: 0 }; // mẫu mới: soạn tiếp ngay dưới quốc hiệu
  // Chèn các dòng "Nhãn: ô trống" kiểu mẫu đơn hành chính. Dòng đang có chữ thì xuống dòng mới trước;
  // phần chèn luôn là chữ thường, căn trái (không ăn định dạng của quốc hiệu/tiêu ngữ phía trên).
  const PLAIN = { bold: false, italic: false, underline: false, strike: false, size: false, color: false, background: false, font: false };
  const insertFieldLines = (fieldIds) => {
    let index = lastRange.index;
    const [line, offset] = quill.getLine(index);
    if (line && line.length() > 1) {
      index += line.length() - 1 - offset; // cuối dòng hiện tại
      quill.insertText(index, '\n', 'user');
      index += 1;
    }
    const start = index;
    fieldIds.forEach((id, i) => {
      if (i) { quill.insertText(index, '\n', 'user'); index += 1; }
      const label = `${allFields().get(id)?.label || 'Thẻ'}: `;
      quill.insertText(index, label, 'user');
      index += label.length;
      quill.insertEmbed(index, 'field', id, 'user');
      index += 1;
    });
    quill.formatText(start, index - start, PLAIN, 'user');
    quill.formatLine(start, index - start, { align: false, header: false, list: false, lineheight: false }, 'user');
    quill.setSelection(index, 0, 'user');
  };
  // Đổi nhãn thẻ: chữ "Nhãn cũ: " đứng ngay trước ô đổi theo; chữ khác (người dùng gõ, chữ từ PDF) giữ nguyên.
  const relabelLines = (id, oldLabel, newLabel) => {
    const before = `${oldLabel}: `;
    [...chipNodes(id)].reverse().forEach((node) => {
      const index = quill.getIndex(window.Quill.find(node));
      const from = index - before.length;
      if (from < 0 || quill.getText(from, before.length) !== before) return;
      quill.deleteText(from, before.length, 'user');
      quill.insertText(from, `${newLabel}: `, 'user');
    });
  };
  const removeChips = (id) => {
    let index = 0;
    const spots = [];
    quill.getContents().ops.forEach((op) => {
      if (op.insert?.field === id) spots.push(index);
      index += typeof op.insert === 'string' ? op.insert.length : 1;
    });
    spots.reverse().forEach((at) => quill.deleteText(at, 1, 'user'));
  };

  // ----- Khung thẻ -----
  const usage = (id) => chipNodes(id).length;
  function renderLists() {
    const tpl = [...templateFields().values()];
    $('[data-de-list="template"]').innerHTML = tpl.length ? tpl.map((field) => `<li class="fde-item" data-id="${escapeHtml(field.id)}">
      <div><strong>${escapeHtml(field.label || field.name)}</strong><small>${escapeHtml(field.section)} · <code>{{${escapeHtml(field.name)}}}</code> · dùng <span data-count>${usage(field.id)}</span> chỗ</small></div>
      <span class="fde-row"><button type="button" class="ft-btn ft-btn--sm" data-de="insert">Chèn</button>
      <button type="button" class="ft-btn ft-btn--sm ft-btn--danger" data-de="delete-template">Xoá</button></span></li>`).join('')
      : '<li class="fde-empty">Không có thẻ nào ngoài văn bản.</li>';
    $('[data-de-list="doc"]').innerHTML = docFields.size ? [...docFields.values()].map((field) => `<li class="fde-item fde-item--edit" data-id="${field.id}">
      <input class="fde-input" data-de-edit="label" value="${escapeHtml(field.label)}" aria-label="Nhãn thẻ">
      <div class="fde-row">
        <select data-de-edit="type" aria-label="Kiểu thẻ">${Object.entries(TYPES).map(([key, label]) => `<option value="${key}"${key === field.type ? ' selected' : ''}>${label}</option>`).join('')}</select>
        <label><input type="checkbox" data-de-edit="required"${field.required ? ' checked' : ''}> Bắt buộc</label>
        <small>${escapeHtml(field.source)} · dùng <span data-count>${usage(field.id)}</span> chỗ</small>
      </div>
      <div class="fde-row">
        <button type="button" class="ft-btn ft-btn--sm" data-de="insert">Chèn</button>
        <button type="button" class="ft-btn ft-btn--sm ft-btn--danger" data-de="delete">Xoá</button>
      </div></li>`).join('') : '<li class="fde-empty">Chưa có thẻ riêng. Tải PDF hoặc tạo thẻ tự do.</li>';
    bar.querySelector('[data-tb="field"]').innerHTML = `<option value="">Chèn thẻ</option>${[...allFields().values()]
      .map((field) => `<option value="${escapeHtml(field.id)}">${escapeHtml(field.label || field.name)}</option>`).join('')}`;
  }
  let countTimer;
  const scheduleCounts = () => {
    clearTimeout(countTimer);
    countTimer = setTimeout(() => root.querySelectorAll('.fde-item').forEach((li) => { const el = li.querySelector('[data-count]'); if (el) el.textContent = usage(li.dataset.id); }), 150);
  };
  const flash = (id) => {
    const li = root.querySelector(`.fde-item[data-id="${CSS.escape(id)}"]`);
    if (!li) return;
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    li.classList.add('is-flash');
    setTimeout(() => li.classList.remove('is-flash'), 1200);
  };
  const changed = () => { doc.ops = quill.getContents().ops; saveFields(); opts.onChange(); };
  renderLists();

  // ----- Thư viện thẻ theo luật -----
  const libDomain = () => {
    const pick = $('[data-de-lib="domain"]').value;
    if (pick !== 'auto') return pick;
    if (!opts.domain()) return 'all'; // chưa chọn lĩnh vực của mẫu
    return LAND.includes(opts.domain()) ? 'land' : 'biz';
  };
  const libGroups = () => LIBRARY.map((group, g) => ({ group, g })).filter(({ group }) => !group.domains || libDomain() === 'all'
    || (libDomain() === 'land' ? group.domains === LAND : group.domains === BIZ));
  function renderLibrary() {
    const person = $('[data-de-lib="person"]').value;
    $('[data-de-lib-groups]').innerHTML = libGroups().map(({ group, g }, i) => `<details class="fde-lib"${i < 2 ? ' open' : ''}>
      <summary>${escapeHtml(group.title)} (${group.fields.length})</summary>
      <ul>${group.fields.map((def, f) => { const item = libField(group, def, person); return `<li><span>${escapeHtml(item.label)}<small><code>{{${item.name}}}</code> · ${TYPES[item.type]}</small></span>
        <button type="button" class="ft-btn ft-btn--sm" data-de="lib-add" data-group="${g}" data-idx="${f}">Chèn</button></li>`; }).join('')}</ul>
      <button type="button" class="ft-btn ft-btn--sm" data-de="lib-block" data-group="${g}">Chèn cả khối</button></details>`).join('');
  }
  // Thẻ cùng mã đã có (của mẫu hoặc của văn bản) thì dùng lại, để một thông tin chỉ nhập một lần.
  const libToField = (group, def) => {
    const item = libField(group, def, $('[data-de-lib="person"]').value);
    const existing = [...allFields().values()].find((field) => field.name === item.name);
    return existing || addDocField({ ...item, source: 'Thư viện' });
  };
  root.querySelectorAll('[data-de-lib]').forEach((select) => select.addEventListener('change', renderLibrary));
  renderLibrary();

  quill.on('text-change', (delta, old, source) => { scheduleCounts(); if (source === 'user') changed(); });
  quill.root.addEventListener('click', (event) => {
    const chip = event.target.closest('.ql-field');
    quill.root.querySelectorAll('.ql-field.is-picked').forEach((node) => node.classList.remove('is-picked'));
    if (!chip) return;
    chip.classList.add('is-picked');
    flash(chip.dataset.id);
  });

  root.addEventListener('input', (event) => {
    const li = event.target.closest('.fde-item');
    if (!li || event.target.dataset.deEdit !== 'label') return;
    const field = docFields.get(li.dataset.id);
    relabelLines(field.id, field.label, event.target.value);
    field.label = event.target.value;
    chipNodes(field.id).forEach(paintChip);
    saveFields();
    opts.onChange();
  });
  root.addEventListener('change', (event) => {
    const li = event.target.closest('.fde-item');
    const edit = li && event.target.dataset.deEdit;
    if (edit === 'type') docFields.get(li.dataset.id).type = event.target.value;
    if (edit === 'required') docFields.get(li.dataset.id).required = event.target.checked;
    if (edit === 'type' || edit === 'required') { saveFields(); opts.onChange(); }
  });
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-de]');
    if (!button || button.tagName !== 'BUTTON') return;
    const act = button.dataset.de;
    const id = button.closest('.fde-item')?.dataset.id;
    if (act === 'export') exportDocx(button);
    else if (act === 'insert') { insertFieldLines([id]); flash(id); }
    else if (act === 'lib-add' || act === 'lib-block') {
      const group = LIBRARY[button.dataset.group];
      const defs = act === 'lib-add' ? [group.fields[button.dataset.idx]] : group.fields;
      const fields = defs.map((def) => libToField(group, def));
      insertFieldLines(fields.map((field) => field.id));
      changed();
      renderLists();
      flash(fields[0].id);
      setStatus(act === 'lib-add' ? `Đã chèn thẻ "${fields[0].label}".` : `Đã chèn khối "${group.title}" (${fields.length} thẻ).`);
    }
    else if (act === 'free') { const field = addDocField({ name: 'the_tu_do', label: 'Thẻ tự do', source: 'Tự thêm' }); saveFields(); renderLists(); flash(field.id); root.querySelector(`.fde-item[data-id="${field.id}"] .fde-input`)?.select(); opts.onChange(); }
    else if (act === 'delete') {
      if (!button.classList.contains('is-armed')) {
        button.classList.add('is-armed');
        button.textContent = 'Bấm lần nữa để xoá';
        setTimeout(() => { button.classList.remove('is-armed'); button.textContent = 'Xoá'; }, 3000);
        return;
      }
      removeChips(id);
      docFields.delete(id);
      changed();
      renderLists();
      setStatus('Đã xoá thẻ và các chỗ dùng thẻ trong văn bản.');
    } else if (act === 'delete-template') {
      removeChips(id);
      opts.removeTemplateField(id);
      changed();
      renderLists();
      setStatus('Đã xoá thẻ khỏi mẫu.');
    }
  });
  // Esc trong picker/ô liên kết chỉ đóng nó, không đóng khung dựng mẫu.
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (root.querySelector('.ql-picker.ql-expanded') || root.querySelector('.ql-tooltip.ql-editing'))) event.preventDefault();
  });

  // ----- Thanh công cụ: nút tự xử lý -----
  const tb = (name) => bar.querySelector(`[data-tb="${name}"]`);
  let painter = null;
  const restore = () => quill.setSelection(lastRange, 'silent');
  const press = (button, on) => { button.classList.toggle('ql-active', on); button.setAttribute('aria-pressed', String(on)); };
  press(tb('spell'), true); // bật sau khi Quill dựng thanh công cụ (class ql-active có sẵn lúc dựng làm Quill cảnh báo)
  const setSize = (n) => {
    const size = Math.min(96, Math.max(1, Math.round(Number(n) || DEFAULT_SIZE)));
    restore();
    quill.format('size', size === DEFAULT_SIZE ? false : `${size}pt`, 'user');
    tb('size').value = size;
  };
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tb]');
    if (!button) return;
    const act = button.dataset.tb;
    if (act === 'undo') quill.history.undo();
    else if (act === 'redo') quill.history.redo();
    else if (act === 'print') printPage();
    else if (act === 'spell') { quill.root.spellcheck = !quill.root.spellcheck; press(button, quill.root.spellcheck); }
    else if (act === 'paint') { painter = painter ? null : quill.getFormat(lastRange); press(button, Boolean(painter)); setStatus(painter ? 'Bôi đen đoạn chữ cần áp định dạng đã sao chép.' : ''); }
    else if (act === 'size-down') setSize(Number(tb('size').value) - 1);
    else if (act === 'size-up') setSize(Number(tb('size').value) + 1);
  });
  tb('size').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); setSize(event.target.value); } });
  tb('size').addEventListener('change', (event) => setSize(event.target.value));
  tb('zoom').addEventListener('change', (event) => { $('.fde-page').style.zoom = Number(event.target.value) / 100; });
  tb('tick').addEventListener('click', () => { restore(); quill.insertEmbed(lastRange.index, 'tick', false, 'user'); quill.insertText(lastRange.index + 1, ' ', 'user'); quill.setSelection(lastRange.index + 2, 0, 'user'); });
  quill.root.addEventListener('click', (event) => {
    const node = event.target.closest('.ql-tick');
    if (!node || !quill.isEnabled()) return;
    const index = quill.getIndex(window.Quill.find(node));
    quill.deleteText(index, 1, 'user');
    quill.insertEmbed(index, 'tick', node.dataset.checked !== '1', 'user');
  });
  const TABLE_OPS = { 'row-below': 'insertRowBelow', 'row-above': 'insertRowAbove', 'col-right': 'insertColumnRight', 'col-left': 'insertColumnLeft',
    'del-row': 'deleteRow', 'del-col': 'deleteColumn', 'del-table': 'deleteTable' };
  tb('table').addEventListener('change', (event) => {
    const value = event.target.value;
    event.target.value = '';
    if (!value) return;
    restore();
    const tableModule = quill.getModule('table');
    if (/^\d+x\d+$/.test(value)) {
      const [rows, cols] = value.split('x').map(Number);
      // Bảng chèn tại con trỏ sẽ kéo chữ phía trước con trỏ vào ô đầu, nên xuống dòng trước nếu dòng đang có chữ.
      const [line, offset] = quill.getLine(lastRange.index);
      if (line && offset > 0) {
        quill.insertText(lastRange.index, '\n', 'user');
        quill.setSelection(lastRange.index + 1, 0, 'user');
      }
      tableModule.insertTable(rows, cols);
      setStatus(`Đã chèn bảng ${rows} × ${cols}. Gõ chữ hoặc chèn thẻ vào từng ô.`);
      return;
    }
    const [inTable] = tableModule.getTable(quill.getSelection(true));
    if (!inTable) { setStatus('Đặt con trỏ vào một ô của bảng trước.', true); return; }
    tableModule[TABLE_OPS[value]]();
  });
  tb('lineheight').addEventListener('change', (event) => { restore(); quill.format('lineheight', event.target.value || false, 'user'); });
  tb('field').addEventListener('change', (event) => { if (event.target.value) { insertFieldLines([event.target.value]); flash(event.target.value); } event.target.value = ''; });
  tb('mode').addEventListener('change', (event) => {
    const view = event.target.value === 'view';
    quill.enable(!view);
    bar.classList.toggle('is-view', view);
    setStatus(view ? 'Đang ở chế độ Xem: không sửa được văn bản.' : '');
  });
  tb('search').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const query = event.target.value.trim().toLowerCase();
    const target = query && [...bar.querySelectorAll('[aria-label], .ql-picker')].find((el) => el !== event.target
      && (el.getAttribute('aria-label') || el.title || '').toLowerCase().includes(query));
    if (!target) { setStatus(`Không có lệnh "${event.target.value}".`, true); return; }
    event.target.value = '';
    if (target.tagName === 'SELECT') target.focus(); else (target.querySelector('.ql-picker-label') || target).click();
  });
  // Nút phản ánh vùng chọn; sao chép định dạng áp vào lần bôi đen kế tiếp.
  quill.on('editor-change', () => {
    const range = quill.getSelection();
    if (!range) return;
    lastRange = range;
    const format = quill.getFormat(range);
    if (document.activeElement !== tb('size')) tb('size').value = parseFloat(format.size) || DEFAULT_SIZE;
    tb('lineheight').value = format.lineheight || '';
    if (painter && range.length) {
      const inline = Object.fromEntries(Object.entries(painter).filter(([key]) => !BLOCK_FORMATS.includes(key) && key !== 'field'));
      quill.formatText(range.index, range.length, { ...INLINE_CLEAR, ...inline }, 'user');
      painter = null;
      press(tb('paint'), false);
      setStatus('Đã áp định dạng.');
    }
  });

  function printPage() {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { setStatus('Trình duyệt chặn cửa sổ in. Hãy cho phép cửa sổ bật lên.', true); return; }
    win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(opts.templateName() || 'Mẫu đơn')}</title>
      <link rel="stylesheet" href="${CDN.quillCss}"><style>@page{size:A4;margin:20mm 15mm 20mm 30mm}body{margin:0;font-family:'Times New Roman',serif;font-size:13pt}
      .ql-editor{padding:0;line-height:1.5}.ql-field{border-bottom:1px dotted #000;padding:0 4px}</style></head>
      <body><div class="ql-snow"><div class="ql-editor">${quill.root.innerHTML}</div></div></body></html>`);
    win.document.close();
    win.addEventListener('load', () => { win.focus(); win.print(); });
  }

  // ----- Tải PDF -----
  const drop = $('[data-de-drop]');
  $('[data-de="pdf"]').addEventListener('change', (event) => { if (event.target.files[0]) readPdf(event.target.files[0]); event.target.value = ''; });
  drop.addEventListener('dragover', (event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); drop.classList.add('is-over'); } });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (event) => {
    if (!event.dataTransfer.files[0]) return;
    event.preventDefault();
    drop.classList.remove('is-over');
    readPdf(event.dataTransfer.files[0]);
  });

  async function readPdf(file) {
    if (file.type && file.type !== 'application/pdf') { setStatus('Chỉ nhận file PDF.', true); return; }
    if (quill.getLength() > 1 && !window.confirm('Nội dung PDF sẽ thay văn bản đang soạn (thẻ của mẫu vẫn giữ). Tiếp tục?')) return;
    setStatus(`Đang đọc ${file.name}…`);
    const backup = new Map(docFields);
    try {
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      docFields.clear();
      const ops = [];
      let chars = 0;
      let widgets = 0;
      let dotted = 0;
      for (let p = 1; p <= pdf.numPages; p += 1) {
        const page = await pdf.getPage(p);
        const pageWidth = page.getViewport({ scale: 1 }).width;
        const [content, annotations] = await Promise.all([page.getTextContent(), page.getAnnotations()]);
        const items = content.items.filter((item) => item.str?.trim()).map((item) => ({
          kind: 'text', str: item.str, x: item.transform[4], y: item.transform[5], w: item.width, h: item.height || Math.abs(item.transform[3]) || 10
        }));
        chars += items.reduce((sum, item) => sum + item.str.trim().length, 0);
        annotations.filter((a) => a.subtype === 'Widget' && a.fieldName).forEach((a) => {
          widgets += 1;
          const label = a.alternativeText || a.fieldName;
          const type = a.fieldType === 'Btn' ? 'checkbox' : a.fieldType === 'Ch' ? 'select' : a.multiLine ? 'textarea' : guess(label).type;
          const field = addDocField({ name: slugify(a.fieldName) || guess(label).name, label, type, source: 'Ô trong PDF' });
          items.push({ kind: 'field', id: field.id, x: a.rect[0], y: (a.rect[1] + a.rect[3]) / 2, w: a.rect[2] - a.rect[0], h: Math.abs(a.rect[3] - a.rect[1]) });
        });
        // Gom thành dòng theo y (sai số nửa chiều cao chữ), trong dòng xếp theo x.
        const lines = [];
        items.sort((a, b) => b.y - a.y || a.x - b.x).forEach((item) => {
          const line = lines.find((l) => Math.abs(l.y - item.y) <= Math.max(l.h, item.h) / 2);
          if (line) line.items.push(item); else lines.push({ y: item.y, h: item.h, items: [item] });
        });
        lines.sort((a, b) => b.y - a.y).forEach((line) => {
          line.items.sort((a, b) => a.x - b.x);
          const parts = [];
          let prevEnd = null;
          line.items.forEach((item) => {
            const gap = prevEnd === null ? 0 : item.x - prevEnd;
            if (item.kind === 'field') parts.push(' ', { field: item.id }, ' ');
            else {
              const text = (gap > item.h * 0.15 && parts.length ? ' ' : '') + item.str;
              if (typeof parts.at(-1) === 'string') parts[parts.length - 1] += text; else parts.push(text);
            }
            prevEnd = item.x + item.w;
          });
          const letters = parts.filter((part) => typeof part === 'string').join('').replace(/[^\p{L}]/gu, '');
          const attrs = letters.length > 1 && letters === letters.toUpperCase() ? { bold: true } : undefined;
          const left = line.items[0].x;
          const centered = Math.abs((left + prevEnd) / 2 - pageWidth / 2) < pageWidth * 0.06 && prevEnd - left < pageWidth * 0.7;
          parts.forEach((part) => {
            if (typeof part !== 'string') { ops.push({ insert: part }); return; }
            if (!part.replace(DOTS, '').trim()) { ops.push({ insert: part, attributes: attrs }); return; } // dòng chỉ có chấm: giữ nguyên
            let last = 0;
            part.replace(DOTS, (match, offset) => {
              const before = part.slice(last, offset);
              const label = labelBefore(before);
              if (before) ops.push({ insert: before, attributes: attrs });
              if (label) {
                ops.push({ insert: { field: addDocField({ ...guess(label), label, source: 'Chỗ chấm trong PDF' }).id } });
                dotted += 1;
              } else ops.push({ insert: match, attributes: attrs });
              last = offset + match.length;
              return match;
            });
            if (part.slice(last)) ops.push({ insert: part.slice(last), attributes: attrs });
          });
          ops.push({ insert: '\n', attributes: centered ? { align: 'center' } : undefined });
        });
        if (p < pdf.numPages) ops.push({ insert: '\n' });
      }
      if (chars < 20 && !widgets) {
        backup.forEach((field, id) => docFields.set(id, field));
        setStatus('File này là ảnh scan nên chưa đọc được chữ, cần OCR ở BE.', true);
        return;
      }
      quill.setContents(withNationalHeader(ops), 'user');
      lastRange = { index: 0, length: 0 };
      changed();
      renderLists();
      setStatus(`Đã đọc ${pdf.numPages} trang: ${widgets} ô điền sẵn, ${dotted} chỗ chấm thành thẻ. Sửa nhãn ở khung trái, thẻ tự thành ô của mẫu khi Lưu nháp.`);
    } catch (error) {
      console.error(error);
      docFields.clear();
      backup.forEach((field, id) => docFields.set(id, field));
      setStatus('Không đọc được file PDF này.', true);
    }
  }

  // ----- Xuất .docx -----
  const chipText = (field, mode) => {
    if (!field) return '';
    if (mode === 'code') return `{{${field.name}}}`;
    if (mode === 'label') return `[${field.label}]`;
    if (field.type === 'checkbox') return '☐';
    return '.'.repeat(field.type === 'textarea' ? 70 : 30);
  };
  // Ảnh trong Quill là data URL → bytes + kích thước (thu nhỏ vừa bề rộng trang ~16,5 cm = 624px).
  async function loadImages(ops) {
    const images = new Map();
    await Promise.all(ops.filter((op) => typeof op.insert?.image === 'string').map(async (op) => {
      const src = op.insert.image;
      const img = new Image();
      img.src = src;
      await img.decode();
      const scale = Math.min(1, 624 / img.naturalWidth);
      const type = (src.match(/^data:image\/(png|jpe?g|gif|bmp)/i)?.[1] || 'png').toLowerCase().replace('jpeg', 'jpg');
      images.set(src, { data: new Uint8Array(await (await fetch(src)).arrayBuffer()), type, width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
    }));
    return images;
  }
  function buildDocument(mode, images) {
    const d = window.docx;
    const fields = allFields();
    const run = (text, a = {}) => new d.TextRun({
      text, bold: a.bold, italics: a.italic, strike: a.strike, underline: a.underline ? {} : undefined,
      color: toHex(a.color), shading: a.background ? { type: d.ShadingType.CLEAR, color: 'auto', fill: toHex(a.background) } : undefined,
      size: a.size ? Math.round(parseFloat(a.size) * 2) : undefined, font: a.font || undefined, superScript: a.script === 'super', subScript: a.script === 'sub'
    });
    const ALIGN = { center: d.AlignmentType.CENTER, right: d.AlignmentType.RIGHT, justify: d.AlignmentType.JUSTIFIED };
    const HEADING = { 1: d.HeadingLevel.HEADING_1, 2: d.HeadingLevel.HEADING_2, 3: d.HeadingLevel.HEADING_3 };
    const paragraphs = [];
    let runs = [];
    // Bảng Quill: mỗi ô là một dòng có attributes.table = mã hàng; ô liên tiếp cùng mã là một hàng, hàng liên tiếp là một bảng.
    let table = null; // [{ id, cells: [Paragraph] }]
    const cellBorder = { style: d.BorderStyle.SINGLE, size: 4, color: '000000' };
    const flushTable = () => {
      if (!table) return;
      const cols = Math.max(...table.map((row) => row.cells.length));
      paragraphs.push(new d.Table({
        width: { size: 100, type: d.WidthType.PERCENTAGE },
        borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder, insideHorizontal: cellBorder, insideVertical: cellBorder },
        rows: table.map((row) => new d.TableRow({ children: Array.from({ length: cols }, (_, i) => new d.TableCell({
          width: { size: Math.floor(100 / cols), type: d.WidthType.PERCENTAGE }, children: [row.cells[i] || new d.Paragraph({ children: [] })] })) }))
      }));
      table = null;
    };
    const endParagraph = (a = {}) => {
      const level = a.indent || 0;
      if (a.list === 'checked' || a.list === 'unchecked') runs.unshift(new d.TextRun({ text: a.list === 'checked' ? '☑ ' : '☐ ' }));
      if (a.table) {
        table ??= [];
        if (table.at(-1)?.id !== a.table) table.push({ id: a.table, cells: [] });
        table.at(-1).cells.push(new d.Paragraph({ children: runs, alignment: ALIGN[a.align] }));
        runs = [];
        return;
      }
      flushTable();
      paragraphs.push(new d.Paragraph({
        children: runs, alignment: ALIGN[a.align], heading: HEADING[a.header],
        spacing: a.lineheight ? { line: Math.round(240 * parseFloat(a.lineheight)) } : undefined,
        bullet: a.list === 'bullet' ? { level } : undefined,
        numbering: a.list === 'ordered' ? { reference: 'fde-num', level } : undefined,
        indent: !a.list && (level || a.blockquote) ? { left: 720 * (level + (a.blockquote ? 1 : 0)) } : undefined
      }));
      runs = [];
    };
    quill.getContents().ops.forEach((op) => {
      const image = images.get(op.insert?.image);
      if (image) { runs.push(new d.ImageRun({ type: image.type, data: image.data, transformation: { width: image.width, height: image.height } })); return; }
      if (typeof op.insert !== 'string') {
        if (op.insert.field) runs.push(run(chipText(fields.get(op.insert.field), mode), op.attributes));
        else if ('tick' in op.insert) runs.push(run(op.insert.tick ? '☒' : '☐', op.attributes));
        return;
      }
      op.insert.split('\n').forEach((text, i) => {
        if (i > 0) endParagraph(op.attributes);
        if (text) runs.push(run(text, op.attributes));
      });
    });
    if (runs.length) endParagraph();
    flushTable();
    const headingStyle = (size) => ({ run: { font: DEFAULT_FONT, size, bold: true, color: '000000' } });
    return new d.Document({
      styles: { default: { document: { run: { font: DEFAULT_FONT, size: DEFAULT_SIZE * 2 } }, heading1: headingStyle(36), heading2: headingStyle(32), heading3: headingStyle(28) } },
      numbering: { config: [{ reference: 'fde-num', levels: Array.from({ length: 9 }, (_, level) => ({
        level, format: d.LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: d.AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) }] },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 851 } } }, children: paragraphs }]
    });
  }
  async function exportDocx(button) {
    button.disabled = true;
    try {
      const images = await loadImages(quill.getContents().ops);
      const blob = await window.docx.Packer.toBlob(buildDocument($('[data-de="export-mode"]').value, images));
      const name = (opts.templateName().trim() || 'mau-don').replace(/[\\/:*?"<>|]+/g, '-');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${name}.docx` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setStatus(`Đã xuất ${name}.docx.`);
    } catch (error) {
      console.error(error);
      setStatus('Xuất .docx không thành công.', true);
    } finally {
      button.disabled = false;
    }
  }

  return {
    refreshLibrary: renderLibrary, // khi đổi lĩnh vực của mẫu
    // Vẽ lại danh sách thẻ và ô thẻ khi gắn lại trình soạn vào khung.
    refresh() {
      renderLists();
      quill.root.querySelectorAll('.ql-field').forEach(paintChip);
    }
  };
}

// Văn bản → các mục của mẫu: [{ title, ids }] theo thứ tự xuất hiện. Tiêu đề mục = dòng đậm, không căn giữa, không trong bảng, không có thẻ.
export function sectionsFromDoc(ops) {
  const sections = [{ title: '', ids: [] }];
  const seen = new Set();
  let text = '';
  let allBold = true;
  let ids = [];
  const endLine = (attrs = {}) => {
    if (text.trim() && !ids.length && allBold && !attrs.align && !attrs.table) sections.push({ title: text.trim(), ids: [] });
    else ids.forEach((id) => { if (!seen.has(id)) { seen.add(id); sections.at(-1).ids.push(id); } });
    text = ''; allBold = true; ids = [];
  };
  ops.forEach((op) => {
    if (typeof op.insert !== 'string') { if (op.insert.field) ids.push(op.insert.field); return; }
    op.insert.split('\n').forEach((part, i) => {
      if (i) endLine(op.attributes);
      if (part.trim()) { text += part; allBold &&= Boolean(op.attributes?.bold); }
    });
  });
  return sections.filter((section) => section.ids.length);
}

{
  const ops = [{ insert: 'QUỐC HIỆU', attributes: { bold: true } }, { insert: '\n', attributes: { align: 'center' } }, { insert: 'Tôi: ' }, { insert: { field: 'a' } }, { insert: '\n' },
    { insert: 'I. Mục', attributes: { bold: true } }, { insert: '\n' }, { insert: { field: 'b' } }, { insert: ' ' }, { insert: { field: 'a' } }, { insert: '\n' }, { insert: 'II. Trống', attributes: { bold: true } }, { insert: '\n' }];
  console.assert(JSON.stringify(sectionsFromDoc(ops)) === '[{"title":"","ids":["a"]},{"title":"I. Mục","ids":["b"]}]', 'sectionsFromDoc');
}

console.assert(
  labelBefore('1. Họ và tên: ') === 'Họ và tên' && labelBefore('Sinh ngày 01/01, nơi sinh: ') === 'nơi sinh' && labelBefore('   ') === ''
  && guess('Ngày cấp').name === 'applicant_id_issue_date' && guess('Số điện thoại').type === 'phone' && guess('Địa chỉ trụ sở').type === 'textarea'
  && guess('Diện tích đất').type === 'number' && slugify('Họ và tên') === 'ho_va_ten' && toHex('rgb(255, 0, 16)') === 'ff0010' && toHex('#e00') === 'ee0000',
  'form-doc-editor');
