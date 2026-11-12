// Trang Quản lí báo cáo (/report-management): admin xem, lọc, xử lý hoặc bỏ qua báo cáo của người dân và luật sư.
// Dữ liệu ở report-store.js (máy chủ giả). Dữ liệu người dùng gửi chỉ render bằng textContent / createElement.
import { protectPage } from '/auth-api.js';
import { STATUS, TYPES, listReports, onReportsChanged, timeAgo, updateReport } from '/report-store.js';

await protectPage(['admin']);

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const formatTime = (iso) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const ROLE = { citizen: 'Người dân', lawyer: 'Luật sư' };
const reporterText = (report) => `${ROLE[report.reporter?.role] || 'Người dùng'} · ${report.reporter?.name || 'Không rõ'}`;

let status = 'pending';
let openId = null;
const dialog = $('ra-dialog');

const meta = (report) => {
  const box = el('div', 'ra-row-meta');
  box.append(el('span', `ra-tag ra-tag--${report.type}`, TYPES[report.type]), el('span', `ra-status ra-status--${report.status}`, STATUS[report.status]));
  return box;
};

function render() {
  const reports = listReports();
  const counts = { all: reports.length, pending: 0, resolved: 0, dismissed: 0 };
  reports.forEach((report) => { counts[report.status] += 1; });
  document.querySelectorAll('[data-count]').forEach((node) => { node.textContent = counts[node.dataset.count]; });
  ['pending', 'resolved', 'dismissed'].forEach((key) => { $(`ra-stat-${key}`).textContent = counts[key]; });

  const query = $('ra-search').value.trim().toLowerCase();
  const type = $('ra-type').value;
  const shown = reports.filter((report) => (status === 'all' || report.status === status)
    && (!type || report.type === type)
    && (!query || [report.title, report.reporter?.name, report.target].some((text) => text?.toLowerCase().includes(query))));

  const list = $('ra-list');
  list.replaceChildren();
  $('ra-empty').hidden = shown.length > 0;
  for (const report of shown) {
    const item = el('li', 'ra-row');
    const main = el('div', 'ra-row-main');
    const sub = [reporterText(report)];
    if (report.target) sub.push(`Báo cáo: ${report.target}`);
    if (report.page) sub.push(`Trang: ${report.page}`);
    main.append(meta(report), el('strong', 'ra-row-title', report.title), el('span', 'ra-row-sub', sub.join(' · ')));
    const side = el('div', 'ra-row-side');
    const time = el('time', 'ra-row-time', timeAgo(report.created_at));
    time.dateTime = report.created_at;
    const view = el('button', 'ra-button', report.status === 'pending' ? 'Xử lý' : 'Xem');
    view.type = 'button';
    view.addEventListener('click', () => openReport(report.id));
    side.append(time, view);
    item.append(main, side);
    list.append(item);
  }
}

function openReport(id) {
  const report = listReports().find((item) => item.id === id);
  if (!report) return;
  openId = id;
  $('ra-dialog-meta').replaceWith(Object.assign(meta(report), { id: 'ra-dialog-meta' }));
  $('ra-dialog-title').textContent = report.title;
  const rows = [
    ['Người gửi', reporterText(report)],
    ['Thời gian gửi', formatTime(report.created_at)],
    report.target && ['Người bị báo cáo', report.target],
    report.page && ['Trang gặp lỗi', report.page],
    ['Mô tả', report.detail || 'Không có'],
    report.handled_at && ['Thời gian xử lý', formatTime(report.handled_at)],
    report.status !== 'pending' && ['Phản hồi đã gửi', report.note || 'Không có']
  ].filter(Boolean);
  $('ra-detail').replaceChildren(...rows.flatMap(([label, value]) => [el('dt', '', label), el('dd', '', value)]));
  const pending = report.status === 'pending';
  $('ra-note').value = '';
  $('ra-note-field').hidden = !pending;
  $('ra-actions-pending').hidden = !pending;
  $('ra-actions-done').hidden = pending;
  dialog.showModal();
}

let toastTimer;
const toast = (message) => {
  const box = $('ra-toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 3500);
};

dialog.addEventListener('close', () => {
  const action = dialog.returnValue;
  dialog.returnValue = '';
  if (!openId || (action !== 'resolved' && action !== 'dismissed')) return;
  updateReport(openId, { status: action, note: $('ra-note').value.trim(), handled_at: new Date().toISOString() });
  toast(action === 'resolved' ? 'Đã đánh dấu đã xử lý. Người gửi sẽ nhận thông báo.' : 'Đã bỏ qua báo cáo. Người gửi sẽ nhận thông báo.');
  openId = null;
});
// Bấm ra nền mờ ngoài hộp thoại thì đóng (không đổi trạng thái).
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close('cancel'); });

$('ra-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-status]');
  if (!button) return;
  status = button.dataset.status;
  document.querySelectorAll('#ra-tabs button').forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
  render();
});
$('ra-search').addEventListener('input', render);
$('ra-type').addEventListener('change', render);
onReportsChanged(render);
render();
