// =============================================================================
// TIỆN ÍCH MỞ/ĐÓNG MODAL DÙNG CHUNG CHO CÁC TRANG QUẢN TRỊ
// Các modal của dự án vừa có lớp "flex" vừa có lớp "hidden", nên khi mở/đóng
// cần set cả class lẫn inline display để không phụ thuộc thứ tự CSS.
// =============================================================================

export function openModal(el) {
  if (!el) return;
  el.classList.remove('hidden');
  el.style.display = 'flex';
}

export function closeModal(el) {
  if (!el) return;
  el.classList.add('hidden');
  el.style.display = 'none';
}

// Bấm vào vùng nền tối (ngoài nội dung modal) để đóng.
// onClose: hàm xử lý riêng; bỏ trống thì chỉ đóng modal.
export function bindModalDismiss(el, onClose) {
  if (!el) return;
  el.addEventListener('click', (e) => {
    if (e.target !== el) return;
    if (typeof onClose === 'function') onClose();
    else closeModal(el);
  });
}
