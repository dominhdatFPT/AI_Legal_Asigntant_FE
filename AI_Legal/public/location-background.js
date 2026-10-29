// Match the dashboard's photographs and red overlay; respect reduced motion.
const slides = [...document.querySelectorAll('.location-slide')];
const previous = document.querySelector('[data-background-prev]');
const next = document.querySelector('[data-background-next]');
const toggle = document.querySelector('[data-background-pause]');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let active = 0;
let paused = false;
let timer;
const show = (index) => {
  active = (index + slides.length) % slides.length;
  slides.forEach((slide, position) => slide.classList.toggle('is-active', position === active));
};
const syncTimer = () => {
  clearInterval(timer);
  toggle.hidden = reduced.matches;
  if (!paused && !reduced.matches && !document.hidden) timer = setInterval(() => show(active + 1), 7000);
};
previous.addEventListener('click', () => { show(active - 1); syncTimer(); });
next.addEventListener('click', () => { show(active + 1); syncTimer(); });
toggle.addEventListener('click', () => {
  paused = !paused;
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.setAttribute('aria-label', paused ? 'Tiếp tục ảnh nền' : 'Tạm dừng ảnh nền');
  toggle.querySelector('span').textContent = paused ? 'play_arrow' : 'pause';
  syncTimer();
});
reduced.addEventListener('change', syncTimer);
document.addEventListener('visibilitychange', syncTimer);
window.addEventListener('pagehide', () => clearInterval(timer));
window.addEventListener('pageshow', syncTimer);
syncTimer();
