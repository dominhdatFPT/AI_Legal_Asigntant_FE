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
const fullNameInput = document.getElementById('full-name');
const phoneInput = document.getElementById('phone');
const emailInput = document.getElementById('email');
const termsInput = document.getElementById('terms');
const privacyInput = document.getElementById('privacy-consent');

// Phiên bản điều khoản/chính sách người dùng đã đồng ý. Đổi nội dung trang /dieu-khoan thì tăng số này.
const CONSENT_VERSION = '2026-10-19';

// "0901 234 567", "+84 901.234.567" → "0901234567". Sai định dạng → null.
const normalizePhone = (value) => {
  let digits = value.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`;
  return /^0[35789]\d{8}$/.test(digits) ? digits : null;
};

// Gộp khoảng trắng thừa; tên phải có chữ cái và không chứa số.
const normalizeFullName = (value) => {
  const name = value.replace(/\s+/g, ' ').trim();
  return name.length >= 2 && /\p{L}/u.test(name) && !/\d/.test(name) ? name : null;
};

const showError = (text, input) => {
  message.textContent = text;
  message.dataset.state = 'error';
  input?.focus();
};
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
  message.dataset.state = '';

  const fullName = normalizeFullName(fullNameInput.value);
  const phone = normalizePhone(phoneInput.value);
  const email = emailInput.value.trim();
  if (!fullName) return showError('Vui lòng nhập họ và tên (chỉ gồm chữ cái).', fullNameInput);
  if (!phone) return showError('Số điện thoại chưa đúng. Hãy nhập 10 số, bắt đầu bằng 0 (vd: 0901234567).', phoneInput);
  if (!email || !emailInput.validity.valid) return showError('Địa chỉ email không hợp lệ.', emailInput);
  if (passwordInput.value.length < 8) return showError('Mật khẩu cần có ít nhất 8 ký tự.', passwordInput);
  if (passwordInput.value !== confirmationInput.value) return showError('Mật khẩu xác nhận không khớp.', confirmationInput);
  if (!termsInput.checked) return showError('Bạn cần đồng ý với Điều khoản sử dụng.', termsInput);
  if (!privacyInput.checked) return showError('Bạn cần đồng ý với Chính sách bảo vệ dữ liệu cá nhân để tạo tài khoản.', privacyInput);

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
      email,
      passwordInput.value
    );
    user = credential.user;

    const username = email.split('@')[0];
    // displayName đi vào ID token (claim "name"); Backend lấy làm full_name khi tạo user lần đầu.
    await updateProfile(user, { displayName: fullName });

    profileReference = doc(services.database, 'userProfiles', user.uid);
    await setDoc(profileReference, {
      username,
      fullName,
      phone,
      email: user.email,
      createdAt: serverTimestamp(),
      termsAcceptedAt: serverTimestamp(),
      privacyConsentAt: serverTimestamp(),
      consentVersion: CONSENT_VERSION
    });
    profileSaved = true;

    // Gửi email xác minh; lỗi gửi không huỷ tài khoản, người dùng gửi lại được ở trang đăng nhập.
    let verificationSent = true;
    await sendEmailVerification(user, { url: `${window.location.origin}/login?verified=1` }).catch(() => { verificationSent = false; });
    await signOut(auth);

    form.reset();
    message.textContent = verificationSent
      ? `Đã tạo tài khoản. Hãy mở email xác minh vừa gửi tới ${email} rồi đăng nhập.`
      : 'Đã tạo tài khoản nhưng chưa gửi được email xác minh. Hãy đăng nhập để hệ thống gửi lại.';
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
