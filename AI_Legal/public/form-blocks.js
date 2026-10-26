// =============================================================================
// THƯ VIỆN THẺ CÓ SẴN CHO "THÊM MẪU ĐƠN" (form-templates-admin.js dựng mẫu, form-renderer.js hiển thị/kiểm tra).
// Rút từ các trường lặp lại nhiều nhất trong 26 bộ thẻ backend (docs/bo-the-inventory.md, mục 3).
// Nhãn trường cố định: admin chỉ chọn thẻ, không đổi nhãn, không cấu hình kiểm tra.
// Mẫu lưu bản chụp đầy đủ các trường (snapshotBlock), nên sửa thư viện ở đây không làm lệch mẫu cũ.
// Thêm thẻ mới: thêm một mục vào BLOCKS, block_key không được đổi sau khi đã có mẫu dùng.
// =============================================================================
import { checkField } from '/field-rules.js';

// type → quy tắc trong field-rules.js. Kiểu không có ở đây (text, textarea, select) chỉ kiểm tra bắt buộc.
export const TYPE_RULES = {
  cccd: 'cccd', phone: 'phone', email: 'email', number: 'number',
  past_date: 'pastDate', dob: 'dob', issue_date: 'issueDate'
};
const DATE_TYPES = ['date', 'past_date', 'dob', 'issue_date'];
export const inputKind = (type) => (DATE_TYPES.includes(type) ? 'date' : type === 'textarea' || type === 'select' ? type : 'text');

// Kiểu admin chọn cho "Trường tự do" (admin chỉ nhập tiêu đề ô).
export const FREE_TYPES = { text: 'Chữ ngắn', textarea: 'Đoạn dài', date: 'Ngày', number: 'Số' };
export const FREE_BLOCK_KEY = 'free_field';

const f = (key, label, type, required, autofill, extra) => ({ key, label, type, required, ...(autofill && { autofill }), ...extra });
const LAND_PURPOSES = ['Đất ở tại nông thôn (ONT)', 'Đất ở tại đô thị (ODT)', 'Đất trồng cây lâu năm (CLN)', 'Đất trồng cây hàng năm khác (HNK)',
  'Đất trồng lúa (LUC)', 'Đất thương mại, dịch vụ (TMD)', 'Đất sản xuất phi nông nghiệp (SKC)'];

export const BLOCKS = [
  { block_key: 'personal_info', name: 'Thông tin cá nhân', fields: [
    f('full_name', 'Họ và tên', 'text', true, 'profile.full_name'),
    f('dob', 'Ngày tháng năm sinh', 'dob', true, 'profile.dob'),
    f('cccd_number', 'Số CCCD', 'cccd', true, 'profile.cccd_number'),
    f('cccd_issue_date', 'Ngày cấp CCCD', 'issue_date', true, 'profile.cccd_issue_date'),
    f('cccd_issue_place', 'Nơi cấp', 'text', true, 'profile.cccd_issue_place'),
    f('permanent_address', 'Nơi đăng ký thường trú', 'textarea', true, 'profile.permanent_address')
  ] },
  { block_key: 'dob', name: 'Ngày sinh', fields: [f('dob', 'Ngày tháng năm sinh', 'dob', true, 'profile.dob')] },
  { block_key: 'cccd', name: 'CCCD', fields: [
    f('cccd_number', 'Số CCCD', 'cccd', true, 'profile.cccd_number'),
    f('cccd_issue_date', 'Ngày cấp CCCD', 'issue_date', true, 'profile.cccd_issue_date'),
    f('cccd_issue_place', 'Nơi cấp', 'text', true, 'profile.cccd_issue_place')
  ] },
  { block_key: 'address', name: 'Địa chỉ', fields: [
    f('permanent_address', 'Nơi đăng ký thường trú', 'textarea', true, 'profile.permanent_address'),
    f('current_address', 'Nơi ở hiện nay', 'textarea', false, 'profile.current_address')
  ] },
  { block_key: 'phone', name: 'Số điện thoại', fields: [f('phone', 'Số điện thoại liên hệ', 'phone', true, 'profile.phone')] },
  { block_key: 'email', name: 'Email', fields: [f('email', 'Địa chỉ email', 'email', false, 'profile.email')] },
  { block_key: 'tax_code', name: 'Mã số thuế', fields: [f('tax_code', 'Mã số thuế', 'text', false, 'profile.tax_code')] },
  { block_key: 'organization', name: 'Thông tin tổ chức/doanh nghiệp', fields: [
    f('org_name', 'Tên tổ chức/doanh nghiệp', 'text', true),
    f('org_name_en', 'Tên tiếng nước ngoài (nếu có)', 'text', false),
    f('org_code', 'Mã số doanh nghiệp/Mã số thuế', 'text', false),
    f('headquarters_address', 'Địa chỉ trụ sở chính', 'textarea', true),
    f('headquarters_phone', 'Điện thoại trụ sở', 'phone', true),
    f('headquarters_email', 'Email trụ sở', 'email', false)
  ] },
  { block_key: 'business_lines', name: 'Ngành nghề và vốn kinh doanh', fields: [
    f('main_business_lines', 'Ngành nghề kinh doanh chính', 'textarea', true),
    f('capital', 'Vốn kinh doanh (VNĐ)', 'number', true),
    f('total_employees', 'Số lao động dự kiến', 'number', false)
  ] },
  { block_key: 'land_parcel', name: 'Thông tin thửa đất', fields: [
    f('plot_number', 'Thửa đất số', 'text', true),
    f('map_sheet_number', 'Tờ bản đồ số', 'text', true),
    f('land_address', 'Địa chỉ thửa đất', 'textarea', true),
    f('land_area', 'Diện tích thửa đất (m²)', 'number', true),
    f('land_use_purpose', 'Mục đích sử dụng đất', 'select', true, null, { options: LAND_PURPOSES }),
    f('certificate_number', 'Số seri Giấy chứng nhận', 'text', false),
    f('certificate_issue_date', 'Ngày cấp Giấy chứng nhận', 'past_date', false)
  ] },
  { block_key: 'receiving_agency', name: 'Cơ quan tiếp nhận', fields: [f('receiving_agency', 'Kính gửi (cơ quan tiếp nhận)', 'text', true)] },
  { block_key: FREE_BLOCK_KEY, name: 'Trường tự do', fields: [f('value', '', 'text', false)] }
];

export const blockByKey = (key) => BLOCKS.find((block) => block.block_key === key);

// Bản chụp trường cho một instance mới. instance_id = <block_key>_<n> (trường tự do: free_<n>), n tăng dần trong mẫu.
export function snapshotBlock(blockKey, usedIds, free = {}) {
  const block = blockByKey(blockKey);
  const prefix = blockKey === FREE_BLOCK_KEY ? 'free' : blockKey;
  let n = 1;
  while (usedIds.has(`${prefix}_${n}`)) n += 1;
  const fields = block.fields.map((field) => structuredClone(field));
  if (blockKey === FREE_BLOCK_KEY) Object.assign(fields[0], { label: free.label ?? '', type: free.type || 'text' });
  return { instance_id: `${prefix}_${n}`, block_key: blockKey, fields };
}

export const blockTitle = (block) => (block.block_key === FREE_BLOCK_KEY ? 'Trường tự do' : blockByKey(block.block_key)?.name || block.block_key);

// Kiểm tra cấu trúc mẫu trước khi lưu/xuất bản → mảng thông báo lỗi (rỗng = hợp lệ).
export function checkTemplate(content) {
  const errors = [];
  if (!content.name?.trim()) errors.push('Chưa nhập tên mẫu.');
  if (!content.domain) errors.push('Chưa chọn lĩnh vực.');
  if (!content.sections.length) errors.push('Mẫu cần ít nhất một mục.');
  content.sections.forEach((section, i) => {
    const where = section.title?.trim() || `Mục ${i + 1}`;
    if (!section.title?.trim()) errors.push(`Mục ${i + 1} chưa có tên.`);
    if (!section.blocks.length) errors.push(`${where}: chưa có thẻ nào.`);
    section.blocks.forEach((block) => {
      if (block.block_key === FREE_BLOCK_KEY && !block.fields[0].label.trim()) errors.push(`${where}: trường tự do chưa có tiêu đề ô.`);
    });
  });
  return errors;
}

// Kiểm tra dữ liệu công dân điền. values: { '<instance_id>.<key>': chuỗi } → { errors: { path: thông báo }, values: đã chuẩn hóa }.
export function checkValues(content, values) {
  const errors = {};
  const clean = {};
  content.sections.forEach((section) => section.blocks.forEach((block) => {
    const dob = (values[`${block.instance_id}.${block.fields.find((field) => field.type === 'dob')?.key}`] || '').trim();
    block.fields.forEach((field) => {
      const path = `${block.instance_id}.${field.key}`;
      const value = String(values[path] ?? '').trim();
      if (!value) {
        if (field.required) errors[path] = 'Vui lòng nhập thông tin này.';
        clean[path] = '';
        return;
      }
      const rule = TYPE_RULES[field.type];
      const result = rule ? checkField(rule, value, { dob }) : { value };
      if (result.error) errors[path] = result.error;
      else clean[path] = rule === 'number' ? value : result.value; // giữ số như người dân viết (1.250.000) để in ra
    });
  }));
  return { errors, values: clean };
}

{
  const tpl = { name: 'x', domain: 'dat_dai', sections: [{ title: 'I', blocks: [
    { ...snapshotBlock('personal_info', new Set()), order: 1 },
    { ...snapshotBlock(FREE_BLOCK_KEY, new Set(), { label: 'Lý do', type: 'number' }), order: 2 }] }] };
  const used = new Set(['personal_info_1', 'personal_info_2']);
  const { errors, values } = checkValues(tpl, { 'personal_info_1.full_name': 'An', 'personal_info_1.dob': '1990-05-20',
    'personal_info_1.cccd_number': '123', 'personal_info_1.cccd_issue_date': '1980-01-01', 'free_1.value': '1.250.000' });
  console.assert(
    snapshotBlock('personal_info', used).instance_id === 'personal_info_3' && tpl.sections[0].blocks[1].instance_id === 'free_1'
    && tpl.sections[0].blocks[1].fields[0].type === 'number' && blockByKey('personal_info').fields[0].label === 'Họ và tên'
    && errors['personal_info_1.cccd_number'] && errors['personal_info_1.cccd_issue_date'] && errors['personal_info_1.cccd_issue_place']
    && !errors['personal_info_1.full_name'] && values['free_1.value'] === '1.250.000'
    && checkTemplate(tpl).length === 0 && checkTemplate({ ...tpl, name: '' }).length === 1
    && checkTemplate({ name: 'x', domain: 'dat_dai', sections: [{ title: 'I', blocks: [snapshotBlock(FREE_BLOCK_KEY, new Set())] }] }).length === 1,
    'form-blocks');
}
