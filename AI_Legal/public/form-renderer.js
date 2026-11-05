// =============================================================================
// HIỂN THỊ MẪU ĐƠN TỪ JSON: dùng chung cho màn "Tổng hợp" của admin (form-templates-admin.js) và màn công dân điền (form-fill.js).
// Ô nhập có name = "<instance_id>.<key>" (vd personal_info_2.full_name), đúng khóa dữ liệu trong hợp đồng API.
// Bản in (PDF qua hộp thoại in của trình duyệt): phần đầu quốc hiệu/tiêu ngữ và phần ký là 2 thành phần riêng, dùng cho mọi mẫu.
// CSS: form-templates.css.
// =============================================================================
import { escapeHtml } from '/auth-api.js';
import { inputKind, blockTitle, FREE_BLOCK_KEY } from '/form-blocks.js';

const fieldId = (path) => `ft-${path.replace(/[^a-z0-9_]/gi, '-')}`;
const sorted = (list) => [...list].sort((a, b) => a.order - b.order);

function repeatItemLabel(group) {
  const title = String(group.title || '').toLocaleLowerCase('vi');
  const labels = (group.fields || []).map((field) => String(field.label || '').toLocaleLowerCase('vi')).join(' ');
  if (/người|thành viên|đồng sở hữu|bên tham gia/.test(title) || /tên người|họ và tên|họ tên/.test(labels)) return 'người';
  if (/giấy tờ|tài liệu/.test(title) || /tên giấy tờ|tên tài liệu/.test(labels)) return 'giấy tờ';
  if (/hồ sơ/.test(title)) return 'hồ sơ';
  if (/thửa đất/.test(title)) return 'thửa đất';
  return 'mục';
}

function fieldHtml(block, field, values) {
  const path = `${block.instance_id}.${field.key}`;
  const id = fieldId(path);
  const value = escapeHtml(values[path] ?? '');
  const common = `id="${id}" name="${escapeHtml(path)}" aria-describedby="${id}-error"${field.required ? ' required aria-required="true"' : ''}`;
  const kind = inputKind(field.type);
  const control = kind === 'textarea' ? `<textarea ${common} rows="3">${value}</textarea>`
    : kind === 'select' ? `<select ${common}><option value="">— Chọn —</option>${(field.options || []).map((option) =>
      `<option${values[path] === option ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`
    : `<input ${common} type="${kind}" value="${value}"${field.type === 'phone' ? ' inputmode="tel" autocomplete="tel"' : field.type === 'email' ? ' inputmode="email" autocomplete="email"' : ['cccd', 'number'].includes(field.type) ? ' inputmode="numeric"' : ''}>`;
  return `<div class="ft-field${kind === 'textarea' ? ' ft-field--wide' : ''}">
    <label for="${id}">${escapeHtml(field.label)}${field.required ? ' <span class="ft-req" aria-hidden="true">*</span>' : ''}</label>
    ${control}<p class="ft-error" id="${id}-error"></p></div>`;
}

// Form điền mẫu. values: { path: giá trị } để giữ lại dữ liệu đã nhập khi vẽ lại.
export function renderForm(content, values = {}) {
  return `<div class="ft-form">
    <header class="ft-form__head"><h2>${escapeHtml(content.name || 'Mẫu đơn chưa đặt tên')}</h2>${content.code ? `<p>Mẫu số ${escapeHtml(content.code)}</p>` : ''}</header>
    ${sorted(content.sections).map((section) => `<fieldset class="ft-section"><legend>${escapeHtml(section.title)}</legend>
      ${sorted(section.blocks).filter((block) => block.block_key !== 'repeat_group').map((block) => `<div class="ft-block" data-instance="${escapeHtml(block.instance_id)}">
        ${block.block_key === FREE_BLOCK_KEY ? '' : `<p class="ft-block__title">${escapeHtml(blockTitle(block))}</p>`}
        <div class="ft-grid">${block.fields.map((field) => fieldHtml(block, field, values)).join('')}</div></div>`).join('')}
    </fieldset>`).join('')}
    ${(content.repeat_groups || []).map((group) => `<section class="ft-repeat" aria-label="${escapeHtml(group.title || 'Thông tin bổ sung')}" data-repeat="${escapeHtml(group.key)}" data-schema="${escapeHtml(JSON.stringify(group))}">
      <div data-repeat-rows></div>
      <button type="button" class="ft-btn" data-repeat-add>+ Thêm ${escapeHtml(repeatItemLabel(group))}</button></section>`).join('')}
  </div>`;
}

function repeatRow(group, index) {
  const label = repeatItemLabel(group);
  return `<div class="ft-repeat-row" data-item-label="${escapeHtml(label[0].toLocaleUpperCase('vi') + label.slice(1))}"><div class="ft-grid">${group.fields.map((field) => fieldHtml({ instance_id: `group_${group.key}_${index}` }, field, {})).join('')}</div><button type="button" class="ft-btn ft-btn--sm" data-repeat-remove>Xóa ${escapeHtml(label)}</button></div>`;
}

document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-repeat-add]');
  const remove = event.target.closest('[data-repeat-remove]');
  if (remove) {
    const group = remove.closest('[data-repeat]');
    remove.closest('.ft-repeat-row').remove();
    group.querySelector('[data-repeat-add]').focus();
    group.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (!add) return;
  const group = add.closest('[data-repeat]');
  const rows = group.querySelector('[data-repeat-rows]');
  if (rows.children.length >= 100) return;
  group.dataset.nextIndex = String(Number(group.dataset.nextIndex || 1) + 1);
  rows.insertAdjacentHTML('beforeend', repeatRow(JSON.parse(group.dataset.schema), Number(group.dataset.nextIndex)));
  rows.lastElementChild.querySelector('input, select, textarea')?.focus();
  group.dispatchEvent(new Event('input', { bubbles: true }));
});

export const readGroups = (root) => Object.fromEntries([...root.querySelectorAll('[data-repeat]')].map((group) => [group.dataset.repeat,
  [...group.querySelectorAll('.ft-repeat-row')].map((row) => Object.fromEntries([...row.querySelectorAll('[name]')].map((input) => [input.name.split('.').pop(), input.value])))
]));

export const readValues = (root) => Object.fromEntries([...root.querySelectorAll('[name*="."]')].map((el) => [el.name, el.value]));

// Hiện lỗi cạnh từng ô; trả về số ô lỗi và đưa con trỏ tới ô lỗi đầu tiên.
export function showErrors(root, errors) {
  root.querySelectorAll('[name*="."]').forEach((el) => {
    const message = errors[el.name] || '';
    el.toggleAttribute('aria-invalid', Boolean(message));
    document.getElementById(`${el.id}-error`).textContent = message;
  });
  const first = root.querySelector('[aria-invalid]');
  first?.focus();
  return Object.keys(errors).length;
}

// ===== Tự điền từ hồ sơ công dân (GET /api/users/me/citizen-profile → CitizenProfileOut) =====
const joinAddress = (address) => (address ? [address.detail, address.ward, address.province].filter(Boolean).join(', ') : '');
// Khóa autofill → giá trị lấy từ hồ sơ. Bảng này chép sang docs/form-template-api-contract.md.
export const profileValues = (profile) => ({
  'profile.full_name': profile.full_name,
  'profile.dob': profile.date_of_birth,
  'profile.birth_year': String(profile.date_of_birth || '').slice(0, 4),
  'profile.gender': profile.gender,
  'profile.cccd_number': profile.id_number,
  'profile.cccd_issue_date': profile.issue_date,
  'profile.cccd_issue_place': profile.issue_place,
  'profile.permanent_address': joinAddress(profile.permanent_address),
  'profile.current_address': joinAddress(profile.current_same_as_permanent ? profile.permanent_address : profile.current_address),
  'profile.phone': profile.phone,
  'profile.email': profile.email,
  'profile.tax_code': profile.tax_code
});

// Các thẻ có trường tự điền, theo thứ tự trong mẫu: [{ instance_id, label }] (label = "<mục> · <thẻ>").
export const autofillTargets = (content) => sorted(content.sections).flatMap((section) => sorted(section.blocks)
  .filter((block) => block.fields.some((field) => field.autofill))
  .map((block) => ({ instance_id: block.instance_id, label: `${section.title} · ${blockTitle(block)}` })));

// Thẻ "người làm đơn" được tự điền cùng nhau: thẻ đã chọn và các thẻ tự điền khác cùng mục với nó
// (vd "Thông tin cá nhân" + "Số điện thoại" của Bên A), nhưng không đụng tới mục khác (Bên B).
// Thẻ cùng loại xuất hiện nhiều lần trong một mục thì chỉ điền đúng thẻ đã chọn. → số ô đã điền.
export function applyAutofill(root, content, instanceId, profile) {
  const values = profileValues(profile);
  const section = content.sections.find((s) => s.blocks.some((block) => block.instance_id === instanceId));
  const count = (key) => section.blocks.filter((block) => block.block_key === key).length;
  let filled = 0;
  section.blocks.filter((block) => block.instance_id === instanceId || count(block.block_key) === 1).forEach((block) => block.fields.forEach((field) => {
    const value = field.autofill && values[field.autofill];
    const el = root.querySelector(`[name="${CSS.escape(`${block.instance_id}.${field.key}`)}"]`);
    if (!value || !el) return;
    el.value = value;
    el.readOnly = true;
    el.dataset.profileLocked = 'true';
    el.title = 'Thông tin từ tài khoản đã đăng ký; cập nhật trong Tài khoản.';
    filled += 1;
  }));
  return filled;
}

// ===== Bản in A4 =====
const formatValue = (field, value) => (value && inputKind(field.type) === 'date' ? value.split('-').reverse().join('/') : value);
const dotted = '<span class="ft-dots" aria-hidden="true"></span>';

// Phần đầu dùng chung: "Mẫu số ..." góc phải (khi mẫu có mã), quốc hiệu, tiêu ngữ có gạch chân ngắn.
export const printHeader = (code) => `<header class="ftp-header">
  ${code ? `<p class="ftp-code">Mẫu số ${escapeHtml(code)}</p>` : ''}
  <p class="ftp-nation">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
  <p class="ftp-motto">Độc lập - Tự do - Hạnh phúc</p>
</header>`;

// Phần ký dùng chung, góc phải cuối trang.
export const printSignature = () => `<footer class="ftp-sign">
  <p class="ftp-date">……, ngày … tháng … năm ……</p>
  <p class="ftp-signer">NGƯỜI LÀM ĐƠN</p>
  <p class="ftp-hint">(Ký, ghi rõ họ tên)</p>
</footer>`;

export function renderPrint(content, values) {
  return `<article class="ftp-page">
    ${printHeader(content.code)}
    <h1 class="ftp-title">${escapeHtml(content.name)}</h1>
    ${sorted(content.sections).map((section) => `<section class="ftp-section"><h2>${escapeHtml(section.title)}</h2>
      ${sorted(section.blocks).flatMap((block) => block.fields.map((field) => {
        const value = formatValue(field, values[`${block.instance_id}.${field.key}`]);
        return `<p class="ftp-line"><span class="ftp-label">${escapeHtml(field.label)}:</span> ${value ? `<span class="ftp-value">${escapeHtml(value)}</span>` : dotted}</p>`;
      })).join('')}</section>`).join('')}
    ${printSignature()}
  </article>`;
}
