import { createAgentConversation, sendAgentMessage, uploadAgentDocument } from '/auth-api.js';

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.docx';
const MAX_FILE_SIZE = 9 * 1024 * 1024;

const createIcon = (path, viewBox = '0 0 24 24') => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    return svg;
  };

const makeButton = (className, label, iconPath) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', label);
    button.append(createIcon(iconPath));
    return button;
  };

const appendBubble = (container, text, role) => {
    const turn = document.createElement('div');
    turn.className = `admin-ai-turn admin-ai-turn-${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'admin-ai-bubble';
    bubble.textContent = text;
    turn.append(bubble);
    container.append(turn);
    return turn;
  };

const renderAnswer = (bubble, text) => {
    bubble.textContent = '';
    const lines = String(text).split('\n');
    lines.forEach((line, index) => {
      const cleaned = line.replace(/^(\s*)[*-]\s+/, '$1• ');
      cleaned.split(/\*\*(.+?)\*\*/g).forEach((part, partIndex) => {
        if (!part) return;
        if (partIndex % 2 === 1) {
          const strong = document.createElement('strong');
          strong.textContent = part;
          bubble.append(strong);
        } else {
          bubble.append(document.createTextNode(part));
        }
      });
      if (index < lines.length - 1) bubble.append(document.createTextNode('\n'));
    });
  };

function mountAdminAssistant() {
    if (document.querySelector('.admin-ai-chat')) return;

    const root = document.createElement('section');
    root.className = 'admin-ai-chat';
    root.setAttribute('aria-label', 'Chatbot hỗ trợ tra cứu thủ tục');

    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'admin-ai-launcher';
    launcher.id = 'admin-ai-chat-toggle';
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'admin-ai-panel');
    launcher.setAttribute('aria-label', 'Mở chatbot hỗ trợ tra cứu thủ tục');
    launcher.title = 'Chatbot hỗ trợ';

    const launcherIcon = document.createElement('span');
    launcherIcon.className = 'admin-ai-launcher-icon';
    launcherIcon.setAttribute('aria-hidden', 'true');
    launcherIcon.append(createIcon('M4 5h16v11H8l-4 4V5Z M9 10h6'));

    const launcherCopy = document.createElement('span');
    launcherCopy.className = 'admin-ai-launcher-copy';
    const launcherTitle = document.createElement('span');
    launcherTitle.className = 'admin-ai-launcher-title';
    launcherTitle.textContent = 'Chatbot hỗ trợ';
    const launcherHint = document.createElement('span');
    launcherHint.className = 'admin-ai-launcher-hint';
    launcherHint.textContent = 'Tra cứu thủ tục, chuẩn bị hồ sơ';
    launcherCopy.append(launcherTitle, launcherHint);

    const launcherChevron = document.createElement('span');
    launcherChevron.className = 'admin-ai-launcher-chevron';
    launcherChevron.setAttribute('aria-hidden', 'true');
    launcherChevron.append(createIcon('M6 15l6-6 6 6'));

    launcher.append(launcherIcon, launcherCopy, launcherChevron);

    const panel = document.createElement('div');
    panel.className = 'admin-ai-panel';
    panel.id = 'admin-ai-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'admin-ai-title');
    panel.hidden = true;

    const header = document.createElement('div');
    header.className = 'admin-ai-header';
    header.tabIndex = 0;
    header.setAttribute('role', 'group');
    header.setAttribute('aria-label', 'Pindahkan jendela dengan menyeret header atau gunakan tombol panah');
    const headerIcon = document.createElement('span');
    headerIcon.className = 'admin-ai-header-icon';
    headerIcon.append(createIcon('M4 5h16v11H8l-4 4V5Z M8 9h8M8 12h5'));
    const heading = document.createElement('div');
    heading.className = 'admin-ai-header-copy';
    heading.innerHTML = '<strong id="admin-ai-title">Chatbot hỗ trợ</strong><small>Tra cứu thủ tục đất đai và hộ kinh doanh</small>';
    const close = makeButton('admin-ai-close', 'Đóng cửa sổ trợ lý', 'M6 6l12 12M18 6 6 18');
    header.append(headerIcon, heading, close);

    const messages = document.createElement('div');
    messages.className = 'admin-ai-messages';
    messages.setAttribute('aria-live', 'polite');
    messages.setAttribute('aria-relevant', 'additions text');

    const welcome = document.createElement('div');
    welcome.className = 'admin-ai-welcome';
    const assistantIcon = document.createElement('span');
    assistantIcon.className = 'admin-ai-message-icon';
    assistantIcon.append(createIcon('M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1 M9 12h6m-3-3v6'));
    const welcomeBubble = document.createElement('div');
    welcomeBubble.className = 'admin-ai-bubble';
    welcomeBubble.textContent = 'Xin chào! Tôi có thể hỗ trợ tra cứu thủ tục về đất đai, hộ kinh doanh và hướng dẫn bạn chuẩn bị thông tin cho hồ sơ.';
    welcome.append(assistantIcon, welcomeBubble);

    const suggestions = document.createElement('div');
    suggestions.className = 'admin-ai-suggestions';
    suggestions.setAttribute('aria-label', 'Gợi ý câu hỏi');
    const suggestionLabels = ['Đăng ký đất đai', 'Cấp giấy chứng nhận', 'Đăng ký hộ kinh doanh'];
    const suggestionButtons = suggestionLabels.map((label) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-ai-suggestion';
      button.textContent = label;
      button.dataset.query = label;
      return button;
    });
    suggestions.append(...suggestionButtons);
    messages.append(welcome, suggestions);

    const composerWrap = document.createElement('div');
    composerWrap.className = 'admin-ai-composer-wrap';
    const form = document.createElement('form');
    form.className = 'admin-ai-composer';
    form.setAttribute('aria-label', 'Gửi nội dung tra cứu');
    const input = document.createElement('input');
    input.className = 'admin-ai-input';
    input.type = 'text';
    input.name = 'question';
    input.placeholder = 'Ví dụ: đăng ký đất đai lần đầu';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Từ khóa hoặc tên thủ tục cần tra cứu');
    const send = makeButton('admin-ai-send', 'Gửi câu hỏi', 'M5 12h14M13 6l6 6-6 6');
    send.type = 'submit';
    const attach = makeButton('admin-ai-attach', 'Đính kèm tệp', 'M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.9-8.9a3.3 3.3 0 0 1 4.7 4.7l-8.9 8.9a1.7 1.7 0 0 1-2.4-2.4l8.2-8.2');
    attach.title = 'Đính kèm tệp (PDF, JPG, PNG, DOCX — tối đa 9MB)';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = ACCEPTED_FILE_TYPES;
    fileInput.hidden = true;
    fileInput.tabIndex = -1;
    fileInput.setAttribute('aria-hidden', 'true');
    form.append(attach, fileInput, input, send);

    const fileError = document.createElement('p');
    fileError.className = 'admin-ai-file-error';
    fileError.setAttribute('role', 'alert');
    fileError.hidden = true;
    const fileChip = document.createElement('div');
    fileChip.className = 'admin-ai-file';
    fileChip.hidden = true;
    const fileName = document.createElement('span');
    fileName.className = 'admin-ai-file-name';
    const fileRemove = makeButton('admin-ai-file-remove', 'Bỏ tệp đính kèm', 'M6 6l12 12M18 6 6 18');
    fileChip.append(createIcon('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z M14 3v5h5'), fileName, fileRemove);

    const footnote = document.createElement('p');
    footnote.className = 'admin-ai-footnote';
    footnote.textContent = 'Câu trả lời do AI tổng hợp để tham khảo. Vui lòng đối chiếu yêu cầu của cơ quan tiếp nhận hồ sơ.';
    composerWrap.append(fileError, fileChip, form, footnote);

    panel.append(header, messages, composerWrap);
    root.append(panel, launcher);
    document.body.append(root);

    let dragState;
    let launcherDragState;
    let suppressLauncherClick = false;
    let panelMoved = false;
    let pendingUpload = null; // AbortController của lượt đang tải/chờ đọc tệp
    const clampPanelPosition = (left, top) => ({
      left: Math.min(Math.max(8, left), Math.max(8, window.innerWidth - panel.offsetWidth - 8)),
      top: Math.min(Math.max(8, top), Math.max(8, window.innerHeight - panel.offsetHeight - 8))
    });
    const movePanelTo = (left, top) => {
      const position = clampPanelPosition(left, top);
      panel.style.left = `${position.left}px`;
      panel.style.top = `${position.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    };
    const positionPanelAboveLauncher = () => {
      const launcherRect = launcher.getBoundingClientRect();
      const aboveTop = launcherRect.top - panel.offsetHeight - 12;
      movePanelTo(
        launcherRect.right - panel.offsetWidth,
        aboveTop >= 8 ? aboveTop : launcherRect.bottom + 12
      );
    };
    const setOpen = (open) => {
      panel.hidden = !open;
      launcher.setAttribute('aria-expanded', String(open));
      if (open) {
        if (!panelMoved) positionPanelAboveLauncher();
        input.focus();
      } else {
        pendingUpload?.abort();
        launcher.focus();
      }
    };

    header.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const rect = panel.getBoundingClientRect();
      dragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top };
      header.setPointerCapture(event.pointerId);
      header.classList.add('is-dragging');
      event.preventDefault();
    });
    header.addEventListener('pointermove', (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      panelMoved = true;
      movePanelTo(dragState.left + event.clientX - dragState.startX, dragState.top + event.clientY - dragState.startY);
    });
    const stopDragging = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      dragState = null;
      header.classList.remove('is-dragging');
      if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
    };
    header.addEventListener('pointerup', stopDragging);
    header.addEventListener('pointercancel', stopDragging);
    header.addEventListener('keydown', (event) => {
      const offsets = { ArrowUp: [0, -24], ArrowDown: [0, 24], ArrowLeft: [-24, 0], ArrowRight: [24, 0] };
      const offset = offsets[event.key];
      if (!offset || panel.hidden || event.target !== header) return;
      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      movePanelTo(rect.left + offset[0], rect.top + offset[1]);
    });
    launcher.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const rect = root.getBoundingClientRect();
      launcherDragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
      launcher.setPointerCapture(event.pointerId);
      launcher.classList.add('is-dragging');
    });
    launcher.addEventListener('pointermove', (event) => {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      const deltaX = event.clientX - launcherDragState.startX;
      const deltaY = event.clientY - launcherDragState.startY;
      if (!launcherDragState.moved && Math.hypot(deltaX, deltaY) < 5) return;
      launcherDragState.moved = true;
      const left = Math.min(Math.max(8, launcherDragState.left + deltaX), Math.max(8, window.innerWidth - root.offsetWidth - 8));
      const top = Math.min(Math.max(8, launcherDragState.top + deltaY), Math.max(8, window.innerHeight - root.offsetHeight - 8));
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
      root.style.right = 'auto';
      root.style.bottom = 'auto';
    });
    const stopDraggingLauncher = (event) => {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      const wasMoved = launcherDragState.moved;
      launcherDragState = null;
      launcher.classList.remove('is-dragging');
      if (launcher.hasPointerCapture(event.pointerId)) launcher.releasePointerCapture(event.pointerId);
      if (wasMoved) {
        suppressLauncherClick = true;
        panelMoved = false;
        if (!panel.hidden) positionPanelAboveLauncher();
      }
    };
    launcher.addEventListener('pointerup', stopDraggingLauncher);
    launcher.addEventListener('pointercancel', stopDraggingLauncher);
    window.addEventListener('resize', () => {
      if (root.style.left && root.style.top) {
        const rootRect = root.getBoundingClientRect();
        const left = Math.min(rootRect.left, Math.max(8, window.innerWidth - root.offsetWidth - 8));
        const top = Math.min(rootRect.top, Math.max(8, window.innerHeight - root.offsetHeight - 8));
        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
      }
      if (!panel.hidden && panel.style.left && panel.style.top) {
        const rect = panel.getBoundingClientRect();
        movePanelTo(rect.left, rect.top);
      }
    });

    launcher.addEventListener('click', (event) => {
      if (suppressLauncherClick) {
        suppressLauncherClick = false;
        event.preventDefault();
        return;
      }
      setOpen(panel.hidden);
    });
    close.addEventListener('click', () => setOpen(false));
    document.addEventListener('admin-ai:open', (event) => {
      if (event.detail?.prompt) input.value = event.detail.prompt;
      setOpen(true);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    });
    window.addEventListener('pagehide', () => pendingUpload?.abort());

    const scrollMessages = () => { messages.scrollTop = messages.scrollHeight; };
    let conversationId = null;
    let attachment = null; // { file, key }: key dùng lại khi retry cùng tệp
    const setAttachedFile = (file) => {
      attachment = file ? { file, key: crypto.randomUUID() } : null;
      fileName.textContent = file ? file.name : '';
      fileChip.hidden = !file;
    };
    const showFileError = (message) => {
      fileError.textContent = message || '';
      fileError.hidden = !message;
    };
    attach.addEventListener('click', () => fileInput.click());
    fileRemove.addEventListener('click', () => {
      pendingUpload?.abort();
      setAttachedFile(null);
      input.focus();
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      const extension = `.${file.name.split('.').pop().toLowerCase()}`;
      if (!ACCEPTED_FILE_TYPES.split(',').includes(extension)) {
        showFileError('Chỉ hỗ trợ tệp PDF, JPG, PNG hoặc DOCX.');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        showFileError('Tệp quá lớn, vui lòng chọn tệp tối đa 9MB.');
        return;
      }
      showFileError('');
      setAttachedFile(file);
      input.focus();
    });

    const sendQuestion = async (rawQuestion) => {
      const current = attachment;
      const file = current?.file;
      const question = rawQuestion.trim() || (file ? 'Vui lòng xem tệp đính kèm.' : '');
      if (!question || send.disabled) return;

      suggestions.remove();
      appendBubble(messages, file ? `${question}\n📎 ${file.name}` : question, 'user');
      showFileError('');
      const searchingText = 'Đang tra cứu, vui lòng chờ trong giây lát…';
      const replyTurn = appendBubble(messages, file ? 'Đang tải tệp lên…' : searchingText, 'assistant');
      const replyBubble = replyTurn.querySelector('.admin-ai-bubble');
      replyBubble.classList.add('admin-ai-status');
      input.value = '';
      send.disabled = true;
      attach.disabled = true;
      pendingUpload = file ? new AbortController() : null;
      scrollMessages();

      try {
        let documentIds;
        if (file) {
          const documentId = await uploadAgentDocument(file, {
            signal: pendingUpload.signal,
            idempotencyKey: current.key,
            onStatus: (stage) => {
              replyBubble.textContent = stage === 'uploading' ? 'Đang tải tệp lên…' : 'Đang đọc nội dung tài liệu…';
            }
          });
          documentIds = [documentId];
          pendingUpload = null;
          fileRemove.disabled = true; // đã tải xong, chỉ còn chờ câu trả lời
          replyBubble.textContent = searchingText;
        }
        if (!conversationId) {
          const convo = await createAgentConversation();
          conversationId = convo.id;
        }
        const result = await sendAgentMessage(conversationId, question, documentIds);
        replyBubble.classList.remove('admin-ai-status');
        renderAnswer(replyBubble, result.assistant_message.content);
        if (file) setAttachedFile(null); // tài liệu chỉ dùng cho lượt này
      } catch (error) {
        replyBubble.classList.remove('admin-ai-status');
        if (error?.name === 'AbortError') {
          replyBubble.textContent = 'Đã hủy gửi tài liệu.';
        } else {
          const message = error?.backendMessage || 'Hiện chưa kết nối được dịch vụ tra cứu. Vui lòng thử lại sau.';
          const documentIssue = error?.code?.startsWith('document/');
          replyBubble.textContent = file && !documentIssue
            ? `${message}\nBạn có thể gửi lại hoặc bỏ tệp đính kèm.`
            : message;
          if (file) {
            if (error?.code === 'document/failed') setAttachedFile(null);
            else if (error?.code === 'DOCUMENT_NOT_FOUND') current.key = crypto.randomUUID();
            if (!input.value && rawQuestion.trim()) input.value = rawQuestion;
          }
        }
      } finally {
        pendingUpload = null;
        fileRemove.disabled = false;
        send.disabled = false;
        attach.disabled = false;
        input.focus();
        scrollMessages();
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      sendQuestion(input.value);
    });
    suggestions.addEventListener('click', (event) => {
      const button = event.target.closest('[data-query]');
      if (button) sendQuestion(button.dataset.query);
    });
  }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAdminAssistant, { once: true });
} else {
  mountAdminAssistant();
}
