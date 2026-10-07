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
- Đăng ký gửi email xác minh tự động; đăng nhập bằng email chưa xác minh sẽ bị từ chối. Username và số điện thoại được lưu trong hồ sơ Firestore riêng theo UID; số điện thoại hiện chưa xác minh bằng SMS.
