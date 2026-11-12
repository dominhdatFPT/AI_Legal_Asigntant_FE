const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const pagesDirectory = path.join(__dirname, 'pages');

// Navbar chung cho các trang người dùng: một nguồn (partials/user-header.html), chèn vào chỗ <!-- user-header -->
// của trang và đánh dấu sẵn mục đang chọn theo URL, nên khi chuyển trang navbar không nháy hay nhảy.
const userHeaderFile = path.join(__dirname, 'partials', 'user-header.html');
const userFooterFile = path.join(__dirname, 'partials', 'user-footer.html');
const USER_NAV_ACTIVE = {
  '/user-dashboard': 'tong-quan-ho-so',
  '/application-submission': 'document-storages',
  '/document-storages': 'document-storages',
  '/form-library': 'document-storages',
  '/xem-mau-don': 'document-storages',
  '/location-search': 'location-search',
  '/lawyer-registration': 'dang-ky-luat-su',
  '/chatbox': 'chatbox',
  '/report': 'bao-cao',
  '/account': 'account',
  '/detail-information': 'account'
};
// Trang xem được khi chưa đăng nhập: user-header.js tự điền người dùng hoặc hiện nút Đăng nhập.
const PUBLIC_USER_PAGES = new Set(['/xem-mau-don']);
const USER_FONT_LINK = '<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&amp;display=swap" rel="stylesheet">';
// Đã có user nhớ tạm trong tab (auth-api.js) thì hiện trang ngay từ lần vẽ đầu, không nháy trắng chờ kiểm tra đăng nhập.
const USER_HEADER_CORE = '<link rel="stylesheet" href="/user-header.css">'
  + '<style>html.has-user body{visibility:visible!important}</style>'
  + '<script>try{if(sessionStorage.getItem("ai_legal_user"))document.documentElement.classList.add("has-user")}catch(e){}</script>';

const sendUserPage = (fileName) => (req, res, next) => {
  try {
    const active = USER_NAV_ACTIVE[req.path];
    let header = fs.readFileSync(userHeaderFile, 'utf8')
      .replace(`class="unav-link" data-path="${active}"`, `class="unav-link is-active" aria-current="page" data-path="${active}"`);
    if (PUBLIC_USER_PAGES.has(req.path)) header = header.replace('<header class="unav"', '<header class="unav" data-public');
    const rawPage = fs.readFileSync(path.join(pagesDirectory, fileName), 'utf8');
    const headSnippet = rawPage.includes('family=Be+Vietnam+Pro')
      ? USER_HEADER_CORE
      : `${USER_FONT_LINK}${USER_HEADER_CORE}`;
    const page = rawPage
      .replace('</head>', `${headSnippet}</head>`)
      .replace('<!-- user-header -->', header)
      .replace('<!-- user-footer -->', fs.readFileSync(userFooterFile, 'utf8'));
    res.type('html').send(page);
  } catch (error) {
    next(error);
  }
};

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Shell chung cho các trang quản trị: một nguồn (partials/admin-sidebar.html + admin-topbar.html) chèn vào
// hai vị trí đánh dấu của trang, đánh dấu sẵn mục đang mở theo data-path nên sidebar không lặp ở từng trang.
const adminSidebarFile = path.join(__dirname, 'partials', 'admin-sidebar.html');
const adminTopbarFile = path.join(__dirname, 'partials', 'admin-topbar.html');
const ADMIN_NAV_ACTIVE = {
  '/dashboard': 'tong-quan',
  '/landforms': 'ho-so-dat-dai',
  '/land-forms': 'ho-so-dat-dai',
  '/business-form-templates': 'ho-so-ho-kinh-doanh',
  '/user-management': 'quan-ly-nguoi-dung',
  '/lawyer-management': 'quan-ly-luat-su',
  '/report-management': 'quan-ly-bao-cao',
  '/announcements': 'thong-bao-chung'
};

const sendAdminPage = (fileName) => (req, res, next) => {
  try {
    const active = ADMIN_NAV_ACTIVE[req.path];
    const sidebar = fs.readFileSync(adminSidebarFile, 'utf8')
      .replace(`data-path="${active}"`, `data-path="${active}" aria-current="page"`);
    const topbar = fs.readFileSync(adminTopbarFile, 'utf8');
    const page = fs.readFileSync(path.join(pagesDirectory, fileName), 'utf8')
      .replace('<!-- admin-sidebar -->', sidebar)
      .replace('<!-- admin-topbar -->', topbar);
    res.type('html').send(page);
  } catch (error) {
    next(error);
  }
};

// Public reference library and page previews. Cached in-memory to prevent slow DB lookups.
let referenceCatalogCache = null;
let referenceCatalogCacheKey = '';
let referenceCatalogCacheTime = 0;
let bundledCatalogSnapshot = null;
const CATALOG_CACHE_TTL = 120000; // 2 minutes

const loadBundledCatalogSnapshot = () => {
  if (!bundledCatalogSnapshot) {
    const file = path.join(__dirname, '..', 'public', 'reference-templates', 'catalog.json');
    bundledCatalogSnapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return bundledCatalogSnapshot;
};

app.get('/api/reference-catalog', async (req, res) => {
  const now = Date.now();
  const refresh = req.query.refresh === '1';
  const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  if (
    !refresh &&
    referenceCatalogCache &&
    referenceCatalogCacheKey === backendBase &&
    (now - referenceCatalogCacheTime) < CATALOG_CACHE_TTL
  ) {
    res.set('X-Reference-Catalog-Source', 'memory-cache');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
    return res.json(referenceCatalogCache);
  }

  try {
    let payload;
    const items = [];
    for (let page = 1; ; page += 1) {
      const response = await fetch(`${backendBase}/api/contracts/reference-catalog?page=${page}&page_size=100`, {
        signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', Connection: 'close' }
      });
      const result = response.ok ? await response.json() : null;
      if (!result?.data?.read_only || !Array.isArray(result.data.items)) throw new Error('Unavailable');
      payload ||= result;
      items.push(...result.data.items);
      if (page >= (result.data.pagination?.total_pages || 1)) break;
      if (!result.data.items.length || page >= 1000) throw new Error('Invalid pagination');
    }
    payload.data.items = items;
    referenceCatalogCache = payload;
    referenceCatalogCacheKey = backendBase;
    referenceCatalogCacheTime = now;
    res.set('X-Reference-Catalog-Source', 'contract-api');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
    return res.json(payload);
  } catch (err) {
    if (referenceCatalogCache && referenceCatalogCacheKey === backendBase) {
      res.set('X-Reference-Catalog-Source', 'stale-cache');
      return res.json(referenceCatalogCache);
    }
    try {
      const snapshot = loadBundledCatalogSnapshot();
      res.set('X-Reference-Catalog-Source', 'bundled-contract-snapshot');
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=86400');
      return res.json({ data: {
        items: snapshot.items, domains: snapshot.domains, classifications: snapshot.classifications,
        counts: snapshot.counts, revision: snapshot.revision, read_only: snapshot.read_only
      }, error: null });
    } catch {
      console.warn('[Catalog] Cannot fetch from backend API:', err.message);
      return res.status(503).json({ data: null, error: { code: 'REFERENCE_CATALOG_UNAVAILABLE', message: 'Kho mẫu từ cơ sở dữ liệu chưa sẵn sàng.' } });
    }
  }
});

app.get('/api/reference-assets/:assetName', async (req, res) => {
  const { assetName } = req.params;
  if (!/^[a-z0-9-]+\.(png|pdf)$/.test(assetName) || assetName.length > 180) return res.sendStatus(404);
  const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  try {
    const response = await fetch(`${backendBase}/api/contracts/reference-assets/${assetName}`, {
      signal: AbortSignal.timeout(15000), headers: { Connection: 'close' }
    });
    if (!response.ok) return res.sendStatus(response.status === 404 ? 404 : 503);
    const mediaType = assetName.endsWith('.pdf') ? 'application/pdf' : 'image/png';
    if (response.headers.get('content-type')?.split(';')[0] !== mediaType) throw new Error('Invalid asset');
    res.set('Content-Type', mediaType);
    res.set('Content-Disposition', `inline; filename="${assetName}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.send(Buffer.from(await response.arrayBuffer()));
  } catch {
    return res.sendStatus(503);
  }
});

// Proxy các API từ Contract Service qua Gateway
app.use('/api/contracts', async (req, res) => {
  const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  const targetUrl = `${backendBase}${req.originalUrl}`;
  try {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;

    const fetchOptions = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(30000)
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    if (req.method !== 'GET' && req.method !== 'HEAD' && response.ok) {
      referenceCatalogCache = null;
      referenceCatalogCacheTime = 0;
    }
    res.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  } catch (err) {
    console.warn('[Proxy] /api/contracts error:', err.message);
    return res.status(503).json({ error: 'Backend contract service unreachable' });
  }
});

// Proxy các API và tài liệu biểu mẫu từ Procedure Service qua Gateway
app.use('/api/procedures', async (req, res) => {
  const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  const targetUrl = `${backendBase}${req.originalUrl}`;
  try {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;

    const fetchOptions = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(30000)
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    res.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  } catch (err) {
    console.warn('[Proxy] /api/procedures error:', err.message);
    return res.status(503).json({ error: 'Backend procedure service unreachable' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'welcome.html'));
});

// Đăng nhập và Đăng ký là hai khung trên cùng một trang; đường dẫn quyết định khung nào nằm trước.
app.get(['/login', '/signup'], (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'auth.html'));
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

// Cấu hình Firebase (web config, công khai, không phải bí mật). Thứ tự ưu tiên:
//   1. Biến môi trường FIREBASE_CONFIG (JSON)
//   2. `const firebaseConfig = {...};` trong file .env (chạy local)
//   3. firebase-config.json đi kèm code (bản deploy Vercel không có .env)
const loadFirebaseConfig = () => {
  if (process.env.FIREBASE_CONFIG) {
    return JSON.parse(process.env.FIREBASE_CONFIG);
  }
  try {
    const configSource = fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8');
    const configMatch = configSource.match(/const\s+firebaseConfig\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (configMatch) {
      return JSON.parse(configMatch[1].replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":'));
    }
  } catch {
    // Không có .env (vd. trên Vercel) → dùng file cấu hình đi kèm
  }
  return require('./firebase-config.json');
};

app.get('/api/firebase-config', (req, res) => {
  if (cachedFirebaseConfig) {
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json(cachedFirebaseConfig);
  }

  try {
    const configObject = loadFirebaseConfig();
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

app.get('/dashboard', sendAdminPage('dashboard.html'));

app.get('/landforms', sendAdminPage('LandForms-admin.html'));
// Giữ đường dẫn mới để các bookmark hiện tại vẫn mở đúng giao diện cũ.
app.get('/land-forms', sendAdminPage('LandForms-admin.html'));

app.get('/detail-information', sendUserPage('detail-information.html'));

app.get('/user-management', sendAdminPage('user-management.html'));
app.get('/lawyer-management', sendAdminPage('lawyer-management.html'));
app.get('/report-management', sendAdminPage('report-management.html'));
app.get('/announcements', sendAdminPage('announcements.html'));
// Keep the existing Procedure library available on its own route.
app.get('/form-library', sendUserPage('form-library.html'));

app.get('/business-form-templates', sendAdminPage('business-form-templates.html'));

// Trang Thêm/Sửa mẫu đơn dùng chung cho Hồ sơ đất đai và Hồ sơ hộ kinh doanh.
app.get('/form-templates/editor', sendAdminPage('form-template-editor.html'));

app.get('/user-dashboard', sendUserPage('user-dashboard.html'));

app.get('/chatbox', sendUserPage('chatbox.html'));
app.get('/user-chatbox', (req, res) => res.redirect(301, '/chatbox'));

app.get('/location-search', sendUserPage('location-search.html'));

app.get('/account', sendUserPage('account.html'));

app.get('/report', sendUserPage('report.html'));

app.get('/document-storages', sendUserPage('contract-catalog.html'));

app.get('/dien-mau-don', (req, res) => {
  const template = typeof req.query.template === 'string' ? `?template=${encodeURIComponent(req.query.template)}` : '';
  res.redirect(302, `/xem-mau-don${template}`);
});

app.get('/xem-mau-don', sendUserPage('contract-viewer.html'));

// Đường dẫn cũ của trang làm đơn (đã bỏ) chuyển về Tạo hồ sơ, giữ ?template=.
app.get('/lam-don', (req, res) => res.redirect(`/application-submission${req.query.template ? `?template=${encodeURIComponent(String(req.query.template))}` : ''}`));
// Bí danh tương thích cho đường dẫn điền mẫu đơn hiện tại.
app.get('/form-fill', (req, res) => res.redirect(`/application-submission${req.query.template ? `?template=${encodeURIComponent(String(req.query.template))}` : ''}`));

app.get('/lawyer-registration', sendUserPage('lawyer-registration.html'));

app.get('/api/application-submission-view', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'application-submission.html'));
});

app.get('/application-submission', sendUserPage('user-dashboard.html'));

// Đường dẫn cũ (bookmark, link đã gửi) chuyển sang tên mới, giữ nguyên tham số ?procedure=...
const renamedPaths = {
  '/applicationSubmission': '/application-submission',
  '/kho-mau-don-tham-khao': '/document-storages',
  '/document-templates': '/document-storages',
  '/landforms': '/land-forms'
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
