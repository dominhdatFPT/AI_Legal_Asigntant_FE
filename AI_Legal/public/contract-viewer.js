import { loadReferenceCatalog, domainLabels, proceduresOf, groupLabel, procedureCode, downloadReferencePdf } from './reference-catalog.mjs';
import { formTemplates } from '/form-template-service.js';
import { fetchCurrentUser } from '/auth-api.js';
const byId = (id) => document.getElementById(id);

const getCachedRole = () => {
  try {
    return JSON.parse(sessionStorage.getItem('ai_legal_user') || 'null')?.role || null;
  } catch {
    return null;
  }
};

let backLinkBound = false;
// Thiết lập nút Quay lại kho mẫu: giữ đúng trang và bộ lọc trước đó (hoặc quay về trang quản trị nếu là Admin)
const setupBackLink = (domain = '', forceAdmin = false) => {
  const backLink = document.querySelector('.back-link');
  if (!backLink) return;

  const urlParams = new URLSearchParams(window.location.search);
  const from = urlParams.get('from');
  const isAdmin = forceAdmin || getCachedRole() === 'admin' || from === 'land-forms' || from === 'business-form-templates';

  if (isAdmin) {
    backLink.href = (from === 'business-form-templates' || domain === 'business')
      ? '/business-form-templates'
      : '/land-forms';
  } else {
    const fromPage = urlParams.get('from_page');
    const fromDomain = urlParams.get('domain');
    const fromProcedure = urlParams.get('procedure');
    const fromQuery = urlParams.get('q');

    const backParams = new URLSearchParams();
    if (fromPage && parseInt(fromPage, 10) > 1) backParams.set('page', fromPage);
    if (fromDomain) backParams.set('domain', fromDomain);
    if (fromProcedure) backParams.set('procedure', fromProcedure);
    if (fromQuery) backParams.set('q', fromQuery);

    backLink.href = `/document-storages${backParams.toString() ? '?' + backParams.toString() : ''}`;
  }

  if (!backLinkBound) {
    backLinkBound = true;
    backLink.addEventListener('click', (e) => {
      // Nếu chuyển từ trang danh sách trong cùng phiên, dùng history.back() để BFCache phục hồi tức thì
      if (
        window.history.length > 1 &&
        document.referrer &&
        ['/document-storages', '/land-forms', '/landforms', '/business-form-templates'].some((p) => document.referrer.includes(p))
      ) {
        e.preventDefault();
        window.history.back();
      }
    });
  }
};

setupBackLink();

try {
  const id = new URLSearchParams(location.search).get('template');

  // Ưu tiên tìm trong catalog đã cache ở sessionStorage/memory trước; chỉ gọi formTemplates.getPublished(id)
  // khi id không nằm trong catalog.items để tránh bắn request 404 dư thừa lên Procedure Service.
  const catalog = await loadReferenceCatalog().catch(() => ({ items: [], classifications: [] }));
  const items = catalog.items || [];
  const classifications = catalog.classifications || [];

  let item = id ? items.find((entry) => entry.id === id) : items[0];
  const customTemplate = (!item && id) ? await formTemplates.getPublished(id).catch(() => null) : null;

  if (!item && customTemplate) {
    const t = customTemplate;
    const domainCode = t.domain === 'dat_dai' ? 'land' : 'business';
    const formCode = (t.content?.code || t.code || '').trim();
    const formCodeLabel = formCode ? (formCode.toLowerCase().startsWith('mẫu') ? formCode : `Mẫu số ${formCode}`) : '';
    
    // Tìm mã thủ tục từ danh mục classifications
    const matchedClassification = classifications.find((c) =>
      t.procedure_id && (c.procedure_id === t.procedure_id || c.key === t.procedure_id || c.code === t.procedure_id)
    );
    const procKey = matchedClassification ? matchedClassification.key : (t.procedure_id || 'general');
    const procCode = matchedClassification ? (matchedClassification.code || formCodeLabel) : formCodeLabel;
    const procName = matchedClassification ? matchedClassification.name : (formCodeLabel || 'Mẫu đơn dùng chung');

    // Ưu tiên tìm tài liệu PDF tham khảo chính thức của thủ tục này trong kho đã được người dùng tải lên
    const catalogPdfItem = items.find((it) =>
      (procCode && (it.procedure_code === procCode || (it.procedures || []).some((p) => p.code === procCode))) ||
      (procKey && (it.procedure === procKey || (it.procedures || []).some((p) => p.key === procKey))) ||
      (t.procedure_id && (it.procedure === t.procedure_id || (it.procedures || []).some((p) => p.key === t.procedure_id || p.procedure_id === t.procedure_id)))
    );

    if (catalogPdfItem && catalogPdfItem.pages && catalogPdfItem.pages.length > 0) {
      item = catalogPdfItem;
    } else {
      item = {
        id: t.id,
        name: t.name,
        description: t.content?.description || 'Biểu mẫu do quản trị viên ban hành, dùng để tham khảo và đối chiếu.',
        domain: domainCode,
        procedure: procKey,
        procedure_code: procCode,
        procedure_name: procName,
        procedures: [{ key: procKey, code: procCode, name: procName }],
        page_count: 1,
        format: 'PDF',
        pdf: `/api/procedures/form-templates/${t.id}/reference-pdf`,
        pages: [],
        page_dimensions: [],
        is_custom_form: true
      };
    }
  }

  if (!item) throw new Error('NOT_FOUND');

  document.title = `${item.name} | Biểu mẫu thủ tục`;
  byId('viewer-title').textContent = item.name;
  byId('viewer-description').textContent = item.description;
  byId('viewer-domain').textContent = domainLabels[item.domain] || 'Biểu mẫu';
  byId('viewer-procedure').textContent = proceduresOf(item).map(groupLabel).join('\n');
  // Trang Tạo hồ sơ tự mở form theo ?procedure=<mã>; mẫu gắn nhiều thủ tục thì lấy thủ tục đầu, như thẻ ở kho mẫu.
  // Nếu là Admin thì ẩn nút Tạo hồ sơ, cập nhật nút Quay lại và menu ngang theo lĩnh vực mẫu.
  const code = procedureCode(proceduresOf(item)[0]);
  const createBtn = byId("viewer-create");
  const fromParam = new URLSearchParams(window.location.search).get('from');
  const applyViewerRole = (role) => {
    const isAdmin = role === 'admin' || fromParam === 'land-forms' || fromParam === 'business-form-templates';
    setupBackLink(item.domain, isAdmin);
    if (createBtn) {
      if (isAdmin || !code) {
        createBtn.hidden = true;
        createBtn.removeAttribute('href');
      } else {
        createBtn.href = `/application-submission?procedure=${encodeURIComponent(code)}`;
        createBtn.hidden = false;
      }
    }
    if (isAdmin) {
      const targetPath = item.domain === 'business' ? 'ho-so-ho-kinh-doanh' : 'ho-so-dat-dai';
      const navLinks = document.querySelector('header.unav .unav-links');
      if (navLinks?.dataset.roleNav === 'admin') {
        navLinks.querySelectorAll('.unav-link').forEach((link) => {
          const active = link.dataset.path === targetPath;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        });
      }
    }
  };
  applyViewerRole(getCachedRole());
  fetchCurrentUser().then((user) => applyViewerRole(user?.role || null)).catch(() => {});
  byId("viewer-page-count").textContent = item.is_custom_form ? "Biểu mẫu PDF" : `PDF · ${item.page_count} trang`;
  byId("reader-total").textContent = item.is_custom_form ? "Bản PDF tham khảo" : `${item.page_count} trang · Chỉ xem`;

  const onDownload = async (btn) => {
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    try {
      if (item.is_custom_form && item.pdf) {
        const res = await fetch(item.pdf);
        if (!res.ok) throw new Error('Không thể tải file PDF.');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.name.replace(/[^\w\s\u00C0-\u024F\u1EA0-\u1EF9-]/gi, '').trim().replace(/\s+/g, '_') || 'mau-don'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await downloadReferencePdf(item);
      }
    } catch (error) {
      alert(error.message || 'Không thể tải tệp PDF biểu mẫu.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  };

  const dlBtn = byId('viewer-download-btn');
  const toolbarDlBtn = byId('reader-download-btn');
  dlBtn?.addEventListener('click', () => onDownload(dlBtn));
  toolbarDlBtn?.addEventListener('click', () => onDownload(toolbarDlBtn));

  if (item.is_custom_form) {
    const pagesContainer = byId('viewer-pages');
    pagesContainer.replaceChildren();

    const iframe = document.createElement('iframe');
    iframe.src = item.pdf;
    iframe.title = item.name;
    iframe.style.width = '100%';
    iframe.style.height = '850px';
    iframe.style.border = '1px solid #dfd1cc';
    iframe.style.borderRadius = '6px';
    iframe.style.background = '#fff';
    pagesContainer.append(iframe);
  } else {
    item.pages.forEach((page, index) => {
      const figure = document.createElement('figure');
      const caption = document.createElement('figcaption');
      caption.textContent = `Trang ${index + 1} / ${item.page_count}`;
      const image = document.createElement('img');
      image.src = page;
      image.alt = `${item.name}, trang ${index + 1}.`;
      image.width = item.page_dimensions[index].width;
      image.height = item.page_dimensions[index].height;
      image.loading = index ? 'lazy' : 'eager';
      image.addEventListener('error', () => {
        byId('viewer-status').hidden = false;
        byId('viewer-status').textContent = 'Một trang tài liệu chưa tải được. Hãy tải lại trang để xem đầy đủ.';
      });
      figure.append(caption, image);
      byId('viewer-pages').append(figure);
    });
  }

  byId('viewer').hidden = false;
  byId('viewer-status').hidden = true;
} catch (error) {
  byId('viewer-status').textContent = error.message === 'NOT_FOUND'
    ? 'Không tìm thấy mẫu này. Quay lại kho để chọn mẫu hiện có.'
    : 'Chưa tải được tài liệu. Kiểm tra kết nối rồi tải lại trang.';
}
