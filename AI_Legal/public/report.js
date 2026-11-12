// Trang Báo cáo (/report): người dân và luật sư báo lỗi trang web cho quản trị viên.
// Báo cáo người dùng khác nằm trong khung chat tư vấn (chatbox.js). Danh sách bên phải gồm cả hai loại của chính mình.
// Báo cáo lưu ở report-store.js (máy chủ giả), admin xử lý ở /report-management.
// Dữ liệu người dùng nhập chỉ render bằng textContent / createElement.
import { displayName, protectPage } from '/auth-api.js';
import { BUG_ISSUES, BUG_PAGES, STATUS, TYPES, addReport, choiceChips, listReports, onReportsChanged } from '/report-store.js';

const user = await protectPage(['citizen', 'lawyer']);

const $ = (id) => document.getElementById(id);
const form = $('report-form');
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const formatTime = (iso) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

$('report-page').append(...BUG_PAGES.map((page) => Object.assign(document.createElement('option'), { value: page, textContent: page })));
$('report-issues').append(...choiceChips('issue', BUG_ISSUES));

const renderList = () => {
  const mine = listReports().filter((report) => report.reporter?.id === user.id);
  const list = $('report-list');
  list.replaceChildren();
  $('report-empty').hidden = mine.length > 0;
  for (const report of mine) {
    const item = el('li', 'report-item');
    const meta = el('div', 'report-item-meta');
    meta.append(el('span', 'report-tag', TYPES[report.type]), el('span', `report-status report-status--${report.status}`, STATUS[report.status]));
    item.append(meta, el('strong', 'report-item-title', report.title));
    if (report.target) item.append(el('span', 'report-item-sub', `Người bị báo cáo: ${report.target}`));
    if (report.page) item.append(el('span', 'report-item-sub', `Trang: ${report.page}`));
    if (report.note) item.append(el('span', 'report-item-note', `Phản hồi của quản trị viên: ${report.note}`));
    item.append(el('time', 'report-item-time', formatTime(report.created_at)));
    list.append(item);
  }
};

$('report-detail').addEventListener('input', (event) => {
  $('report-detail-count').textContent = event.target.value.length;
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const page = $('report-page').value;
  const issue = form.elements.issue.value;
  $('report-page-error').hidden = Boolean(page);
  $('report-page').setAttribute('aria-invalid', String(!page));
  $('report-issue-error').hidden = Boolean(issue);
  if (!page || !issue) {
    $('report-success').hidden = true;
    (!page ? $('report-page') : form.querySelector('input[name="issue"]')).focus();
    return;
  }

  addReport({
    id: `r-${Date.now()}`,
    type: 'bug',
    title: issue,
    detail: $('report-detail').value.trim(),
    target: '',
    page,
    reporter: { id: user.id, name: displayName(user), role: user.role },
    status: 'pending',
    created_at: new Date().toISOString()
  });
  form.reset();
  $('report-detail-count').textContent = '0';
  $('report-success').hidden = false;
  $('report-success').focus();
});

onReportsChanged(renderList);
renderList();
