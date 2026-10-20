# Legal Assistant AI Frontend

Frontend của hệ thống Legal Assistant AI.

## Chạy local

```powershell
npm install
npm start
```

Frontend được quản lý trong GitLab project riêng, độc lập với Backend.

## Kho biểu mẫu

Mở `/kho-mau-don-tham-khao` để tìm kiếm, lọc và xem đủ 30 tài liệu / 114 trang. Trang chỉ xem, không điền hoặc lưu nháp hợp đồng. Có bốn nhóm: đất đai (18), doanh nghiệp/hộ kinh doanh (10), hợp tác xã (1), BHXH (1).

Nguồn chính là API Contract qua `/api/reference-catalog` của server FE; khi backend không kết nối được, dùng snapshot tại `AI_Legal/public/reference-templates/catalog.json`. Các ảnh/PDF được xuất từ cùng bộ asset Contract và nằm cùng thư mục. Bộ lọc gồm lĩnh vực, thủ tục và tìm kiếm không dấu; danh sách phân trang 12 mẫu/trang. Ảnh trang được render ở 216 DPI; trang xem không hiện nhãn trạng thái, ghi chú hoặc tên file nguồn.

Không chỉnh JSON FE riêng lẻ. Chuẩn hóa tên tại `backend/services/contract-service/scripts/build_reference_catalog.py`; phân loại tại `backend/services/procedure-service/app/reference_classifications.json`, sau đó chạy builder với `--sync-frontend`. Chi tiết: `backend/docs/api/REFERENCE_LIBRARY_RELEASE.md`.

Trang đọc: `/xem-mau-don?template={id}`. Đường dẫn `/dien-mau-don` cũ chuyển sang trang xem.

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
