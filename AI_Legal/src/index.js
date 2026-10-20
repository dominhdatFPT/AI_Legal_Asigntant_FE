const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const pagesDirectory = path.join(__dirname, 'pages');

app.use(express.static(path.join(__dirname, '..', 'public')));

// Read-only source library: prefer Contract API; use its identical exported
// snapshot when the backend is unavailable. No user cookies or tokens forwarded.
app.get('/api/reference-catalog', async (req, res) => {
  const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  try {
    const response = await fetch(`${backendBase}/api/contracts/reference-catalog?page=1&page_size=100`, {
      signal: AbortSignal.timeout(2500), headers: { Accept: 'application/json' }
    });
    const payload = response.ok ? await response.json() : null;
    if (!payload?.data?.read_only || !Array.isArray(payload.data.items)) throw new Error('Unavailable');
    res.set('X-Reference-Catalog-Source', 'contract-api');
    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public/reference-templates/catalog.json'), 'utf8'));
      res.set('X-Reference-Catalog-Source', 'bundled-contract-snapshot');
      res.set('Cache-Control', 'no-store');
      return res.json({ data: {
        items: data.items, domains: data.domains, classifications: data.classifications,
        counts: data.counts, revision: data.revision, read_only: data.read_only
      }, error: null });
    } catch {
      return res.status(503).json({ data: null, error: { code: 'REFERENCE_CATALOG_UNAVAILABLE', message: 'Kho mẫu chưa sẵn sàng.' } });
    }
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

// Địa chỉ Backend (Gateway) mà trình duyệt sẽ gọi. Đổi bằng biến môi trường BACKEND_URL.
app.get('/api/app-config', (req, res) => {
  const apiBaseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.hostname}:8080`;
  res.json({ apiBaseUrl });
});

app.get('/api/firebase-config', (req, res) => {
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

    return res.json(publicConfig);
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

app.get('/detail-information', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'detail-information.html'));
});

app.get('/user-management', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'user-management.html'));
});

// Keep the existing Procedure library available on its own route.
app.get('/form-library', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'form-library.html'));
});

app.get('/business-form-templates', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'business-form-templates.html'));
});

app.get('/user-dashboard', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'user-dashboard.html'));
});

app.get('/location-search', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'location-search.html'));
});

app.get('/account', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'account.html'));
});

app.get('/kho-mau-don-tham-khao', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'contract-catalog.html'));
});

app.get('/dien-mau-don', (req, res) => {
  const template = typeof req.query.template === 'string' ? `?template=${encodeURIComponent(req.query.template)}` : '';
  res.redirect(302, `/xem-mau-don${template}`);
});

app.get('/xem-mau-don', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'contract-viewer.html'));
});

app.get('/lawyer-registration', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'lawyer-registration.html'));
});

app.get('/api/application-submission-view', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'applicationSubmission.html'));
});

app.get('/applicationSubmission', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'user-dashboard.html'));
});

// Bắt đầu lắng nghe các kết nối
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
  });
}

module.exports = app;
