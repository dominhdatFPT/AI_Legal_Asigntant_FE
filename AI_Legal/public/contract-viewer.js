import { loadReferences, domainLabels, proceduresOf, groupLabel, downloadReferencePdf } from './reference-catalog.mjs';
const byId = (id) => document.getElementById(id);
try {
  const items = await loadReferences();
  const id = new URLSearchParams(location.search).get('template');
  const item = id ? items.find((entry) => entry.id === id) : items[0];
  if (!item) throw new Error('NOT_FOUND');
  document.title = `${item.name} | Biểu mẫu thủ tục`;
  byId('viewer-title').textContent = item.name;
  byId('viewer-description').textContent = item.description;
  byId('viewer-domain').textContent = domainLabels[item.domain] || 'Biểu mẫu';
  byId('viewer-procedure').textContent = proceduresOf(item).map(groupLabel).join('\n');
  byId('viewer-page-count').textContent = `PDF · ${item.page_count} trang`;
  byId('reader-total').textContent = `${item.page_count} trang · Chỉ xem`;

  const onDownload = async (btn) => {
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    try {
      await downloadReferencePdf(item);
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
  item.pages.forEach((page, index) => {
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption'); caption.textContent = `Trang ${index + 1} / ${item.page_count}`;
    const image = document.createElement('img'); image.src = page;
    image.alt = `${item.name}, trang ${index + 1}.`;
    image.width = item.page_dimensions[index].width; image.height = item.page_dimensions[index].height;
    image.loading = index ? 'lazy' : 'eager';
    image.addEventListener('error', () => { byId('viewer-status').hidden = false; byId('viewer-status').textContent = 'Một trang tài liệu chưa tải được. Hãy tải lại trang để xem đầy đủ.'; });
    figure.append(caption, image); byId('viewer-pages').append(figure);
  });
  byId('viewer').hidden = false; byId('viewer-status').hidden = true;
} catch (error) {
  byId('viewer-status').textContent = error.message === 'NOT_FOUND'
    ? 'Không tìm thấy mẫu này. Quay lại kho để chọn mẫu hiện có.'
    : 'Chưa tải được tài liệu. Kiểm tra kết nối rồi tải lại trang.';
}
