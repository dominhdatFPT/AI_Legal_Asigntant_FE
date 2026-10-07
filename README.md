# Legal Assistant AI Frontend

Frontend của hệ thống Legal Assistant AI.

## Chạy local

```powershell
npm install
npm start
```

Frontend được quản lý trong GitLab project riêng, độc lập với Backend.

## Firebase Authentication

- Bật Email/Password và Google trong Firebase Authentication.
- Tạo Firestore database rồi triển khai rules trong `firestore.rules` bằng Firebase CLI: `firebase deploy --only firestore:rules --project ai-legal-assistant-7875a`.
- Thêm `localhost` và domain triển khai vào Authorized domains trong Firebase Authentication.
- Đăng ký xong có thể đăng nhập ngay, không yêu cầu xác minh email. Username và số điện thoại được lưu trong hồ sơ Firestore riêng theo UID; số điện thoại hiện chưa xác minh bằng SMS.

## Kết nối Backend

Trang đăng nhập gọi Backend qua Gateway, mặc định `http://localhost:8080`. Đổi địa chỉ bằng biến môi trường `BACKEND_URL`:

```powershell
$env:BACKEND_URL = "http://localhost:8080"
npm run dev
```

Gateway của Backend đã cho phép CORS từ `http://localhost:3000`.

## Đăng nhập

Ô "Tên đăng nhập / Email" nhận 2 loại:

- Có `@` (email): đăng nhập Firebase email/mật khẩu (tài khoản tạo ở `/signup`), sau đó gửi Firebase ID token cho Backend `POST /api/users/auth/firebase`.
- Không có `@` (tên đăng nhập): Backend kiểm tra username/mật khẩu trong database, `POST /api/users/auth/login`.
- Nút "Đăng nhập bằng Google": Firebase Google, rồi gửi ID token cho Backend.

Backend trả về token và `user.role`. `admin` chuyển sang `/dashboard`, các role khác chuyển sang `/user-dashboard`. Token lưu trong `localStorage` (khóa `ai_legal_session`).

Tài khoản quản trị: `admin2026` (mật khẩu do nhóm quản lý, tạo bằng `services/user-service/database/002_seed_admin.sql` ở Backend).
