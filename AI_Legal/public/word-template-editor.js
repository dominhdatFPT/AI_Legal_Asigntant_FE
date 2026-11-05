import { escapeHtml } from '/auth-api.js';
import { formTemplates } from '/form-template-service.js';

// Text-only editing: save run text, never HTML or a reconstructed document.
export async function createWordEditor(id, onDirty) {
  let model = await formTemplates.loadWordEditor(id);
  const edits = new Map();
  const originals = new Map();
  const root = document.createElement('div');
  root.className = 'word-inline-editor';
  const renderBlocks = (blocks) => blocks.map((block) => {
    if (block.kind === 'table') return `<table><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td colspan="${Number(cell.span) || 1}">${renderBlocks(cell.blocks)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return `<p style="text-align:${['left', 'center', 'right', 'justify'].includes(block.align) ? block.align : 'left'}">${block.runs.map((run) => {
      originals.set(String(run.id), run.text);
      const size = Number(run.size);
      return `<span contenteditable="plaintext-only" role="textbox" aria-label="Nội dung Word" data-word-run="${run.id}" style="${run.bold ? 'font-weight:bold;' : ''}${run.italic ? 'font-style:italic;' : ''}${run.underline ? 'text-decoration:underline;' : ''}${size > 0 && size < 200 ? `font-size:${size}pt;` : ''}">${escapeHtml(run.text)}</span>`;
    }).join('')}</p>`;
  }).join('');
  root.innerHTML = `<p class="ft-muted">Sửa chữ và chèn mã ngay trên file Word gốc. Bảng, lề và bố cục gốc được giữ khi lưu. Đây là khung sửa nội dung, không phải bản xem trước phân trang; đầu/chân trang, hình ảnh và định dạng phức tạp chưa hiển thị ở đây.</p>
    <div class="word-inline-layout"><aside class="word-inline-tokens" aria-label="Mã trường để chèn"></aside>
    <div class="word-inline-paper" aria-label="Sửa nội dung Word">${renderBlocks(model.blocks)}</div></div>
    <p class="ft-muted" data-word-status>Chọn vị trí trong văn bản rồi bấm mã bên trái để chèn. Bấm Lưu nháp để lưu Word cùng mẫu.</p>`;
  let selection = null;
  root.addEventListener('keyup', remember);
  root.addEventListener('mouseup', remember);
  root.addEventListener('focusout', remember);
  function remember() {
    const current = window.getSelection();
    if (!current?.rangeCount) return;
    const range = current.getRangeAt(0);
    const node = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const run = node?.closest('[data-word-run]');
    if (run && root.contains(run)) selection = { range: range.cloneRange(), run };
    else if (node && root.querySelector('.word-inline-paper').contains(node)) selection = null;
  }
  function changed(run) {
    const key = run.dataset.wordRun;
    if (run.textContent === originals.get(key)) edits.delete(key);
    else edits.set(key, { id: Number(key), text: run.textContent });
    onDirty();
    root.querySelector('[data-word-status]').textContent = 'Word có thay đổi chưa lưu. Bấm Lưu nháp để lưu.';
  }
  root.addEventListener('input', (event) => {
    const run = event.target.closest('[data-word-run]');
    if (run) { changed(run); remember(); }
  });
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-insert-word-token]');
    if (!button) return;
    if (!selection || !root.contains(selection.run)) {
      root.querySelector('[data-word-status]').textContent = 'Bấm vào vị trí cần chèn trong văn bản trước, rồi chọn mã trường.';
      return;
    }
    const { range, run } = selection;
    const endNode = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
    if (!run.contains(range.startContainer) || !run.contains(endNode)) return;
    run.focus();
    range.deleteContents();
    const token = document.createTextNode(button.dataset.insertWordToken);
    range.insertNode(token);
    range.setStartAfter(token); range.collapse(true);
    const current = window.getSelection(); current.removeAllRanges(); current.addRange(range);
    changed(run); remember();
  });
  return {
    root,
    hasChanges: () => edits.size > 0,
    refreshTokens(content) {
      const tokens = [];
      content.sections.forEach((section) => section.blocks.filter((block) => block.block_key !== 'repeat_group').forEach((block) => block.fields.forEach((field) => {
        tokens.push({ label: field.label, token: `{{${field.word_key}}}` });
      })));
      (content.repeat_groups || []).forEach((group) => {
        tokens.push({ label: `${group.title} · STT đầu hàng`, token: `{{#${group.key}}}{{${group.key}.index}}` });
        group.fields.forEach((field) => tokens.push({ label: field.label, token: `{{${group.key}.${field.key}}}` }));
        tokens.push({ label: `${group.title} · Kết thúc hàng`, token: `{{/${group.key}}}` });
      });
      root.querySelector('.word-inline-tokens').innerHTML = `<strong>Chèn mã vào vị trí đang chọn</strong>${tokens.map(({ label, token }) => `<button type="button" class="ft-btn ft-btn--sm" data-insert-word-token="${escapeHtml(token)}"><span>${escapeHtml(label)}</span><code>${escapeHtml(token)}</code></button>`).join('')}`;
    },
    async save() {
      if (!edits.size) return;
      const result = await formTemplates.saveWordEditor(id, { version: model.version, edits: [...edits.values()] });
      model.version = result.version;
      edits.forEach((edit, key) => originals.set(key, edit.text));
      edits.clear();
      root.querySelector('[data-word-status]').textContent = 'Đã lưu thay đổi vào file Word của mẫu.';
    }
  };
}
