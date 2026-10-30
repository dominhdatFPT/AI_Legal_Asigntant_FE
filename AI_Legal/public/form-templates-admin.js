// =============================================================================
// "THÊM MẪU ĐƠN" DÙNG CHUNG CHO TRANG HỒ SƠ ĐẤT ĐAI (/land-forms) VÀ HỘ KINH DOANH (/business-form-templates).
// Trang chỉ cần: nút #add-template-card, vùng #ft-app (danh sách mẫu của trang) và
//   <script type="module" src="/form-templates-admin.js" data-domains="dat_dai|ho_kinh_doanh,doanh_nghiep"></script>
// Danh sách mẫu (lọc theo lĩnh vực của trang) nằm trong trang; khung dựng mẫu + Tổng hợp là một trang riêng dùng chung
// /form-templates/editor, có vùng #ftb-page thay cho #ft-app. Mẫu đang sửa nằm trong sessionStorage nên URL luôn gọn và tải lại vẫn đúng mẫu.
// Không lưu tạm vào localStorage/sessionStorage: rời trang khi chưa lưu nháp là mất, nên có hộp thoại cảnh báo
// (beforeunload + chặn bấm link + khi đóng khung).
// =============================================================================
import { formTemplates, DOMAINS, STATUSES, PROCEDURE_PREFIX, USE_MOCK } from '/form-template-service.js';
import { FREE_BLOCK_KEY, snapshotBlock, blockTitle, checkTemplate } from '/form-blocks.js';
import { renderForm, initTableResizers, readValues } from '/form-renderer.js';
import { escapeHtml, fetchProcedureNames, formatDate } from '/auth-api.js';
import { mountDocEditor, renderDocPreview, sectionsFromDoc } from '/form-doc-editor.js';

const listRoot = document.getElementById('ft-app');
const app = document.getElementById('ftb-page');
const legacy = new URLSearchParams(location.search); // link cũ ?id/?domain/?from: đọc một lần rồi trả về URL gọn
if (app && location.search) history.replaceState(null, '', location.pathname);
const PAGE_DOMAINS = (document.querySelector('script[src="/form-templates-admin.js"]')?.dataset.domains || 'dat_dai').split(',');
const pageDomains = Object.fromEntries(Object.entries(DOMAINS).filter(([key]) => PAGE_DOMAINS.includes(key)));
const LIST_PAGES = ['/land-forms', '/business-form-templates'];
const EDITOR_URL = '/form-templates/editor';
const TEMPLATE_KEY = 'ftEditorTemplateId';
const FLASH_KEY = 'ftFlash';
const stored = (key) => { try { return sessionStorage.getItem(key); } catch { return null; } };
const store = (key, value) => {
  try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); } catch { /* trình duyệt chặn: mở mẫu mới */ }
};
const openNewTemplate = () => { store(TEMPLATE_KEY, null); location.assign(EDITOR_URL); };
const openTemplate = (id, flash) => { store(TEMPLATE_KEY, id); store(FLASH_KEY, flash); location.assign(EDITOR_URL); };
// Về đúng trang danh sách vừa bấm; mở thẳng URL thì về theo lĩnh vực đang chọn.
const opener = document.referrer ? new URL(document.referrer) : null;
const listUrl = () => {
  const from = legacy.get('from') || (opener?.origin === location.origin ? opener.pathname : '');
  return LIST_PAGES.includes(from) ? from : editor?.content.domain === 'dat_dai' ? '/land-forms' : '/business-form-templates';
};
const filters = { domain: '', status: '', includeDeleted: false };
let editor = null; // { id, version, status, content, selected, dirty, tab }
let procedures = null; // [{ id, code, name }] hoặc 'unavailable' (khi đó nhập tay mã thủ tục)
const options = (map, selected, empty) => `${empty ? `<option value="">${empty}</option>` : ''}${Object.entries(map)
  .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}`;

// ===== Thông báo + hộp thoại xác nhận =====
document.body.insertAdjacentHTML('beforeend', `<div class="ft-toast" role="status" aria-live="polite" hidden></div>
<dialog class="ft-dialog" aria-labelledby="ft-dialog-title"><h2 id="ft-dialog-title"></h2><p></p>
  <div class="ft-dialog__actions"><button type="button" class="ft-btn" value="cancel">Ở lại</button><button type="button" class="ft-btn ft-btn--primary" value="ok"></button></div></dialog>`);
const toastEl = document.querySelector('.ft-toast');
let toastTimer;
const toast = (message, isError = false) => {
  toastEl.textContent = message;
  toastEl.classList.toggle('is-error', isError);
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, isError ? 7000 : 3500);
};
// Thông báo cho thao tác vừa chuyển trang.
const FLASH = {
  published: 'Đã xuất bản mẫu đơn thành công vào hệ thống thủ tục.',
  new_version: 'Đã tạo bản nháp mới. Bản cũ vẫn giữ nguyên cho tới khi xuất bản bản mới.'
};
if (FLASH[stored(FLASH_KEY)]) toast(FLASH[stored(FLASH_KEY)]);
store(FLASH_KEY, null);
const dialog = document.querySelector('.ft-dialog');
const confirmDialog = (title, message, okLabel, cancelLabel = 'Hủy', variant = 'primary') => new Promise((resolve) => {
  dialog.querySelector('h2').textContent = title;
  dialog.querySelector('p').textContent = message;
  const okBtn = dialog.querySelector('[value="ok"]');
  const cancelBtn = dialog.querySelector('[value="cancel"]');
  okBtn.textContent = okLabel;
  cancelBtn.textContent = cancelLabel;
  okBtn.className = `ft-btn ${variant === 'danger' ? 'ft-btn--danger-action' : 'ft-btn--primary'}`;
  cancelBtn.className = 'ft-btn ft-btn--secondary-action';
  const done = (value) => { dialog.close(); resolve(value); };
  okBtn.onclick = () => done(true);
  cancelBtn.onclick = () => done(false);
  dialog.oncancel = (event) => { event.preventDefault(); done(false); };
  dialog.showModal();
  cancelBtn.focus();
});
const confirmLeave = () => confirmDialog('Rời khỏi trang dựng mẫu?', 'Mẫu đơn có thay đổi chưa lưu nháp. Nếu rời đi, các thay đổi này sẽ mất.', 'Rời đi, bỏ thay đổi', 'Ở lại chỉnh sửa', 'danger');

// ===== Chặn rời trang khi chưa lưu =====
window.addEventListener('beforeunload', (event) => {
  if (!editor?.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});
let leaveConfirmed = false;
document.addEventListener('click', async (event) => {
  const link = event.target.closest('a[href]');
  if (!link || !editor?.dirty || leaveConfirmed || link.target === '_blank') return;
  event.preventDefault();
  event.stopPropagation();
  if (!(await confirmLeave())) return;
  editor.dirty = false;
  leaveConfirmed = true;
  link.click(); // bấm lại để link chạy đúng xử lý vốn có (vd hộp thoại Đăng xuất)
  leaveConfirmed = false;
}, true);

// ===== Danh sách mẫu =====
function rowActions(row) {
  const button = (action, label, extra = '') => `<button type="button" class="ft-btn ft-btn--sm ${extra}" data-row-act="${action}" data-id="${row.id}">${label}</button>`;
  if (row.deleted_at) {
    return [
      button('restore', 'Khôi phục'),
      button('delete', 'Xóa vĩnh viễn', 'ft-btn--danger')
    ].join('');
  }
  return [
    button('edit', row.status === 'draft' ? 'Sửa' : 'Sửa (tạo bản mới)'),
    ['draft', 'hidden'].includes(row.status) ? button('publish', 'Xuất bản', 'ft-btn--primary') : '',
    row.status === 'published' ? button('hide', 'Ẩn') : '',
    button('delete', 'Xóa', 'ft-btn--danger')
  ].join('');
}

function renderList() {
  listRoot.innerHTML = `<section class="ftl" aria-labelledby="ftl-title">
    <div class="ftl__head"><div><h2 id="ftl-title">Mẫu đơn dựng từ thư viện thẻ · ${Object.values(pageDomains).join(', ')}</h2>
      <p class="ft-muted">Danh sách các mẫu đơn dùng chung đã tạo và xuất bản.${USE_MOCK ? ' <strong>(Chế độ thử nghiệm - dữ liệu lưu trên trình duyệt)</strong>' : ''}</p></div>
      <button type="button" class="ft-btn ft-btn--primary" data-act="new">+ Thêm mẫu đơn</button></div>
    <div class="ftl__filters">
      ${PAGE_DOMAINS.length > 1 ? `<label>Lĩnh vực<select data-filter="domain">${options(pageDomains, filters.domain, 'Tất cả lĩnh vực')}</select></label>` : ''}
      <label>Trạng thái<select data-filter="status">${options(STATUSES, filters.status, 'Tất cả trạng thái')}</select></label>
      <label class="ft-check"><input type="checkbox" data-filter="includeDeleted"${filters.includeDeleted ? ' checked' : ''}> Hiện cả mẫu đã xóa</label>
    </div>
    <div class="ftl__scroll"><table><thead><tr><th scope="col">Tên mẫu</th><th scope="col">Thủ tục đại diện</th><th scope="col">Lĩnh vực</th><th scope="col">Phiên bản</th><th scope="col">Trạng thái</th><th scope="col">Cập nhật</th><th scope="col"><span class="sr-only">Thao tác</span></th></tr></thead>
      <tbody id="ftl-rows"><tr><td colspan="6" class="ft-muted">Đang tải…</td></tr></tbody></table></div>
  </section>`;
  loadRows();
}

async function loadRows() {
  const tbody = document.getElementById('ftl-rows');
  try {
    const domain = filters.domain || (PAGE_DOMAINS.length === 1 ? PAGE_DOMAINS[0] : '');
    const items = (await formTemplates.listAdmin({ ...filters, domain })).items.filter((row) => PAGE_DOMAINS.includes(row.domain));
    tbody.innerHTML = items.length ? items.map((row) => `<tr${row.deleted_at ? ' class="is-deleted"' : ''}>
      <td><strong>${escapeHtml(row.name)}</strong>${row.content.code ? `<div class="ft-muted">Mẫu số ${escapeHtml(row.content.code)}</div>` : ''}</td>
      <td>${row.procedure_id ? `<span class="ft-badge" style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;font-weight:600;">${escapeHtml(row.procedure_id)}</span>` : '<span class="ft-muted">—</span>'}</td>
      <td>${escapeHtml(DOMAINS[row.domain] || row.domain)}</td>
      <td>v${row.version}</td>
      <td><span class="ft-badge ft-badge--${row.status}">${STATUSES[row.status] || row.status}</span>${row.deleted_at ? ' <span class="ft-badge ft-badge--deleted">Đã xóa</span>' : ''}</td>
      <td>${formatDate(row.updated_at)}</td>
      <td><div class="ftl__actions">${rowActions(row)}</div></td></tr>`).join('')
      : '<tr><td colspan="6" class="ft-muted">Chưa có mẫu nào khớp bộ lọc.</td></tr>';
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" role="alert">Không tải được danh sách mẫu. ${escapeHtml(error.message)}</td></tr>`;
  }
}

async function rowAction(action, id) {
  try {
    if (action === 'edit') {
      const row = await formTemplates.getAdmin(id);
      if (row.status === 'draft') return openTemplate(id);
      const draft = await formTemplates.newVersion(id);
      return openTemplate(draft.id, 'new_version');
    }
    if (action === 'delete') {
      const allItems = (await formTemplates.listAdmin({ includeDeleted: true })).items;
      const target = allItems.find(it => it.id === id);
      const isPermanent = target && Boolean(target.deleted_at);
      const title = isPermanent ? 'Xóa vĩnh viễn khỏi Database?' : 'Xóa mẫu đơn?';
      const desc = isPermanent
        ? 'Mẫu đơn này sẽ bị XÓA HOÀN TOÀN KHỎI DATABASE và không thể khôi phục lại. Bạn có chắc chắn muốn xóa?'
        : 'Mẫu sẽ bị ẩn khỏi mọi danh sách. Có thể khôi phục lại từ bộ lọc "Hiện cả mẫu đã xóa".';
      const btnText = isPermanent ? 'Xóa vĩnh viễn' : 'Xóa mẫu';
      if (!(await confirmDialog(title, desc, btnText))) return;
      await formTemplates.remove(id);
      toast(isPermanent ? 'Đã xóa vĩnh viễn mẫu đơn khỏi Database.' : 'Đã chuyển mẫu đơn vào danh sách đã xóa.');
      loadRows();
      return;
    }
    const messages = { publish: 'Đã xuất bản mẫu. Phiên bản cũ (nếu có) chuyển sang lưu trữ.', hide: 'Đã ẩn mẫu khỏi công dân.', restore: 'Đã khôi phục mẫu.' };
    await formTemplates[action](id);
    toast(messages[action]);
    loadRows();
  } catch (error) {
    toast(error.message, true);
  }
}

// ===== Khung dựng mẫu =====
function openEditor(row) {
  const initialContent = row ? structuredClone(row.content)
    : { schema_version: 1, name: '', code: '', domain: DOMAINS[legacy.get('domain')] ? legacy.get('domain') : '', procedure_id: null, sections: [{ id: 'sec_1', title: '', order: 1, blocks: [] }] };
  if (!row) {
    initialContent.proc_mode = 'new';
    initialContent.new_proc_code = getSuggestedProcedureCode(initialContent.domain);
    initialContent.new_proc_name = '';
  } else {
    initialContent.proc_mode = initialContent.procedure_id ? 'existing' : 'none';
  }
  editor = {
    id: row?.id ?? null, version: row?.version ?? 1, status: row?.status ?? 'draft', dirty: false, tab: 'build',
    content: initialContent
  };
  renderEditor();
  app.querySelector('[data-info="name"]')?.focus();
}

function closeEditor(flash) {
  editor.dirty = false;
  store(TEMPLATE_KEY, null);
  store(FLASH_KEY, flash);
  location.assign(listUrl());
}

// Bản JSON gửi BE: thứ tự theo vị trí hiện tại.
const serialize = () => {
  const content = structuredClone(editor.content);
  content.sections = deriveSections();
  content.name = content.name.trim();
  content.code = content.code?.trim() || '';
  const mode = editor.content.proc_mode || (editor.content.procedure_id ? 'existing' : 'new');
  if (mode === 'new') {
    const pCode = (editor.content.new_proc_code || getSuggestedProcedureCode(editor.content.domain)).trim().toUpperCase();
    const pName = (editor.content.new_proc_name || (editor.content.name ? `Thủ tục ${editor.content.name}` : '')).trim();
    content.procedure_id = pCode;
    content.new_procedure = { code: pCode, name: pName, domain: content.domain };
  } else if (mode === 'existing') {
    content.procedure_id = editor.content.procedure_id || null;
    content.new_procedure = null;
  } else {
    content.procedure_id = null;
    content.new_procedure = null;
  }
  content.sections.forEach((section, i) => {
    section.order = i + 1;
    section.title = section.title.trim();
    section.blocks.forEach((block, j) => {
      block.order = j + 1;
      if (block.block_key === FREE_BLOCK_KEY) {
        block.fields[0].label = block.fields[0].label.trim();
      }
    });
  });
  return content;
};

const statusText = () => `Phiên bản ${editor.version} · ${STATUSES[editor.status]} · ${editor.dirty ? 'Có thay đổi chưa lưu' : editor.id ? 'Đã lưu' : 'Chưa lưu'}`;
const markDirty = () => {
  editor.dirty = true;
  const status = document.getElementById('ftb-status');
  if (status) { status.textContent = statusText(); status.classList.add('is-dirty'); }
};

function getSuggestedProcedureCode(domain) {
  const prefix = PROCEDURE_PREFIX[domain];
  if (!prefix) return ''; // chưa chọn lĩnh vực
  const list = Array.isArray(procedures) ? procedures : [];
  const numbers = list
    .filter((p) => p.code && p.code.startsWith(prefix))
    .map((p) => {
      const m = p.code.replace(prefix, '').match(/^(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    });
  const max = numbers.length ? Math.max(...numbers) : 17;
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function procedureControl() {
  const mode = editor.content.proc_mode || (editor.content.procedure_id ? 'existing' : 'new');
  const code = editor.content.new_proc_code || getSuggestedProcedureCode(editor.content.domain);
  const name = editor.content.new_proc_name || (editor.content.name ? `Thủ tục ${editor.content.name}` : '');
  const existingValue = editor.content.procedure_id || '';
  const list = (Array.isArray(procedures) ? procedures : []).filter((item) => item.code?.startsWith(PROCEDURE_PREFIX[editor.content.domain]));

  const dupProc = mode === 'new' && code ? (Array.isArray(procedures) ? procedures : []).find(p => p.code?.toUpperCase() === code.trim().toUpperCase()) : null;

  return `<div class="ftb-proc-control">
    <div class="ftb-proc-modes">
      <label class="ftb-proc-mode-card${mode === 'new' ? ' is-active' : ''}">
        <input type="radio" name="proc_mode" value="new"${mode === 'new' ? ' checked' : ''}>
        <span><strong>★ Tạo thủ tục mới</strong> (Tờ đơn này đại diện chính)</span>
      </label>
      <label class="ftb-proc-mode-card${mode === 'existing' ? ' is-active' : ''}">
        <input type="radio" name="proc_mode" value="existing"${mode === 'existing' ? ' checked' : ''}>
        <span>Chọn thủ tục đã có</span>
      </label>
      <label class="ftb-proc-mode-card${mode === 'none' ? ' is-active' : ''}">
        <input type="radio" name="proc_mode" value="none"${mode === 'none' ? ' checked' : ''}>
        <span>Không liên kết</span>
      </label>
    </div>

    ${mode === 'new' ? `
      <div class="ftb-proc-new-box">
        <div class="ftb-proc-new-grid">
          <label class="ftb-proc-field" style="width: 160px;">
            <span class="ftb-proc-label">MÃ THỦ TỤC</span>
            <input data-info="new_proc_code" value="${escapeHtml(code)}" placeholder="vd: DD-018" style="font-weight:700;letter-spacing:.05em;${dupProc ? ';border-color:#b91c1c;background:#fff5f5;color:#991b1b;' : ''}">
          </label>
          <label class="ftb-proc-field" style="flex:1;min-width:240px;">
            <span class="ftb-proc-label">TÊN THỦ TỤC HÀNH CHÍNH CÔNG</span>
            <input data-info="new_proc_name" value="${escapeHtml(name)}" placeholder="vd: Thủ tục ${escapeHtml(editor.content.name || 'cho thuê mặt bằng...')}">
          </label>
        </div>
        ${dupProc ? `
          <div class="ft-alert ftb-proc-dup-alert" role="alert" style="margin:4px 0 0;padding:8px 12px;font-size:13px;border-left:3px solid #b91c1c;background:#fef2f2;color:#991b1b;">
            <strong>⚠️ Trùng mã thủ tục:</strong> Mã <code>${escapeHtml(code)}</code> đã thuộc về <em>"${escapeHtml(dupProc.name)}"</em>. Vui lòng nhập mã khác hoặc chuyển sang "Chọn thủ tục đã có".
          </div>
        ` : ''}
        <p class="ftb-proc-hint">Khi xuất bản, hệ thống sẽ đăng ký thủ tục mới này vào Cổng Dịch vụ công. Tờ đơn này là biểu mẫu chính để công dân nộp hồ sơ.</p>
      </div>
    ` : mode === 'existing' ? `
      <div style="max-width: 500px;">
        <select data-info="procedure_id"${procedures ? '' : ' disabled'}>
          <option value="">${procedures ? '— Chọn thủ tục liên kết —' : 'Đang tải danh mục thủ tục…'}</option>
          ${list.map((item) => `<option value="${escapeHtml(item.id || item.code)}"${(item.id === existingValue || item.code === existingValue) ? ' selected' : ''}>${escapeHtml(`${item.code} · ${item.name}`)}</option>`).join('')}
        </select>
      </div>
    ` : `
      <p class="ft-muted" style="margin:2px 0 0;font-size:13px;">Mẫu đơn này chỉ lưu nội bộ trên hệ thống quản trị, không liên kết với thủ tục hành chính công nào.</p>
    `}
  </div>`;
}

function buildView() {
  const { content } = editor;
  return `<div class="ftb__card"><h2>a. Thông tin chung</h2>
    <div class="ftb__info">
      <label style="flex:2;"><span>Tên mẫu <span class="ft-req" aria-hidden="true">*</span></span><input data-info="name" value="${escapeHtml(content.name)}" required aria-required="true" placeholder="vd: Hợp đồng ủy quyền"></label>
      <label style="flex:1;">Mã mẫu<input data-info="code" value="${escapeHtml(content.code || '')}" placeholder="vd: 09/ĐK (không bắt buộc)"></label>
      <label style="flex:1;"><span>Lĩnh vực <span class="ft-req" aria-hidden="true">*</span></span><select data-info="domain" required aria-required="true" aria-describedby="ftb-domain-error">${options(DOMAINS, content.domain, '— Chọn lĩnh vực —')}</select><small class="ftb__field-error" id="ftb-domain-error" hidden>Chọn lĩnh vực trước khi lưu.</small></label>
    </div>
    <div style="margin-top:14px;border-top:1px dashed var(--ft-line);padding-top:14px;">
      <div style="font-size:13px;font-weight:700;color:var(--ft-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Thủ tục hành chính liên kết</div>
      <div id="ftb-procedure">${procedureControl()}</div>
    </div>
  </div>`;
}

const previewView = () => `<div class="ftb__card"><div class="ftb__preview-bar"><div><h2>Tổng hợp</h2>
    <p class="ft-muted">Xem trước hình thức thể hiện của mẫu đơn trên hệ thống.</p></div>
    <div class="ftb__bar-actions"><button type="button" class="ft-btn" data-act="clear-preview">Xoá dữ liệu thử</button>
      <button type="button" class="ft-btn" data-act="back-edit">← Quay lại chỉnh sửa</button></div></div>
  <form novalidate onsubmit="return false">${renderForm(serialize(), previewValues)}</form></div>
  ${hasDocument() ? `<div class="ftb__card"><h2>Văn bản mẫu đơn (từ b. Soạn văn bản)</h2>
    <p class="ft-muted">Ô gạch chân là thẻ công dân sẽ điền.</p><div id="ftb-doc-preview"></div></div>` : ''}`;
// Tổng hợp: giá trị gõ vào form xem trước hiện ngay vào ô tương ứng của văn bản (ô có data-id = name của ô nhập).
function fillDocPreview(form, docPreview) {
  if (!form || !docPreview) return;
  form.querySelectorAll('[name*="."]').forEach((input) => {
    if (input.type === 'radio' && !input.checked) return;
    const shown = input.type === 'checkbox' ? (input.checked ? '☒' : '')
      : input.tagName === 'SELECT' ? (input.value ? input.selectedOptions[0].textContent : '')
      : /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value.split('-').reverse().join('/') : input.value.trim();
    docPreview.querySelectorAll(`.ql-field[data-id="${CSS.escape(input.name)}"]`).forEach((chip) => {
      chip.classList.toggle('has-value', Boolean(shown));
      (chip.querySelector('[contenteditable]') || chip).textContent = shown || ' ';
    });
  });
}
let previewValues = {};
const hasDocument = () => (editor.content.document?.ops || []).some((op) => typeof op.insert !== 'string' || op.insert.trim());

function renderEditor(focusSelector) {
  const title = editor.id ? `Sửa mẫu: ${escapeHtml(editor.content.name || 'chưa đặt tên')}` : 'Tạo mẫu đơn mới';
  app.innerHTML = `<div class="ftb">
    <div class="ftb__bar"><div><button type="button" class="ft-btn ft-btn--sm" data-act="back">← Đóng, về danh sách</button>
      <h1>${title}</h1><p class="ft-muted${editor.dirty ? ' is-dirty' : ''}" id="ftb-status" aria-live="polite">${statusText()}</p></div>
      <div class="ftb__tabs" role="tablist" aria-label="Bước dựng mẫu">
        <button type="button" role="tab" data-tab="build" aria-selected="${editor.tab === 'build'}">1. Dựng mẫu</button>
        <button type="button" role="tab" data-tab="preview" aria-selected="${editor.tab === 'preview'}">2. Tổng hợp</button></div>
      <div class="ftb__bar-actions"><button type="button" class="ft-btn" data-act="save">Lưu nháp</button>
        <button type="button" class="ft-btn ft-btn--primary" data-act="publish">Xác thực &amp; xuất bản</button></div></div>
    <div id="ftb-errors" tabindex="-1"></div>
    ${editor.tab === 'build' ? `${buildView()}<div class="ftb__card" id="ftb-doc"></div>` : previewView()}</div>`;
  if (editor.tab === 'build') attachDocCard();

  if (editor.tab === 'preview') {
    initTableResizers(app);
    const docPreview = app.querySelector('#ftb-doc-preview');
    const form = app.querySelector('.ftb__card form');
    if (docPreview) renderDocPreview(docPreview, editor.content.document, templateFields).then(() => fillDocPreview(form, docPreview));
    // Dữ liệu thử chỉ giữ trong phiên mở khung (qua lại giữa 2 tab), không vào content nên không lưu lên BE.
    const onFill = () => { previewValues = readValues(form); fillDocPreview(form, docPreview); };
    form?.addEventListener('input', onFill);
    form?.addEventListener('change', onFill);
  }

  if (focusSelector) app.querySelector(focusSelector)?.focus();
}

// ===== b. Soạn văn bản mẫu đơn (form-doc-editor.js): văn bản là nguồn chính của mẫu =====
// Văn bản lưu trong content.document = { ops, fields }. Các ô của mẫu (content.sections gửi BE, form ở Tổng hợp) sinh từ
// thẻ trong văn bản theo thứ tự xuất hiện; dòng đậm, không căn giữa, không có thẻ là tiêu đề mục.
// Khối của mẫu cũ (không phải thẻ văn bản) giữ nguyên: đặt đúng chỗ nếu có trong văn bản, không thì cuối mẫu, hiện ở "Thẻ của mẫu đã lưu".
let docCard = null;
let docApi = null;
const DOC_SECTION_TITLE = 'Nội dung mẫu đơn';
const DOC_BLOCK = /^doc_\d+$/; // instance_id thẻ văn bản: "doc_<n>", id thẻ = "doc_<n>.value" (trùng name ô ở Tổng hợp)
// Kiểu thẻ → kiểu ô BE; ô chọn/ô tích chưa có danh sách lựa chọn nên nhập chữ.
const DOC_FIELD_TYPE = { textarea: 'textarea', number: 'number', date: 'date', cccd: 'cccd', phone: 'phone', email: 'email' };
const oldBlocks = () => editor.content.sections.flatMap((section) => section.blocks).filter((block) => !DOC_BLOCK.test(block.instance_id));
const templateFields = () => oldBlocks().flatMap((block) => block.fields
  .filter((field) => !['static_text', 'table'].includes(field.type))
  .map((field) => ({ id: `${block.instance_id}.${field.key}`, name: `${block.instance_id}.${field.key}`, label: field.label || blockTitle(block), type: field.type, section: blockTitle(block) })));
function deriveSections() {
  const doc = editor.content.document || { ops: [], fields: [] };
  const docFields = new Map(doc.fields.map((field) => [field.id, field]));
  const rest = new Map(oldBlocks().map((block) => [block.instance_id, block]));
  const docBlock = (field) => ({ ...snapshotBlock(FREE_BLOCK_KEY, new Set(), { label: field.label, type: DOC_FIELD_TYPE[field.type] || 'text', required: field.required, width: 'full' }),
    instance_id: field.id.split('.')[0] });
  const sections = sectionsFromDoc(doc.ops).map((part) => ({ title: part.title, blocks: part.ids.flatMap((id) => {
    if (docFields.has(id)) return [docBlock(docFields.get(id))];
    const block = rest.get(id.split('.')[0]);
    rest.delete(id.split('.')[0]);
    return block ? [block] : [];
  }) })).filter((section) => section.blocks.length);
  if (rest.size || !sections.length) {
    if (!sections.length) sections.push({ title: DOC_SECTION_TITLE, blocks: [] });
    sections.at(-1).blocks.push(...rest.values());
  }
  return sections.map((section, i) => ({ ...section, id: `sec_${i + 1}`, order: i + 1, title: section.title || DOC_SECTION_TITLE }));
}
// Xoá thẻ của mẫu cũ khỏi mẫu (từ khung "Thẻ của mẫu đã lưu").
function removeTemplateField(id) {
  const [instanceId, key] = id.split('.');
  editor.content.sections = editor.content.sections.map((section) => ({ ...section, blocks: section.blocks
    .map((block) => (block.instance_id === instanceId ? { ...block, fields: block.fields.filter((field) => field.key !== key) } : block))
    .filter((block) => block.fields.length) }));
  markDirty();
}
// Mỗi lần vẽ lại khung thì gắn lại đúng phần tử trình soạn cũ, để không mất con trỏ/lịch sử hoàn tác.
function attachDocCard() {
  const slot = app.querySelector('#ftb-doc');
  if (docCard && docCard.owner === editor) {
    slot.replaceWith(docCard);
    docApi?.refresh();
    return;
  }
  docCard = slot;
  docCard.owner = editor;
  docApi = null;
  editor.content.document ??= { ops: [], fields: [] };
  mountDocEditor(slot, {
    doc: editor.content.document,
    templateFields,
    removeTemplateField,
    onChange: markDirty,
    templateName: () => editor.content.name || '',
    domain: () => editor.content.domain
  }).then((api) => { if (docCard === slot) docApi = api; });
}

async function requestClose() {
  if (editor?.dirty && !(await confirmLeave())) return;
  closeEditor();
}

function showDomainError(show) {
  const select = app.querySelector('[data-info="domain"]');
  if (!select) return;
  select.setAttribute('aria-invalid', String(show));
  select.nextElementSibling.hidden = !show;
}

async function save(shouldPublish = false) {
  const errBox = document.getElementById('ftb-errors');
  errBox.innerHTML = '';
  const payload = serialize();
  const errors = checkTemplate(payload);

  if (payload.new_procedure) {
    const np = payload.new_procedure;
    if (!np.code) {
      if (payload.domain) errors.push('Chưa nhập mã thủ tục mới.'); // chưa chọn lĩnh vực thì chưa có mã gợi ý, báo lĩnh vực là đủ
    } else {
      const dup = (Array.isArray(procedures) ? procedures : []).find(p => p.code?.toUpperCase() === np.code.toUpperCase());
      if (dup) {
        errors.push(`Mã thủ tục "${np.code}" đã tồn tại trên hệ thống ("${dup.name}"). Vui lòng chọn mã khác hoặc chuyển sang "Chọn thủ tục đã có".`);
      }
    }
    if (!np.name) {
      errors.push('Chưa nhập tên thủ tục hành chính công.');
    }
  }

  showDomainError(!payload.domain);
  if (errors.length) {
    errBox.innerHTML = `<div class="ft-alert" role="alert"><strong>Chưa thể lưu mẫu:</strong><ul>${errors.map((msg) => `<li>${escapeHtml(msg)}</li>`).join('')}</ul></div>`;
    errBox.focus();
    return;
  }
  setSaving(true, shouldPublish);
  try {
    const payload = serialize();
    let saved;
    if (editor.id) {
      if (editor.status !== 'draft') {
        const draft = await formTemplates.newVersion(editor.id);
        editor.id = draft.id;
        editor.version = draft.version;
        editor.status = 'draft';
      }
      saved = await (formTemplates.update || formTemplates.updateDraft)(editor.id, payload);
    } else {
      saved = await (formTemplates.create || formTemplates.createDraft)(payload);
      editor.id = saved.id;
    }
    store(TEMPLATE_KEY, editor.id); // tải lại trang thì mở đúng mẫu vừa lưu
    if (shouldPublish) {
      saved = await formTemplates.publish(saved.id);
      closeEditor('published');
      return;
    } else {
      toast(editor.version > 1 ? `Đã lưu bản nháp phiên bản v${saved.version}.` : 'Đã lưu bản nháp.');
    }
    editor.dirty = false;
    editor.version = saved.version;
    const status = document.getElementById('ftb-status');
    if (status) { status.textContent = statusText(); status.classList.remove('is-dirty'); }
  } catch (error) {
    errBox.innerHTML = `<div class="ft-alert" role="alert"><strong>Chưa lưu được mẫu.</strong> ${escapeHtml(error.message)}
      <p class="ft-alert__hint">Nội dung đang soạn vẫn còn trên trang. Kiểm tra kết nối rồi bấm "${shouldPublish ? 'Xác thực &amp; xuất bản' : 'Lưu nháp'}" lại sau ít phút.</p></div>`;
    errBox.focus();
  } finally {
    setSaving(false);
  }
}
// Trong lúc gửi: khoá 2 nút, nút vừa bấm hiện "Đang lưu…".
function setSaving(on, shouldPublish) {
  app.querySelectorAll('[data-act="save"], [data-act="publish"]').forEach((button) => {
    button.disabled = on;
    button.setAttribute('aria-busy', String(on));
    button.dataset.label ??= button.textContent;
    button.textContent = on && (button.dataset.act === 'publish') === Boolean(shouldPublish) ? 'Đang lưu…' : button.dataset.label;
  });
}

// ===== Xử lý sự kiện =====
listRoot?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-row-act]');
  if (btn) rowAction(btn.dataset.rowAct, btn.dataset.id);
});

const onClick = async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const tab = button.closest('[data-tab]');
  if (tab && editor) { editor.tab = tab.dataset.tab; return renderEditor(`[data-tab="${editor.tab}"]`); }
  const { act, id } = button.dataset;
  if (act === 'new') return openNewTemplate();
  if (act === 'back') return requestClose();
  if (act === 'back-edit') { editor.tab = 'build'; return renderEditor('[data-tab="build"]'); }
  if (act === 'clear-preview') { previewValues = {}; return renderEditor(); }
  if (act === 'save' || act === 'publish') return save(act === 'publish');
};
[listRoot, app].forEach((root) => root?.addEventListener('click', onClick));
document.getElementById('add-template-card')?.addEventListener('click', openNewTemplate);

app?.addEventListener('input', (event) => {
  const el = event.target;
  if (!editor) return;
  if (el.dataset.info && el.dataset.info !== 'domain') {
    editor.content[el.dataset.info] = el.value;
    if (el.dataset.info === 'name' && (editor.content.proc_mode || 'new') === 'new') {
      const procNameInput = app.querySelector('[data-info="new_proc_name"]');
      if (procNameInput && (!procNameInput.value || procNameInput.value.startsWith('Thủ tục '))) {
        procNameInput.value = el.value ? `Thủ tục ${el.value}` : '';
        editor.content.new_proc_name = procNameInput.value;
      }
    }
    if (el.dataset.info === 'new_proc_code') {
      editor.content.new_proc_code = el.value.trim().toUpperCase();
      const procEl = document.getElementById('ftb-procedure');
      const dup = el.value.trim() ? (Array.isArray(procedures) ? procedures : []).find(p => p.code?.toUpperCase() === el.value.trim().toUpperCase()) : null;
      let dupBox = procEl?.querySelector('.ftb-proc-dup-alert');
      if (dup) {
        el.style.borderColor = '#b91c1c';
        el.style.background = '#fff5f5';
        el.style.color = '#991b1b';
        if (!dupBox) {
          el.closest('.ftb-proc-new-grid')?.insertAdjacentHTML('afterend', `
            <div class="ft-alert ftb-proc-dup-alert" role="alert" style="margin:4px 0 0;padding:8px 12px;font-size:13px;border-left:3px solid #b91c1c;background:#fef2f2;color:#991b1b;">
              <strong>⚠️ Trùng mã thủ tục:</strong> Mã <code>${escapeHtml(el.value.trim().toUpperCase())}</code> đã thuộc về <em>"${escapeHtml(dup.name)}"</em>. Vui lòng nhập mã khác hoặc chuyển sang "Chọn thủ tục đã có".
            </div>
          `);
        } else {
          dupBox.innerHTML = `<strong>⚠️ Trùng mã thủ tục:</strong> Mã <code>${escapeHtml(el.value.trim().toUpperCase())}</code> đã thuộc về <em>"${escapeHtml(dup.name)}"</em>. Vui lòng nhập mã khác hoặc chuyển sang "Chọn thủ tục đã có".`;
        }
      } else {
        el.style.borderColor = '';
        el.style.background = '';
        el.style.color = '';
        dupBox?.remove();
      }
    }
  } else {
    return;
  }
  markDirty();
});

listRoot?.addEventListener('change', (event) => {
  const el = event.target;
  if (!el.dataset.filter) return;
  filters[el.dataset.filter] = el.type === 'checkbox' ? el.checked : el.value;
  loadRows();
});

app?.addEventListener('change', (event) => {
  const el = event.target;
  if (!editor) return;
  if (el.name === 'proc_mode') {
    editor.content.proc_mode = el.value;
    const procEl = document.getElementById('ftb-procedure');
    if (procEl) procEl.innerHTML = procedureControl();
    return markDirty();
  }
  if (el.dataset.info === 'domain') {
    editor.content.domain = el.value;
    editor.content.new_proc_code = getSuggestedProcedureCode(el.value);
    editor.content.procedure_id = null;
    document.getElementById('ftb-procedure').innerHTML = procedureControl();
    showDomainError(!el.value);
    docApi?.refreshLibrary();
    return markDirty();
  }
  if (el.dataset.info === 'procedure_id') { editor.content.procedure_id = el.value; return markDirty(); }
});

// ===== Khởi động =====
async function startEditor() {
  const id = legacy.get('id') || (legacy.has('domain') ? null : stored(TEMPLATE_KEY));
  store(TEMPLATE_KEY, id);
  if (!id) return openEditor(null);
  try {
    openEditor(await formTemplates.getAdmin(id));
  } catch (error) {
    store(TEMPLATE_KEY, null);
    app.innerHTML = `<div class="ft-alert" role="alert"><strong>Không mở được mẫu đơn.</strong> ${escapeHtml(error.message)}
      <p class="ft-alert__hint"><a href="${listUrl()}">Về danh sách mẫu</a></p></div>`;
  }
}
// Chờ danh sách thủ tục trước khi mở khung: mã thủ tục gợi ý cần biết các mã đã dùng.
if (app) {
  fetchProcedureNames('all')
    .then((items) => { procedures = items; })
    .catch(() => { procedures = 'unavailable'; })
    .finally(startEditor);
}


window.addEventListener('procedure:created', (e) => {
  const np = e.detail;
  if (!np || !np.code) return;
  if (!Array.isArray(procedures)) procedures = [];
  if (!procedures.find((p) => p.code === np.code)) {
    procedures.push({ id: np.code, code: np.code, name: np.name, domain: np.domain });
  }
});

if (listRoot) renderList();
