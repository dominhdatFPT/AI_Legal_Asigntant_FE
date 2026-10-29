// =============================================================================
// PHÂN TRANG PHÍA CLIENT cho các bảng quản trị (người dùng, luật sư, mẫu đơn).
// Mặc định 10 dòng mỗi trang. Dùng: page = clampPage(page, total, size); pageSlice(rows, page, size);
// renderPager(container, { page, total, size, classes, onChange }).
// =============================================================================
export const PAGE_SIZE = 10;

// Kiểu nút theo giao diện từng trang (class đã có sẵn trong CSS của trang).
export const ADMIN_PAGER_CLASSES = {
  nav: 'p-1.5 rounded-lg text-stone-600 hover:bg-stone-200 disabled:opacity-40',
  page: 'w-8 h-8 rounded-lg bg-white border border-stone-300 text-stone-800 hover:bg-amber-50 font-label-badge text-xs',
  active: 'w-8 h-8 rounded-lg bg-gradient-to-r from-red-700 to-red-600 text-white font-label-badge text-xs font-bold shadow-sm',
  gap: 'px-1 text-stone-400 text-xs'
};
export const FORM_PAGER_CLASSES = {
  nav: 'p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface disabled:opacity-40',
  page: 'w-8 h-8 rounded hover:bg-surface-container text-on-surface font-medium flex items-center justify-center text-label-md',
  active: 'w-8 h-8 rounded bg-primary text-on-primary font-bold flex items-center justify-center text-label-md shadow-xs',
  gap: 'px-1 text-outline'
};

export const pageCount = (total, size = PAGE_SIZE) => Math.max(1, Math.ceil(total / size));
export const clampPage = (page, total, size = PAGE_SIZE) => Math.min(Math.max(1, page || 1), pageCount(total, size));
export const pageSlice = (items, page, size = PAGE_SIZE) => items.slice((page - 1) * size, page * size);

// Số trang hiển thị: đủ hết khi ≤ 7 trang, nếu không thì 1 … (trang-1, trang, trang+1) … cuối.
export function pageNumbers(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return keep.flatMap((n, i) => (i && n - keep[i - 1] > 1 ? ['…', n] : [n]));
}

export function renderPager(container, { page, total, size = PAGE_SIZE, classes = ADMIN_PAGER_CLASSES, onChange }) {
  if (!container) return;
  if (!total) { container.innerHTML = ''; return; }
  const pages = pageCount(total, size);
  const nav = (target, icon, label, disabled) =>
    `<button type="button" data-page="${target}" class="${classes.nav}" aria-label="${label}" title="${label}" ${disabled ? 'disabled' : ''}><span class="material-symbols-outlined text-[18px] pointer-events-none">${icon}</span></button>`;
  container.innerHTML = [
    nav(page - 1, 'chevron_left', 'Trang trước', page <= 1),
    ...pageNumbers(page, pages).map((n) => (n === '…'
      ? `<span class="${classes.gap}" aria-hidden="true">…</span>`
      : `<button type="button" data-page="${n}" class="${n === page ? classes.active : classes.page}" aria-label="Trang ${n}"${n === page ? ' aria-current="page"' : ''}>${n}</button>`)),
    nav(page + 1, 'chevron_right', 'Trang sau', page >= pages)
  ].join('');
  container.onclick = (e) => {
    const btn = e.target.closest('button[data-page]');
    if (btn && !btn.disabled) onChange(Number(btn.dataset.page));
  };
}
