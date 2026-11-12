import { authRequest, getApiBaseUrl, fetchCurrentUser, displayName } from '/auth-api.js';
import { USER_REASONS, addReport, choiceChips, listReports } from '/report-store.js';

const $ = (selector) => document.querySelector(selector);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const STATUS = {
  waiting: { label: 'Đang chờ', badge: 'bg-amber-100 text-amber-800' },
  in_progress: { label: 'Đang tư vấn', badge: 'bg-red-100 text-red-700' },
  closed: { label: 'Đã kết thúc', badge: 'bg-slate-100 text-slate-600' }
};
const CLOSE_REASON = { completed: 'Cuộc tư vấn đã được kết thúc.', expired: 'Cuộc tư vấn đã hết hạn.' };

const state = {
  me: null,
  tab: 'mine', // 'mine' | 'lobby' (chỉ luật sư)
  mine: [],
  lobby: [],
  activeId: null, // null = soạn câu hỏi mới
  messages: [],
  termsAccepted: true,
  termsVersion: ''
};

// ---------------------------------------------------------------- REST
async function api(path, options) {
  const response = await authRequest(path, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) {
    const error = payload?.error || {};
    throw Object.assign(new Error(error.message || 'Không kết nối được máy chủ.'), {
      code: error.code || `http-${response.status}`,
      status: response.status
    });
  }
  return payload.data;
}

const showStatus = (message) => {
  const node = $('[data-chat-feedback]');
  node.textContent = message || '';
  node.hidden = !message;
};
const run = async (task) => {
  try {
    showStatus('');
    return await task();
  } catch (error) {
    showStatus(error.message);
    return undefined;
  }
};

// ---------------------------------------------------------------- WebSocket (chỉ để nhận sự kiện)
const sockets = new Map(); // channel → { ws, stop }

async function openChannel(channel, onEvent, onOpen) {
  closeChannel(channel);
  const entry = { ws: null, stopped: false, delay: 1000, refreshed: false };
  sockets.set(channel, entry);
  const base = (await getApiBaseUrl()).replace(/^http/, 'ws');

  const connect = () => {
    if (entry.stopped) return;
    const ws = new WebSocket(`${base}/ws/consultations/${channel}`);
    entry.ws = ws;
    ws.onopen = () => {
      entry.delay = 1000;
      onOpen?.();
    };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'error') onEvent(message);
      } catch { /* bỏ qua tin không hợp lệ */ }
    };
    ws.onclose = async (event) => {
      if (entry.stopped) return;
      if (event.code === 4401 && !entry.refreshed) {
        entry.refreshed = true; // token hết hạn: gọi API thường để refresh cookie rồi nối lại 1 lần
        await authRequest('/api/users/me').catch(() => {});
        return connect();
      }
      if ([4401, 4403, 4404].includes(event.code)) return; // lỗi quyền, nối lại cũng vô ích
      setTimeout(connect, entry.delay);
      entry.delay = Math.min(entry.delay * 2, 30000);
    };
  };
  connect();
}

function closeChannel(channel) {
  const entry = sockets.get(channel);
  if (!entry) return;
  entry.stopped = true;
  entry.ws?.close();
  sockets.delete(channel);
}

// ---------------------------------------------------------------- Dữ liệu
const lastTime = (c) => c.last_message?.created_at || c.updated_at || c.created_at;
const byRecent = (a, b) => new Date(lastTime(b)) - new Date(lastTime(a));
const active = () => [...state.mine, ...state.lobby].find((c) => c.id === state.activeId) || null;
const iAmLawyerOf = (c) => c && c.lawyer_id === state.me.id;

async function loadMine() {
  const data = await api('/api/consultations?page_size=100');
  state.mine = data.items.sort(byRecent);
  renderList();
  renderHeader();
}
async function loadLobby() {
  if (state.me.role !== 'lawyer') return;
  const data = await api('/api/consultations/lobby?page_size=100');
  state.lobby = data.items.sort(byRecent);
  renderList();
}
let reloadTimer;
const reloadSoon = () => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => run(loadMine), 300);
};

async function loadMessages({ after } = {}) {
  const id = state.activeId;
  const query = after ? `&after=${after}` : '';
  const data = await api(`/api/consultations/${id}/messages?limit=100${query}`);
  if (id !== state.activeId) return; // đã chuyển sang cuộc khác
  data.items.forEach(addMessage);
  renderMessages();
}

function addMessage(message) {
  if (message.consultation_id !== state.activeId || state.messages.some((m) => m.id === message.id)) return false;
  state.messages.push(message);
  state.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return true;
}

async function markRead(c) {
  if (!c || c.status === 'waiting') return;
  c.unread_count = 0;
  renderList();
  await api(`/api/consultations/${c.id}/read`, { method: 'POST' }).catch(() => {});
}

// ---------------------------------------------------------------- Chọn cuộc tư vấn
async function select(id) {
  closeChannel(state.activeId);
  state.activeId = id;
  state.messages = [];
  renderList();
  renderHeader();
  renderMessages();
  if (!id) return;
  const c = active();
  if (c.status === 'waiting') return;
  await run(() => loadMessages());
  markRead(c);
  openChannel(id, onChatEvent, () => run(() => loadMessages({ after: state.messages.at(-1)?.id })));
}

function onChatEvent({ type, data }) {
  const c = active();
  if (!c) return;
  if (type === 'message.created' && addMessage(data)) {
    renderMessages();
    if (data.sender_id !== state.me.id) markRead(c);
    reloadSoon();
  } else if (type === 'consultation.closed') {
    Object.assign(c, data);
    select(null); // cuộc tư vấn đã kết thúc: đóng tab, không hiển thị nữa
    reloadSoon();
  }
}

function onMeEvent({ type, data }) {
  // Dự phòng khi socket riêng của cuộc tư vấn rớt: addMessage đã chống trùng nên gọi 2 đường vẫn an toàn.
  if (type === 'message.created' && data.consultation_id === state.activeId) onChatEvent({ type, data });
  if (type === 'consultation.accepted' && data.consultation_id === state.activeId) {
    run(loadMine).then(() => select(state.activeId));
    return;
  }
  reloadSoon();
}

function onLobbyEvent({ type, data }) {
  if (type === 'consultation.created') {
    state.lobby = [data, ...state.lobby.filter((c) => c.id !== data.id)];
  } else if (type === 'consultation.accepted') {
    state.lobby = state.lobby.filter((c) => c.id !== data.consultation_id);
  } else if (type === 'consultation.removed') {
    state.lobby = state.lobby.filter((c) => !data.consultation_ids.includes(c.id));
  }
  renderList();
}

// ---------------------------------------------------------------- Hiển thị
const timeText = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)
    : date.toLocaleDateString('vi-VN');
};

const otherPartyLabel = (c) => (state.me.id === c.citizen_id ? 'Luật sư' : 'Người dân');

function renderList() {
  const list = $('[data-session-list]');
  const query = $('[data-session-search]').value.trim().toLocaleLowerCase('vi');
  const source = state.tab === 'lobby' ? state.lobby : state.mine;
  const items = source.filter((c) => c.status !== 'closed' && c.question.toLocaleLowerCase('vi').includes(query));
  list.replaceChildren();

  items.forEach((c) => {
    const status = STATUS[c.status] || STATUS.closed;
    const isActive = c.id === state.activeId;
    const item = el('div', `chat-session-item p-3.5 cursor-pointer${isActive ? ' is-active' : ''}`);
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.setAttribute('aria-pressed', String(isActive));

    const row = el('div', 'flex items-start space-x-3');
    const avatar = el('div', 'w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center border border-slate-300 text-xs shrink-0',
      state.tab === 'lobby' || state.me.id === c.lawyer_id ? 'ND' : 'LS');
    const body = el('div', 'flex-1 min-w-0');
    const top = el('div', 'flex items-center justify-between');
    top.append(el('h4', 'text-xs font-bold text-slate-900 truncate',
      state.tab === 'lobby' ? 'Câu hỏi mới' : c.status === 'waiting' ? 'Chờ luật sư nhận' : otherPartyLabel(c)),
    el('span', 'text-[10px] text-slate-500 font-medium', timeText(lastTime(c))));
    const preview = c.last_message ? c.last_message.content : c.question;
    const badges = el('div', 'mt-2 flex items-center gap-1.5');
    badges.append(el('span', `text-xs px-3 py-1 rounded-full font-medium ${status.badge}`, status.label));
    if (c.unread_count > 0) badges.append(el('span', 'text-xs px-2 py-1 rounded-full font-bold bg-red-600 text-white', String(c.unread_count)));
    body.append(top, el('p', 'text-xs text-slate-600 truncate mt-1', preview), badges);
    row.append(avatar, body);
    item.append(row);

    const open = () => select(c.id);
    item.addEventListener('click', open);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    list.append(item);
  });

  $('[data-search-empty]').textContent = state.tab === 'lobby' ? 'Chưa có câu hỏi nào đang chờ.' : 'Chưa có phiên tư vấn nào.';
  $('[data-search-empty]').hidden = items.length > 0;
  document.querySelectorAll('[data-tab]').forEach((tab) => {
    const on = tab.dataset.tab === state.tab;
    tab.classList.toggle('bg-red-600', on);
    tab.classList.toggle('text-white', on);
    tab.classList.toggle('bg-white', !on);
    tab.classList.toggle('text-slate-700', !on);
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  });
}

function renderHeader() {
  const c = active();
  const title = $('[data-chat-title]');
  const sub = $('[data-chat-organization]');
  const badge = $('[data-chat-response]');
  const closeButton = $('[data-chat-close]');
  const accept = $('[data-chat-accept]');
  const composer = $('.chat-composer');
  const textarea = composer.querySelector('textarea');
  const submit = composer.querySelector('button[type="submit"]');

  let composerMode = 'send';
  if (!c) {
    title.textContent = state.me.role === 'lawyer' ? 'Chọn câu hỏi cần tư vấn' : 'Gửi câu hỏi cho luật sư';
    sub.textContent = state.me.role === 'lawyer'
      ? 'Chọn một yêu cầu đang chờ để nhận và trao đổi riêng với người hỏi.'
      : 'Câu hỏi chỉ hiển thị với bạn và luật sư nhận tư vấn.';
    badge.textContent = '';
    composerMode = state.me.role === 'lawyer' ? 'off' : 'new';
  } else {
    const status = STATUS[c.status] || STATUS.closed;
    title.textContent = c.status === 'waiting' && state.tab === 'lobby'
      ? 'Câu hỏi mới từ người dân'
      : c.status === 'waiting' ? 'Đang chờ luật sư nhận' : otherPartyLabel(c);
    sub.textContent = c.question.length > 90 ? `${c.question.slice(0, 90)}…` : c.question;
    badge.textContent = status.label;
    composerMode = c.status === 'in_progress' ? 'send' : 'off';
  }

  closeButton.hidden = !(c && c.status === 'in_progress');
  // Báo cáo bên kia: chỉ khi đã có luật sư nhận (đang tư vấn hoặc đã kết thúc); mỗi cuộc chỉ một báo cáo đang chờ.
  const reportButton = $('[data-chat-report]');
  const canReport = Boolean(c && c.lawyer_id && c.status !== 'waiting');
  const reported = canReport && listReports().some((r) => r.consultation_id === c.id && r.reporter?.id === state.me.id && r.status === 'pending');
  reportButton.hidden = !canReport;
  reportButton.disabled = reported;
  reportButton.textContent = reported ? 'Đã báo cáo' : 'Báo cáo';
  const canAccept = c && c.status === 'waiting' && state.tab === 'lobby';
  accept.hidden = !canAccept;
  composer.hidden = canAccept || (!c && state.me.role === 'lawyer');

  textarea.disabled = composerMode === 'off';
  submit.disabled = composerMode === 'off';
  textarea.placeholder = {
    new: 'Nhập câu hỏi cần luật sư tư vấn (Enter để gửi)...',
    send: 'Nhập tin nhắn (Enter để gửi)...',
    off: !c && state.me.role === 'lawyer'
      ? 'Chọn câu hỏi cần tư vấn trong danh sách.'
      : c?.status === 'waiting' ? 'Đang chờ luật sư nhận câu hỏi...' : 'Cuộc tư vấn đã kết thúc.'
  }[composerMode];
  composer.dataset.mode = composerMode;
  $('[data-terms]').hidden = state.termsAccepted;
}

function renderMessages() {
  const history = $('.chat-history');
  history.replaceChildren();
  const c = active();

  const notice = (text) => {
    const wrap = el('div', 'flex justify-center my-2');
    wrap.append(el('div', 'bg-white border border-slate-200 text-[11px] text-slate-600 px-3 py-1.5 rounded-full', text));
    history.append(wrap);
  };

  if (!c) return notice(state.me.role === 'lawyer'
    ? 'Chọn câu hỏi mới hoặc cuộc tư vấn trong danh sách bên trái.'
    : 'Chọn một cuộc tư vấn hoặc đặt câu hỏi mới.');
  notice(`Câu hỏi: ${c.question}`);
  if (c.status === 'waiting') notice('Yêu cầu đang trong hàng chờ. Khi có luật sư nhận, bạn sẽ nhắn tin được ngay.');

  state.messages.forEach((m) => {
    const mine = m.sender_id === state.me.id;
    const row = el('div', mine ? 'flex items-start justify-end space-x-2.5 max-w-[88%] ml-auto' : 'flex items-start space-x-2.5 max-w-[85%]');
    const body = el('div', mine ? 'flex flex-col items-end' : '');
    const meta = el('div', 'flex items-center space-x-2 mb-1');
    const name = el('span', 'text-xs font-semibold text-slate-800', mine ? 'Bạn' : otherPartyLabel(c));
    const time = el('span', 'text-[10px] text-slate-400', timeText(m.created_at));
    meta.append(...(mine ? [time, name] : [name, time]));
    const bubble = el('div', mine
      ? 'bg-red-600 text-white p-4 rounded-2xl rounded-tr-sm shadow-sm text-sm leading-relaxed max-w-full whitespace-pre-wrap break-words'
      : 'bg-white p-4 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words',
    m.content);
    body.append(meta, bubble);
    row.append(body);
    history.append(row);
  });

  if (c.status === 'closed') notice(CLOSE_REASON[c.close_reason] || 'Cuộc tư vấn đã kết thúc.');
  history.scrollTop = history.scrollHeight;
}

// ---------------------------------------------------------------- Thao tác
async function ensureTerms() {
  if (state.termsAccepted) return true;
  await api('/api/consultations/terms/accept', { method: 'POST', body: { terms_version: state.termsVersion } });
  state.termsAccepted = true;
  renderHeader();
  return true;
}

async function submitComposer() {
  const textarea = $('.chat-composer textarea');
  const content = textarea.value.trim();
  if (!content) return;
  const mode = $('.chat-composer').dataset.mode;

  if (mode === 'new') {
    if (!state.termsAccepted) return showStatus('Vui lòng đồng ý điều khoản tư vấn trước khi gửi câu hỏi.');
    const created = await api('/api/consultations', { method: 'POST', body: { question: content, source: 'lobby' } });
    textarea.value = '';
    state.mine = [created, ...state.mine];
    state.tab = 'mine';
    await select(created.id);
  } else if (mode === 'send') {
    const message = await api(`/api/consultations/${state.activeId}/messages`, { method: 'POST', body: { content } });
    textarea.value = '';
    if (addMessage(message)) renderMessages();
    reloadSoon();
  }
}

async function acceptActive() {
  if (!state.termsAccepted) return showStatus('Vui lòng đồng ý điều khoản tư vấn trước khi nhận câu hỏi.');
  const c = await api(`/api/consultations/${state.activeId}/accept`, { method: 'POST' });
  state.lobby = state.lobby.filter((item) => item.id !== c.id);
  state.mine = [c, ...state.mine.filter((item) => item.id !== c.id)];
  state.tab = 'mine';
  await select(c.id);
}

async function closeActive() {
  if (!window.confirm('Kết thúc cuộc tư vấn này? Sau đó không thể nhắn thêm.')) return;
  const closed = await api(`/api/consultations/${state.activeId}/close`, { method: 'POST' });
  Object.assign(active(), closed);
  await select(null);
  reloadSoon();
}

function bindEvents() {
  const composer = $('.chat-composer');
  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    run(submitComposer);
  });
  composer.querySelector('textarea').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      composer.requestSubmit();
    }
  });
  $('[data-session-search]').addEventListener('input', renderList);
  $('[data-chat-new]').addEventListener('click', () => select(null));
  $('[data-chat-close]').addEventListener('click', () => run(closeActive));
  $('[data-chat-accept]').addEventListener('click', () => run(acceptActive));
  $('[data-terms-accept]').addEventListener('click', () => run(ensureTerms));
  bindReport();
  document.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', async () => {
      state.tab = tab.dataset.tab;
      if (state.tab === 'lobby') await run(loadLobby);
      select(null);
    });
  });
}

// ---------------------------------------------------------------- Báo cáo người dùng trong cuộc tư vấn
// shortcut: BE chưa có API report nên lưu qua report-store.js (máy chủ giả); có API thì gọi POST report của Consultation Service.
function bindReport() {
  const dialog = $('[data-report-dialog]');
  const form = dialog.querySelector('form');
  const error = $('#chat-report-error');
  $('[data-report-reasons]').append(...choiceChips('reason', USER_REASONS));

  $('[data-chat-report]').addEventListener('click', () => {
    const c = active();
    if (!c) return;
    form.reset();
    error.hidden = true;
    $('[data-report-title]').textContent = `Báo cáo ${otherPartyLabel(c).toLowerCase()}`;
    $('[data-report-sub]').textContent = `Cuộc tư vấn: "${c.question.length > 80 ? `${c.question.slice(0, 80)}…` : c.question}". Quản trị viên sẽ xem xét, bạn nhận thông báo khi có kết quả.`;
    dialog.showModal();
  });

  form.addEventListener('submit', (event) => {
    if (event.submitter?.value !== 'send') return;
    const reason = form.elements.reason.value;
    error.hidden = Boolean(reason);
    if (!reason) {
      event.preventDefault();
      form.querySelector('input[name="reason"]').focus();
      return;
    }
    const c = active();
    if (!c) return;
    const question = c.question.length > 60 ? `${c.question.slice(0, 60)}…` : c.question;
    addReport({
      id: `r-${Date.now()}`,
      type: 'user',
      title: reason,
      detail: $('#chat-report-detail').value.trim(),
      target: `${otherPartyLabel(c)} trong cuộc tư vấn "${question}"`,
      page: '',
      consultation_id: c.id,
      reported_user_id: state.me.id === c.citizen_id ? c.lawyer_id : c.citizen_id,
      reporter: { id: state.me.id, name: displayName(state.me), role: state.me.role },
      status: 'pending',
      created_at: new Date().toISOString()
    });
    const notice = $('[data-chat-notice]');
    notice.textContent = 'Đã gửi báo cáo tới quản trị viên. Bạn sẽ nhận thông báo khi có kết quả.';
    notice.hidden = false;
    setTimeout(() => { notice.hidden = true; }, 5000);
    renderHeader();
  });
}

export async function startChatbox() {
  state.me = await fetchCurrentUser();
  state.tab = state.me.role === 'lawyer' ? 'lobby' : 'mine';
  $('[data-lobby-tabs]').hidden = state.me.role !== 'lawyer';
  $('[data-chat-new]').hidden = state.me.role === 'lawyer';
  bindEvents();
  renderList();
  renderHeader();
  renderMessages();

  await run(async () => {
    const terms = await api('/api/consultations/terms');
    state.termsAccepted = terms.accepted;
    state.termsVersion = terms.version;
    renderHeader();
    await loadMine();
    await loadLobby();
    const firstConsultation = [...(state.tab === 'lobby' ? state.lobby : []), ...state.mine].find((c) => c.status !== 'closed');
    if (firstConsultation) await select(firstConsultation.id);
  });

  openChannel('me', onMeEvent, reloadSoon);
  if (state.me.role === 'lawyer') openChannel('lobby', onLobbyEvent, () => run(loadLobby));
}
