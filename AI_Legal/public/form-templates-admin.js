// =============================================================================
// "THÊM MẪU ĐƠN" DÙNG CHUNG CHO TRANG HỒ SƠ ĐẤT ĐAI (/land-forms) VÀ HỘ KINH DOANH (/business-form-templates).
// Trang chỉ cần: nút #add-template-card, vùng #ft-app (danh sách mẫu của trang) và
//   <script type="module" src="/form-templates-admin.js" data-domains="dat_dai|ho_kinh_doanh,doanh_nghiep"></script>
// Danh sách mẫu (lọc theo lĩnh vực của trang) nằm trong trang; khung dựng mẫu + Tổng hợp mở thành lớp phủ toàn màn hình.
// Không lưu tạm vào localStorage/sessionStorage: rời trang khi chưa lưu nháp là mất, nên có hộp thoại cảnh báo
// (beforeunload + chặn bấm link + khi đóng khung). Kéo thả bằng HTML5; bàn phím dùng nút Lên/Xuống và ô "Chuyển sang mục".
// =============================================================================
import { formTemplates, DOMAINS, STATUSES, PROCEDURE_PREFIX, USE_MOCK } from '/form-template-service.js';
import { BLOCKS, FREE_TYPES, FREE_BLOCK_KEY, snapshotBlock, blockTitle, checkTemplate } from '/form-blocks.js';
import { renderForm } from '/form-renderer.js';
import { escapeHtml, fetchProcedureNames, formatDate } from '/auth-api.js';

const listRoot = document.getElementById('ft-app');
const PAGE_DOMAINS = (document.querySelector('script[src="/form-templates-admin.js"]')?.dataset.domains || 'dat_dai').split(',');
const pageDomains = Object.fromEntries(Object.entries(DOMAINS).filter(([key]) => PAGE_DOMAINS.includes(key)));
// Khung dựng mẫu: lớp phủ toàn màn hình trên trang hiện tại (không đổi route).
document.body.insertAdjacentHTML('beforeend', '<div class="ftb-overlay" role="dialog" aria-modal="true" aria-label="Thêm mẫu đơn" hidden></div>');
const app = document.querySelector('.ftb-overlay');
let lastTrigger = null;
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
  if (row.deleted_at) return button('restore', 'Khôi phục');
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
      <p class="ft-muted">Mẫu đã xuất bản hiện cho công dân ở trang "Làm đơn theo mẫu".${USE_MOCK ? ' <strong>Đang dùng dữ liệu thử (mock)</strong>, tải lại trang là mất.' : ''}</p></div>
      <button type="button" class="ft-btn ft-btn--primary" data-act="new">+ Thêm mẫu đơn</button></div>
    <div class="ftl__filters">
      ${PAGE_DOMAINS.length > 1 ? `<label>Lĩnh vực<select data-filter="domain">${options(pageDomains, filters.domain, 'Tất cả lĩnh vực')}</select></label>` : ''}
      <label>Trạng thái<select data-filter="status">${options(STATUSES, filters.status, 'Tất cả trạng thái')}</select></label>
      <label class="ft-check"><input type="checkbox" data-filter="includeDeleted"${filters.includeDeleted ? ' checked' : ''}> Hiện cả mẫu đã xóa</label>
    </div>
    <div class="ftl__scroll"><table><thead><tr><th scope="col">Tên mẫu</th><th scope="col">Lĩnh vực</th><th scope="col">Phiên bản</th><th scope="col">Trạng thái</th><th scope="col">Cập nhật</th><th scope="col"><span class="sr-only">Thao tác</span></th></tr></thead>
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
      if (row.status === 'draft') return openEditor(row);
      const draft = await formTemplates.newVersion(id);
      toast(`Đã tạo bản nháp phiên bản ${draft.version}. Bản cũ vẫn giữ nguyên cho tới khi xuất bản bản mới.`);
      return openEditor(draft);
    }
    if (action === 'delete' && !(await confirmDialog('Xóa mẫu đơn?', 'Mẫu sẽ bị ẩn khỏi mọi danh sách. Có thể khôi phục lại từ bộ lọc "Hiện cả mẫu đã xóa".', 'Xóa mẫu'))) return;
    const messages = { publish: 'Đã xuất bản mẫu. Phiên bản cũ (nếu có) chuyển sang lưu trữ.', hide: 'Đã ẩn mẫu khỏi công dân.', delete: 'Đã xóa mẫu.', restore: 'Đã khôi phục mẫu.' };
    await formTemplates[action === 'delete' ? 'remove' : action](id);
    toast(messages[action]);
    loadRows();
  } catch (error) {
    toast(error.message, true);
  }
}

// ===== Khung dựng mẫu =====
const allBlocks = () => editor.content.sections.flatMap((section) => section.blocks);
const findSection = (id) => editor.content.sections.find((section) => section.id === id);
const sectionOf = (instanceId) => editor.content.sections.find((section) => section.blocks.some((block) => block.instance_id === instanceId));
const nextSectionId = () => {
  let n = 1;
  while (findSection(`sec_${n}`)) n += 1;
  return `sec_${n}`;
};

function openEditor(row) {
  if (!row || !editor) lastTrigger = document.activeElement;
  editor = {
    id: row?.id ?? null, version: row?.version ?? 1, status: row?.status ?? 'draft', dirty: false, tab: 'build',
    content: row ? structuredClone(row.content)
      : { schema_version: 1, name: '', code: '', domain: PAGE_DOMAINS[0], procedure_id: null, sections: [{ id: 'sec_1', title: '', order: 1, blocks: [] }] }
  };
  editor.selected = editor.content.sections[0]?.id ?? null;
  app.hidden = false;
  document.documentElement.style.overflow = 'hidden'; // trang phía sau không cuộn theo
  renderEditor();
  app.scrollTop = 0;
  app.querySelector('[data-info="name"]')?.focus();
}

function closeEditor() {
  editor = null;
  app.hidden = true;
  app.innerHTML = '';
  document.documentElement.style.overflow = '';
  loadRows();
  lastTrigger?.focus();
}

// Bản JSON gửi BE (mục 4 của hợp đồng): thứ tự theo vị trí hiện tại.
const serialize = () => {
  const content = structuredClone(editor.content);
  content.name = content.name.trim();
  content.code = content.code?.trim() || '';
  content.procedure_id = content.procedure_id || null;
  content.sections.forEach((section, i) => {
    section.order = i + 1;
    section.title = section.title.trim();
    section.blocks.forEach((block, j) => {
      block.order = j + 1;
      if (block.block_key === FREE_BLOCK_KEY) block.fields[0].label = block.fields[0].label.trim();
    });
  });
  return content;
};

const statusText = () => `Phiên bản ${editor.version} · ${STATUSES[editor.status]} · ${editor.dirty ? 'Có thay đổi chưa lưu' : editor.id ? 'Đã lưu' : 'Chưa lưu'}`;
const markDirty = () => {
  editor.dirty = true;
  const status = document.getElementById('ftb-status');
  if (status) status.textContent = statusText();
};

function procedureControl() {
  const value = editor.content.procedure_id || '';
  if (procedures === 'unavailable') {
    return `<input data-info="procedure_id" value="${escapeHtml(value)}" placeholder="Nhập ID thủ tục (chưa tải được danh mục)">`;
  }
  const list = (procedures || []).filter((item) => item.code?.startsWith(PROCEDURE_PREFIX[editor.content.domain]));
  return `<select data-info="procedure_id"${procedures ? '' : ' disabled'}><option value="">${procedures ? '— Không liên kết —' : 'Đang tải danh mục thủ tục…'}</option>
    ${list.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === value ? ' selected' : ''}>${escapeHtml(`${item.code} · ${item.name}`)}</option>`).join('')}</select>`;
}

const blockSummary = (block) => block.fields.map((field) => field.label).join(' · ');

function blockItem(block, section, index) {
  const label = escapeHtml(blockTitle(block));
  const free = block.block_key === FREE_BLOCK_KEY ? block.fields[0] : null;
  return `<li class="ftb-blk" data-blk="${block.instance_id}">
    <span class="ftb-handle" draggable="true" title="Kéo để đổi chỗ hoặc chuyển sang mục khác" aria-hidden="true">⋮⋮</span>
    <div class="ftb-blk__main"><strong>${label}</strong><code>${block.instance_id}</code>
      ${free ? `<div class="ftb-blk__free">
        <input data-free-title="${block.instance_id}" value="${escapeHtml(free.label)}" placeholder="Tiêu đề ô (bắt buộc), vd: Lý do ủy quyền" aria-label="Tiêu đề ô của ${block.instance_id}" required>
        <select data-free-type="${block.instance_id}" aria-label="Kiểu ô của ${block.instance_id}">${options(FREE_TYPES, free.type)}</select></div>`
        : `<small>${escapeHtml(blockSummary(block))}</small>`}</div>
    <div class="ftb-blk__tools">
      <button type="button" class="ft-btn ft-btn--sm ft-icon-btn" data-act="blk-up" data-id="${block.instance_id}" aria-label="Đưa thẻ ${label} (${block.instance_id}) lên"${index === 0 ? ' disabled' : ''}>↑</button>
      <button type="button" class="ft-btn ft-btn--sm ft-icon-btn" data-act="blk-down" data-id="${block.instance_id}" aria-label="Đưa thẻ ${label} (${block.instance_id}) xuống"${index === section.blocks.length - 1 ? ' disabled' : ''}>↓</button>
      <select data-move-to="${block.instance_id}" aria-label="Chuyển thẻ ${block.instance_id} sang mục khác">
        <option value="">Chuyển sang…</option>${editor.content.sections.filter((other) => other !== section)
          .map((other, i) => `<option value="${other.id}">${escapeHtml(other.title || `Mục ${editor.content.sections.indexOf(other) + 1}`)}</option>`).join('')}</select>
      <button type="button" class="ft-btn ft-btn--sm ft-btn--danger" data-act="blk-del" data-id="${block.instance_id}" aria-label="Xóa thẻ ${block.instance_id}">Xóa</button>
    </div></li>`;
}

function sectionItem(section, index) {
  const count = editor.content.sections.length;
  const name = escapeHtml(section.title || `Mục ${index + 1}`);
  return `<li class="ftb-sec${section.id === editor.selected ? ' is-selected' : ''}" data-sec="${section.id}">
    <div class="ftb-sec__head">
      <span class="ftb-handle" draggable="true" title="Kéo để đổi thứ tự mục" aria-hidden="true">⋮⋮</span>
      <input data-sec-title="${section.id}" value="${escapeHtml(section.title)}" placeholder="Tên mục, vd: I. Bên ủy quyền" aria-label="Tên mục ${index + 1}">
      <button type="button" class="ft-btn ft-btn--sm" data-act="sec-select" data-id="${section.id}" aria-pressed="${section.id === editor.selected}">${section.id === editor.selected ? 'Đang chọn' : 'Chọn'}</button>
      <button type="button" class="ft-btn ft-btn--sm ft-icon-btn" data-act="sec-up" data-id="${section.id}" aria-label="Đưa mục ${name} lên"${index === 0 ? ' disabled' : ''}>↑</button>
      <button type="button" class="ft-btn ft-btn--sm ft-icon-btn" data-act="sec-down" data-id="${section.id}" aria-label="Đưa mục ${name} xuống"${index === count - 1 ? ' disabled' : ''}>↓</button>
      <button type="button" class="ft-btn ft-btn--sm ft-btn--danger" data-act="sec-del" data-id="${section.id}" aria-label="Xóa mục ${name}">Xóa mục</button>
    </div>
    <ul class="ftb-sec__blocks" data-drop-blocks="${section.id}" aria-label="Các thẻ trong mục ${name}">
      ${section.blocks.length ? section.blocks.map((block, i) => blockItem(block, section, i)).join('') : '<li class="ftb-sec__empty">Kéo thẻ từ thư viện vào đây, hoặc chọn mục này rồi bấm "Thêm".</li>'}
    </ul></li>`;
}

function buildView() {
  const { content } = editor;
  const selected = findSection(editor.selected);
  return `<div class="ftb__card"><h2>a. Thông tin chung</h2><div class="ftb__info">
      <label><span>Tên mẫu <span class="ft-req" aria-hidden="true">*</span></span><input data-info="name" value="${escapeHtml(content.name)}" required aria-required="true" placeholder="vd: Hợp đồng ủy quyền"></label>
      <label>Mã mẫu<input data-info="code" value="${escapeHtml(content.code || '')}" placeholder="vd: 09/ĐK (không bắt buộc)"></label>
      <label>Lĩnh vực<select data-info="domain">${options(pageDomains[content.domain] ? pageDomains : DOMAINS, content.domain)}</select></label>
      <label>Thủ tục liên kết<span id="ftb-procedure">${procedureControl()}</span></label>
    </div></div>
    <div class="ftb__work">
      <aside class="ftb__card ftb__lib" aria-labelledby="ftb-lib-title"><h2 id="ftb-lib-title">b. Thư viện thẻ</h2>
        <p class="ftb__target" id="ftb-target">Bấm "Thêm" để đưa vào: <strong>${escapeHtml(selected ? selected.title || `Mục ${content.sections.indexOf(selected) + 1}` : 'chưa chọn mục')}</strong></p>
        <ul class="ftb__lib-list">${BLOCKS.filter((block) => block.block_key !== FREE_BLOCK_KEY).map((block) => `<li class="ftb__lib-item" draggable="true" data-lib="${block.block_key}">
          <div><strong>${escapeHtml(block.name)}</strong><small>${escapeHtml(blockSummary(block))}</small></div>
          <button type="button" class="ft-btn ft-btn--sm" data-act="add-block" data-key="${block.block_key}" aria-label="Thêm thẻ ${escapeHtml(block.name)} vào mục đang chọn"${selected ? '' : ' disabled'}>Thêm</button></li>`).join('')}</ul>
        <div class="ftb__free"><strong>Trường tự do</strong><span class="ft-muted">Ô để công dân tự viết. Chỉ cần tiêu đề ô.</span>
          <label>Tiêu đề ô<input id="ftb-free-title" placeholder="vd: Lý do ủy quyền"></label>
          <label>Kiểu ô<select id="ftb-free-type">${options(FREE_TYPES, 'text')}</select></label>
          <button type="button" class="ft-btn ft-btn--sm" data-act="add-free"${selected ? '' : ' disabled'}>Thêm trường tự do</button></div>
      </aside>
      <section aria-labelledby="ftb-sections-title"><div class="ftb__card">
        <h2 id="ftb-sections-title">Các mục của mẫu</h2>
        <ol class="ftb__sections" data-drop-sections aria-label="Các mục, theo thứ tự">${content.sections.map(sectionItem).join('')}</ol>
        <p><button type="button" class="ft-btn" data-act="sec-add">+ Thêm mục</button></p></div></section>
    </div>`;
}

const previewView = () => `<div class="ftb__card"><div class="ftb__preview-bar"><div><h2>c. Tổng hợp</h2>
    <p class="ft-muted">Đây đúng là giao diện công dân sẽ thấy khi điền mẫu.</p></div>
    <button type="button" class="ft-btn" data-act="back-edit">← Quay lại chỉnh sửa</button></div>
  <form novalidate onsubmit="return false">${renderForm(serialize())}</form></div>`;

function renderEditor(focusSelector) {
  const title = editor.id ? `Sửa mẫu: ${escapeHtml(editor.content.name || 'chưa đặt tên')}` : 'Tạo mẫu đơn mới';
  app.innerHTML = `<div class="ftb">
    <div class="ftb__bar"><div><button type="button" class="ft-btn ft-btn--sm" data-act="back">← Đóng, về danh sách</button>
      <h1>${title}</h1><p class="ft-muted" id="ftb-status" aria-live="polite">${statusText()}</p></div>
      <div class="ftb__tabs" role="tablist" aria-label="Bước dựng mẫu">
        <button type="button" role="tab" data-tab="build" aria-selected="${editor.tab === 'build'}">1. Dựng mẫu</button>
        <button type="button" role="tab" data-tab="preview" aria-selected="${editor.tab === 'preview'}">2. Tổng hợp</button></div>
      <div class="ftb__bar-actions"><button type="button" class="ft-btn" data-act="save">Lưu nháp</button>
        <button type="button" class="ft-btn ft-btn--primary" data-act="publish">Xác thực &amp; xuất bản</button></div></div>
    <div id="ftb-errors" tabindex="-1"></div>
    ${editor.tab === 'build' ? buildView() : previewView()}</div>`;
  if (focusSelector) app.querySelector(focusSelector)?.focus();
}

// Thay đổi cấu trúc: sửa state rồi vẽ lại, giữ con trỏ ở nút vừa bấm.
function change(mutate, focusSelector) {
  mutate();
  markDirty();
  renderEditor(focusSelector);
}

const moveIn = (list, item, index) => {
  list.splice(list.indexOf(item), 1);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, item);
};
const moveBlock = (instanceId, toSectionId, index) => {
  const from = sectionOf(instanceId);
  const block = from.blocks.find((item) => item.instance_id === instanceId);
  from.blocks.splice(from.blocks.indexOf(block), 1);
  const to = findSection(toSectionId);
  to.blocks.splice(Math.max(0, Math.min(index ?? to.blocks.length, to.blocks.length)), 0, block);
};
const addBlock = (key, sectionId, index, free) => {
  const block = snapshotBlock(key, new Set(allBlocks().map((item) => item.instance_id)), free);
  const section = findSection(sectionId);
  section.blocks.splice(index ?? section.blocks.length, 0, { ...block, order: 0 });
  editor.selected = sectionId;
  return block.instance_id;
};

async function save(publish) {
  const content = serialize();
  const errors = publish ? checkTemplate(content) : [!content.name && 'Chưa nhập tên mẫu.', !content.domain && 'Chưa chọn lĩnh vực.'].filter(Boolean);
  const box = document.getElementById('ftb-errors');
  box.innerHTML = errors.length ? `<div class="ft-alert" role="alert"><strong>${publish ? 'Chưa xuất bản được' : 'Chưa lưu được'}:</strong><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul></div>` : '';
  if (errors.length) return box.focus();
  app.querySelectorAll('[data-act="save"], [data-act="publish"]').forEach((button) => { button.disabled = true; });
  try {
    let row = editor.id ? await formTemplates.update(editor.id, content) : await formTemplates.create(content);
    Object.assign(editor, { id: row.id, version: row.version, status: row.status, dirty: false });
    if (publish) {
      row = await formTemplates.publish(row.id);
      toast(`Đã xuất bản "${row.name}" phiên bản ${row.version}.`);
      return closeEditor();
    }
    toast('Đã lưu nháp.');
    renderEditor();
  } catch (error) {
    box.innerHTML = `<div class="ft-alert" role="alert">${escapeHtml(error.message)}</div>`;
    box.focus();
    app.querySelectorAll('[data-act="save"], [data-act="publish"]').forEach((button) => { button.disabled = false; });
  }
}

// ===== Sự kiện (ủy quyền trên danh sách #ft-app và lớp phủ khung dựng) =====
const requestClose = async () => { if (!editor.dirty || await confirmLeave()) closeEditor(); };
const onClick = async (event) => {
  const rowButton = event.target.closest('[data-row-act]');
  if (rowButton) return rowAction(rowButton.dataset.rowAct, rowButton.dataset.id);
  const tab = event.target.closest('[data-tab]');
  if (tab && editor) { editor.tab = tab.dataset.tab; return renderEditor(`[data-tab="${editor.tab}"]`); }
  const button = event.target.closest('[data-act]');
  if (!button) {
    const section = event.target.closest('[data-sec]');
    if (section && editor && editor.selected !== section.dataset.sec && !event.target.closest('input, select')) change(() => { editor.selected = section.dataset.sec; });
    return;
  }
  const { act, id } = button.dataset;
  if (act === 'new') return openEditor(null);
  if (act === 'back') return requestClose();
  if (act === 'back-edit') { editor.tab = 'build'; return renderEditor('[data-tab="build"]'); }
  if (act === 'save' || act === 'publish') return save(act === 'publish');
  const { sections } = editor.content;
  if (act === 'sec-add') {
    const newId = nextSectionId();
    return change(() => { sections.push({ id: newId, title: '', order: 0, blocks: [] }); editor.selected = newId; }, `[data-sec-title="${newId}"]`);
  }
  if (act === 'sec-select') return change(() => { editor.selected = id; }, `[data-act="sec-select"][data-id="${id}"]`);
  if (act === 'sec-up' || act === 'sec-down') {
    const section = findSection(id);
    return change(() => moveIn(sections, section, sections.indexOf(section) + (act === 'sec-up' ? -1 : 1)), `[data-act="${act}"][data-id="${id}"]:not(:disabled), [data-sec-title="${id}"]`);
  }
  if (act === 'sec-del') {
    const section = findSection(id);
    if (section.blocks.length && !(await confirmDialog('Xóa mục?', `Mục "${section.title || 'chưa đặt tên'}" và ${section.blocks.length} thẻ bên trong sẽ bị xóa khỏi mẫu.`, 'Xóa mục', 'Hủy', 'danger'))) return;
    return change(() => {
      sections.splice(sections.indexOf(section), 1);
      if (editor.selected === id) editor.selected = sections[0]?.id ?? null;
    }, '[data-act="sec-add"]');
  }
  if (act === 'blk-up' || act === 'blk-down') {
    const section = sectionOf(id);
    const block = section.blocks.find((item) => item.instance_id === id);
    return change(() => moveIn(section.blocks, block, section.blocks.indexOf(block) + (act === 'blk-up' ? -1 : 1)), `[data-act="${act}"][data-id="${id}"]:not(:disabled), [data-move-to="${id}"]`);
  }
  if (act === 'blk-del') {
    const section = sectionOf(id);
    return change(() => section.blocks.splice(section.blocks.findIndex((item) => item.instance_id === id), 1), `[data-sec-title="${section.id}"]`);
  }
  if (act === 'add-block') {
    return change(() => addBlock(button.dataset.key, editor.selected), `[data-act="add-block"][data-key="${button.dataset.key}"]`);
  }
  if (act === 'add-free') {
    const label = document.getElementById('ftb-free-title').value.trim();
    const type = document.getElementById('ftb-free-type').value;
    if (!label) { toast('Nhập tiêu đề ô trước khi thêm trường tự do.', true); return document.getElementById('ftb-free-title').focus(); }
    return change(() => addBlock(FREE_BLOCK_KEY, editor.selected, undefined, { label, type }), '#ftb-free-title');
  }
};
[listRoot, app].forEach((root) => root.addEventListener('click', onClick));
app.addEventListener('keydown', (event) => { if (event.key === 'Escape' && editor && !event.defaultPrevented) requestClose(); });
document.getElementById('add-template-card')?.addEventListener('click', () => openEditor(null));

app.addEventListener('input', (event) => {
  const el = event.target;
  if (!editor) return;
  if (el.dataset.info && el.dataset.info !== 'domain') editor.content[el.dataset.info] = el.value;
  else if (el.dataset.secTitle) findSection(el.dataset.secTitle).title = el.value;
  else if (el.dataset.freeTitle) sectionOf(el.dataset.freeTitle).blocks.find((block) => block.instance_id === el.dataset.freeTitle).fields[0].label = el.value;
  else return;
  markDirty();
});

listRoot.addEventListener('change', (event) => {
  const el = event.target;
  if (!el.dataset.filter) return;
  filters[el.dataset.filter] = el.type === 'checkbox' ? el.checked : el.value;
  loadRows();
});
app.addEventListener('change', (event) => {
  const el = event.target;
  if (!editor) return;
  if (el.dataset.info === 'domain') {
    editor.content.domain = el.value;
    editor.content.procedure_id = null; // danh mục thủ tục đi theo lĩnh vực
    document.getElementById('ftb-procedure').innerHTML = procedureControl();
    return markDirty();
  }
  if (el.dataset.info === 'procedure_id') { editor.content.procedure_id = el.value; return markDirty(); }
  if (el.dataset.freeType) {
    sectionOf(el.dataset.freeType).blocks.find((block) => block.instance_id === el.dataset.freeType).fields[0].type = el.value;
    return markDirty();
  }
  if (el.dataset.moveTo && el.value) {
    const id = el.dataset.moveTo;
    change(() => { moveBlock(id, el.value); editor.selected = el.value; }, `[data-move-to="${id}"]`);
  }
});

// ===== Kéo thả HTML5 =====
let drag = null; // { kind: 'section' | 'block' | 'lib', id }
const clearDropMarks = () => app.querySelectorAll('.is-drop-target, .is-dragging').forEach((el) => el.classList.remove('is-drop-target', 'is-dragging'));
const dropZone = (target) => (drag?.kind === 'section' ? target.closest('[data-drop-sections]') : target.closest('[data-drop-blocks]'));
// Vị trí chèn = số phần tử (trừ phần tử đang kéo) có tâm nằm trên con trỏ.
const dropIndex = (zone, selector, y) => [...zone.children]
  .filter((el) => el.matches(selector) && !el.classList.contains('is-dragging'))
  .filter((el) => { const box = el.getBoundingClientRect(); return box.top + box.height / 2 < y; }).length;

app.addEventListener('dragstart', (event) => {
  const handle = event.target.closest?.('[draggable="true"]');
  if (!handle || !editor) return;
  const block = handle.closest('[data-blk]');
  const section = handle.closest('[data-sec]');
  drag = handle.dataset.lib ? { kind: 'lib', id: handle.dataset.lib } : block ? { kind: 'block', id: block.dataset.blk } : { kind: 'section', id: section.dataset.sec };
  const moving = block || (drag.kind === 'section' ? section : handle);
  moving.classList.add('is-dragging');
  if (moving !== handle) event.dataTransfer.setDragImage(moving, 16, 16);
  event.dataTransfer.effectAllowed = drag.kind === 'lib' ? 'copy' : 'move';
  event.dataTransfer.setData('text/plain', drag.id);
});
app.addEventListener('dragover', (event) => {
  const zone = drag && dropZone(event.target);
  if (!zone) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = drag.kind === 'lib' ? 'copy' : 'move';
  app.querySelectorAll('.is-drop-target').forEach((el) => el !== zone && el.classList.remove('is-drop-target'));
  zone.classList.add('is-drop-target');
});
app.addEventListener('drop', (event) => {
  const zone = drag && dropZone(event.target);
  if (!zone) return;
  event.preventDefault();
  const current = drag;
  if (current.kind === 'section') {
    const index = dropIndex(zone, '[data-sec]', event.clientY);
    return change(() => moveIn(editor.content.sections, findSection(current.id), index));
  }
  const sectionId = zone.dataset.dropBlocks;
  const index = dropIndex(zone, '[data-blk]', event.clientY);
  if (current.kind === 'lib') return change(() => addBlock(current.id, sectionId, index));
  change(() => { moveBlock(current.id, sectionId, index); editor.selected = sectionId; });
});
app.addEventListener('dragend', () => { drag = null; clearDropMarks(); });

// ===== Khởi động =====
fetchProcedureNames('all')
  .then((items) => { procedures = items; })
  .catch(() => { procedures = 'unavailable'; })
  .finally(() => {
    const slot = document.getElementById('ftb-procedure');
    if (slot && editor) slot.innerHTML = procedureControl();
  });

renderList();
