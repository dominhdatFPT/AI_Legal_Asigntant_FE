// Trang "Kho mẫu đơn tham khảo": tra cứu, xem trước PDF trực tiếp và tải file Word (.docx) chuẩn hành chính A4.
// Đồng bộ 100% mẫu đơn đều có bản PDF xem trước và bản Word tải về.
import { fetchFormTemplates, fetchProcedureNames, getApiBaseUrl } from '/auth-api.js';

const formListEl = document.getElementById('form-list');
const formSearchEl = document.getElementById('form-search');
const formCountEl = document.getElementById('form-count');
const formEmptyEl = document.getElementById('form-empty');
const selectDomainEl = document.getElementById('select-domain');
const selectProcedureEl = document.getElementById('select-procedure');

const ALL_OPTION = 'all';

// Danh mục thủ tục chuẩn dự phòng (đảm bảo Dropdown 2 luôn đầy đủ 100% kể cả khi mạng chậm)
const MASTER_PROCEDURES = [
  // Doanh nghiệp & Hộ kinh doanh
  { code: 'HKD-001', name: 'Đăng ký thành lập hộ kinh doanh', domain: 'business' },
  { code: 'HKD-002', name: 'Thay đổi nội dung đăng ký hộ kinh doanh', domain: 'business' },
  { code: 'HKD-003', name: 'Thông báo lập Địa điểm kinh doanh của Hộ kinh doanh', domain: 'business' },
  { code: 'DN-001', name: 'Thủ tục ủy quyền thực hiện thủ tục đăng ký doanh nghiệp', domain: 'business' },
  { code: 'DN-002', name: 'Thủ tục đề nghị cấp lại Giấy chứng nhận đăng ký doanh nghiệp', domain: 'business' },
  { code: 'DN-003', name: 'Thủ tục đăng ký thành lập Công ty Cổ phần', domain: 'business' },
  { code: 'DN-004', name: 'Thủ tục đăng ký thành lập Công ty Trách nhiệm hữu hạn', domain: 'business' },
  { code: 'DN-005', name: 'Thủ tục đăng ký thành lập Doanh nghiệp tư nhân', domain: 'business' },
  { code: 'DN-006', name: 'Thủ tục thuê nhà/mặt bằng làm Trụ sở chính doanh nghiệp', domain: 'business' },
  { code: 'DN-007', name: 'Thủ tục đăng ký thuế, khai thuế ban đầu', domain: 'business' },
  { code: 'DN-008', name: 'Thủ tục đăng ký thành lập Công ty Hợp danh', domain: 'business' },
  { code: 'DN-009', name: 'Thủ tục đăng ký giải thể doanh nghiệp', domain: 'business' },
  { code: 'DN-010', name: 'Thủ tục thông báo tạm ngừng / Cấp đổi thông tin ĐKDN', domain: 'business' },
  { code: 'DN-011', name: 'Thủ tục đăng ký thay đổi nội dung Đăng ký doanh nghiệp', domain: 'business' },

  // Đất đai & Bất động sản
  { code: 'DD-001', name: 'Đăng ký biến động quyền sử dụng đất do chuyển nhượng', domain: 'land' },
  { code: 'DD-002', name: 'Cấp đổi Giấy chứng nhận quyền sử dụng đất', domain: 'land' },
  { code: 'DD-003', name: 'Tách thửa hoặc hợp thửa đất', domain: 'land' },
  { code: 'DD-004', name: 'Thủ tục đăng ký đất đai, cấp Giấy chứng nhận lần đầu', domain: 'land' },
  { code: 'DD-005', name: 'Thủ tục cấp lại Giấy chứng nhận do bị mất', domain: 'land' },
  { code: 'DD-006', name: 'Thủ tục đăng ký biến động do tặng cho, thừa kế quyền sử dụng đất, nhà ở', domain: 'land' },
  { code: 'DD-007', name: 'Thủ tục đính chính Giấy chứng nhận đã cấp do sai sót thông tin', domain: 'land' },
  { code: 'DD-008', name: 'Thủ tục chuyển mục đích sử dụng đất', domain: 'land' },
  { code: 'DD-009', name: 'Thủ tục gia hạn thời hạn sử dụng đất', domain: 'land' },
  { code: 'DD-010', name: 'Thủ tục đăng ký thế chấp quyền sử dụng đất, tài sản gắn liền với đất', domain: 'land' },
  { code: 'DD-011', name: 'Thủ tục xóa đăng ký thế chấp quyền sử dụng đất (Giải chấp Sổ đỏ)', domain: 'land' },
  { code: 'DD-012', name: 'Thủ tục cung cấp thông tin, dữ liệu đất đai, trích lục bản đồ địa chính', domain: 'land' },
  { code: 'DD-013', name: 'Thủ tục giao đất, cho thuê đất', domain: 'land' },
  { code: 'DD-014', name: 'Thủ tục hòa giải tranh chấp đất đai', domain: 'land' },
];

let rawForms = [];
let groupedForms = [];
let allProcedures = [...MASTER_PROCEDURES];
let selectedDomain = ALL_OPTION;
let selectedProcedureCode = ALL_OPTION;
let apiBaseUrl = '';

const buttonClasses = {
  pdf: 'shrink-0 h-10 px-space-md flex items-center gap-space-xs rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-all shadow-[0_2px_8px_rgba(185,28,28,0.25)]',
  word: 'shrink-0 h-10 px-space-md flex items-center gap-space-xs rounded-xl bg-blue-700 text-white font-label-lg text-label-lg hover:bg-blue-800 transition-all shadow-[0_2px_8px_rgba(29,78,216,0.25)]',
};

// Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu.
function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '—';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Link file mẫu trên Backend: inline để xem (download=false), attachment để tải về (download=true).
function fileUrl(id, download) {
  return `${apiBaseUrl}/api/procedures/templates/${encodeURIComponent(id)}/file?download=${download ? 'true' : 'false'}`;
}

// Link tải trực tiếp file Word theo mã thủ tục
function procedureWordUrl(procedureCode) {
  return `${apiBaseUrl}/api/procedures/templates/by-procedure/${encodeURIComponent(procedureCode)}/word`;
}

// Link xem trực tiếp file PDF theo mã thủ tục
function procedurePdfUrl(procedureCode) {
  return `${apiBaseUrl}/api/procedures/templates/by-procedure/${encodeURIComponent(procedureCode)}/pdf`;
}

// Nhóm các file Word và PDF của cùng một biểu mẫu thành 1 thẻ duy nhất
function groupForms(items) {
  const map = new Map();

  items.forEach((item) => {
    // Làm sạch tên: bỏ đuôi (PDF), (Bản Word), (Bản PDF gốc)
    const cleanName = (item.name || '')
      .replace(/\s*\((?:Bản\s*)?(?:Word|PDF|DOCX|gốc)\)/gi, '')
      .replace(/\s*\(PDF\)/gi, '')
      .trim();

    const pCode = (item.procedure_code || '').trim().toUpperCase();
    const domain = (item.domain || 'business').toLowerCase();
    const key = `${domain}_${pCode}_${cleanName.toLowerCase()}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        name: cleanName,
        procedure_code: pCode,
        procedure_name: item.procedure_name || cleanName,
        domain: domain,
        domain_label: item.domain_label || (domain === 'land' ? 'Đất đai & Bất động sản' : 'Doanh nghiệp & Hộ kinh doanh'),
        wordItem: null,
        pdfItem: null,
      });
    }

    const group = map.get(key);
    const fmt = (item.format || '').toUpperCase();
    if (fmt === 'PDF') {
      group.pdfItem = item;
    } else if (fmt === 'DOCX' || fmt === 'DOC') {
      if (!group.wordItem || fmt === 'DOCX') {
        group.wordItem = item;
      }
    }
  });

  return Array.from(map.values());
}

// Cập nhật ô chọn "2. Thủ tục chi tiết" theo Lĩnh vực đã chọn
function updateProcedureDropdown() {
  if (!selectProcedureEl) return;
  const currentDomain = selectDomainEl ? selectDomainEl.value : ALL_OPTION;

  // Lọc danh sách thủ tục chi tiết thuộc domain
  const filteredProcedures = allProcedures.filter(
    (p) => currentDomain === ALL_OPTION || p.domain === currentDomain
  );

  // Sắp xếp mã thủ tục theo thứ tự
  filteredProcedures.sort((a, b) => a.code.localeCompare(b.code));

  selectProcedureEl.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = ALL_OPTION;
  defaultOption.textContent = currentDomain === ALL_OPTION
    ? 'Tất cả thủ tục chi tiết'
    : `Tất cả thủ tục ${currentDomain === 'land' ? 'Đất đai' : 'Doanh nghiệp'}`;
  selectProcedureEl.appendChild(defaultOption);

  filteredProcedures.forEach((proc) => {
    const opt = document.createElement('option');
    opt.value = proc.code;
    opt.textContent = `[${proc.code}] ${proc.name}`;
    if (proc.code === selectedProcedureCode) {
      opt.selected = true;
    }
    selectProcedureEl.appendChild(opt);
  });
}

function createLink(label, icon, href, className, title) {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  link.title = title;
  link.innerHTML = `<span class="material-symbols-outlined text-title-sm" aria-hidden="true">${icon}</span>`;
  if (label) {
    const text = document.createElement('span');
    text.textContent = label;
    link.appendChild(text);
  } else {
    link.setAttribute('aria-label', title);
  }
  return link;
}

// Tạo 1 Card đồng bộ cho từng mẫu đơn: vừa có Xem PDF vừa có Tải file Word
function createFormCard(group) {
  const item = document.createElement('li');
  item.className = 'bg-surface-container-lowest rounded-xl shadow-[0_2px_12px_rgba(28,25,23,0.06)] p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-md border border-outline/10 hover:border-primary/40 transition-all';

  const leftBox = document.createElement('div');
  leftBox.className = 'flex items-start gap-space-md min-w-0 flex-1';

  // Biểu tượng file Word & PDF kết hợp
  const icon = document.createElement('div');
  icon.className = 'w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center font-bold bg-blue-50 text-blue-700 ring-1 ring-blue-200';
  icon.innerHTML = `<span class="material-symbols-outlined text-2xl" aria-hidden="true">description</span>`;
  const formatText = document.createElement('span');
  formatText.className = 'font-label-sm text-[10px] tracking-wider uppercase font-bold leading-none mt-0.5 text-blue-900';
  formatText.textContent = 'DOCX';
  icon.appendChild(formatText);

  const info = document.createElement('div');
  info.className = 'flex-1 min-w-0 flex flex-col gap-1.5';

  const name = document.createElement('h2');
  name.className = 'font-title-sm text-title-sm text-on-surface font-semibold leading-snug';
  name.textContent = group.name;

  const meta = document.createElement('div');
  meta.className = 'flex flex-wrap items-center gap-2';

  if (group.procedure_code) {
    const procCode = document.createElement('span');
    procCode.className = 'px-2 py-0.5 rounded-md bg-primary-fixed text-primary font-label-md text-xs font-semibold';
    procCode.textContent = group.procedure_code;
    meta.appendChild(procCode);
  }

  const category = document.createElement('span');
  category.className = 'px-2 py-0.5 rounded-md bg-secondary-fixed text-on-secondary-fixed-variant font-label-md text-xs font-medium';
  category.textContent = group.domain_label;

  const sizeBytes = (group.wordItem && group.wordItem.size) || (group.pdfItem && group.pdfItem.size) || 0;
  if (sizeBytes > 0) {
    const size = document.createElement('span');
    size.className = 'font-label-md text-xs text-on-surface-variant font-medium';
    size.textContent = formatSize(sizeBytes);
    meta.appendChild(size);
  }

  meta.appendChild(category);

  if (group.procedure_name && group.procedure_name !== group.name) {
    const procName = document.createElement('p');
    procName.className = 'font-body-sm text-xs text-on-surface-variant truncate';
    procName.title = group.procedure_name;
    procName.textContent = `Thủ tục: ${group.procedure_name}`;
    info.append(name, procName, meta);
  } else {
    info.append(name, meta);
  }

  leftBox.append(icon, info);
  item.appendChild(leftBox);

  // Khối các nút hành động đồng bộ: Xem PDF & Tải file Word (.docx)
  const actionsBox = document.createElement('div');
  actionsBox.className = 'flex items-center gap-2 shrink-0 self-end md:self-center';

  // 1. Nút Xem PDF (mở trực tiếp trang PDF)
  const pdfLinkUrl = group.pdfItem ? fileUrl(group.pdfItem.id, false) : procedurePdfUrl(group.procedure_code);
  actionsBox.append(
    createLink('Xem PDF', 'visibility', pdfLinkUrl, buttonClasses.pdf, `Xem trước bản PDF của ${group.name}`)
  );

  // 2. Nút Tải file Word (.docx)
  const wordLinkUrl = group.wordItem ? fileUrl(group.wordItem.id, true) : procedureWordUrl(group.procedure_code);
  actionsBox.append(
    createLink('Tải file Word (.docx)', 'download', wordLinkUrl, buttonClasses.word, `Tải về file Word (.docx) của ${group.name}`)
  );

  item.appendChild(actionsBox);
  return item;
}

function renderForms() {
  const keyword = normalizeText(formSearchEl ? formSearchEl.value.trim() : '');
  const targetDomain = selectDomainEl ? selectDomainEl.value : ALL_OPTION;
  const targetProcCode = selectProcedureEl ? selectProcedureEl.value : ALL_OPTION;

  const visible = groupedForms.filter((group) => {
    // Lọc theo Lĩnh vực (Domain)
    if (targetDomain !== ALL_OPTION && group.domain !== targetDomain) {
      return false;
    }
    // Lọc theo Thủ tục chi tiết (Procedure Code)
    if (targetProcCode !== ALL_OPTION && group.procedure_code !== targetProcCode) {
      return false;
    }
    // Lọc theo từ khóa tìm kiếm
    if (keyword) {
      const matchName = normalizeText(group.name).includes(keyword);
      const matchProc = normalizeText(group.procedure_name).includes(keyword);
      const matchCode = normalizeText(group.procedure_code).includes(keyword);
      if (!matchName && !matchProc && !matchCode) {
        return false;
      }
    }
    return true;
  });

  formListEl.replaceChildren(...visible.map(createFormCard));

  if (targetProcCode !== ALL_OPTION) {
    const selectedProcObj = allProcedures.find((p) => p.code === targetProcCode);
    const procNameDisplay = selectedProcObj ? selectedProcObj.name : targetProcCode;
    formCountEl.innerHTML = `<span class="font-semibold text-primary">Thủ tục [${targetProcCode}]: ${procNameDisplay}</span> — Hiển thị ${visible.length} biểu mẫu`;
  } else if (targetDomain !== ALL_OPTION) {
    const domainText = targetDomain === 'land' ? 'Đất đai & Bất động sản' : 'Doanh nghiệp & Hộ kinh doanh';
    formCountEl.innerHTML = `<span class="font-semibold text-primary">Lĩnh vực: ${domainText}</span> — Hiển thị ${visible.length} biểu mẫu`;
  } else {
    formCountEl.textContent = `Hiển thị ${visible.length} biểu mẫu`;
  }

  formEmptyEl.textContent = 'Không tìm thấy mẫu đơn phù hợp với lựa chọn của bạn.';
  formEmptyEl.classList.toggle('hidden', visible.length > 0);
}

function renderError(error) {
  if (formCountEl) formCountEl.textContent = '';
  if (formListEl) formListEl.replaceChildren();
  if (formEmptyEl) {
    formEmptyEl.textContent =
      error?.code === 'backend/unreachable'
        ? 'Không kết nối được máy chủ Backend. Vui lòng kiểm tra Procedure Service đang chạy trên cổng 8080 rồi tải lại trang.'
        : error?.backendMessage || 'Không tải được danh sách mẫu đơn. Vui lòng thử lại sau.';
    formEmptyEl.classList.remove('hidden');
  }
}

async function loadInitialData() {
  if (formCountEl) formCountEl.textContent = 'Đang tải danh sách mẫu đơn và thủ tục chi tiết...';
  try {
    const [baseUrl, templateData, procData] = await Promise.all([
      getApiBaseUrl(),
      fetchFormTemplates(),
      fetchProcedureNames('all').catch(() => [])
    ]);

    apiBaseUrl = baseUrl;
    rawForms = templateData.items || [];
    groupedForms = groupForms(rawForms);

    // Hợp nhất danh sách thủ tục chi tiết (từ API + từ biểu mẫu + từ master catalog)
    const procMap = new Map();
    MASTER_PROCEDURES.forEach((p) => procMap.set(p.code, p));

    if (Array.isArray(procData)) {
      procData.forEach((p) => {
        if (p && p.code) procMap.set(p.code, p);
      });
    }

    rawForms.forEach((f) => {
      if (f.procedure_code && !procMap.has(f.procedure_code)) {
        procMap.set(f.procedure_code, {
          code: f.procedure_code,
          name: f.procedure_name || f.name,
          domain: f.domain,
        });
      }
    });

    allProcedures = Array.from(procMap.values());

    updateProcedureDropdown();
    renderForms();
  } catch (error) {
    updateProcedureDropdown();
    renderError(error);
  }
}

// Lắng nghe sự kiện người dùng thay đổi 2 Ô chọn và ô tìm kiếm
if (selectDomainEl) {
  selectDomainEl.addEventListener('change', (e) => {
    selectedDomain = e.target.value;
    selectedProcedureCode = ALL_OPTION;
    if (selectProcedureEl) selectProcedureEl.value = ALL_OPTION;

    updateProcedureDropdown();
    renderForms();
  });
}

if (selectProcedureEl) {
  selectProcedureEl.addEventListener('change', (e) => {
    selectedProcedureCode = e.target.value;
    renderForms();
  });
}

if (formSearchEl) {
  formSearchEl.addEventListener('input', renderForms);
}

// Cập nhật ngay danh mục thủ tục chi tiết chuẩn để Dropdown 2 luôn hiển thị đầy đủ
updateProcedureDropdown();
loadInitialData();
