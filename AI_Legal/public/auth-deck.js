// Đăng nhập ⇄ Đăng ký trên cùng một trang (/login và /signup cùng phục vụ auth.html).
// Hai khung xếp chồng như bộ bài: khung sau thu nhỏ, mờ, lộ một mép bên cạnh. Bấm khung sau hoặc link chuyển
// → khung sau trượt ra cạnh, khung trước lùi lại rồi khung mới trượt vào giữa đè lên (chỉ transform/opacity),
// sau đó đổi URL bằng history.pushState. Back/Forward của trình duyệt đổi khung tương ứng.
(() => {
  const root = document.documentElement;
  const deck = document.getElementById('auth-deck');
  if (!deck) return;
  const slots = { login: deck.querySelector('[data-mode="login"]'), signup: deck.querySelector('[data-mode="signup"]') };
  const TITLES = { login: 'Đăng nhập | AI Legal Assistant', signup: 'Đăng ký tài khoản | AI Legal Assistant' };
  const SWITCH_LABEL = { login: 'Chuyển sang Đăng nhập', signup: 'Chuyển sang Đăng ký' };
  const other = (m) => (m === 'login' ? 'signup' : 'login');
  // Phía khung sau lộ ra khi m ở trước: Đăng nhập ở trước thì khung Đăng ký lộ bên trái
  const sideOf = (m) => (m === 'login' ? -1 : 1);
  const small = () => window.innerWidth < 640;
  const modeOfPath = (path) => (path.replace(/\/+$/, '') === '/signup' ? 'signup' : 'login');
  let mode = root.dataset.authMode === 'signup' ? 'signup' : 'login';
  let running = null;

  // Khung sau: thu nhỏ để nằm gọn sau khung trước, lệch ngang cho lộ một mép
  const backTransform = (front, back) => {
    const fw = front.offsetWidth, fh = front.offsetHeight, bw = back.offsetWidth, bh = back.offsetHeight;
    const s = Math.min(0.96, (fh - 24) / bh, (fw - 8) / bw);
    const tx = sideOf(mode) * ((fw - bw * s) / 2 + (small() ? 10 : 26));
    return `translateX(${tx.toFixed(1)}px) scale(${s.toFixed(3)})`;
  };

  const apply = () => {
    const front = slots[mode], back = slots[other(mode)];
    front.classList.remove('is-back');
    front.style.transform = '';
    ['role', 'tabindex', 'aria-label'].forEach((a) => front.removeAttribute(a));
    front.querySelector('.auth-card').inert = false;
    back.classList.add('is-back');
    back.style.transform = backTransform(front, back);
    back.setAttribute('role', 'button');
    back.setAttribute('tabindex', '0');
    back.setAttribute('aria-label', SWITCH_LABEL[other(mode)]);
    back.querySelector('.auth-card').inert = true;
    document.querySelectorAll('.auth-nav a[href]').forEach((a) => {
      const path = new URL(a.href).pathname;
      if (path !== '/login' && path !== '/signup') return;
      if (path === `/${mode}`) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };

  const focusFirst = (slot) => slot.querySelector('input:not([type="hidden"]):not([type="checkbox"])')?.focus({ preventScroll: true });

  // Hộp không tính transform, để FLIP từ vị trí đang thấy về vị trí mới
  const layoutBox = (el) => {
    const t = el.style.transform;
    el.style.transform = 'none';
    const r = el.getBoundingClientRect();
    el.style.transform = t;
    return r;
  };
  const flipFrom = (seen, box) =>
    `translate(${(seen.left + seen.width / 2 - box.left - box.width / 2).toFixed(1)}px, ${(seen.top + seen.height / 2 - box.top - box.height / 2).toFixed(1)}px) scale(${(seen.width / box.width).toFixed(3)})`;

  const go = (next, { push = true } = {}) => {
    if (next === mode) return;
    running?.forEach((a) => a.finish());
    const prev = mode, incoming = slots[next], outgoing = slots[prev];
    const seen = { in: incoming.getBoundingClientRect(), out: outgoing.getBoundingClientRect() };
    const side = sideOf(prev); // khung mới đang lộ ở phía này, sẽ trượt ra phía này
    mode = next;
    root.dataset.authMode = next;
    apply();
    document.title = TITLES[next];
    if (push) window.history.pushState({ authMode: next }, '', `/${next}${window.location.search}`);

    if (!root.classList.contains('js-anim')) {
      focusFirst(incoming);
      return;
    }
    const spread = Math.min(320, window.innerWidth * (small() ? 0.34 : 0.3));
    const opts = { duration: 900, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' };
    const finalBack = outgoing.style.transform;
    [incoming, outgoing].forEach((el) => { el.style.willChange = 'transform, opacity'; });
    deck.classList.add('is-shuffling');
    // Pha 1 khung cũ vẫn nằm trên; từ giữa chừng khung mới vượt lên trên
    outgoing.style.zIndex = '3';
    const raise = setTimeout(() => { outgoing.style.zIndex = ''; incoming.style.zIndex = '4'; }, opts.duration * 0.45);
    running = [
      incoming.animate([
        { transform: flipFrom(seen.in, layoutBox(incoming)), opacity: 0.55 },
        { transform: `translate(${side * spread}px, 0) scale(0.97)`, opacity: 1, offset: 0.45 },
        { transform: 'none', opacity: 1 }
      ], opts),
      outgoing.animate([
        { transform: flipFrom(seen.out, layoutBox(outgoing)), opacity: 1 },
        { transform: `translate(${-side * spread * 0.3}px, 0) scale(0.95)`, opacity: 0.6, offset: 0.45 },
        { transform: finalBack, opacity: 0.55 }
      ], opts)
    ];
    const done = running;
    Promise.all(done.map((a) => a.finished)).catch(() => {}).finally(() => {
      clearTimeout(raise);
      [incoming, outgoing].forEach((el) => { el.style.willChange = ''; el.style.zIndex = ''; });
      if (running === done) {
        running = null;
        deck.classList.remove('is-shuffling');
      }
      if (mode === next) focusFirst(incoming);
    });
  };

  // Link tới /login, /signup (thanh trên, "Đăng ký ngay", "Đã có tài khoản? Đăng nhập") đổi khung tại chỗ
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (link && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !link.target) {
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin && (url.pathname === '/login' || url.pathname === '/signup')) {
        e.preventDefault();
        go(modeOfPath(url.pathname));
        return;
      }
    }
    const back = e.target.closest('.auth-slot.is-back');
    if (back) go(back.dataset.mode);
  });
  deck.addEventListener('keydown', (e) => {
    const back = e.target.closest?.('.auth-slot.is-back');
    if (back && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      go(back.dataset.mode);
    }
  });
  window.addEventListener('popstate', () => go(modeOfPath(window.location.pathname), { push: false }));
  let pending = 0;
  window.addEventListener('resize', () => {
    if (running || pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      slots[other(mode)].style.transform = backTransform(slots[mode], slots[other(mode)]);
    });
  }, { passive: true });

  apply();
  window.history.replaceState({ authMode: mode }, '');
})();
