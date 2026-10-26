// =============================================================================
// TRANG CÔNG DÂN "LÀM ĐƠN THEO MẪU" (/lam-don): chọn mẫu đã xuất bản → xem trước → điền → tải PDF.
// Form vẽ bằng form-renderer.js (giống hệt màn Tổng hợp của admin). Dữ liệu công dân điền KHÔNG gửi xuống BE:
// chỉ dùng để dựng bản in A4 rồi mở hộp thoại in của trình duyệt (chọn "Lưu dưới dạng PDF").
// =============================================================================
import { formTemplates, DOMAINS, PROCEDURE_PREFIX } from '/form-template-service.js';
import { checkValues } from '/form-blocks.js';
import { renderForm, readValues, showErrors, autofillTargets, applyAutofill, renderPrint } from '/form-renderer.js';
import { escapeHtml, fetchMyCitizenProfile, fetchProcedureNames, PROFILE_PATH } from '/auth-api.js';

const app = document.getElementById('ff-app');
const printRoot = document.getElementById('ft-print');
const filters = { domain: '', procedureId: '' };
let procedures = [];
let current = null; // mẫu đang xem/điền
let profilePromise = null; // hồ sơ công dân, tải một lần khi cần

const domainOptions = () => `<option value="">Tất cả lĩnh vực</option>${Object.entries(DOMAINS)
  .map(([value, label]) => `<option value="${value}"${value === filters.domain ? ' selected' : ''}>${label}</option>`).join('')}`;
const procedureOptions = () => `<option value="">Tất cả thủ tục</option>${procedures
  .filter((item) => !filters.domain || item.code?.startsWith(PROCEDURE_PREFIX[filters.domain]))
  .map((item) => `<option value="${escapeHtml(item.id)}"${item.id === filters.procedureId ? ' selected' : ''}>${escapeHtml(`${item.code} · ${item.name}`)}</option>`).join('')}`;
const loadProfile = () => {
  profilePromise ||= fetchMyCitizenProfile().catch(() => null);
  return profilePromise;
};
const needProfileHtml = () => `<div class="ft-alert" role="alert"><strong>Cần cập nhật hồ sơ cá nhân.</strong>
  Hồ sơ của bạn chưa có thông tin CCCD. Hệ thống yêu cầu có CCCD trước khi làm bất kỳ đơn nào.
  <p><a class="ft-btn ft-btn--primary" href="${PROFILE_PATH}?required=1&amp;redirect=${encodeURIComponent('/lam-don')}">Cập nhật hồ sơ</a></p></div>`;

function showList() {
  current = null;
  app.innerHTML = `<p class="section-label">Mẫu đơn dùng chung</p><h1>Làm đơn theo mẫu</h1>
    <p class="ft-muted">Chọn mẫu, xem trước, điền thông tin rồi tải bản PDF để in và mang đi nộp. Thông tin bạn điền không được gửi lên hệ thống.</p>
    <div class="ff-filters"><label>Lĩnh vực<select data-filter="domain">${domainOptions()}</select></label>
      <label>Thủ tục<select data-filter="procedureId">${procedureOptions()}</select></label></div>
    <div id="ff-list" class="ff-list" aria-live="polite"><p class="ft-muted">Đang tải mẫu…</p></div>`;
  loadList();
}

async function loadList() {
  const list = document.getElementById('ff-list');
  try {
    const { items } = await formTemplates.listPublished(filters);
    list.innerHTML = items.length ? items.map((row) => `<article class="ff-card">
      <p class="ff-card__meta">${escapeHtml(DOMAINS[row.domain] || row.domain)}${row.content.code ? ` · Mẫu số ${escapeHtml(row.content.code)}` : ''}</p>
      <h2>${escapeHtml(row.name)}</h2>
      <p class="ft-muted">${row.content.sections.map((section) => escapeHtml(section.title)).join(' · ')}</p>
      <button type="button" class="ft-btn" data-act="preview" data-id="${row.id}" aria-label="Xem trước mẫu ${escapeHtml(row.name)}">Xem trước</button></article>`).join('')
      : '<p class="ft-muted">Chưa có mẫu nào cho lựa chọn này.</p>';
  } catch (error) {
    list.innerHTML = `<p role="alert">Chưa tải được danh sách mẫu. ${escapeHtml(error.message)}</p>`;
  }
}

async function open(id, mode) {
  try {
    current ||= await formTemplates.getPublished(id);
  } catch (error) {
    app.innerHTML = `<p role="alert">${escapeHtml(error.message)}</p><button type="button" class="ft-btn" data-act="list">← Danh sách mẫu</button>`;
    return;
  }
  if (mode === 'preview') {
    app.innerHTML = `<div class="ff-bar"><button type="button" class="ft-btn" data-act="list">← Danh sách mẫu</button>
      <button type="button" class="ft-btn ft-btn--primary" data-act="fill">Dùng mẫu này</button></div>
      <p class="ft-muted">Xem trước các thông tin cần điền để biết mẫu có phù hợp không.</p>
      <fieldset disabled class="ff-preview">${renderForm(current.content)}</fieldset>`;
    return app.querySelector('[data-act="fill"]').focus();
  }
  app.innerHTML = '<p class="ft-muted" role="status">Đang kiểm tra hồ sơ cá nhân…</p>';
  const profile = await loadProfile();
  if (!profile?.id_number) {
    app.innerHTML = `<div class="ff-bar"><button type="button" class="ft-btn" data-act="list">← Danh sách mẫu</button></div>${needProfileHtml()}`;
    return;
  }
  const targets = autofillTargets(current.content);
  app.innerHTML = `<div class="ff-bar"><button type="button" class="ft-btn" data-act="list">← Danh sách mẫu</button></div>
    ${targets.length ? `<div class="ff-autofill"><label for="ff-target">Tự điền thông tin của bạn vào thẻ</label>
      <select id="ff-target">${targets.map((target) => `<option value="${target.instance_id}">${escapeHtml(target.label)}</option>`).join('')}</select>
      <button type="button" class="ft-btn" data-act="autofill">Tự điền thông tin cá nhân</button>
      <p class="ft-muted">Thường chọn thẻ của người làm đơn. Các ô đã điền vẫn sửa được.</p></div>` : ''}
    <div id="ff-errors" tabindex="-1"></div>
    <form id="ff-form" novalidate>${renderForm(current.content)}
      <div class="ff-actions"><button type="submit" class="ft-btn ft-btn--primary">Tải về PDF</button></div></form>`;
  app.querySelector('#ff-target, #ff-form input')?.focus();
}

async function autofill() {
  const profile = await loadProfile();
  if (!profile?.id_number) {
    document.getElementById('ff-errors').innerHTML = needProfileHtml();
    return;
  }
  const filled = applyAutofill(document.getElementById('ff-form'), current.content, document.getElementById('ff-target').value, profile);
  document.getElementById('ff-errors').innerHTML = `<p class="ff-ok" role="status">Đã tự điền ${filled} ô từ hồ sơ của bạn. Hãy kiểm tra lại trước khi tải về.</p>`;
}

function download(form) {
  const { errors, values } = checkValues(current.content, readValues(form));
  const count = showErrors(form, errors);
  const box = document.getElementById('ff-errors');
  if (count) {
    box.innerHTML = `<div class="ft-alert" role="alert">Còn ${count} ô chưa đúng hoặc chưa điền. Hãy sửa các ô được đánh dấu đỏ.</div>`;
    return;
  }
  box.innerHTML = '';
  printRoot.innerHTML = renderPrint(current.content, values);
  const title = document.title;
  document.title = current.content.code ? `${current.content.code} ${current.content.name}` : current.content.name; // tên file PDF gợi ý
  window.print();
  document.title = title;
}

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-act]');
  if (!button) return;
  const { act, id } = button.dataset;
  if (act === 'list') return showList();
  if (act === 'preview') { current = null; return open(id, 'preview'); }
  if (act === 'fill') return open(current.id, 'fill');
  if (act === 'autofill') return autofill();
});
app.addEventListener('submit', (event) => {
  event.preventDefault();
  download(event.target);
});
app.addEventListener('change', (event) => {
  const { filter } = event.target.dataset;
  if (!filter) return;
  filters[filter] = event.target.value;
  if (filter === 'domain') {
    filters.procedureId = '';
    app.querySelector('[data-filter="procedureId"]').innerHTML = procedureOptions();
  }
  loadList();
});

fetchProcedureNames('all').then((items) => {
  procedures = items;
  const select = app.querySelector('[data-filter="procedureId"]');
  if (select) select.innerHTML = procedureOptions();
}).catch(() => {});
const startId = new URLSearchParams(window.location.search).get('template');
if (startId) open(startId, 'preview');
else showList();
