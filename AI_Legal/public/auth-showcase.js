// Dùng chung cho trang Đăng nhập và Đăng ký.
(() => {
  // Ảnh nền tự đổi mỗi 5,5 giây; người dùng có thể chọn ảnh hoặc tạm dừng.
  // Không tự chạy khi trình duyệt bật "giảm chuyển động" hoặc tab đang ẩn.
  const slides = Array.from(document.querySelectorAll('[data-login-slide]'));
  const dots = Array.from(document.querySelectorAll('[data-slide-dot]'));
  const caption = document.getElementById('slide-caption');
  const pauseButton = document.getElementById('slide-pause-btn');
  const pauseIcon = document.getElementById('slide-pause-icon');
  const pauseLabel = document.getElementById('slide-pause-label');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DOT_ACTIVE = 'h-2.5 w-7 rounded-full bg-[#ecc15a] transition-all cursor-pointer';
  const DOT_IDLE = 'h-2.5 w-2.5 rounded-full bg-white/[0.35] hover:bg-white/60 transition-all cursor-pointer';
  let current = 0;
  let paused = false;
  let timer;

  const show = (index) => {
    current = index;
    slides.forEach((slide, i) => {
      slide.classList.toggle('opacity-100', i === index);
      slide.classList.toggle('opacity-0', i !== index);
    });
    dots.forEach((dot, i) => {
      dot.className = i === index ? DOT_ACTIVE : DOT_IDLE;
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
    if (caption) caption.textContent = slides[index].dataset.caption;
  };

  const schedule = () => {
    window.clearInterval(timer);
    if (paused || reducedMotion.matches || document.hidden) return;
    timer = window.setInterval(() => show((current + 1) % slides.length), 5500);
  };

  if (slides.length > 1) {
    dots.forEach((dot) => dot.addEventListener('click', () => {
      show(Number(dot.dataset.slideDot));
      schedule();
    }));
    pauseButton?.addEventListener('click', () => {
      paused = !paused;
      pauseButton.setAttribute('aria-pressed', String(paused));
      pauseIcon.textContent = paused ? 'play_arrow' : 'pause';
      pauseLabel.textContent = paused ? 'Tiếp tục' : 'Tạm dừng';
      schedule();
    });
    reducedMotion.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', schedule);
    show(0);
    schedule();
  }

  // <button data-toggle-password="id-ô-mật-khẩu"> → hiện/ẩn mật khẩu
  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    const input = document.getElementById(button.dataset.togglePassword);
    const icon = button.querySelector('.material-symbols-outlined');
    button.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      icon.textContent = isPassword ? 'visibility_off' : 'visibility';
      button.setAttribute('aria-pressed', String(isPassword));
      button.setAttribute('aria-label', isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    });
  });

  // <button data-dismiss="id-thông-báo"> → ẩn thông báo
  document.querySelectorAll('[data-dismiss]').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.dismiss).classList.add('hidden'));
  });
})();
