const passwordInput = document.querySelector('#password');
const togglePassword = document.querySelector('#toggle-password');
const loginForm = document.querySelector('#login-form');
const formMessage = document.querySelector('#form-message');
const resetLink = document.querySelector('#reset-link');

togglePassword.addEventListener('click', () => {
  const isVisible = passwordInput.type === 'text';
  passwordInput.type = isVisible ? 'password' : 'text';
  togglePassword.setAttribute('aria-pressed', String(!isVisible));
  togglePassword.setAttribute('aria-label', isVisible ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  formMessage.textContent = 'Giao diện đã sẵn sàng, nhưng dịch vụ xác thực chưa được kết nối.';
});

resetLink.addEventListener('click', (event) => {
  event.preventDefault();
  formMessage.textContent = 'Vui lòng liên hệ quản trị viên để đặt lại mật khẩu.';
});