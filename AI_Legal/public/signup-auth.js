import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
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

  if (passwordInput.value !== confirmationInput.value) {
    message.textContent = 'Mật khẩu xác nhận không khớp.';
    message.dataset.state = 'error';
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
    await signOut(auth);

    form.reset();
    message.textContent = 'Tài khoản đã tạo thành công. Bạn có thể đăng nhập ngay bây giờ.';
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
