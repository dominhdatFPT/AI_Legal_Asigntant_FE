// Đăng nhập, Đăng ký: sân khấu múa rối nước ở đáy trang (chú Tễu, cô thôn nữ, ông câu cá, rồng).
// Con rối lướt ra, dừng, lật mặt rồi lùi về như nghệ nhân giật sào dưới nước. Chuyển động bằng CSS (tự dừng khi tab ẩn,
// đứng yên khi máy bật "giảm chuyển động"). Dải chỉ hiện khi dưới hộp form còn đủ chỗ, không đè chữ hay nút.
(() => {
  const SKIN = '#F3D3B0', INK = '#2a1a12', RED = '#B4161B', GOLD = '#F2B544', GREEN = '#2E6B4F';
  const arm = (side, d) => `<g class="wp-arm wp-arm-${side}"><path d="${d}" stroke="${SKIN}" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
  const face = (y) => `<circle cx="26.5" cy="${y}" r="1.4" fill="${INK}"/><circle cx="33.5" cy="${y}" r="1.4" fill="${INK}"/><path d="M26 ${y + 5} q4 3.5 8 0" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  const PUPPETS = {
    // Chú Tễu: bụng tròn, khố đỏ, chỏm tóc, cười tươi
    teu: `<svg viewBox="0 0 60 80">${arm('l', 'M18 46 Q8 42 5 32')}${arm('r', 'M42 46 Q52 42 55 32')}
      <g class="wp-bow"><ellipse cx="30" cy="54" rx="15" ry="17" fill="${SKIN}"/><circle cx="30" cy="57" r="1.3" fill="#C98B6B"/>
      <path d="M15 60 Q30 72 45 60 L46 80 L14 80Z" fill="${RED}"/><path d="M15 60 Q30 72 45 60" stroke="${GOLD}" stroke-width="2" fill="none"/>
      <circle cx="30" cy="25" r="13" fill="${SKIN}"/><path d="M27.5 13 q2.5 -7 5 0z" fill="${INK}"/>${face(24)}
      <circle cx="21" cy="29" r="2.4" fill="#E4572E" opacity=".45"/><circle cx="39" cy="29" r="2.4" fill="#E4572E" opacity=".45"/></g></svg>`,
    // Cô thôn nữ: nón lá, áo tứ thân xanh, yếm đỏ
    nu: `<svg viewBox="0 0 60 80">${arm('l', 'M20 40 Q12 48 10 56')}${arm('r', 'M40 40 Q50 34 52 26')}
      <path d="M18 36 Q30 31 42 36 L47 80 L13 80Z" fill="${GREEN}"/><path d="M25.5 36 L34.5 36 L33 52 L27 52Z" fill="${RED}"/>
      <circle cx="30" cy="25" r="9.5" fill="${SKIN}"/>${face(25)}
      <path d="M12 21 L30 5 L48 21Z" fill="${GOLD}"/><path d="M16 21 L30 9 L44 21" stroke="#C99A5B" stroke-width="1" fill="none"/></svg>`,
    // Ông câu cá: khăn đỏ, áo nâu, cần câu vàng
    ca: `<svg viewBox="0 0 60 80"><path d="M44 42 L58 8" stroke="${GOLD}" stroke-width="1.6"/><path d="M58 8 Q60 30 56 46" stroke="#F6DCCF" stroke-width=".7" fill="none" opacity=".7"/>
      ${arm('l', 'M20 42 Q12 50 10 58')}${arm('r', 'M40 42 Q44 42 46 40')}
      <path d="M18 38 Q30 33 42 38 L46 80 L14 80Z" fill="#7A3B1E"/><path d="M18 38 Q30 33 42 38" stroke="${GOLD}" stroke-width="1.5" fill="none"/>
      <circle cx="30" cy="26" r="10" fill="${SKIN}"/>${face(27)}<path d="M19.5 22 Q30 12 40.5 22 L40 19 Q30 9 20 19Z" fill="${RED}"/><path d="M40 21 l6 4 -5 1z" fill="${RED}"/></svg>`,
    // Rồng: đầu bờm đỏ, thân là các khúc uốn nhô lên khỏi mặt nước lệch nhịp
    rong: `<svg viewBox="0 0 120 60" class="wp-dragon">
      ${[0, 1, 2, 3].map((i) => `<path class="wp-hump" style="--h:${i}" d="M${8 + i * 20} 60 Q${18 + i * 20} 30 ${28 + i * 20} 60" stroke="${GOLD}" stroke-width="7" fill="none" stroke-linecap="round"/><path class="wp-hump" style="--h:${i}" d="M${12 + i * 20} 52 Q${18 + i * 20} 38 ${24 + i * 20} 52" stroke="${GREEN}" stroke-width="2" fill="none"/>`).join('')}
      <g class="wp-head"><path d="M88 58 Q92 30 104 24 Q116 22 118 32 Q112 34 108 36 Q104 44 100 58Z" fill="${GOLD}"/>
      <path d="M96 30 Q92 18 100 14 Q100 22 106 22Z" fill="${RED}"/><circle cx="109" cy="28" r="1.8" fill="${INK}"/><path d="M114 34 Q120 38 116 42" stroke="${RED}" stroke-width="1.5" fill="none"/></g></svg>`
  };
  // [kiểu, vị trí bắt đầu (% bề ngang), quãng lướt, chu kỳ, lệch pha, hướng mặt ban đầu]
  const CAST = [['teu', 6, '22vw', '15s', '0s', 1], ['rong', 24, '12vw', '19s', '-6s', 1], ['nu', 60, '-10vw', '17s', '-3s', -1], ['ca', 80, '-12vw', '21s', '-9s', -1]];

  const card = document.querySelector('.auth-card');
  if (!card) return;
  const small = window.innerWidth < 640;
  const stage = document.createElement('div');
  stage.className = 'wp-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = '<div class="wp-curtain"></div>' + (small ? CAST.filter(([k]) => k !== 'ca') : CAST).map(([kind, x, dx, t, delay, dir]) =>
    `<div class="wp-puppet wp-${kind}" style="--x:${x}%;--dx0:${dx};--t:${t};--delay:${delay};--dir:${dir}">
      <span class="wp-ripple"></span><div class="wp-bob"><div class="wp-face">${PUPPETS[kind]}</div></div></div>`).join('') +
    '<div class="wp-water"></div>';
  document.body.append(stage);

  // Chiều cao dải = khoảng trống dưới hộp form (tối đa 150px). Màn rộng: con rối đứng hai bên hộp form nên được cao hơn dải,
  // dải nước được phép mỏng (mép dưới form vẫn trống); màn hẹp: con rối nằm gọn trong dải, thiếu chỗ thì ẩn.
  const puppets = [...stage.querySelectorAll('.wp-puppet')];
  const fit = () => {
    // Trang gộp Đăng nhập/Đăng ký: tính theo cả bộ bài (bề ngang bộ bài + mép khung sau, chiều cao khung cao nhất)
    // để vị trí con rối giống hệt nhau ở cả hai khung, đổi khung không làm rối nhảy chỗ.
    const deck = document.getElementById('auth-deck');
    let r = card.getBoundingClientRect();
    if (deck) {
      const d = deck.getBoundingClientRect();
      const tallest = Math.max(...[...deck.querySelectorAll('.auth-slot')].map((el) => el.offsetHeight));
      r = { left: d.left - 26, right: d.right + 26, bottom: d.top + d.height / 2 + tallest / 2 };
    }
    const wide = r.left >= 180;
    const h = Math.min(150, Math.round(window.innerHeight * 0.18), window.innerHeight - r.bottom - 8);
    const min = wide ? 36 : 72;
    stage.style.visibility = h < min ? 'hidden' : '';
    stage.style.setProperty('--stage-h', `${Math.max(h, min)}px`);
    stage.classList.toggle('wp-wide', wide);
    puppets.forEach((el, i) => {
      el.style.left = el.style.height = '';
      el.style.removeProperty('--dx');
      if (!wide) return;
      // Hai con bên trái hộp form, hai con bên phải; mỗi con đi lại trong ô của mình
      const [from, to] = i < 2 ? [12, r.left - 40] : [r.right + 40, window.innerWidth - 12];
      const slot = (to - from) / 2, start = from + (i % 2) * slot;
      const dragon = el.classList.contains('wp-rong');
      const ratio = dragon ? 2 : 0.75; // rộng / cao
      const ph = Math.min(Math.round(Math.min(220, window.innerHeight * 0.26) * (dragon ? 0.55 : 1)), Math.floor((slot * 0.9) / ratio));
      const room = Math.max(0, slot - ph * ratio) * 0.85;
      const dir = +el.style.getPropertyValue('--dir');
      el.style.height = `${ph}px`;
      el.style.left = `${Math.round(dir > 0 ? start : start + room)}px`;
      el.style.setProperty('--dx', `${Math.round(room * dir)}px`);
    });
  };
  fit();
  window.addEventListener('resize', fit, { passive: true });
})();
