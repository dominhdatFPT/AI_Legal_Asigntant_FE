import { fetchAdministrativeUnits, searchNearbyOffices } from '/auth-api.js';

const byId = (id) => document.getElementById(id);
const form = byId('location-form');
const version = byId('version');
const province = byId('province');
const district = byId('district');
const ward = byId('ward');
const districtWrap = byId('district-wrap');
const wardNote = byId('ward-note');
const submit = byId('submit-search');
const status = byId('status');
const resolved = byId('resolved-address');
const results = byId('results');
let catalogueSequence = 0;
let searchSequence = 0;
let searching = false;

const setOptions = (select, items, placeholder) => {
  select.replaceChildren(new Option(placeholder, ''));
  for (const item of items) select.add(new Option(item.name, String(item.code)));
};

const clearResults = () => {
  searchSequence += 1;
  results.replaceChildren();
  resolved.hidden = true;
  resolved.textContent = '';
  status.textContent = 'Địa chỉ đã thay đổi. Bấm Tìm để xem kết quả mới.';
  status.removeAttribute('role');
};

const loadProvinces = async () => {
  const sequence = ++catalogueSequence;
  const selectedVersion = version.value;
  districtWrap.hidden = selectedVersion !== 'legacy';
  wardNote.hidden = selectedVersion !== 'legacy';
  ward.required = selectedVersion !== 'legacy';
  setOptions(province, [], 'Đang tải tỉnh/thành...');
  setOptions(district, [], 'Chọn quận/huyện');
  setOptions(ward, [], 'Chọn xã/phường');
  try {
    const data = await fetchAdministrativeUnits(`${selectedVersion}/provinces`);
    if (sequence !== catalogueSequence) return;
    setOptions(province, data.items, 'Chọn tỉnh/thành');
  } catch {
    if (sequence === catalogueSequence) setOptions(province, [], 'Không tải được tỉnh/thành');
  }
};

const loadChildren = async (kind) => {
  const sequence = ++catalogueSequence;
  const selectedVersion = version.value;
  const provinceCode = province.value;
  const districtCode = district.value;
  const target = kind === 'district' ? district : ward;
  setOptions(target, [], kind === 'district' ? 'Đang tải quận/huyện...' : 'Đang tải xã/phường...');
  if (kind === 'district') setOptions(ward, [], 'Chọn xã/phường');
  if (!provinceCode || (kind === 'ward' && selectedVersion === 'legacy' && !districtCode)) return;
  const path = kind === 'district'
    ? `legacy/provinces/${provinceCode}/districts`
    : selectedVersion === 'legacy'
      ? `legacy/districts/${districtCode}/wards`
      : `current/provinces/${provinceCode}/wards`;
  try {
    const data = await fetchAdministrativeUnits(path);
    if (sequence !== catalogueSequence) return;
    setOptions(target, data.items, kind === 'district' ? 'Chọn quận/huyện' : 'Chọn xã/phường');
  } catch {
    if (sequence === catalogueSequence) setOptions(target, [], 'Không tải được danh mục');
  }
};

version.addEventListener('change', () => { clearResults(); loadProvinces(); });
province.addEventListener('change', () => {
  clearResults();
  if (version.value === 'legacy') loadChildren('district');
  else loadChildren('ward');
});
district.addEventListener('change', () => { clearResults(); loadChildren('ward'); });
ward.addEventListener('change', clearResults);
for (const id of ['detail', 'query', 'radius', 'limit']) byId(id).addEventListener('input', clearResults);

const safeDirections = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.google.com' &&
      url.pathname === '/maps/dir/' && url.searchParams.get('api') === '1' ? url.href : null;
  } catch { return null; }
};

const renderResults = (data) => {
  resolved.textContent = `Địa chỉ hệ thống đã định vị: ${data.origin.resolved_address}`;
  resolved.hidden = false;
  if (!data.items.length) {
    status.textContent = 'Không tìm thấy địa điểm trong bán kính đã chọn. Bạn có thể thử bán kính lớn hơn.';
    return;
  }
  status.textContent = `Tìm thấy ${data.items.length} địa điểm${data.is_partial ? ' (kết quả một phần)' : ''}.`;
  for (const item of data.items) {
    const card = document.createElement('article');
    card.className = 'result';
    const heading = document.createElement('h3');
    heading.textContent = item.name;
    const address = document.createElement('p');
    address.textContent = item.address;
    const distance = document.createElement('p');
    distance.className = 'muted';
    distance.textContent = `Khoảng cách đường thẳng: ${(item.distance_meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
    card.append(heading, address, distance);
    const href = safeDirections(item.directions_url);
    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Chỉ đường';
      card.append(link);
    }
    results.append(card);
  }
  if (data.is_partial) {
    const warning = document.createElement('p');
    warning.textContent = data.warnings.map((item) => item.message).join(' ') || 'Một số địa điểm chưa tải được.';
    results.prepend(warning);
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (searching || !form.reportValidity()) return;
  const sequence = ++searchSequence;
  const selectedVersion = version.value;
  const address = {
    administrative_version: selectedVersion,
    detail: byId('detail').value.trim(),
    province_code: Number(province.value),
    district_code: selectedVersion === 'legacy' ? Number(district.value) : null,
    ward_code: ward.value ? Number(ward.value) : null
  };
  if (!province.value || (selectedVersion === 'legacy' && !district.value) ||
      (selectedVersion === 'current' && !ward.value)) {
    status.textContent = 'Vui lòng chọn đầy đủ đơn vị hành chính.';
    status.setAttribute('role', 'alert');
    return;
  }
  searching = true;
  submit.disabled = true;
  submit.textContent = 'Đang tìm...';
  results.replaceChildren();
  resolved.hidden = true;
  status.textContent = 'Đang tìm nơi nộp trong khu vực đã chọn...';
  status.removeAttribute('role');
  try {
    const data = await searchNearbyOffices({
      address, query: byId('query').value.trim(),
      radius_meters: Number(byId('radius').value), limit: Number(byId('limit').value)
    });
    if (sequence === searchSequence) renderResults(data);
  } catch (error) {
    if (sequence === searchSequence) {
      status.textContent = error.backendMessage || 'Không thể tìm địa điểm lúc này. Vui lòng thử lại.';
      status.setAttribute('role', 'alert');
    }
  } finally {
    searching = false;
    submit.disabled = false;
    submit.textContent = 'Tìm nơi nộp';
  }
});

loadProvinces();
