import { authRequest } from '/auth-api.js';

const people = document.getElementById('people');
for (const n of [1, 2]) {
  people.insertAdjacentHTML('beforeend', `<fieldset><legend>Người ${n}${n === 1 ? ' · Đại diện' : ''}</legend><div class="m18-grid">
    <label>Họ và tên, năm sinh *<input name="name${n}" maxlength="120" required></label>
    <label>Số định danh / giấy tờ nhân thân *<input name="identity${n}" maxlength="100" required></label>
    <label class="full">Địa chỉ thường trú *<input name="address${n}" maxlength="240" required></label>
    <label>Mã số thuế (nếu có)<input name="tax${n}" maxlength="50"></label>
    <label>Diện tích sử dụng / tỷ lệ sở hữu (nếu có)<input name="share${n}" maxlength="80"></label>
    <label class="full">Ghi chú (nếu có)<small>Ví dụ: là vợ/chồng; là thành viên có chung quyền sử dụng đất của hộ.</small><input name="note${n}" maxlength="100"></label>
  </div></fieldset>`);
}
const form = document.getElementById('mau18-form');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const get = (name) => String(data.get(name) || '').trim();
  const body = Object.fromEntries(['receiving_agency','phone','email','change_content','tax_exemption','attached_documents','place','date'].map((key) => [key, get(key)]));
  body.people = [1, 2].map((n) => Object.fromEntries(['name','identity','address','tax','share','note'].map((key) => [key, get(key + n)])));
  const error = document.getElementById('mau18-error');
  const button = form.querySelector('button[type=submit]');
  button.disabled = true; error.hidden = true;
  try {
    const response = await authRequest('/api/procedures/templates/mau18-two-person/docx', { method: 'POST', body });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error?.message || 'Chưa tạo được file Word. Vui lòng thử lại.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'don-dang-ky-bien-dong-mau18.docx';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) { error.textContent = err.message || 'Không kết nối được máy chủ.'; error.hidden = false; }
  finally { button.disabled = false; }
});
