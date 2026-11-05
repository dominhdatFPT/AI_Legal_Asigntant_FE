import { escapeHtml } from '/auth-api.js';
import { formTemplates } from '/form-template-service.js';

let loading;
function loadOfficeScript(url) {
  if (window.DocsAPI) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => { script.remove(); loading = null; reject(new Error('Không tải được ONLYOFFICE. Kiểm tra dịch vụ Word nội bộ.')); };
    document.head.append(script);
  });
  return loading;
}

export async function createWordEditor(id, onDirty, { mount } = {}) {
  const session = await formTemplates.officeConfig(id);
  await loadOfficeScript(session.script);
  const root = document.createElement('section');
  root.className = mount ? 'office-inline-panel' : 'office-side-panel';
  const hostId = `office-${crypto.randomUUID()}`;
  root.innerHTML = `<div class="office-side-head"><strong>Word · Bản nháp</strong><span data-office-status>Đang mở tài liệu…</span></div>
    <div class="office-token-strip" aria-label="Sao chép mã trường"></div>
    <div class="office-frame"><div id="${hostId}"></div></div>`;
  (mount || document.body).append(root);
  let dirty = false;
  let changeNumber = 0;
  let alive = true;
  let ready = false;
  const status = root.querySelector('[data-office-status]');
  const api = new window.DocsAPI.DocEditor(hostId, {
    ...session.config,
    events: {
      onDocumentReady: () => { ready = true; status.textContent = 'Sao chép mã từ phần trường bên cạnh rồi Ctrl+V vào Word. Lưu nháp để lưu cùng mẫu.'; },
      onDocumentStateChange: (event) => {
        if (!event.data) return;
        dirty = true; changeNumber++; onDirty();
        status.textContent = 'Word có thay đổi. Bấm Lưu nháp để xác nhận lưu cùng mẫu.';
      },
      onError: (event) => { status.textContent = `Lỗi Word ${event.data?.errorCode ?? ''}: ${event.data?.errorDescription || 'Vui lòng bấm Mở lại Word.'}`; status.setAttribute('role', 'alert'); }
    }
  });
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-office-copy]');
    if (!button) return;
    try {
      await navigator.clipboard.writeText(button.dataset.officeCopy);
      status.textContent = 'Đã sao chép. Đặt con trỏ trong Word rồi nhấn Ctrl+V.';
    } catch { status.textContent = 'Hãy chọn mã hiển thị và nhấn Ctrl+C để sao chép.'; }
  });
  return {
    root,
    hasChanges: () => dirty,
    setVisible(show) { root.hidden = !show; if (show) window.dispatchEvent(new Event('resize')); },
    destroy() { alive = false; try { api.destroyEditor(); } finally { root.remove(); } },
    refreshTokens(content) {
      const tokens = [];
      content.sections.forEach((section) => section.blocks.filter((block) => block.block_key !== 'repeat_group').forEach((block) => block.fields.forEach((field) => {
        tokens.push({ label: field.label, token: `{{${field.word_key}}}` });
      })));
      (content.repeat_groups || []).forEach((group) => {
        tokens.push({ label: `${group.title} · STT`, token: `{{#${group.key}}}{{${group.key}.index}}` });
        group.fields.forEach((field) => tokens.push({ label: field.label, token: `{{${group.key}.${field.key}}}` }));
        tokens.push({ label: `${group.title} · Cuối hàng`, token: `{{/${group.key}}}` });
      });
      root.querySelector('.office-token-strip').innerHTML = tokens.map(({ label, token }) => `<button type="button" title="Sao chép mã" data-office-copy="${escapeHtml(token)}"><span>${escapeHtml(label)}</span><code>${escapeHtml(token)}</code></button>`).join('');
    },
    async save() {
      if (!dirty) return;
      if (!ready) throw new Error('Word đang mở. Hãy đợi tài liệu sẵn sàng rồi lưu lại.');
      const initialChange = changeNumber;
      const request = await formTemplates.officeSave(id, session.session);
      if (!request.unchanged) {
        let saved = false;
        for (let attempt = 0; attempt < 40 && alive; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 750));
          const current = await formTemplates.officeStatus(id, session.session);
          if (current.revision > request.revision) { saved = true; break; }
        }
        if (!saved) throw new Error('Word chưa xác nhận lưu xong. Hãy thử Lưu nháp lại; chưa xuất bản mẫu.');
      }
      dirty = changeNumber !== initialChange;
      if (dirty) throw new Error('Word vừa có thay đổi mới trong lúc lưu. Bấm Lưu nháp lại trước khi xuất bản.');
      status.textContent = 'Đã lưu Word vào bản nháp. Bản Word gốc mở đầu phiên vẫn được giữ riêng.';
    }
  };
}
