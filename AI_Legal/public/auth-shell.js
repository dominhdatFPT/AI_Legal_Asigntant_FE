(() => {
  const slides = Array.from(document.querySelectorAll('[data-login-slide]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const slideDuration = 5500;

  if (slides.length < 2) return;

  let slideshowTimer;

  const showCurrentSlide = () => {
    const activeIndex = Math.floor(Date.now() / slideDuration) % slides.length;
    slides.forEach((slide, index) => {
      slide.classList.toggle('opacity-100', index === activeIndex);
      slide.classList.toggle('opacity-0', index !== activeIndex);
    });
  };

  const syncSlideshowMotion = () => {
    window.clearTimeout(slideshowTimer);
    window.clearInterval(slideshowTimer);
    slideshowTimer = undefined;
    showCurrentSlide();
    if (reducedMotion.matches || document.hidden) return;

    const untilNextSlide = slideDuration - (Date.now() % slideDuration);
    slideshowTimer = window.setTimeout(() => {
      showCurrentSlide();
      slideshowTimer = window.setInterval(showCurrentSlide, slideDuration);
    }, untilNextSlide);
  };

  syncSlideshowMotion();
  reducedMotion.addEventListener('change', syncSlideshowMotion);
  document.addEventListener('visibilitychange', syncSlideshowMotion);
})();
