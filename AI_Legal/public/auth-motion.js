// Hiệu ứng dùng chung cho Đăng nhập, Đăng ký, Quên mật khẩu.
// Hiệu ứng trang trí chỉ chạy khi có lớp js-anim (đặt trong <head>, bỏ qua khi máy bật "giảm chuyển động").
// Báo lỗi, trạng thái nút và độ mạnh mật khẩu vẫn chạy cả khi giảm chuyển động, chỉ không rung/không chuyển động.
(() => {
  const root = document.documentElement;
  const animate = root.classList.contains('js-anim');
  const card = document.querySelector('.auth-card');

  // 1. Hộp form hiện ra: tiêu đề và từng ô nhập lần lượt hiện lên
  if (card && animate) {
    const content = card.querySelector('.auth-content');
    const items = [];
    Array.from(content?.children || []).forEach((el) => {
      if (el.matches('form')) items.push(...el.children);
      else items.push(el);
    });
    items.filter((el) => !el.hidden).slice(0, 12).forEach((el, i) => {
      el.style.setProperty('--i', i);
      el.setAttribute('data-stagger', '');
      // Xong thì bỏ, để hiệu ứng rung về sau không làm phần tử hiện lại từ đầu
      el.addEventListener('animationend', () => el.removeAttribute('data-stagger'), { once: true });
    });
  }

  // 2. Mặt trống nền nghiêng nhẹ theo con trỏ (chỉ máy có chuột)
  const bg = document.querySelector('.auth-bg');
  if (bg && animate && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const step = () => {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      bg.style.setProperty('--px', `${x.toFixed(2)}px`);
      bg.style.setProperty('--py', `${y.toFixed(2)}px`);
      raf = Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05 ? requestAnimationFrame(step) : 0;
    };
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / innerWidth - 0.5) * -24;
      ty = (e.clientY / innerHeight - 0.5) * -24;
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
  }

  // 3. Đường vàng chạy dọc viền ô nhập khi bấm vào
  document.querySelectorAll('.auth-card input.peer').forEach((input) => {
    const line = document.createElement('span');
    line.className = 'field-line';
    line.setAttribute('aria-hidden', 'true');
    input.parentElement.appendChild(line);
    input.addEventListener('input', () => input.classList.remove('is-invalid'));
  });

  // 4. Báo lỗi: ô bị lỗi viền cam, rung nhẹ một nhịp và được đưa con trỏ vào
  const shake = (el) => {
    if (!el) return;
    el.classList.remove('is-shaking');
    void el.offsetWidth;
    el.classList.add('is-shaking');
    el.addEventListener('animationend', () => el.classList.remove('is-shaking'), { once: true });
  };
  const visible = (el) => el && el.offsetParent !== null;
  const onError = (source) => {
    const form = source.closest('form') || document.querySelector('.auth-card form:not([hidden])');
    let target = document.activeElement;
    if (!(target instanceof HTMLInputElement) || !form?.contains(target)) {
      target = Array.from(form?.querySelectorAll('input[required]') || []).find((el) => visible(el) && el.type !== 'checkbox' && !el.value.trim());
      target?.focus();
    }
    if (target instanceof HTMLInputElement) {
      if (target.type === 'checkbox') shake(target.closest('label'));
      else {
        target.classList.add('is-invalid');
        shake(target.parentElement);
      }
    } else {
      shake(source);
    }
  };
  // Chỉ phản ứng khi nội dung hoặc trạng thái lỗi thật sự đổi (lớp rung tự thêm không tính, tránh lặp vô hạn)
  const watch = (el, isError) => {
    if (!el) return;
    const signature = () => `${el.classList.contains('hidden')}|${el.dataset.state || ''}|${el.textContent.trim()}`;
    let last = signature();
    new MutationObserver(() => {
      const now = signature();
      if (now === last) return;
      last = now;
      if (isError()) onError(el);
    }).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-state'] });
  };
  ['signup-auth-message', 'reset-message', 'new-password-message'].forEach((id) => {
    const el = document.getElementById(id);
    watch(el, () => el.dataset.state === 'error' && el.textContent.trim() !== '');
  });
  const loginAlert = document.getElementById('form-error-alert');
  watch(loginAlert, () => !loginAlert.classList.contains('hidden') && loginAlert.textContent.trim() !== '');

  // 5. Nút gửi: co lại thành vòng quay khi đang xử lý, hiện dấu tích khi thành công
  document.querySelectorAll('button.auth-btn').forEach((button) => {
    const sync = () => {
      const busy = button.disabled || button.getAttribute('aria-busy') === 'true';
      const wasBusy = button.classList.contains('is-busy');
      button.classList.toggle('is-busy', busy);
      if (wasBusy && !busy) {
        const message = button.form?.querySelector('[data-state]');
        if (message?.dataset.state === 'success') {
          button.classList.add('is-done');
          setTimeout(() => button.classList.remove('is-done'), 1600);
        }
      }
    };
    new MutationObserver(sync).observe(button, { attributes: true, attributeFilter: ['disabled', 'aria-busy'] });
    sync();
  });

  // 6. Thanh độ mạnh mật khẩu cho ô đặt mật khẩu mới
  const LEVELS = [
    { text: 'Yếu', color: '#E4572E', width: '25%' },
    { text: 'Yếu', color: '#E4572E', width: '25%' },
    { text: 'Trung bình', color: '#F2A23A', width: '55%' },
    { text: 'Khá', color: '#F2B544', width: '78%' },
    { text: 'Mạnh', color: '#F2B544', width: '100%' }
  ];
  const score = (value) => {
    if (!value) return -1;
    let s = 0;
    if (value.length >= 8) s++;
    if (value.length >= 12) s++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) s++;
    if (/\d/.test(value)) s++;
    if (/[^A-Za-z0-9]/.test(value)) s++;
    if (value.length < 8) s = Math.min(s, 1);
    return Math.min(s, 4);
  };
  ['password', 'new-password'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    const meter = document.createElement('span');
    meter.className = 'pw-meter';
    meter.setAttribute('aria-hidden', 'true');
    meter.innerHTML = '<span></span>';
    input.parentElement.appendChild(meter);
    const label = input.parentElement.querySelector('label');
    const hint = document.createElement('span');
    hint.className = 'pw-hint';
    hint.setAttribute('aria-live', 'polite');
    label?.appendChild(hint);
    input.addEventListener('input', () => {
      const s = score(input.value);
      const level = LEVELS[Math.max(s, 0)];
      meter.classList.toggle('is-on', s >= 0);
      meter.firstChild.style.width = s >= 0 ? level.width : '0';
      meter.firstChild.style.background = level.color;
      hint.textContent = s >= 0 ? ` · ${level.text}` : '';
      hint.style.color = s >= 0 ? level.color : '';
    });
  });

  // 7. Chuyển giữa 3 trang: nền giữ nguyên, chỉ hộp form mờ đi rồi hiện lại ở trang mới
  const AUTH_PATHS = ['/login', '/signup', '/forgot-password'];
  if (card && animate) {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !AUTH_PATHS.includes(url.pathname) || url.pathname === location.pathname) return;
      e.preventDefault();
      card.classList.add('is-leaving');
      setTimeout(() => location.assign(url.href), 200);
    });
    window.addEventListener('pageshow', (e) => { if (e.persisted) card.classList.remove('is-leaving'); });
  }

  // Khung thông báo thành công (quên mật khẩu) hiện lên nhẹ
  ['reset-success', 'reset-complete', 'reset-invalid', 'new-password-form'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el || !animate) return;
    new MutationObserver(() => { if (!el.hidden) { el.classList.remove('panel-in'); void el.offsetWidth; el.classList.add('panel-in'); } })
      .observe(el, { attributes: true, attributeFilter: ['hidden'] });
  });
})();
