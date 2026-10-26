// =============================================================================
// TOAST THÔNG BÁO DÙNG CHUNG CHO TRANG QUẢN TRỊ (tách từ user-management.html)
// Phần tử HTML cần có: #toast, #toast-title, #toast-message, #toast-icon, #toast-undo-btn
// =============================================================================
const TOAST_HIDE_DELAY = 300;

let toastTimer = null;

function toastEl() {
  return document.getElementById('toast');
}

function fill(title, message) {
  const el = toastEl();
  if (!el) return null;
  const titleEl = document.getElementById('toast-title');
  if (titleEl) {
    titleEl.textContent = title;
    titleEl.classList.remove('hidden');
  }
  const msgEl = document.getElementById('toast-message');
  if (msgEl) msgEl.textContent = titleEl ? message : `${title}: ${message}`;
  return el;
}

function reveal(el, duration) {
  el.classList.remove('hidden');
  setTimeout(() => {
    el.classList.remove('translate-y-2', 'opacity-0');
    el.classList.add('translate-y-0', 'opacity-100');
  }, 10);

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, duration);
}

export function hideToast() {
  const el = toastEl();
  if (!el) return;
  el.classList.remove('translate-y-0', 'opacity-100');
  el.classList.add('translate-y-2', 'opacity-0');
  setTimeout(() => el.classList.add('hidden'), TOAST_HIDE_DELAY);
}

export function showToast(title, message, isError = false) {
  const el = fill(title, message);
  if (!el) return;

  const iconEl = document.getElementById('toast-icon');
  if (iconEl) {
    iconEl.textContent = isError ? 'error' : 'check_circle';
    iconEl.className = `material-symbols-outlined text-[22px] shrink-0 ${isError ? 'text-red-400' : 'text-emerald-400'}`;
  }

  const undoBtn = document.getElementById('toast-undo-btn');
  if (undoBtn) {
    undoBtn.classList.add('hidden');
    undoBtn.onclick = null;
  }

  reveal(el, 4000);
}

// onUndo: hàm hoàn tác (ví dụ khôi phục tài khoản vừa xóa mềm).
export function showToastWithUndo(title, message, onUndo) {
  const el = fill(title, message);
  if (!el) return;

  const iconEl = document.getElementById('toast-icon');
  if (iconEl) {
    iconEl.textContent = 'delete';
    iconEl.className = 'material-symbols-outlined text-amber-400 text-[22px] shrink-0';
  }

  const undoBtn = document.getElementById('toast-undo-btn');
  if (undoBtn) {
    undoBtn.classList.remove('hidden');
    undoBtn.onclick = function () {
      if (typeof onUndo === 'function') onUndo();
      hideToast();
    };
  }

  reveal(el, 7000);
}
