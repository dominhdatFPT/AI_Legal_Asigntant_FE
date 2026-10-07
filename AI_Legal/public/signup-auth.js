import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendEmailVerification,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  deleteDoc,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const form = document.getElementById('signup-form');
const message = document.getElementById('signup-auth-message');
const submitButton = document.getElementById('signup-submit-button');
const submitLabel = document.getElementById('signup-submit-label');
const submitSpinner = document.getElementById('signup-auth-spinner');
const passwordInput = document.getElementById('password');
const confirmationInput = document.getElementById('confirm-password');
let servicesPromise;

const fields = [
  {
    input: document.getElementById('username'),
    wrapper: document.getElementById('username').parentElement,
    error: document.getElementById('username-error'),
    getMessage(value) {
      return value.trim() ? '' : 'Vui lòng nhập tên đăng nhập.';
    }
  },
  {
    input: document.getElementById('email'),
    wrapper: document.getElementById('email').parentElement,
    error: document.getElementById('email-error'),
    getMessage(value, input) {
      if (!value.trim()) return 'Vui lòng nhập email.';
      return input.validity.typeMismatch ? 'Vui lòng nhập địa chỉ email hợp lệ.' : '';
    }
  },
  {
    input: document.getElementById('phone'),
    wrapper: document.getElementById('phone').parentElement,
    error: document.getElementById('phone-error'),
    getMessage(value) {
      return value.trim() ? '' : 'Vui lòng nhập số điện thoại.';
    }
  },
  {
    input: passwordInput,
    wrapper: passwordInput.parentElement,
    error: document.getElementById('password-error'),
    getMessage(value, input) {
      if (!value) return 'Vui lòng nhập mật khẩu.';
      return input.validity.tooShort ? 'Mật khẩu cần có ít nhất 8 ký tự.' : '';
    }
  },
  {
    input: confirmationInput,
    wrapper: confirmationInput.parentElement,
    error: document.getElementById('confirm-password-error'),
    getMessage(value) {
      if (!value) return 'Vui lòng xác nhận mật khẩu.';
      return value === passwordInput.value ? '' : 'Mật khẩu xác nhận không khớp.';
    }
  }
];

fields.forEach(({ input, wrapper, error, getMessage }) => {
  let touched = false;

  const validate = () => {
    const message = touched ? getMessage(input.value, input) : '';
    const invalid = Boolean(message);
    error.textContent = message;
    error.classList.toggle('hidden', !invalid);
    input.setAttribute('aria-invalid', String(invalid));
    wrapper.classList.toggle('is-invalid', invalid);
    if (input === confirmationInput) input.setCustomValidity(message);
  };

  input.addEventListener('blur', () => {
    touched = true;
    validate();
  });
  input.addEventListener('invalid', () => {
    touched = true;
    validate();
  });
  input.addEventListener('input', () => {
    if (touched) validate();
    if (input === passwordInput) {
      const confirmationField = fields[fields.length - 1];
      if (confirmationInput.value) confirmationField.input.dispatchEvent(new Event('input'));
    }
  });
});

const getFirebaseServices = () => {
  if (!servicesPromise) {
    servicesPromise = fetch('/api/firebase-config')
      .then(async (response) => {
        if (!response.ok) throw new Error('firebase/config-unavailable');
        const config = await response.json();
        const app = initializeApp(config);
        return { auth: getAuth(app), database: getFirestore(app) };
      })
      .catch((error) => {
        servicesPromise = undefined;
        throw error;
      });
  }
  return servicesPromise;
};

const messages = {
  'auth/email-already-in-use': 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.',
  'auth/invalid-email': 'Địa chỉ email không hợp lệ.',
  'auth/operation-not-allowed': 'Hãy bật Email/Password trong Firebase Authentication.',
  'auth/weak-password': 'Mật khẩu cần có ít nhất 8 ký tự.',
  'auth/too-many-requests': 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.',
  'permission-denied': 'Firestore chưa bật quyền lưu hồ sơ. Hãy triển khai firestore.rules rồi thử lại.',
  'firebase/config-unavailable': 'Không tải được cấu hình Firebase. Hãy kiểm tra cấu hình máy chủ.'
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';

  fields.forEach(({ input }) => input.dispatchEvent(new Event('blur')));
  if (passwordInput.value !== confirmationInput.value) {
    confirmationInput.reportValidity();
    return;
  }

  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');
  submitSpinner.classList.remove('hidden');
  submitLabel.textContent = 'Đang tạo tài khoản...';

  let auth;
  let user;
  let profileReference;
  let profileSaved = false;

  try {
    const services = await getFirebaseServices();
    auth = services.auth;
    const credential = await createUserWithEmailAndPassword(
      auth,
      document.getElementById('email').value.trim(),
      passwordInput.value
    );
    user = credential.user;

    const username = document.getElementById('username').value.trim();
    const phone = document.getElementById('phone').value.trim();
    await updateProfile(user, { displayName: username });

    profileReference = doc(services.database, 'userProfiles', user.uid);
    await setDoc(profileReference, {
      username,
      phone,
      email: user.email,
      createdAt: serverTimestamp()
    });
    profileSaved = true;
    await sendEmailVerification(user);
    await signOut(auth);

    form.reset();
    fields.forEach(({ input, wrapper, error }) => {
      input.setCustomValidity('');
      input.removeAttribute('aria-invalid');
      wrapper.classList.remove('is-invalid');
      error.textContent = '';
      error.classList.add('hidden');
    });
    message.textContent = `Tài khoản đã tạo. Hãy mở email ${user.email}, xác minh địa chỉ rồi đăng nhập.`;
    message.dataset.state = 'success';
  } catch (error) {
    if (user) {
      if (profileSaved) await deleteDoc(profileReference).catch(() => {});
      await deleteUser(user).catch(() => {});
    }
    message.textContent = messages[error.code] || 'Không thể tạo tài khoản. Vui lòng thử lại.';
    message.dataset.state = 'error';
  } finally {
    submitButton.disabled = false;
    submitButton.setAttribute('aria-busy', 'false');
    submitSpinner.classList.add('hidden');
    submitLabel.textContent = 'Đăng ký';
  }
});
