// Đăng ký tài khoản bằng Backend (user-service /auth/register), không dùng Firebase.
import { registerAccount, saveSession, homePathFor } from '/auth-api.js';

const form = document.getElementById('signup-form');
const message = document.getElementById('signup-auth-message');
const submitButton = document.getElementById('signup-submit-button');
const submitLabel = document.getElementById('signup-submit-label');
const submitSpinner = document.getElementById('signup-auth-spinner');
const passwordInput = document.getElementById('password');
const confirmationInput = document.getElementById('confirm-password');

const describeError = (error) => {
  if (error?.code === 'backend/unreachable') {
    return 'Không kết nối được máy chủ. Vui lòng thử lại sau ít phút.';
  }
  if (Array.isArray(error?.details) && error.details.length) {
    return error.details.map((item) => item.message).filter(Boolean).join(' ');
  }
  return error?.backendMessage || 'Không thể tạo tài khoản. Vui lòng thử lại.';
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';

  if (passwordInput.value !== confirmationInput.value) {
    message.textContent = 'Mật khẩu xác nhận không khớp.';
    message.dataset.state = 'error';
    return;
  }

  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');
  submitSpinner.classList.remove('hidden');
  submitLabel.textContent = 'Đang tạo tài khoản...';

  try {
    const data = await registerAccount({
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      password: passwordInput.value,
      confirm_password: confirmationInput.value
    });
    form.reset();
    message.textContent = 'Tài khoản đã tạo thành công. Đang chuyển trang...';
    message.dataset.state = 'success';
    const session = saveSession(data);
    window.location.assign(homePathFor(session.user?.role));
  } catch (error) {
    message.textContent = describeError(error);
    message.dataset.state = 'error';
  } finally {
    submitButton.disabled = false;
    submitButton.setAttribute('aria-busy', 'false');
    submitSpinner.classList.add('hidden');
    submitLabel.textContent = 'Đăng ký';
  }
});
