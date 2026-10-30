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

function getWidthClass(field, kind, block) {
  if (field.width === 'full') return ' ft-field--full';
  if (field.width === 'half') return ' ft-field--half';
  if (field.width === 'third') return ' ft-field--third';
  if (field.width === 'two_thirds') return ' ft-field--two_thirds';
  // Mặc định tự động: trường tự do, hoặc kiểu textarea, static_text, table, hoặc nhãn dài
  if (['textarea', 'static_text', 'table'].includes(kind)) return ' ft-field--full';
  if (block?.block_key === FREE_BLOCK_KEY) return ' ft-field--full';
  if ((field.label || '').length > 40) return ' ft-field--full';
  return '';
}

function fieldHtml(block, field, values) {
  const path = `${block.instance_id}.${field.key}`;
  const id = fieldId(path);
  const kind = inputKind(field.type);

  // 1. Trường văn bản điều luật / chỉ dẫn tĩnh (Static text) - KHÔNG sinh ô input
  if (kind === 'static_text') {
    return `<div class="ft-static-text" id="${id}">
      <div class="ft-static-text__content">${escapeHtml(field.label)}</div>
    </div>`;
  }

  // 2. Trường bảng biểu (Table)
  if (kind === 'table') {
    const config = field.table_config || {
      cols: [
        { id: 'c1', title: 'STT', width: 15 },
        { id: 'c2', title: 'Nội dung', width: 55 },
        { id: 'c3', title: 'Ghi chú', width: 30 }
      ],
      rows: 3,
      allow_add_row: true
    };
    const cols = config.cols || [];
    const colCount = cols.length;
    const initialRows = config.rows || 3;

    // Tìm dòng lớn nhất đã nhập trong values
    let maxRow = initialRows;
    Object.keys(values).forEach((k) => {
      const match = k.match(new RegExp(`^${path.replace(/\./g, '\\.')}_r(\\d+)_c`));
      if (match) maxRow = Math.max(maxRow, parseInt(match[1], 10));
    });

    return `<div class="ft-table-wrapper" id="${id}" data-table-path="${escapeHtml(path)}">
      ${field.label ? `<p class="ft-table-title">${escapeHtml(field.label)}</p>` : ''}
      <div class="ft-table-container">
        <table class="ft-table" data-cols="${colCount}">
          <colgroup>
            ${cols.map((c) => `<col style="width: ${c.width || Math.floor(100 / colCount)}%">`).join('')}
          </colgroup>
          <thead>
            <tr>
              ${cols.map((c, i) => `<th data-col-idx="${i}">
                <span>${escapeHtml(c.title || `Cột ${i + 1}`)}</span>
                ${i < colCount - 1 ? `<span class="ft-table-resizer" data-resizer="${i}" title="Kéo để chỉnh độ rộng cột"></span>` : ''}
              </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: maxRow }, (_, r) => `<tr>
              ${cols.map((c, ci) => {
                const cellPath = `${path}_r${r + 1}_c${ci + 1}`;
                const cellVal = escapeHtml(values[cellPath] ?? '');
                return `<td><input class="ft-table-input" name="${escapeHtml(cellPath)}" value="${cellVal}" placeholder="..." aria-label="${escapeHtml(c.title)} dòng ${r + 1}"></td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${config.allow_add_row !== false ? `<div class="ft-table-actions">
        <button type="button" class="ft-btn ft-btn--sm" data-table-act="add-row" data-target="${id}">+ Thêm hàng</button>
      </div>` : ''}
    </div>`;
  }

  // 3. Các trường nhập liệu thông thường
  const value = escapeHtml(values[path] ?? '');
  const common = `id="${id}" name="${escapeHtml(path)}" aria-describedby="${id}-error"${field.required ? ' required aria-required="true"' : ''}`;
  const control = kind === 'textarea' ? `<textarea ${common} rows="3">${value}</textarea>`
    : kind === 'select' ? `<select ${common}><option value="">— Chọn —</option>${(field.options || []).map((option) =>
      `<option${values[path] === option ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`
    : `<input ${common} type="${kind}" value="${value}"${field.type === 'phone' ? ' inputmode="tel" autocomplete="tel"' : field.type === 'email' ? ' inputmode="email" autocomplete="email"' : ['cccd', 'number'].includes(field.type) ? ' inputmode="numeric"' : ''}>`;
  
  const widthClass = getWidthClass(field, kind, block);
  return `<div class="ft-field${widthClass}">
    <label for="${id}">${escapeHtml(field.label)}${field.required ? ' <span class="ft-req" aria-hidden="true">*</span>' : ''}</label>
    ${control}<p class="ft-error" id="${id}-error"></p></div>`;
}

// Form điền mẫu. values: { path: giá trị } để giữ lại dữ liệu đã nhập khi vẽ lại.
export function renderForm(content, values = {}) {
  return `<div class="ft-form">
    <header class="ft-form__head"><h2>${escapeHtml(content.name || 'Mẫu đơn chưa đặt tên')}</h2>${content.code ? `<p>Mẫu số ${escapeHtml(content.code)}</p>` : ''}</header>
    ${sorted(content.sections).map((section) => `<fieldset class="ft-section">${section.title?.trim() ? `<legend>${escapeHtml(section.title)}</legend>` : ''}
      ${sorted(section.blocks).map((block) => `<div class="ft-block" data-instance="${escapeHtml(block.instance_id)}">
        ${block.block_key === FREE_BLOCK_KEY ? '' : `<p class="ft-block__title">${escapeHtml(blockTitle(block))}</p>`}
        <div class="ft-grid">${block.fields.map((field) => fieldHtml(block, field, values)).join('')}</div></div>`).join('')}
    </fieldset>`).join('')}
  </div>`;
}

export const readValues = (root) => Object.fromEntries([...root.querySelectorAll('[name*="."]')].map((el) => [el.name, el.value]));

// Hiện lỗi cạnh từng ô; trả về số ô lỗi và đưa con trỏ tới ô lỗi đầu tiên.
export function showErrors(root, errors) {
  root.querySelectorAll('[name*="."]').forEach((el) => {
    const message = errors[el.name] || '';
    el.toggleAttribute('aria-invalid', Boolean(message));
    const errEl = document.getElementById(`${el.id}-error`);
    if (errEl) errEl.textContent = message;
  });
  const first = root.querySelector('[aria-invalid]');
  first?.focus();
  return Object.keys(errors).length;
}

// Khởi tạo tính năng kéo giãn cột bảng biểu và thêm hàng
export function initTableResizers(root = document) {
  root.querySelectorAll('.ft-table').forEach((table) => {
    const colgroup = table.querySelector('colgroup');
    const cols = colgroup ? colgroup.querySelectorAll('col') : [];
    const headers = table.querySelectorAll('th');

    headers.forEach((th, idx) => {
      const resizer = th.querySelector('.ft-table-resizer');
      if (!resizer || resizer._hasListener) return;
      resizer._hasListener = true;

      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startX = e.pageX;
        const currentTh = th;
        const nextTh = headers[idx + 1];
        if (!nextTh) return;

        const tableWidth = table.getBoundingClientRect().width;
        const startW1 = currentTh.getBoundingClientRect().width;
        const startW2 = nextTh.getBoundingClientRect().width;
        resizer.classList.add('is-resizing');

        const onMouseMove = (moveEvent) => {
          const dx = moveEvent.pageX - startX;
          const minColWidth = 50; // Giữ tối thiểu 50px để người dùng luôn có ô nhập liệu
          let newW1 = startW1 + dx;
          let newW2 = startW2 - dx;

          if (newW1 < minColWidth) {
            newW1 = minColWidth;
            newW2 = startW1 + startW2 - minColWidth;
          } else if (newW2 < minColWidth) {
            newW2 = minColWidth;
            newW1 = startW1 + startW2 - minColWidth;
          }

          if (cols[idx] && cols[idx + 1]) {
            cols[idx].style.width = `${((newW1 / tableWidth) * 100).toFixed(2)}%`;
            cols[idx + 1].style.width = `${((newW2 / tableWidth) * 100).toFixed(2)}%`;
          }
        };

        const onMouseUp = () => {
          resizer.classList.remove('is-resizing');
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  });

  // Xử lý nút Thêm hàng cho bảng
  root.querySelectorAll('[data-table-act="add-row"]').forEach((btn) => {
    if (btn._hasListener) return;
    btn._hasListener = true;
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const wrapper = document.getElementById(targetId);
      if (!wrapper) return;
      const table = wrapper.querySelector('.ft-table');
      const tbody = table?.querySelector('tbody');
      const path = wrapper.dataset.tablePath;
      if (!tbody || !path) return;

      const currentRowCount = tbody.querySelectorAll('tr').length;
      const newRowIdx = currentRowCount + 1;
      const colHeaders = table.querySelectorAll('thead th');
      const tr = document.createElement('tr');

      colHeaders.forEach((th, ci) => {
        const td = document.createElement('td');
        const colTitle = th.querySelector('span')?.textContent || `Cột ${ci + 1}`;
        const input = document.createElement('input');
        input.className = 'ft-table-input';
        input.name = `${path}_r${newRowIdx}_c${ci + 1}`;
        input.placeholder = '...';
        input.setAttribute('aria-label', `${colTitle} dòng ${newRowIdx}`);
        td.appendChild(input);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
      tr.querySelector('input')?.focus();
    });
  });
}

// ===== Tự điền từ hồ sơ công dân =====
const joinAddress = (address) => (address ? [address.detail, address.ward, address.province].filter(Boolean).join(', ') : '');
export const profileValues = (profile) => ({
  'profile.full_name': profile.full_name,
  'profile.dob': profile.date_of_birth,
  'profile.cccd_number': profile.id_number,
  'profile.cccd_issue_date': profile.issue_date,
  'profile.cccd_issue_place': profile.issue_place,
  'profile.permanent_address': joinAddress(profile.permanent_address),
  'profile.current_address': joinAddress(profile.current_same_as_permanent ? profile.permanent_address : profile.current_address),
  'profile.phone': profile.phone,
  'profile.email': profile.email,
  'profile.tax_code': profile.tax_code
});

export const autofillTargets = (content) => sorted(content.sections).flatMap((section) => sorted(section.blocks)
  .filter((block) => block.fields.some((field) => field.autofill))
  .map((block) => ({ instance_id: block.instance_id, label: `${section.title} · ${blockTitle(block)}` })));

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
    filled += 1;
  }));
  return filled;
}

// ===== Bản in A4 =====
const formatValue = (field, value) => (value && inputKind(field.type) === 'date' ? value.split('-').reverse().join('/') : value);
const dotted = '<span class="ft-dots" aria-hidden="true"></span>';

export const printHeader = (code) => `<header class="ftp-header">
  ${code ? `<p class="ftp-code">Mẫu số ${escapeHtml(code)}</p>` : ''}
  <p class="ftp-nation">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
  <p class="ftp-motto">Độc lập - Tự do - Hạnh phúc</p>
</header>`;

export const printSignature = () => `<footer class="ftp-sign">
  <p class="ftp-date">……, ngày … tháng … năm ……</p>
  <p class="ftp-signer">NGƯỜI LÀM ĐƠN</p>
  <p class="ftp-hint">(Ký, ghi rõ họ tên)</p>
</footer>`;

export function renderPrint(content, values) {
  return `<article class="ftp-page">
    ${printHeader(content.code)}
    <h1 class="ftp-title">${escapeHtml(content.name)}</h1>
    ${sorted(content.sections).map((section) => `<section class="ftp-section">${section.title?.trim() ? `<h2>${escapeHtml(section.title)}</h2>` : ''}
      ${sorted(section.blocks).flatMap((block) => block.fields.map((field) => {
        const path = `${block.instance_id}.${field.key}`;
        if (field.type === 'static_text') {
          return `<div class="ftp-static">${escapeHtml(field.label)}</div>`;
        }
        if (field.type === 'table') {
          const config = field.table_config || { cols: [{ title: 'STT' }, { title: 'Nội dung' }], rows: 3 };
          const cols = config.cols || [];
          let maxRow = config.rows || 3;
          Object.keys(values).forEach((k) => {
            const match = k.match(new RegExp(`^${path.replace(/\./g, '\\.')}_r(\\d+)_c`));
            if (match) maxRow = Math.max(maxRow, parseInt(match[1], 10));
          });
          return `<div class="ftp-table-wrap">
            ${field.label ? `<p style="font-weight:700;margin:4pt 0;">${escapeHtml(field.label)}</p>` : ''}
            <table class="ftp-table">
              <thead><tr>${cols.map((c) => `<th>${escapeHtml(c.title)}</th>`).join('')}</tr></thead>
              <tbody>
                ${Array.from({ length: maxRow }, (_, r) => `<tr>
                  ${cols.map((c, ci) => `<td>${escapeHtml(values[`${path}_r${r + 1}_c${ci + 1}`] ?? '')}</td>`).join('')}
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
        }
        const value = formatValue(field, values[path]);
        return `<p class="ftp-line"><span class="ftp-label">${escapeHtml(field.label)}:</span> ${value ? `<span class="ftp-value">${escapeHtml(value)}</span>` : dotted}</p>`;
      })).join('')}</section>`).join('')}
    ${printSignature()}
  </article>`;
}
