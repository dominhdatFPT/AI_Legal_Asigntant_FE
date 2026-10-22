const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const pagesDirectory = path.join(__dirname, 'pages');

// Navbar chung cho các trang người dùng: một nguồn (partials/user-header.html), chèn vào chỗ <!-- user-header -->
// của trang và đánh dấu sẵn mục đang chọn theo URL, nên khi chuyển trang navbar không nháy hay nhảy.
const userHeaderFile = path.join(__dirname, 'partials', 'user-header.html');
const USER_NAV_ACTIVE = {
  '/user-dashboard': 'tong-quan-ho-so',
  '/application-submission': 'nop-ho-so-truc-tuyen',
  '/document-storages': 'document-storages',
  '/form-library': 'document-storages',
  '/xem-mau-don': 'document-storages',
  '/location-search': 'location-search',
  '/lawyer-registration': 'dang-ky-luat-su',
  '/account': 'account',
  '/detail-information': 'account'
};
// Trang xem được khi chưa đăng nhập: user-header.js tự điền người dùng hoặc hiện nút Đăng nhập.
const PUBLIC_USER_PAGES = new Set(['/document-storages', '/xem-mau-don']);
// Đã có user nhớ tạm trong tab (auth-api.js) thì hiện trang ngay từ lần vẽ đầu, không nháy trắng chờ kiểm tra đăng nhập.
const USER_HEADER_HEAD = '<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="/user-header.css">'
  + '<style>html.has-user body{visibility:visible!important}</style>'
  + '<script>try{if(sessionStorage.getItem("ai_legal_user"))document.documentElement.classList.add("has-user")}catch(e){}</script>';

const sendUserPage = (fileName) => (req, res, next) => {
  try {
    const active = USER_NAV_ACTIVE[req.path];
    let header = fs.readFileSync(userHeaderFile, 'utf8')
      .replace(`class="unav-link" data-path="${active}"`, `class="unav-link is-active" aria-current="page" data-path="${active}"`);
    if (PUBLIC_USER_PAGES.has(req.path)) header = header.replace('<header class="unav"', '<header class="unav" data-public');
    const page = fs.readFileSync(path.join(pagesDirectory, fileName), 'utf8')
      .replace('</head>', `${USER_HEADER_HEAD}</head>`)
      .replace('<!-- user-header -->', header);
    res.type('html').send(page);
  } catch (error) {
    next(error);
  }
};

app.use(express.static(path.join(__dirname, '..', 'public')));

// Read-only source library: prefer Contract API; use its identical exported
// snapshot when the backend is unavailable. No user cookies or tokens forwarded.
app.get('/api/reference-catalog', async (req, res) => {
  const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  try {
    const response = await fetch(`${backendBase}/api/contracts/reference-catalog?page=1&page_size=100`, {
      signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json', Connection: 'close' }
    });
    const payload = response.ok ? await response.json() : null;
    if (!payload?.data?.read_only || !Array.isArray(payload.data.items)) throw new Error('Unavailable');
    res.set('X-Reference-Catalog-Source', 'contract-api');
    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (err) {
    console.warn('[Catalog] Cannot fetch from backend API:', err.message);
    return res.status(503).json({ data: null, error: { code: 'REFERENCE_CATALOG_UNAVAILABLE', message: 'Kho mẫu từ cơ sở dữ liệu chưa sẵn sàng.' } });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'welcome.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'signup.html'));
});

// Điều khoản sử dụng & Chính sách bảo vệ dữ liệu cá nhân (link từ trang Đăng ký).
app.get('/dieu-khoan', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'dieu-khoan.html'));
});

app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'forgot-password.html'));
});

// Bộ nhớ đệm (in-memory cache) cấu hình Firebase để tránh đọc đĩa và parse regex mỗi request
let cachedFirebaseConfig = null;

// Địa chỉ Backend (Gateway) mà trình duyệt sẽ gọi. Đổi bằng biến môi trường BACKEND_URL.
app.get('/api/app-config', (req, res) => {
  const apiBaseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.hostname}:8080`;
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ apiBaseUrl });
});

app.get('/api/firebase-config', (req, res) => {
  if (cachedFirebaseConfig) {
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json(cachedFirebaseConfig);
  }

  try {
    const configSource = fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8');
    const configMatch = configSource.match(/const\s+firebaseConfig\s*=\s*(\{[\s\S]*?\})\s*;/);

    if (!configMatch) {
      return res.status(503).json({ error: 'Firebase configuration is unavailable.' });
    }

    const configObject = JSON.parse(
      configMatch[1].replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    );
    const publicKeys = [
      'apiKey',
      'authDomain',
      'projectId',
      'storageBucket',
      'messagingSenderId',
      'appId',
      'measurementId'
    ];
    const publicConfig = Object.fromEntries(
      publicKeys
        .filter((key) => typeof configObject[key] === 'string')
        .map((key) => [key, configObject[key]])
    );

    if (!publicConfig.apiKey || !publicConfig.authDomain || !publicConfig.projectId || !publicConfig.appId) {
      return res.status(503).json({ error: 'Firebase configuration is incomplete.' });
    }

    cachedFirebaseConfig = publicConfig;
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json(cachedFirebaseConfig);
  } catch {
    return res.status(503).json({ error: 'Firebase configuration could not be loaded.' });
  }
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'dashboard.html'));
});

app.get('/landforms', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'LandForms-admin.html'));
});

app.get('/detail-information', sendUserPage('detail-information.html'));

app.get('/user-management', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'user-management.html'));
});

// Keep the existing Procedure library available on its own route.
app.get('/form-library', sendUserPage('form-library.html'));

app.get('/business-form-templates', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'business-form-templates.html'));
});

app.get('/user-dashboard', sendUserPage('user-dashboard.html'));

app.get('/location-search', sendUserPage('location-search.html'));

app.get('/account', sendUserPage('account.html'));

app.get('/document-storages', sendUserPage('contract-catalog.html'));

app.get('/dien-mau-don', (req, res) => {
  const template = typeof req.query.template === 'string' ? `?template=${encodeURIComponent(req.query.template)}` : '';
  res.redirect(302, `/xem-mau-don${template}`);
});

app.get('/xem-mau-don', sendUserPage('contract-viewer.html'));

app.get('/lawyer-registration', sendUserPage('lawyer-registration.html'));

app.get('/api/application-submission-view', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'application-submission.html'));
});

app.get('/application-submission', sendUserPage('user-dashboard.html'));

// Đường dẫn cũ (bookmark, link đã gửi) chuyển sang tên mới, giữ nguyên tham số ?procedure=...
const renamedPaths = {
  '/applicationSubmission': '/application-submission',
  '/kho-mau-don-tham-khao': '/document-storages',
  '/document-templates': '/document-storages'
};
Object.entries(renamedPaths).forEach(([oldPath, newPath]) => {
  app.get(oldPath, (req, res) => {
    res.redirect(301, req.originalUrl.replace(oldPath, newPath));
  });
});

// Bắt đầu lắng nghe các kết nối
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
  });
}

module.exports = app;
