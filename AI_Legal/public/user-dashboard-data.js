// Điền dữ liệu thật cho trang tổng quan của người dùng (citizen/lawyer).
// Mọi dữ liệu lấy từ Backend theo token đăng nhập; trang không chứa số liệu cứng.
import {
  AGENCY_LABELS,
  COMING_SOON_HTML,
  STATUS_LABELS,
  escapeHtml,
  fetchMyApplications,
  fetchMyCitizenProfile,
  fetchMyDocuments,
  fetchProcedures,
  formatDate,
  formatFee,
  lookupApplication,
  exportApplicationPdf
} from '/auth-api.js';

const PAGE_SIZE = 10;
const state = { page: 1, status: '', domain: '', q: '', currentDossierCode: '' };

const STATUS_STYLES = {
  draft: 'bg-surface-container-high text-on-surface-variant',
  submitted: 'bg-secondary-fixed text-on-secondary-fixed',
  processing: 'bg-secondary-fixed text-on-secondary-fixed',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-error-container text-on-error-container'
};

const $ = (selector) => document.querySelector(selector);

const statusBadge = (status) =>
  `<span class="inline-flex items-center gap-1 font-label-sm text-label-sm px-space-sm py-1 rounded font-semibold ${STATUS_STYLES[status] || ''}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;

// Hạn trả chỉ có nghĩa khi hồ sơ đang chờ cơ quan giải quyết.
const dueDate = (item) => (['submitted', 'processing'].includes(item.status) ? item.due_date : null);

const applicationCode = (item) => `${item.procedure_code}-${item.id.slice(0, 8).toUpperCase()}`;

const errorBox = (message, retryId) =>
  `<div role="alert" class="flex flex-col items-start gap-space-xs text-error font-body-sm text-body-sm">${escapeHtml(message)}<button type="button" id="${retryId}" class="text-primary font-semibold hover:underline">Thử lại</button></div>`;

const fillComingSoon = () => {
  document.querySelectorAll('[data-coming-soon]').forEach((element) => {
    element.innerHTML = COMING_SOON_HTML;
  });
};

async function renderStats() {
  const count = (status) => fetchMyApplications({ status, pageSize: 1 }).then((data) => data.pagination.total);
  try {
    const [total, submitted, processing, completed, nextDue] = await Promise.all([
      count(), count('submitted'), count('processing'), count('completed'),
      fetchMyApplications({ status: 'processing', pageSize: 50 })
    ]);
    $('[data-stat="total"]').textContent = total;
    $('[data-stat="in_progress"]').textContent = submitted + processing;
    $('[data-stat="completed"]').textContent = completed;
    const dues = nextDue.items.map((item) => item.due_date).filter(Boolean).sort();
    if (dues.length) $('[data-stat-note="next_due"]').textContent = `Hạn trả gần nhất: ${formatDate(dues[0])}`;
  } catch {
    document.querySelectorAll('[data-stat]').forEach((element) => { element.textContent = '—'; });
  }
}

async function renderProcessing() {
  const list = $('#processing-list');
  try {
    const { items, pagination } = await fetchMyApplications({ status: 'processing', pageSize: 3 });
    $('#processing-count').textContent = `${pagination.total} hồ sơ đang xử lý`;
    list.innerHTML = items.length
      ? items.map((item) => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs bg-surface-container-low/50 p-space-md rounded-lg">
          <div class="flex flex-col">
            <span class="font-mono text-label-md text-primary font-bold">${escapeHtml(applicationCode(item))}</span>
            <span class="font-title-sm text-title-sm text-on-surface font-semibold">${escapeHtml(item.procedure_name || item.procedure_code)}</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant">Nộp ngày ${formatDate(item.created_at)}${dueDate(item) ? ` • Hạn trả ${formatDate(dueDate(item))}` : ''}</span>
          </div>
          ${statusBadge(item.status)}
        </div>`).join('')
      : '<p class="font-body-sm text-body-sm text-on-surface-variant">Không có hồ sơ nào đang xử lý.</p>';
  } catch {
    $('#processing-count').textContent = '—';
    list.innerHTML = errorBox('Không tải được hồ sơ, thử lại sau.', 'processing-retry');
    $('#processing-retry').addEventListener('click', renderProcessing);
  }
}

function paintFilters() {
  document.querySelectorAll('#status-filters [data-status]').forEach((button) => {
    const active = button.dataset.status === state.status;
    button.classList.toggle('bg-primary-container', active);
    button.classList.toggle('text-on-primary', active);
    button.classList.toggle('bg-surface-container-high', !active);
    button.classList.toggle('text-on-surface', !active);
    button.setAttribute('aria-pressed', String(active));
  });
}

async function renderTable() {
  const body = $('#my-applications-body');
  paintFilters();
  try {
    const { items, pagination } = await fetchMyApplications({
      status: state.status, domain: state.domain, q: state.q, page: state.page, pageSize: PAGE_SIZE
    });
    body.innerHTML = items.length
      ? items.map((item) => `
        <tr class="hover:bg-surface-container-low transition-colors">
          <td class="py-space-md px-space-md whitespace-nowrap">
            <button type="button" class="btn-view-dossier font-mono text-primary font-bold hover:underline text-left cursor-pointer" data-app-code="${escapeHtml(applicationCode(item))}" title="Bấm để xem chi tiết tờ đơn">${escapeHtml(applicationCode(item))}</button>
          </td>
          <td class="py-space-md px-space-md">
            <span class="font-title-sm text-title-sm text-on-surface block font-semibold">${escapeHtml(item.procedure_name || item.procedure_code)}</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant">Lệ phí: ${escapeHtml(formatFee(item.fee))}</span>
          </td>
          <td class="py-space-md px-space-md text-on-surface-variant">${escapeHtml(AGENCY_LABELS[item.receiving_agency_level] || '—')}</td>
          <td class="py-space-md px-space-md whitespace-nowrap">${formatDate(item.created_at)}</td>
          <td class="py-space-md px-space-md whitespace-nowrap font-semibold text-secondary">${formatDate(dueDate(item))}</td>
          <td class="py-space-md px-space-md text-center whitespace-nowrap">${statusBadge(item.status)}</td>
          <td class="py-space-md px-space-md text-right whitespace-nowrap">
            <button type="button" class="btn-view-dossier inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-primary border border-red-200 text-xs font-bold transition shadow-xs cursor-pointer" data-app-code="${escapeHtml(applicationCode(item))}" title="Xem chi tiết tờ đơn">
              <span class="material-symbols-outlined text-sm">description</span>
              <span>Xem đơn</span>
            </button>
          </td>
        </tr>`).join('')
      : `<tr><td class="py-space-lg px-space-md text-center text-on-surface-variant" colspan="7">${
          state.status || state.domain ? 'Không có hồ sơ phù hợp bộ lọc.' : 'Bạn chưa có hồ sơ nào. <a class="text-primary font-semibold hover:underline" href="/application-submission">Tạo hồ sơ</a>'
        }</td></tr>`;

    body.querySelectorAll('.btn-view-dossier').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.appCode;
        if (code) openDossierModal(code);
      });
    });

    const from = pagination.total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
    const to = Math.min(pagination.page * pagination.page_size, pagination.total);
    $('#my-applications-range').textContent = `Hiển thị ${from} - ${to} trong tổng số ${pagination.total} hồ sơ`;
    $('#my-applications-page').textContent = `${pagination.page} / ${Math.max(pagination.total_pages, 1)}`;
    $('#my-applications-prev').disabled = pagination.page <= 1;
    $('#my-applications-next').disabled = pagination.page >= pagination.total_pages;
  } catch {
    body.innerHTML = `<tr><td class="py-space-lg px-space-md" colspan="7">${errorBox('Không tải được hồ sơ, thử lại sau.', 'table-retry')}</td></tr>`;
    $('#table-retry').addEventListener('click', renderTable);
  }
}

async function renderDocuments() {
  const box = $('#my-documents');
  try {
    const [profile, documents] = await Promise.all([
      fetchMyCitizenProfile().catch(() => null),
      fetchMyDocuments().catch(() => ({ items: [] }))
    ]);
    const rows = [];
    if (profile) {
      rows.push({ icon: 'badge', title: 'Căn cước công dân', note: `${String(profile.id_number).slice(0, 6)}****** • Đã xác nhận` });
    }
    documents.items.slice(0, 5).forEach((doc) => {
      rows.push({ icon: 'description', title: doc.original_filename || 'Tài liệu', note: `Tải lên ${formatDate(doc.created_at)}` });
    });
    box.innerHTML = rows.length
      ? rows.map((row) => `
        <div class="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container-low">
          <div class="w-9 h-9 rounded bg-primary-container/10 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-title-md">${row.icon}</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-title-sm text-title-sm text-on-surface font-semibold truncate">${escapeHtml(row.title)}</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant font-mono">${escapeHtml(row.note)}</span>
          </div>
        </div>`).join('')
      : '<p class="font-body-sm text-body-sm text-on-surface-variant">Chưa có giấy tờ nào. <a class="text-primary font-semibold hover:underline" href="/detail-information">Cập nhật CCCD</a></p>';
  } catch {
    box.innerHTML = errorBox('Không tải được tài liệu.', 'documents-retry');
    $('#documents-retry').addEventListener('click', renderDocuments);
  }
}

async function renderFeatured() {
  const box = $('#featured-procedures');
  try {
    const [land, business] = await Promise.all([fetchProcedures('land'), fetchProcedures('business')]);
    const picks = [...land.slice(0, 2), ...business.slice(0, 2)];
    box.innerHTML = picks.length
      ? picks.map((procedure) => `
        <a class="p-space-sm rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-between group" href="/application-submission?procedure=${encodeURIComponent(procedure.code)}">
          <div class="flex items-center gap-space-sm">
            <span class="material-symbols-outlined text-primary">${procedure.domain === 'land' ? 'landscape' : 'storefront'}</span>
            <div class="flex flex-col">
              <span class="font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors">${escapeHtml(procedure.name)}</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">${escapeHtml(procedure.code)} • ${escapeHtml(AGENCY_LABELS[procedure.receiving_agency_level] || 'Cơ quan tiếp nhận')}</span>
            </div>
          </div>
          <span class="material-symbols-outlined text-on-surface-variant text-title-sm">arrow_forward</span>
        </a>`).join('')
      : '<p class="font-body-sm text-body-sm text-on-surface-variant">Chưa có thủ tục nào.</p>';
  } catch {
    box.innerHTML = errorBox('Không tải được danh mục thủ tục.', 'featured-retry');
    $('#featured-retry').addEventListener('click', renderFeatured);
  }
}

// Gắn sự kiện mỗi lần khung tổng quan được vẽ lại (user-dashboard-navigation.js thay lại HTML gốc).
function render() {
  if (!$('#my-applications-body')) return; // đang ở màn hình tạo hồ sơ
  fillComingSoon();
  document.querySelectorAll('#status-filters [data-status]').forEach((button) => {
    button.addEventListener('click', () => {
      state.status = button.dataset.status;
      state.page = 1;
      renderTable();
    });
  });
  $('#domain-filter').value = state.domain;
  $('#domain-filter').addEventListener('change', (event) => {
    state.domain = event.target.value;
    state.page = 1;
    renderTable();
  });
  $('#my-applications-prev').addEventListener('click', () => { state.page -= 1; renderTable(); });
  $('#my-applications-next').addEventListener('click', () => { state.page += 1; renderTable(); });
  renderStats();
  renderProcessing();
  renderTable();
  renderDocuments();
  renderFeatured();

  const searchBtn = $('#dashboard-search-btn');
  const searchInput = $('#dashboard-search-input');
  if (searchBtn && !searchBtn.dataset.bound) {
    searchBtn.dataset.bound = 'true';
    searchBtn.addEventListener('click', handleSearch);
  }
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }

  const printBtn = $('#btn-print-dossier');
  if (printBtn && !printBtn.dataset.bound) {
    printBtn.dataset.bound = 'true';
    printBtn.addEventListener('click', async () => {
      const code = state.currentDossierCode;
      if (!code) return;
      const originalHtml = printBtn.innerHTML;
      try {
        printBtn.disabled = true;
        printBtn.innerHTML = `
          <div class="inline-block animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></div>
          <span>Đang tạo PDF...</span>
        `;
        await exportApplicationPdf(code);
      } catch (err) {
        console.error('Lỗi tải tờ đơn PDF:', err);
        alert('Không thể tải file PDF tờ đơn: ' + (err.backendMessage || err.message || 'Lỗi kết nối'));
      } finally {
        printBtn.disabled = false;
        printBtn.innerHTML = originalHtml;
      }
    });
  }
  const closeBtn1 = $('#btn-close-dossier-modal');
  const closeBtn2 = $('#btn-close-dossier-modal-bottom');
  if (closeBtn1 && !closeBtn1.dataset.bound) {
    closeBtn1.dataset.bound = 'true';
    closeBtn1.addEventListener('click', closeDossierModal);
  }
  if (closeBtn2 && !closeBtn2.dataset.bound) {
    closeBtn2.dataset.bound = 'true';
    closeBtn2.addEventListener('click', closeDossierModal);
  }
  const modalEl = $('#application-dossier-modal');
  if (modalEl && !modalEl.dataset.bound) {
    modalEl.dataset.bound = 'true';
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeDossierModal();
    });
  }
}

const handleSearch = () => {
  const input = $('#dashboard-search-input');
  if (!input) return;
  const q = input.value.trim();
  if (!q) {
    state.q = '';
    state.page = 1;
    renderTable();
    return;
  }
  if (q.includes('-') && q.length >= 8) {
    openDossierModal(q);
  }
  state.q = q;
  state.page = 1;
  renderTable();
};

async function openDossierModal(code) {
  state.currentDossierCode = code;
  const modal = $('#application-dossier-modal');
  const loading = $('#dossier-loading');
  const errorBox = $('#dossier-error');
  const errorText = $('#dossier-error-text');
  const sheet = $('#dossier-sheet');

  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  loading.classList.remove('hidden');
  errorBox.classList.add('hidden');
  sheet.classList.add('hidden');

  try {
    const data = await lookupApplication(code);
    renderDossierSheet(data);
    loading.classList.add('hidden');
    sheet.classList.remove('hidden');
  } catch (err) {
    loading.classList.add('hidden');
    errorBox.classList.remove('hidden');
    errorText.textContent = err.backendMessage || `Không tìm thấy hồ sơ với mã "${code}". Vui lòng kiểm tra lại.`;
  }
}

function closeDossierModal() {
  const modal = $('#application-dossier-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

function renderDossierSheet({ application_code, record, procedure, schema }) {
  if (application_code) state.currentDossierCode = application_code;
  const formData = record.form_data || {};
  const procName = procedure?.name || schema?.procedure_name || record.procedure_code;
  const agency = AGENCY_LABELS[procedure?.receiving_agency_level] || 'Ủy ban nhân dân cấp huyện / Chi nhánh Văn phòng Đăng ký Đất đai';
  const statusLabel = STATUS_LABELS[record.status] || record.status;
  const createdAtFormatted = formatDate(record.created_at);

  const sections = schema?.sections || [
    { key: 'applicant', title: 'I. THÔNG TIN NGƯỜI NỘP ĐƠN / CHỦ HỒ SƠ' },
    { key: 'property', title: 'II. THÔNG TIN THỬA ĐẤT / TÀI SẢN' },
    { key: 'transfer', title: 'III. NỘI DUNG ĐĂNG KÝ BIẾN ĐỘNG / CHUYỂN NHƯỢNG' }
  ];
  const fields = schema?.fields || [];
  const fieldsBySection = {};
  fields.forEach((f) => {
    const sec = f.section || 'general';
    if (!fieldsBySection[sec]) fieldsBySection[sec] = [];
    fieldsBySection[sec].push(f);
  });

  let sectionsHtml = '';
  sections.forEach((sec) => {
    const secFields = fieldsBySection[sec.key] || [];
    if (!secFields.length) return;

    let itemsHtml = '';
    secFields.forEach((f) => {
      let val = formData[f.name];
      if (val === undefined || val === null || val === '') {
        val = record[f.name] || '—';
      }
      if (f.options && Array.isArray(f.options)) {
        const matched = f.options.find((opt) => String(opt.value) === String(val));
        if (matched) val = matched.label;
      }
      if (typeof val === 'boolean') {
        val = val ? 'Có' : 'Không';
      }

      itemsHtml += `
        <div class="py-2.5 border-b border-slate-200/70 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <dt class="text-xs font-bold text-slate-500 uppercase tracking-wide">${escapeHtml(f.label)}:</dt>
          <dd class="sm:col-span-2 text-sm font-semibold text-slate-900">${escapeHtml(String(val))}</dd>
        </div>
      `;
    });

    sectionsHtml += `
      <div class="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <h3 class="font-sans font-bold text-xs sm:text-sm text-red-800 uppercase mb-2 border-b border-red-200 pb-1.5 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-red-600"></span>
          ${escapeHtml(sec.title)}
        </h3>
        <dl>
          ${itemsHtml}
        </dl>
      </div>
    `;
  });

  if (!sectionsHtml) {
    let rowsHtml = '';
    for (const [k, v] of Object.entries(formData)) {
      rowsHtml += `
        <div class="py-2 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <dt class="text-xs font-bold text-slate-500 uppercase">${escapeHtml(k)}:</dt>
          <dd class="sm:col-span-2 text-sm font-semibold text-slate-900">${escapeHtml(String(v))}</dd>
        </div>
      `;
    }
    sectionsHtml = `
      <div class="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <h3 class="font-sans font-bold text-xs sm:text-sm text-red-800 uppercase mb-2">DỮ LIỆU ĐÃ KÊ KHAI</h3>
        <dl>${rowsHtml}</dl>
      </div>
    `;
  }

  $('#dossier-sheet').innerHTML = `
    <!-- Quốc hiệu & Tiêu ngữ -->
    <div class="text-center mb-6">
      <div class="font-bold text-sm sm:text-base tracking-wide uppercase text-slate-900">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
      <div class="text-xs sm:text-sm font-bold italic mt-0.5 text-slate-800">Độc lập - Tự do - Hạnh phúc</div>
      <div class="w-32 h-0.5 bg-slate-400 mx-auto mt-2 mb-3"></div>
      <div class="font-sans text-[11px] text-slate-500 uppercase font-semibold">CỔNG DỊCH VỤ CÔNG QUỐC GIA • HỆ THỐNG THÔNG TIN GIẢI QUYẾT TTHC</div>
    </div>

    <!-- Khung Mã tiếp nhận hồ sơ -->
    <div class="p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-300 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans">
      <div class="flex flex-col gap-1">
        <div class="text-xs text-slate-500 font-bold uppercase">MÃ HỒ SƠ QUỐC GIA:</div>
        <div class="font-mono text-xl sm:text-2xl font-black text-red-700 tracking-wider select-all">${escapeHtml(application_code)}</div>
        <div class="text-xs text-slate-600">Ngày nộp trực tuyến: <strong class="text-slate-800">${createdAtFormatted}</strong></div>
      </div>
      <div class="flex flex-col sm:items-end gap-1.5">
        <div class="text-xs text-slate-500 font-bold">TRẠNG THÁI TIẾP NHẬN:</div>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <span class="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
          ${escapeHtml(statusLabel)}
        </span>
        <div class="text-[11px] text-slate-600">Cơ quan thụ lý: <strong class="text-slate-800">${escapeHtml(agency)}</strong></div>
      </div>
    </div>

    <!-- Tên Đơn chính thức -->
    <div class="text-center my-6">
      <h1 class="text-lg sm:text-2xl font-black uppercase text-slate-900 leading-tight">
        ${escapeHtml(procName)}
      </h1>
      <p class="text-xs sm:text-sm italic text-slate-600 mt-2 font-serif">
        Kính gửi: <span class="font-bold underline">${escapeHtml(agency)}</span>
      </p>
    </div>

    <!-- Chi tiết các phần đã kê khai kèm data user -->
    <div class="font-sans">
      ${sectionsHtml}
    </div>

    <!-- Lời cam kết và chữ ký xác thực điện tử -->
    <div class="mt-8 pt-4 border-t-2 border-slate-300 font-serif">
      <p class="italic text-xs sm:text-sm text-slate-700 leading-relaxed mb-6">
        "Tôi xin cam đoan toàn bộ những nội dung kê khai trên là hoàn toàn đúng sự thật, không gian dối và chịu hoàn toàn trách nhiệm trước pháp luật về tính hợp pháp, chính xác của hồ sơ này."
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center font-sans text-xs">
        <div class="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
          <div class="font-bold uppercase text-slate-700">CÁN BỘ TIẾP NHẬN HỒ SƠ</div>
          <div class="text-[11px] text-slate-400 italic mt-0.5">(Ký, ghi rõ họ tên và đóng dấu)</div>
          <div class="h-16 flex items-center justify-center text-slate-400 italic text-[11px]">
            [ Đã tiếp nhận trên hệ thống ]
          </div>
        </div>

        <div class="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70">
          <div class="font-bold uppercase text-emerald-900">NGƯỜI KÊ KHAI / NỘP ĐƠN</div>
          <div class="text-[11px] text-emerald-700 italic mt-0.5">(Xác thực điện tử)</div>
          <div class="h-16 flex flex-col items-center justify-center">
            <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 mb-1">
              <span class="material-symbols-outlined text-xs">check_circle</span> ĐÃ XÁC THỰC TÀI KHOẢN
            </span>
            <div class="font-bold text-slate-900 uppercase text-sm font-sans">${escapeHtml(record.applicant_name || 'NGƯỜI NỘP ĐƠN')}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.addEventListener('user-dashboard:shown', render);
render();
