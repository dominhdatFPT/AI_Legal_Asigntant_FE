// Mặt trống đồng ghép từ hạt tam giác (dùng chung: Welcome, Đăng nhập, Đăng ký).
// window.initDrumConstellation(canvas, { sparks, ambient, scale, scrollSpin, startOnView })
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // ================= Chòm sao trống đồng: tam giác nhỏ lấy mẫu từ hoa văn mặt trống =================
  // Hai lớp: lớp tĩnh hàng chục nghìn tam giác li ti vẽ sẵn một lần để hoa văn (ngôi sao, các vành, hình người, chim) hiện rõ,
  // và vài trăm tam giác lớn hơn chuyển động, lấp lánh, né con trỏ chuột. Cả mặt trống xoay rất chậm.
  const PARTICLE_COLORS = ['#F2B544', '#F2B544', '#F7C766', '#E4572E', '#FF8A5B', '#E5484D', '#F6DCCF', '#C9221F'];
  const drumImage = new Image();
  drumImage.src = '/images/login/dong-son-drum-face.png';
  const drumReady = drumImage.decode().then(() => drumImage).catch(() => null);

  // Điểm thuộc hoa văn = pixel không trong suốt của ảnh mặt trống; toạ độ chuẩn hoá trong đường tròn bán kính 1
  const sampleDrum = (img) => {
    const size = 360;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const points = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[(y * size + x) * 4 + 3] < 140) continue;
        const nx = (x / size) * 2 - 1;
        const ny = (y / size) * 2 - 1;
        // Vành tối ngoài cùng là mảng đặc: chỉ giữ thưa để hoa văn bên trong nổi lên
        if (Math.hypot(nx, ny) > 0.9 && Math.random() > 0.12) continue;
        points.push([nx, ny]);
      }
    }
    return points;
  };

  // Mặt trống nét liền: tô màu thẳng lên nét của ảnh, vàng ấm ở ngôi sao → cam → đỏ đồng ra vành; bỏ lớp nền mờ alpha thấp.
  // Phóng ảnh lên 1600px trước rồi mới cắt ngưỡng alpha, nên mép nét vẫn sắc trên màn retina.
  const PATTERN_SIZE = 1600;
  const DRUM_STOPS = [[0, [255, 222, 150]], [0.3, [246, 190, 84]], [0.6, [236, 136, 58]], [0.9, [200, 78, 46]]];
  const drumColor = (r) => {
    const i = Math.max(0, DRUM_STOPS.findIndex(([at]) => at >= r) - 1);
    const [a, ca] = DRUM_STOPS[i];
    const [b, cb] = DRUM_STOPS[Math.min(i + 1, DRUM_STOPS.length - 1)];
    const k = b > a ? Math.min(1, Math.max(0, (r - a) / (b - a))) : 0;
    // smoothstep cho chỗ chuyển màu không thành vạch
    const s = k * k * (3 - 2 * k);
    return ca.map((v, j) => Math.round(v + (cb[j] - v) * s));
  };
  const tintDrum = (img) => {
    const off = document.createElement('canvas');
    off.width = off.height = PATTERN_SIZE;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, PATTERN_SIZE, PATTERN_SIZE);
    const pixels = ctx.getImageData(0, 0, PATTERN_SIZE, PATTERN_SIZE);
    const data = pixels.data;
    for (let y = 0; y < PATTERN_SIZE; y++) {
      for (let x = 0; x < PATTERN_SIZE; x++) {
        const i = (y * PATTERN_SIZE + x) * 4;
        const r = Math.hypot((x / PATTERN_SIZE) * 2 - 1, (y / PATTERN_SIZE) * 2 - 1);
        // Vành ngoài cùng của ảnh là mảng đặc: bỏ, thay bằng hai đường tròn nét liền vẽ sau
        const a = r > 0.9 ? 0 : Math.min(255, Math.max(0, (data[i + 3] - 110) * 2.6));
        const [cr, cg, cb] = drumColor(r);
        data[i] = cr;
        data[i + 1] = cg;
        data[i + 2] = cb;
        data[i + 3] = a;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    return off;
  };

  // Dự phòng khi không tải được ảnh: các vòng tròn đồng tâm và ngôi sao 14 cánh
  const proceduralDrum = () => {
    const points = [];
    [0.22, 0.42, 0.6, 0.74, 0.86, 0.95].forEach(ring => {
      for (let a = 0; a < Math.PI * 2; a += 0.004) points.push([Math.cos(a) * ring, Math.sin(a) * ring]);
    });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      for (let t = 0.03; t < 0.2; t += 0.002) points.push([Math.cos(a) * t, Math.sin(a) * t]);
    }
    return points;
  };

  const drumPattern = drumReady.then(img => img && tintDrum(img));

  const initConstellation = async (canvas, { sparks, ambient, scale, scrollSpin = false, startOnView = false, maxDpr = 2, fps = 0 }) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = await drumReady;
    const pattern = await drumPattern;
    const source = img ? sampleDrum(img) : proceduralDrum();
    if (!source.length) return;

    const factor = window.innerWidth < 640 ? 0.6 : 1;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const particles = Array.from({ length: Math.round(sparks * factor) }, () => {
      const [nx, ny] = pick(source);
      return {
        nx,
        ny,
        sx: (Math.random() - 0.5) * 3,
        sy: (Math.random() - 0.5) * 3,
        size: 2.6 + Math.random() * 2.6,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.6,
        color: pick(PARTICLE_COLORS),
        alpha: 0.6 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.5
      };
    });
    const dust = Array.from({ length: ambient }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.004,
      vy: (Math.random() - 0.5) * 0.004,
      size: 1.5 + Math.random() * 3,
      rot: Math.random() * Math.PI * 2,
      color: pick(PARTICLE_COLORS),
      alpha: 0.12 + Math.random() * 0.25
    }));

    const triangle = (c, x, y, size, rot) => {
      c.moveTo(x + Math.cos(rot) * size, y + Math.sin(rot) * size);
      c.lineTo(x + Math.cos(rot + 2.094) * size, y + Math.sin(rot + 2.094) * size);
      c.lineTo(x + Math.cos(rot - 2.094) * size, y + Math.sin(rot - 2.094) * size);
      c.closePath();
    };

    // Lớp tĩnh: vẽ một lần vào canvas phụ theo kích thước hiện tại, mỗi khung hình chỉ cần xoay rồi dán lại
    const layer = document.createElement('canvas');
    const layerCtx = layer.getContext('2d');
    let width = 0;
    let height = 0;
    let radius = 0;
    let dpr = 1;
    const renderLayer = () => {
      const side = Math.ceil((radius + 14) * 2);
      layer.width = Math.round(side * dpr);
      layer.height = Math.round(side * dpr);
      layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layerCtx.clearRect(0, 0, side, side);
      const c = side / 2;
      layerCtx.imageSmoothingQuality = 'high';
      const paint = () => {
        if (pattern) {
          layerCtx.drawImage(pattern, c - radius, c - radius, radius * 2, radius * 2);
        } else {
          layerCtx.strokeStyle = '#F2B544';
          layerCtx.lineWidth = 1.5;
          layerCtx.beginPath();
          [0.22, 0.42, 0.6, 0.74, 0.86].forEach(ring => {
            layerCtx.moveTo(c + ring * radius, c);
            layerCtx.arc(c, c, ring * radius, 0, Math.PI * 2);
          });
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            layerCtx.moveTo(c + Math.cos(a) * radius * 0.03, c + Math.sin(a) * radius * 0.03);
            layerCtx.lineTo(c + Math.cos(a) * radius * 0.2, c + Math.sin(a) * radius * 0.2);
          }
          layerCtx.stroke();
        }
        // Vành trống: hai đường tròn nét liền, cùng tông đỏ đồng với vành hoa văn
        layerCtx.strokeStyle = 'rgb(214,98,52)';
        [[0.93, 1.5], [0.99, 2.2]].forEach(([ring, w]) => {
          layerCtx.lineWidth = w;
          layerCtx.beginPath();
          layerCtx.arc(c, c, ring * radius, 0, Math.PI * 2);
          layerCtx.stroke();
        });
      };
      // Lượt 1 có quầng sáng ấm quanh nét, lượt 2 vẽ đè nét sắc lên trên để rực mà không nhoè
      layerCtx.shadowColor = 'rgba(246,160,70,0.55)';
      layerCtx.shadowBlur = Math.max(4, radius * 0.025);
      paint();
      layerCtx.shadowColor = 'transparent';
      layerCtx.shadowBlur = 0;
      paint();
    };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      radius = Math.min(width, height) * 0.5 * scale;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderLayer();
    };
    resize();
    new ResizeObserver(() => {
      if (canvas.clientWidth === width && canvas.clientHeight === height) return;
      resize();
      if (!running) draw(performance.now());
    }).observe(canvas);

    const pointer = { x: -9999, y: -9999 };
    canvas.parentElement.addEventListener('pointermove', (e) => {
      const box = canvas.getBoundingClientRect();
      pointer.x = e.clientX - box.left;
      pointer.y = e.clientY - box.top;
    });
    canvas.parentElement.addEventListener('pointerleave', () => {
      pointer.x = -9999;
      pointer.y = -9999;
    });

    // Trống cuối trang chỉ bắt đầu tụ lại khi lần đầu cuộn tới
    let start = startOnView ? null : performance.now();
    const draw = (now) => {
      const t = start === null ? 0 : (now - start) / 1000;
      const still = reduceMotion.matches;
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      // Mặt trống quay rất chậm, khoảng 3 phút một vòng; trống ở hero quay thêm theo quãng cuộn trang
      const spin = still ? 0 : t * 0.035 + (scrollSpin ? window.scrollY * 0.0022 : 0);
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);
      // Hoa văn hiện dần trong 2 giây đầu, cùng lúc các hạt lớn bay về
      const reveal = still ? 1 : Math.min(1, t / 2);

      ctx.lineWidth = 1;
      dust.forEach(d => {
        if (!still) {
          d.x = (d.x + d.vx / 60 + 1) % 1;
          d.y = (d.y + d.vy / 60 + 1) % 1;
        }
        ctx.globalAlpha = d.alpha;
        ctx.strokeStyle = d.color;
        ctx.beginPath();
        triangle(ctx, d.x * width, d.y * height, d.size, d.rot + (still ? 0 : t * 0.2));
        ctx.stroke();
      });

      ctx.save();
      ctx.globalAlpha = reveal * reveal;
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      const half = layer.width / dpr / 2;
      ctx.drawImage(layer, -half, -half, half * 2, half * 2);
      ctx.restore();

      if (!still && reveal > 0.3) {
        // Mặt trời giữa trống thở sáng
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.26);
        glow.addColorStop(0, `rgba(255,215,140,${(0.22 + 0.14 * Math.sin(t * 2.2)) * reveal})`);
        glow.addColorStop(1, 'rgba(255,215,140,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(cx, cy, radius * 0.26, 0, Math.PI * 2); ctx.fill();
        // Hai vòng sóng lan ra như tiếng trống vang, mỗi nhịp 3,2 giây
        ctx.lineWidth = 1.2;
        [0, 0.5].forEach(offset => {
          const beat = ((t / 3.2) + offset) % 1;
          ctx.strokeStyle = `rgba(242,181,68,${0.5 * (1 - beat) * reveal})`;
          ctx.beginPath(); ctx.arc(cx, cy, radius * (0.1 + beat), 0, Math.PI * 2); ctx.stroke();
        });
      }

      particles.forEach(p => {
        const k = still ? 1 : Math.min(1, Math.max(0, (t - p.delay) / 1.8));
        const ease = 1 - Math.pow(1 - k, 3);
        const rx = p.nx * cos - p.ny * sin;
        const ry = p.nx * sin + p.ny * cos;
        let x = cx + (rx + p.sx * (1 - ease)) * radius;
        let y = cy + (ry + p.sy * (1 - ease)) * radius;
        // Hạt né nhẹ con trỏ chuột
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 80 && dist > 0.01) {
          const push = (80 - dist) / 80 * 18;
          x += (dx / dist) * push;
          y += (dy / dist) * push;
        }
        ctx.globalAlpha = p.alpha * ease * (still ? 1 : 0.6 + 0.4 * Math.sin(t * 1.6 + p.phase));
        ctx.strokeStyle = p.color;
        ctx.beginPath();
        triangle(ctx, x, y, p.size, p.rot + (still ? 0 : t * p.spin));
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    };

    // Chỉ chạy hoạt ảnh khi canvas đang hiện trên màn hình và tab đang mở
    let running = false;
    let visible = false;
    let frame = 0;
    // fps > 0: chỉ vẽ lại tối đa fps lần/giây; trong lúc hai khung Đăng nhập/Đăng ký đổi chỗ vẽ thưa hơn (vẫn chạy tiếp theo thời gian thật)
    let last = 0;
    const loop = (now) => {
      const cap = fps && canvas.ownerDocument.querySelector('.auth-deck.is-shuffling') ? fps / 2 : fps;
      if (!cap || now - last >= 1000 / cap - 2) {
        last = now;
        draw(now);
      }
      frame = requestAnimationFrame(loop);
    };
    const sync = () => {
      const shouldRun = visible && !document.hidden && !reduceMotion.matches;
      if (shouldRun && !running) {
        running = true;
        frame = requestAnimationFrame(loop);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
    };
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= (startOnView ? 0.35 : 0);
      // Ra hẳn khỏi màn hình thì lần quay lại các hạt bay về tụ thành mặt trống từ đầu
      if (!entry.isIntersecting) start = null;
      if (visible && start === null) start = performance.now();
      sync();
    }, { threshold: [0, startOnView ? 0.35 : 0] }).observe(canvas);
    document.addEventListener('visibilitychange', sync);
    reduceMotion.addEventListener?.('change', () => {
      sync();
      if (!running) draw(performance.now());
    });
    draw(performance.now());
  };

  window.initDrumConstellation = initConstellation;
})();
