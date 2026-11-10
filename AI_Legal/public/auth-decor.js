// Đăng nhập, Đăng ký: trang trí nền và hộp form, cảm hứng trống đồng, chim Lạc, sao vàng.
(() => {
  const small = window.innerWidth < 640;

  // 1. Mặt trống đồng ghép từ hạt sau hộp form (dùng chung với Welcome; máy nhỏ vẽ ít hạt hơn)
  const canvas = document.querySelector('[data-constellation="auth"]');
  if (canvas && window.initDrumConstellation) {
    window.initDrumConstellation(canvas, { sparks: small ? 160 : 320, ambient: small ? 30 : 70, scale: small ? 0.95 : 1.15, maxDpr: 1, fps: 30 });
  }

  // 2. Đàn chim Lạc (hình giống Welcome) bay ngang phía trên hộp form
  const bg = document.querySelector('.auth-bg');
  if (bg) {
    const LAC = '<svg viewBox="0 0 200 70" aria-hidden="true"><defs><linearGradient id="lac-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF0B8"/><stop offset=".35" stop-color="#F7D560"/><stop offset="1" stop-color="#C8930E"/></linearGradient></defs><g transform="translate(200 0) scale(-1 1)" fill="url(#lac-gold)"><path d="M2 38 52 33.5 53 36.5Z"/><path d="M50 30Q56 22 66 26Q72 30 70 36Q62 40 52 37Z"/><path d="M60 25Q63 13 76 14Q68 19 66 27Z"/><circle cx="58" cy="31" r="2" fill="#7A4A12"/><path d="M66 30Q80 29 92 36Q120 44 150 42L150 48Q118 52 92 46Q78 42 68 38Z"/><path d="M146 41 198 33 196 37 148 45Z"/><path d="M146 44 199 43 196 47 148 48Z"/><path d="M144 46 192 55 188 57 144 50Z"/><path d="M72 32Q86 32 96 38" stroke="#FFF6D2" stroke-width="1" fill="none" opacity=".8"/><g class="lac-wing"><path d="M92 40Q102 18 134 4Q129 13 127 18Q114 29 104 42Z"/><path d="M100 41Q114 22 150 11Q142 19 138 23Q122 34 110 43Z" opacity=".9"/><path d="M107 43Q124 29 164 21Q154 29 147 32Q130 40 118 45Z" opacity=".8"/><path d="M114 45Q132 36 172 33Q160 39 152 41Q136 46 124 47Z" opacity=".7"/><path d="M98 34Q110 18 130 9" stroke="#FFF6D2" stroke-width="1" fill="none" opacity=".8"/></g></g></svg>';
    const cut = LAC.indexOf('<g class="lac-wing">');
    const open = LAC.slice(0, LAC.indexOf('fill="url(#lac-gold)">') + 'fill="url(#lac-gold)">'.length);
    const LAC_BODY = LAC.slice(0, cut) + '</g></svg>';
    const LAC_WING = open.replace('<svg ', '<svg class="lac-wing-svg" ') + LAC.slice(cut);
    const birds = [['16%', 220, 0.85, '32s', '0s'], ['28%', 170, 0.65, '38s', '-13s'], ['11%', 140, 0.5, '42s', '-26s']];
    const flock = document.createElement('div');
    flock.className = 'auth-lac-flock';
    flock.setAttribute('aria-hidden', 'true');
    birds.slice(0, small ? 2 : 3).forEach(([y, w, o, t, delay], i) => {
      const bird = document.createElement('span');
      bird.className = 'lac';
      bird.style.cssText = `--x:${20 + i * 26}%;--y:${y};--w:${Math.round(w * (small ? 0.55 : 1))}px;--o:${o};--t:${t};--delay:${delay}`;
      // Cánh là một SVG riêng chồng lên thân: vỗ cánh bằng transform của cả phần tử (GPU), không phải vẽ lại SVG
      bird.innerHTML = LAC_BODY + LAC_WING;
      flock.append(bird);
    });
    bg.append(flock);
  }

  // 3. Sao vàng năm cánh trước dòng chào: tự vẽ nét rồi tô vàng khi hộp form hiện, sau đó thỉnh thoảng sáng lên
  document.querySelectorAll('.auth-card .t-label').forEach((label) => {
    label.insertAdjacentHTML('afterbegin', '<svg class="auth-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.6.7-4.9 4.6 1.4 6.6L12 17.3 6 20.6l1.4-6.6-4.9-4.6 6.6-.7z"/></svg>');
  });

})();
