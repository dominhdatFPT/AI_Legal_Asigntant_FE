// Ảnh nền đổi tự động + hiện dần khi cuộn: lấy theo user-dashboard, dùng chung cho các trang người dùng.
(() => {
  const carousel = document.querySelector('.hero-carousel');
  if (carousel) {
    const slides = Array.from(carousel.querySelectorAll('[data-carousel-slide]'));
    const dots = Array.from(document.querySelectorAll('[data-carousel-to]'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let activeIndex = 0;
    let timer;

    const showSlide = (index) => {
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === activeIndex;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
        dots[slideIndex]?.setAttribute('aria-pressed', String(active));
      });
    };
    const syncAutoplay = () => {
      window.clearInterval(timer);
      if (!reduceMotion.matches && !document.hidden) {
        timer = window.setInterval(() => showSlide(activeIndex + 1), 6000);
      }
    };

    document.querySelector('[data-carousel-prev]')?.addEventListener('click', () => { showSlide(activeIndex - 1); syncAutoplay(); });
    document.querySelector('[data-carousel-next]')?.addEventListener('click', () => { showSlide(activeIndex + 1); syncAutoplay(); });
    dots.forEach((dot, index) => dot.addEventListener('click', () => { showSlide(index); syncAutoplay(); }));
    showSlide(activeIndex);
    syncAutoplay();
    document.addEventListener('visibilitychange', syncAutoplay);
    reduceMotion.addEventListener('change', syncAutoplay);
  }

  const targets = document.querySelectorAll('[data-reveal]');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('is-visible'));
    return;
  }
  document.documentElement.classList.add('dashboard-motion-ready');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
  targets.forEach((target) => observer.observe(target));
})();
