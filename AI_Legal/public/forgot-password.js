import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  confirmPasswordReset,
  getAuth,
  sendPasswordResetEmail,
  verifyPasswordResetCode
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const form = document.getElementById('reset-form');
const emailInput = document.getElementById('reset-email');
const message = document.getElementById('reset-message');
const submitButton = document.getElementById('reset-submit-button');
const submitLabel = document.getElementById('reset-submit-label');
const spinner = document.getElementById('reset-spinner');
const successPanel = document.getElementById('reset-success');
const confirmation = document.getElementById('reset-email-confirmation');
const resendMessage = document.getElementById('reset-resend-message');
const resendButton = document.getElementById('reset-resend-button');
const heading = document.getElementById('reset-heading');
const description = document.getElementById('reset-description');
const newPasswordForm = document.getElementById('new-password-form');
const newPasswordEmail = document.getElementById('new-password-email');
const newPasswordInput = document.getElementById('new-password');
const confirmNewPasswordInput = document.getElementById('confirm-new-password');
const newPasswordButton = document.getElementById('new-password-submit');
const newPasswordButtonLabel = document.getElementById('new-password-submit-label');
const newPasswordSpinner = document.getElementById('new-password-spinner');
const newPasswordMessage = document.getElementById('new-password-message');
const invalidPanel = document.getElementById('reset-invalid');
const completePanel = document.getElementById('reset-complete');

let authPromise;
let resendTimer;
let resendSeconds = 30;

const getFirebaseAuth = () => {
  if (!authPromise) {
    authPromise = fetch('/api/firebase-config')
      .then(async (response) => {
        if (!response.ok) throw Object.assign(new Error('Firebase config unavailable'), { code: 'firebase/config-unavailable' });
        const config = await response.json();
        return getAuth(initializeApp(config));
      })
      .catch((error) => {
        authPromise = undefined;
        throw error;
      });
  }
  return authPromise;
};

const setLoading = (loading) => {
  submitButton.disabled = loading;
  submitButton.setAttribute('aria-busy', String(loading));
  spinner.classList.toggle('hidden', !loading);
  submitLabel.textContent = loading ? 'Đang gửi' : 'Gửi';
};

const showSuccess = (email) => {
  confirmation.textContent = email;
  form.hidden = true;
  successPanel.hidden = false;
  message.textContent = '';
  startResendCountdown();
};

const startResendCountdown = () => {
  window.clearInterval(resendTimer);
  resendSeconds = 30;
  resendButton.disabled = true;
  resendButton.textContent = `Gửi lại email sau ${resendSeconds} giây`;
  resendTimer = window.setInterval(() => {
    resendSeconds -= 1;
    if (resendSeconds <= 0) {
      window.clearInterval(resendTimer);
      resendButton.disabled = false;
      resendButton.textContent = 'Gửi lại email';
      return;
    }
    resendButton.textContent = `Gửi lại email sau ${resendSeconds} giây`;
  }, 1000);
};

const requestPasswordReset = async (email) => {
  const auth = await getFirebaseAuth();
  try {
    await sendPasswordResetEmail(auth, email, {
      url: `${window.location.origin}/login`,
      handleCodeInApp: false
    });
  } catch (error) {
    // Keep the response identical for unknown accounts to avoid revealing registered emails.
    if (error.code === 'auth/user-not-found') return;
    throw error;
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  message.dataset.state = '';
  const email = emailInput.value.trim();

  if (!emailInput.validity.valid || !email) {
    message.textContent = 'Vui lòng nhập địa chỉ email hợp lệ.';
    message.dataset.state = 'error';
    emailInput.focus();
    return;
  }

  setLoading(true);
  try {
    await requestPasswordReset(email);
    showSuccess(email);
  } catch (error) {
    const messages = {
      'auth/invalid-email': 'Địa chỉ email chưa đúng định dạng. Vui lòng kiểm tra lại.',
      'auth/too-many-requests': 'Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.',
      'auth/operation-not-allowed': 'Chức năng đặt lại mật khẩu chưa được bật trong Firebase Authentication.',
      'firebase/config-unavailable': 'Không tải được cấu hình xác thực. Vui lòng thử lại sau.'
    };
    message.textContent = messages[error.code] || 'Chưa gửi được hướng dẫn. Vui lòng kiểm tra kết nối và thử lại.';
    message.dataset.state = 'error';
  } finally {
    setLoading(false);
  }
});

resendButton.addEventListener('click', async () => {
  resendButton.disabled = true;
  resendButton.textContent = 'Đang gửi lại...';
  resendMessage.textContent = '';
  try {
    await requestPasswordReset(confirmation.textContent);
    startResendCountdown();
  } catch (error) {
    resendButton.disabled = false;
    resendButton.textContent = 'Gửi lại email';
    resendMessage.textContent = error.code === 'auth/too-many-requests'
      ? 'Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.'
      : 'Chưa gửi lại được email. Vui lòng thử lại sau.';
  }
});

const actionCode = new URLSearchParams(window.location.search).get('oobCode');
const actionMode = new URLSearchParams(window.location.search).get('mode');

if (actionMode === 'resetPassword') {
  heading.textContent = 'Đặt mật khẩu mới';
  description.textContent = 'Tạo mật khẩu mới để tiếp tục sử dụng tài khoản của bạn.';
  document.title = 'Đặt mật khẩu mới - Cổng Trợ lý Pháp lý';
  form.hidden = true;
  successPanel.hidden = true;

  if (!actionCode) {
    invalidPanel.hidden = false;
  } else {
    getFirebaseAuth()
      .then((auth) => verifyPasswordResetCode(auth, actionCode))
      .then((email) => {
        newPasswordEmail.textContent = email;
        newPasswordForm.hidden = false;
        newPasswordInput.focus();
      })
      .catch(() => {
        invalidPanel.hidden = false;
      });
  }
}

newPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  newPasswordMessage.textContent = '';
  newPasswordMessage.dataset.state = '';

  if (!newPasswordInput.validity.valid || newPasswordInput.value.length < 8) {
    newPasswordMessage.textContent = 'Mật khẩu cần có ít nhất 8 ký tự.';
    newPasswordMessage.dataset.state = 'error';
    newPasswordInput.focus();
    return;
  }

  if (newPasswordInput.value !== confirmNewPasswordInput.value) {
    newPasswordMessage.textContent = 'Mật khẩu nhập lại không khớp.';
    newPasswordMessage.dataset.state = 'error';
    confirmNewPasswordInput.focus();
    return;
  }

  newPasswordButton.disabled = true;
  newPasswordButton.setAttribute('aria-busy', 'true');
  newPasswordButtonLabel.textContent = 'Đang cập nhật...';
  newPasswordSpinner.classList.remove('hidden');

  try {
    const auth = await getFirebaseAuth();
    await confirmPasswordReset(auth, actionCode, newPasswordInput.value);
    newPasswordForm.hidden = true;
    completePanel.hidden = false;
    window.setTimeout(() => {
      window.location.replace('/login?passwordReset=success');
    }, 900);
  } catch (error) {
    const messages = {
      'auth/expired-action-code': 'Liên kết đã hết hạn. Hãy gửi yêu cầu đặt lại mật khẩu mới.',
      'auth/invalid-action-code': 'Liên kết không còn hợp lệ. Hãy gửi yêu cầu đặt lại mật khẩu mới.',
      'auth/weak-password': 'Mật khẩu chưa đủ mạnh. Hãy chọn mật khẩu khác.'
    };
    newPasswordMessage.textContent = messages[error.code] || 'Chưa thể cập nhật mật khẩu. Vui lòng thử lại.';
    newPasswordMessage.dataset.state = 'error';
    if (error.code === 'auth/expired-action-code' || error.code === 'auth/invalid-action-code') {
      newPasswordForm.hidden = true;
      invalidPanel.hidden = false;
    }
  } finally {
    newPasswordButton.disabled = false;
    newPasswordButton.setAttribute('aria-busy', 'false');
    newPasswordButtonLabel.textContent = 'Lưu mật khẩu mới';
    newPasswordSpinner.classList.add('hidden');
  }
});

