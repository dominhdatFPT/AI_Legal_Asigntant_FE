(() => {
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
    form.append(input, send);
    const footnote = document.createElement('p');
    footnote.className = 'admin-ai-footnote';
    footnote.textContent = 'Câu trả lời do AI tổng hợp để tham khảo. Vui lòng đối chiếu yêu cầu của cơ quan tiếp nhận hồ sơ.';
    composerWrap.append(form, footnote);

    panel.append(header, messages, composerWrap);
    root.append(panel, launcher);
    document.body.append(root);

    const setOpen = (open) => {
      panel.hidden = !open;
      launcher.setAttribute('aria-expanded', String(open));
      if (open) input.focus();
      else launcher.focus();
    };

    launcher.addEventListener('click', () => setOpen(panel.hidden));
    close.addEventListener('click', () => setOpen(false));
    document.addEventListener('admin-ai:open', (event) => {
      if (event.detail?.prompt) input.value = event.detail.prompt;
      setOpen(true);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    });

    const scrollMessages = () => { messages.scrollTop = messages.scrollHeight; };
    const sendQuestion = async (rawQuestion) => {
      const question = rawQuestion.trim();
      if (!question || send.disabled) return;

      suggestions.remove();
      appendBubble(messages, question, 'user');
      const replyTurn = appendBubble(messages, 'Đang tra cứu, vui lòng chờ trong giây lát…', 'assistant');
      const replyBubble = replyTurn.querySelector('.admin-ai-bubble');
      replyBubble.classList.add('admin-ai-status');
      input.value = '';
      send.disabled = true;
      scrollMessages();

      try {
        const configResponse = await fetch('/api/app-config');
        if (!configResponse.ok) throw new Error('Không thể tải cấu hình kết nối.');
        const { apiBaseUrl = 'http://localhost:8080' } = await configResponse.json();
        const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/agent/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: question }),
          signal: AbortSignal.timeout(60000)
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.error || !result?.data) {
          const serverError = new Error(result?.error?.message || 'Trợ lý chưa thể xử lý yêu cầu này.');
          serverError.fromServer = true;
          throw serverError;
        }

        const procedure = result.data.procedure;
        replyBubble.classList.remove('admin-ai-status');
        renderAnswer(replyBubble, procedure
          ? (result.data.answer || 'Đã tìm thấy thủ tục phù hợp.')
          : (result.data.answer || 'Chưa tìm thấy thủ tục phù hợp.'));

        if (procedure) {
          const resultCard = document.createElement('div');
          resultCard.className = 'admin-ai-result';
          const label = document.createElement('strong');
          label.textContent = procedure.name || 'Thủ tục phù hợp';
          resultCard.append(label);
          if (procedure.code) {
            const code = document.createElement('code');
            code.textContent = `Mã thủ tục: ${procedure.code}`;
            resultCard.append(code);
          }
          replyTurn.append(resultCard);
        }
      } catch (error) {
        replyBubble.classList.remove('admin-ai-status');
        replyBubble.textContent = error?.name === 'TimeoutError'
          ? 'Yêu cầu mất nhiều thời gian hơn dự kiến. Vui lòng thử lại.'
          : (error?.fromServer ? error.message : 'Hiện chưa kết nối được dịch vụ tra cứu. Vui lòng thử lại sau.');
      } finally {
        send.disabled = false;
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
})();
