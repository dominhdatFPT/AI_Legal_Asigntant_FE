const express = require('express');
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

app.get('/ho-so', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'ho-so.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'dashboard.html'));
});

app.get('/detail-information', (req, res) => {
  res.sendFile(path.join(pagesDirectory, 'detail-information.html'));
});

// Route API trả về định dạng JSON
app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'Nguyễn Văn A' },
    { id: 2, name: 'Trần Thị B' }
  ]);
});

// Bắt đầu lắng nghe các kết nối
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
  });
}

module.exports = app;