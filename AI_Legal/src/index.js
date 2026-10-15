const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const pagesDirectory = path.join(__dirname, 'pages');

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'welcome.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'signup.html'));
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

app.get('/detail-information', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'detail-information.html'));
});

app.get('/user-management', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'user-management.html'));
});

app.get('/business-form-templates', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'business-form-templates.html'));
});

app.get('/user-dashboard', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'user-dashboard.html'));
});

app.get('/account', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'account.html'));
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
