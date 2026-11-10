// Navbar chung: trang được bảo vệ đã gọi protectPage (điền tên, gắn đăng xuất) nên ở đây không làm gì.
// Trang công khai (kho mẫu, xem mẫu) có data-public: tự điền người dùng nếu đã đăng nhập, chưa thì hiện nút Đăng nhập.
import { clearSession, confirmLogout, displayName, fetchCurrentUser, roleLabel } from '/auth-api.js';

// Màn hình hẹp: cuộn thanh menu ngang tới mục đang chọn (không cuộn cả trang).
const revealActiveLink = () => {
  const links = document.querySelector('.unav-links');
  const active = links?.querySelector('.is-active');
  if (!active || links.scrollWidth <= links.clientWidth) return;
  links.scrollLeft = active.getBoundingClientRect().left - links.getBoundingClientRect().left + links.scrollLeft
    - (links.clientWidth - active.offsetWidth) / 2;
};
revealActiveLink();
window.addEventListener('load', revealActiveLink, { once: true });

// Bấm link sang trang khác trong site: hiện thanh tiến trình dưới navbar (CSS chờ 0,15 giây mới hiện, trang nhanh thì không thấy).
// Mở tab mới, tải file, neo trong trang: bỏ qua. Back/Forward từ bộ nhớ trình duyệt: tắt lại để không kẹt.
const nav = document.querySelector('header.unav');
const stopLoading = () => {
  nav?.classList.remove('is-loading');
  document.documentElement.classList.remove('unav-navigating');
};
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!nav || !link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  nav.classList.add('is-loading');
  document.documentElement.classList.add('unav-navigating');
});
window.addEventListener('pageshow', stopLoading);

const header = document.querySelector('header.unav[data-public]');

if (header) {
  const applyAdminNav = () => {
    const brand = header.querySelector('.unav-brand');
    if (brand) brand.href = '/dashboard';
    const accountLink = header.querySelector('[data-account-link]');
    if (accountLink) {
      accountLink.href = '/dashboard';
      accountLink.title = 'Về trang quản trị';
    }
    const navLinks = header.querySelector('.unav-links');
    if (!navLinks || navLinks.dataset.roleNav === 'admin') return;
    navLinks.dataset.roleNav = 'admin';
    const from = new URLSearchParams(location.search).get('from');
    const activePath = from === 'business-form-templates'
      ? 'ho-so-ho-kinh-doanh'
      : 'ho-so-dat-dai';
    navLinks.innerHTML = [
      ['tong-quan', '/dashboard', 'Tổng quan'],
      ['ho-so-dat-dai', '/land-forms', 'Hồ sơ đất đai'],
      ['ho-so-ho-kinh-doanh', '/business-form-templates', 'Hồ sơ hộ kinh doanh'],
      ['quan-ly-nguoi-dung', '/user-management', 'Quản lý người dùng']
    ].map(([p, href, label]) => (
      `<a class="unav-link${p === activePath ? ' is-active' : ''}"${p === activePath ? ' aria-current="page"' : ''} data-path="${p}" href="${href}">${label}</a>`
    )).join('');
  };

  const fromParam = new URLSearchParams(location.search).get('from');
  if (fromParam === 'land-forms' || fromParam === 'business-form-templates') {
    applyAdminNav();
  }

  const fill = (user) => {
    if (user?.role === 'admin') applyAdminNav();
    const values = { name: displayName(user), role: roleLabel(user.role) };
    header.querySelectorAll('[data-user-field]').forEach((element) => {
      element.textContent = values[element.dataset.userField] ?? '';
    });
  };
  // Hiện ngay tên đã nhớ tạm trong tab (auth-api.js), rồi kiểm tra lại với Backend
  try {
    const cached = JSON.parse(sessionStorage.getItem('ai_legal_user'));
    if (cached) fill(cached);
  } catch {
    // không đọc được thì chờ Backend
  }
  const user = await fetchCurrentUser().catch(() => null);
  if (user) {
    fill(user);
    header.querySelector('[data-logout]').addEventListener('click', () => confirmLogout(user));
  } else {
    clearSession(); // hết phiên: bỏ tên nhớ tạm
    header.querySelector('[data-account-link]').hidden = true;
    header.querySelector('[data-logout]').hidden = true;
    header.querySelector('.unav-login').hidden = false;
  }
}
