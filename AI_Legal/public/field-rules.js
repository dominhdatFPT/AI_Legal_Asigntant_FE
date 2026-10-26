// =============================================================================
// QUY TẮC KIỂM TRA DÙNG CHUNG CHO CÁC TRƯỜNG LẶP LẠI TRONG NHIỀU BỘ THẺ
// Cùng một trường (Số CCCD, Số điện thoại, Email, Ngày sinh, Ngày cấp) xuất hiện ở nhiều thủ tục với
// tiền tố khác nhau (applicant_, authorizer_, authorized_person_, lessor_, lessee_...) nên nhận diện theo hậu tố tên.
// Dùng ở: application-submission.html (form theo schema), signup-auth.js (SĐT), form-blocks.js (kiểm tra theo kiểu trường của mẫu đơn).
// =============================================================================

// "0901 234 567", "+84 901.234.567" → "0901234567". Sai định dạng → null.
export const normalizePhone = (value) => {
  let digits = String(value).replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`;
  return /^0[35789]\d{8}$/.test(digits) ? digits : null;
};

// Số kiểu Việt Nam: '85,5' / '85.5' → 85.5; '1.000' / '1.250,5' / '100.000.000 đồng' (dấu chấm ngăn nghìn) → 1000 / 1250.5 / 100000000.
// Cách viết mơ hồ như '1,000' hoặc chữ → null để hỏi lại người dùng, không đoán.
export function parseVietnameseNumber(text) {
  const t = String(text ?? '').replace(/m²|m2|đồng|vnđ|vnd|đ/gi, '').replace(/\s/g, '');
  if (/^\d+([.,]\d{1,2})?$/.test(t)) return Number(t.replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return null;
}

export const MESSAGES = {
  cccd: 'Số CCCD phải gồm đúng 12 chữ số.',
  cmnd: 'Số CMND phải gồm 9 hoặc 12 chữ số.',
  phone: 'Số điện thoại chưa đúng. Hãy nhập 10 số, bắt đầu bằng 0 (vd: 0901234567).',
  email: 'Địa chỉ email không hợp lệ.',
  dob: 'Ngày sinh không được ở tương lai.',
  issueDate: 'Ngày cấp không hợp lệ.',
  pastDate: 'Ngày không được ở tương lai.',
  number: 'Giá trị chưa đúng, ví dụ: 85,5 hoặc 1.250.000'
};

// Tên trường theo schema (hoặc kiểu thẻ do admin chọn: cccd/phone/email/pastDate/money/area) → quy tắc; null = không có quy tắc riêng.
export const ruleFor = (name, type) =>
  ['cccd', 'phone', 'email', 'pastDate'].includes(type) ? type
    : ['number', 'money', 'area'].includes(type) ? 'number'
    : /_id_number$/.test(name) ? 'cccd'
    : /_phone$/.test(name) ? 'phone'
    : /_email$/.test(name) ? 'email'
    : /_dob$/.test(name) ? 'dob'
    : /issue_date$/.test(name) ? 'issueDate'
    : null;

const localToday = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD theo giờ máy

// value đã trim. idType: 'CCCD' | 'CMND' | 'HoChieu' của cùng người; dob: ngày sinh cùng người (để so với ngày cấp).
// → { value } (đã chuẩn hóa để gửi backend) hoặc { error }.
export function checkField(rule, value, { idType, dob } = {}) {
  if (rule === 'cccd') {
    const digits = value.replace(/\s/g, '');
    if (idType === 'HoChieu') return { value: digits };
    if (idType === 'CMND') return /^(\d{9}|\d{12})$/.test(digits) ? { value: digits } : { error: MESSAGES.cmnd };
    return /^\d{12}$/.test(digits) ? { value: digits } : { error: MESSAGES.cccd };
  }
  if (rule === 'phone') {
    const phone = normalizePhone(value);
    return phone ? { value: phone } : { error: MESSAGES.phone };
  }
  if (rule === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? { value } : { error: MESSAGES.email };
  if (rule === 'number') {
    const number = parseVietnameseNumber(value);
    return number === null ? { error: MESSAGES.number } : { value: number };
  }
  if (rule === 'pastDate') return value <= localToday() ? { value } : { error: MESSAGES.pastDate };
  if (rule === 'dob') return value <= localToday() ? { value } : { error: MESSAGES.dob };
  if (rule === 'issueDate') return value <= localToday() && !(dob && value < dob) ? { value } : { error: MESSAGES.issueDate };
  return { value };
}

const ok = (rule, value, ctx) => !checkField(rule, value, ctx).error;
console.assert(
  ok('cccd', '001095012345') && !ok('cccd', '00109501234') && !ok('cccd', '123456789')
  && ok('cccd', '123456789', { idType: 'CMND' }) && !ok('cccd', '1234567890', { idType: 'CMND' })
  && checkField('phone', '+84 901.234.567').value === '0901234567' && !ok('phone', '0201234567')
  && ok('email', 'an@gmail.com') && !ok('email', 'abc@') && !ok('dob', '2999-01-01') && ok('dob', '1990-05-20')
  && !ok('issueDate', '1980-01-01', { dob: '1990-05-20' }) && ok('issueDate', '2021-06-01', { dob: '1990-05-20' })
  && parseVietnameseNumber('85,5 m²') === 85.5 && parseVietnameseNumber('1.000 m²') === 1000
  && parseVietnameseNumber('1.250,5') === 1250.5 && parseVietnameseNumber('100.000.000 đồng') === 100000000
  && parseVietnameseNumber('1,000') === null && parseVietnameseNumber('abc') === null && parseVietnameseNumber('') === null
  && checkField('number', '1.250.000').value === 1250000 && !ok('number', '1,000') && ruleFor('land_area', 'number') === 'number'
  && ruleFor('x', 'money') === 'number' && !ok('pastDate', '2999-01-01') && ok('pastDate', '2020-01-01')
  && ruleFor('lessee_id_number') === 'cccd' && ruleFor('so_dien_thoai', 'phone') === 'phone' && ruleFor('certificate_issue_date') === 'issueDate' && ruleFor('land_address') === null,
  'field-rules');
