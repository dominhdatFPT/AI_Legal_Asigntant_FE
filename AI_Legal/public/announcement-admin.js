// Trang Thông báo chung (/announcements): admin soạn và gửi thông báo tới toàn bộ người dân, luật sư.
// Dữ liệu ở announcement-store.js (máy chủ giả). Nội dung chỉ render bằng textContent / createElement.
import { displayName, protectPage } from '/auth-api.js';
import { CATEGORIES, LINKS, addAnnouncement, listAnnouncements, onAnnouncementsChanged } from '/announcement-store.js';
import { timeAgo } from '/report-store.js';

const admin = await protectPage(['admin']);

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const form = $('an-form');
const dialog = $('an-dialog');
let draft = null;

$('an-link').append(...Object.entries(LINKS).map(([value, label]) => Object.assign(document.createElement('option'), { value, textContent: label })));

// Cùng một khối cho danh sách "Đã gửi" và bản xem trước trong hộp xác nhận.
const card = (item) => {
  const box = el('div', 'an-card');
  const meta = el('div', 'ra-row-meta');
  meta.append(el('span', `an-tag an-tag--${item.category}`, CATEGORIES[item.category]));
  box.append(meta, el('strong', 'an-card-title', item.title), el('p', 'an-card-body', item.content));
  const foot = [item.created_at ? timeAgo(item.created_at) : 'Gửi ngay khi xác nhận'];
  if (item.link) foot.push(`Mở trang: ${LINKS[item.link]}`);
  box.append(el('span', 'an-card-foot', foot.join(' · ')));
  return box;
};

function render() {
  const items = listAnnouncements();
  $('an-stat-total').textContent = items.length;
  $('an-empty').hidden = items.length > 0;
  $('an-list').replaceChildren(...items.map((item) => {
    const li = el('li', 'an-item');
    li.append(card(item));
    return li;
  }));
}

const showError = (input, message, show) => {
  message.hidden = !show;
  input.setAttribute('aria-invalid', String(show));
};

$('an-content').addEventListener('input', (event) => {
  $('an-content-count').textContent = event.target.value.length;
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = $('an-title-input').value.trim();
  const content = $('an-content').value.trim();
  showError($('an-title-input'), $('an-title-error'), !title);
  showError($('an-content'), $('an-content-error'), !content);
  if (!title || !content) {
    (!title ? $('an-title-input') : $('an-content')).focus();
    return;
  }
  draft = { category: form.elements.category.value, title, content, link: $('an-link').value };
  $('an-preview').replaceChildren(card(draft));
  dialog.showModal();
});

let toastTimer;
dialog.addEventListener('close', () => {
  const send = dialog.returnValue === 'send';
  dialog.returnValue = '';
  if (!send || !draft) return;
  addAnnouncement({ ...draft, id: `a-${Date.now()}`, author: displayName(admin), created_at: new Date().toISOString() });
  draft = null;
  form.reset();
  $('an-content-count').textContent = '0';
  const toast = $('an-toast');
  toast.textContent = 'Đã gửi thông báo tới toàn bộ người dùng.';
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
});
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close('cancel'); });

onAnnouncementsChanged(render);
render();
