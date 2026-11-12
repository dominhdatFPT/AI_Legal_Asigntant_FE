// Chuông thông báo trên header: user-header (người dân, luật sư) và admin-topbar (quản trị viên).
// Thông báo báo cáo lấy từ report-store.js: admin thấy báo cáo mới, người gửi thấy "đã gửi" và "đã xử lý".
// Thông báo chung admin gửi cho mọi người dân, luật sư lấy từ announcement-store.js.
// shortcut: tin nhắn mới đang viết cứng, trạng thái "đã đọc" chỉ nhớ trong tab (sessionStorage);
// khi có Notification Service thì thay bằng API và sự kiện realtime.
// Nội dung chỉ render bằng textContent / createElement.
import { TYPES, listReports, onReportsChanged, timeAgo } from '/report-store.js';
import { CATEGORIES, listAnnouncements, onAnnouncementsChanged } from '/announcement-store.js';

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const MESSAGES = {
  citizen: [{ id: 'c-msg-1', type: 'message', title: 'Tin nhắn mới từ luật sư', body: 'Luật sư vừa trả lời câu hỏi của bạn về thủ tục tách thửa đất.', at: minutesAgo(5), href: '/chatbox' }],
  lawyer: [{ id: 'l-msg-1', type: 'message', title: 'Tin nhắn mới từ người dùng', body: 'Người dùng vừa gửi tin nhắn trong cuộc tư vấn đang mở.', at: minutesAgo(2), href: '/chatbox' }],
  admin: []
};

const reporterLabel = (reporter) => `${reporter?.role === 'lawyer' ? 'Luật sư' : 'Người dân'} ${reporter?.name || ''}`.trim();

function buildItems(role, userId) {
  const reports = listReports();
  const items = [...MESSAGES[role]];
  if (role === 'admin') {
    reports.slice(0, 10).forEach((report) => items.push({
      id: `report-new-${report.id}`,
      type: 'report_new',
      title: report.type === 'user' ? 'Báo cáo người dùng mới' : 'Báo cáo lỗi web mới',
      body: `${reporterLabel(report.reporter)}: ${report.title}`,
      at: report.created_at,
      href: '/report-management',
      read: report.status !== 'pending'
    }));
  } else {
    listAnnouncements().forEach((item) => items.push({
      id: `announcement-${item.id}`,
      type: 'announcement',
      title: item.title,
      body: `${CATEGORIES[item.category] || 'Thông báo'}: ${item.content}`,
      at: item.created_at,
      href: item.link || undefined
    }));
    reports.filter((report) => report.reporter?.id === userId).forEach((report) => {
      if (report.status !== 'pending') items.push({
        id: `report-done-${report.id}`,
        type: 'report_resolved',
        title: report.status === 'resolved' ? 'Báo cáo đã được xử lý' : 'Báo cáo đã được xem xét',
        body: `${TYPES[report.type]}: ${report.title}.${report.note ? ` Phản hồi: ${report.note}` : ''}`,
        at: report.handled_at,
        href: '/report'
      });
      items.push({
        id: `report-sent-${report.id}`,
        type: 'report_sent',
        title: 'Đã gửi báo cáo',
        body: `${TYPES[report.type]}: ${report.title}. Bạn sẽ nhận thông báo khi quản trị viên xử lý xong.`,
        at: report.created_at,
        href: '/report'
      });
    });
  }
  return items.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20);
}

const ICONS = {
  message: 'M4 5h16v11H8l-4 4V5Zm4 4h8m-8 3h5',
  report_new: 'M5 21V4m0 0h11l-2 4 2 4H5',
  report_sent: 'M4 12l16-8-6 16-3-7-7-1Z',
  announcement: 'M4 10v4h3l7 4V6l-7 4H4Zm14-1.5a4.5 4.5 0 0 1 0 7',
  report_resolved: 'M12 3l7 3v5c0 4.6-3 8.5-7 10-4-1.5-7-5.4-7-10V6l7-3Zm-3 9 2 2 4-4'
};
const BELL = 'M12 3a6 6 0 0 0-6 6v3.5L4.5 15v1.5h15V15L18 12.5V9a6 6 0 0 0-6-6Zm-2 15.5a2 2 0 0 0 4 0';

const svg = (d, size) => {
  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('width', size);
  icon.setAttribute('height', size);
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  icon.append(path);
  return icon;
};
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const storageKey = (role) => `ai_legal_notifications_read_${role}`;
const loadRead = (role) => {
  try { return new Set(JSON.parse(sessionStorage.getItem(storageKey(role))) || []); } catch { return new Set(); }
};
const saveRead = (role, ids) => {
  try { sessionStorage.setItem(storageKey(role), JSON.stringify([...ids])); } catch { /* storage bị chặn: chỉ nhớ trong trang */ }
};

function mount(root, role, userId) {
  if (!MESSAGES[role] || root.dataset.mounted) return;
  let items = buildItems(role, userId);
  root.dataset.mounted = 'true';
  const read = loadRead(role);
  const isUnread = (item) => !item.read && !read.has(item.id);

  const button = el('button', 'nbell-button');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `nbell-panel-${role}`);
  const badge = el('span', 'nbell-badge');
  badge.setAttribute('aria-hidden', 'true');
  button.append(svg(BELL, 20), badge);

  const panel = el('section', 'nbell-panel');
  panel.id = `nbell-panel-${role}`;
  panel.setAttribute('aria-label', 'Thông báo');
  panel.hidden = true;
  const head = el('div', 'nbell-head');
  const markAll = el('button', 'nbell-mark-all', 'Đánh dấu đã đọc');
  markAll.type = 'button';
  head.append(el('h2', 'nbell-title', 'Thông báo'), markAll);
  const list = el('ul', 'nbell-list');
  panel.append(head, list);
  root.append(button, panel);
  root.hidden = false;

  const render = () => {
    const unread = items.filter(isUnread).length;
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.hidden = unread === 0;
    button.setAttribute('aria-label', unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo');
    markAll.disabled = unread === 0;
    list.replaceChildren();
    if (!items.length) list.append(el('li', 'nbell-empty', 'Chưa có thông báo nào.'));
    for (const item of items) {
      const li = el('li', `nbell-item${isUnread(item) ? ' is-unread' : ''}`);
      const action = el(item.href ? 'a' : 'button', 'nbell-link');
      if (item.href) action.href = item.href; else action.type = 'button';
      const icon = el('span', `nbell-icon nbell-icon--${item.type}`);
      icon.append(svg(ICONS[item.type] || ICONS.message, 18));
      const text = el('span', 'nbell-text');
      text.append(el('strong', 'nbell-item-title', item.title), el('span', 'nbell-item-body', item.body), el('span', 'nbell-time', timeAgo(item.at)));
      action.append(icon, text);
      if (isUnread(item)) {
        const dot = el('span', 'nbell-dot');
        dot.setAttribute('aria-label', 'Chưa đọc');
        action.append(dot);
      }
      action.addEventListener('click', () => {
        read.add(item.id);
        saveRead(role, read);
        render();
      });
      li.append(action);
      list.append(li);
    }
  };

  // Không để bảng tràn khỏi mép trái màn hình hẹp.
  const keepInView = () => {
    panel.style.right = '0px';
    const left = panel.getBoundingClientRect().left;
    if (left < 12) panel.style.right = `${left - 12}px`;
  };
  const setOpen = (open) => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) keepInView();
  };
  button.addEventListener('click', () => setOpen(panel.hidden));
  markAll.addEventListener('click', () => {
    items.forEach((item) => read.add(item.id));
    saveRead(role, read);
    render();
  });
  document.addEventListener('click', (event) => {
    // composedPath: mục vừa bấm đã bị render() gỡ khỏi DOM, root.contains(target) sẽ sai.
    if (!panel.hidden && !event.composedPath().includes(root)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  window.addEventListener('resize', () => { if (!panel.hidden) keepInView(); });
  const rebuild = () => {
    items = buildItems(role, userId);
    render();
  };
  onReportsChanged(rebuild);
  onAnnouncementsChanged(rebuild);
  render();
}

// Vai trò: admin-topbar ghi sẵn data-role; user-header lấy từ người dùng đã nhớ trong tab (auth-api.js).
// Chưa đăng nhập (trang công khai) thì không hiện chuông.
const cachedUser = () => {
  try { return JSON.parse(sessionStorage.getItem('ai_legal_user')); } catch { return null; }
};

async function init() {
  const roots = document.querySelectorAll('[data-notification-bell]');
  if (!roots.length) return;
  let user = cachedUser();
  if (!user && [...roots].some((root) => !root.dataset.role)) {
    const { fetchCurrentUser } = await import('/auth-api.js');
    user = await fetchCurrentUser().catch(() => null);
  }
  roots.forEach((root) => {
    const rootRole = root.dataset.role || user?.role;
    if (rootRole) mount(root, rootRole, user?.id);
  });
}

init();
