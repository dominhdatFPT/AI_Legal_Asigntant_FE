import { fetchAdministrativeUnits, searchNearbyOffices, enrichOfficeContacts } from '/auth-api.js';

const byId = (id) => document.getElementById(id);
const form = byId('location-form');
const province = byId('province');
const ward = byId('ward');
const submit = byId('submit-search');
const status = byId('status');
const resolved = byId('resolved-address');
const results = byId('results');
const submitLabel = byId('submit-label');
const count = byId('result-count');
const empty = byId('empty-state');
const loading = byId('loading-state');
const coverage = byId('coverage-note');
let catalogueSequence = 0;
let searchSequence = 0;
let searching = false;

const administrativeOptions = new Map();
const administrativePickers = new Map();
const searchKey = (value) => value.toLocaleLowerCase('vi').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim().replace(/\s+/g, ' ');
const matchingAdministrativeUnits = (items, query) => items.filter(item => searchKey(item.name).includes(searchKey(query)));

const closePicker = (picker, restoreFocus = false) => {
  picker.popup.hidden = true;
  picker.trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) picker.trigger.focus();
};

const filterOptions = (select) => {
  const picker = administrativePickers.get(select);
  const { items } = administrativeOptions.get(select);
  const matches = matchingAdministrativeUnits(items, picker.filter.value);
  picker.list.replaceChildren();
  for (const item of matches) {
    const option = element('button', 'administrative-option', item.name);
    option.type = 'button';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(select.value === String(item.code)));
    option.addEventListener('click', () => {
      select.value = String(item.code);
      picker.trigger.textContent = item.name;
      closePicker(picker, true);
      select.dispatchEvent(new Event('change'));
    });
    picker.list.append(option);
  }
  picker.empty.hidden = matches.length > 0;
};

const setupAdministrativePicker = (select) => {
  const wrapper = element('div', 'administrative-picker');
  const trigger = element('button', 'administrative-trigger');
  trigger.type = 'button';
  trigger.id = `${select.id}-trigger`;
  document.querySelector(`label[for="${select.id}"]`).htmlFor = trigger.id;
  trigger.disabled = true;
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const popup = element('div', 'administrative-popup');
  popup.id = `${select.id}-popup`;
  popup.hidden = true;
  popup.setAttribute('role', 'dialog');
  const label = select.id === 'province' ? 'Tỉnh / Thành phố' : 'Xã / Phường';
  trigger.setAttribute('aria-label', label);
  popup.setAttribute('aria-label', `Chọn ${label.toLocaleLowerCase('vi')}`);
  trigger.setAttribute('aria-controls', popup.id);
  const filter = element('input');
  filter.id = `${select.id}-filter`;
  filter.type = 'search';
  filter.placeholder = 'Gõ để tìm trong danh sách…';
  filter.autocomplete = 'off';
  filter.setAttribute('aria-label', `Tìm trong danh sách ${label.toLocaleLowerCase('vi')}`);
  const list = element('div', 'administrative-options');
  list.id = `${select.id}-options`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', label);
  filter.setAttribute('aria-controls', list.id);
  const empty = element('p', 'administrative-empty', 'Không tìm thấy kết quả');
  empty.setAttribute('role', 'status');
  popup.append(filter, list, empty);
  wrapper.append(trigger, popup);
  select.after(wrapper);
  select.hidden = true;
  const picker = { wrapper, trigger, popup, filter, list, empty };
  administrativePickers.set(select, picker);
  const open = () => {
    for (const other of administrativePickers.values()) closePicker(other);
    filter.value = '';
    filterOptions(select);
    popup.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    filter.focus();
  };
  trigger.addEventListener('click', () => popup.hidden ? open() : closePicker(picker));
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
  });
  filter.addEventListener('input', () => filterOptions(select));
  popup.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closePicker(picker, true); }
    const options = Array.from(list.children);
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && options.length) {
      event.preventDefault();
      const position = options.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (position + 1) % options.length
        : (position <= 0 ? options.length - 1 : position - 1);
      options[next].focus();
    }
  });
  wrapper.addEventListener('focusout', event => {
    if (!wrapper.contains(event.relatedTarget)) closePicker(picker);
  });
  document.addEventListener('pointerdown', event => {
    if (!wrapper.contains(event.target)) closePicker(picker);
  });
  select.addEventListener('invalid', event => { event.preventDefault(); open(); });
  select.addEventListener('change', () => {
    trigger.textContent = select.selectedOptions[0]?.textContent || administrativeOptions.get(select).placeholder;
  });
};

const setOptions = (select, items, placeholder) => {
  administrativeOptions.set(select, { items, placeholder });
  select.replaceChildren(new Option(placeholder, ''));
  for (const item of items) select.add(new Option(item.name, String(item.code)));
  select.disabled = items.length === 0;
  const picker = administrativePickers.get(select);
  picker.trigger.textContent = placeholder;
  picker.trigger.disabled = select.disabled;
  picker.filter.value = '';
  closePicker(picker);
};

const clearResults = () => {
  searchSequence += 1;
  results.replaceChildren();
  resolved.hidden = true;
  resolved.textContent = '';
  count.hidden = true;
  coverage.hidden = true;
  loading.hidden = true;
  empty.hidden = false;
  byId('empty-title').textContent = 'Sẵn sàng tìm địa điểm mới';
  byId('empty-description').textContent = 'Bấm Tìm nơi nộp để cập nhật các gợi ý theo thông tin vừa chọn.';
  byId('empty-hint').hidden = false;
  status.textContent = 'Thông tin tìm kiếm đã thay đổi. Bấm Tìm để xem gợi ý mới.';
  status.setAttribute('role', 'status');
};

const loadProvinces = async () => {
  const sequence = ++catalogueSequence;
  setOptions(province, [], 'Đang tải tỉnh/thành...');
  setOptions(ward, [], 'Chọn xã/phường');
  try {
    const data = await fetchAdministrativeUnits('current/provinces');
    if (sequence !== catalogueSequence) return;
    setOptions(province, data.items, 'Chọn tỉnh/thành');
  } catch {
    if (sequence === catalogueSequence) setOptions(province, [], 'Không tải được tỉnh/thành');
  }
};

const loadWards = async () => {
  const sequence = ++catalogueSequence;
  const provinceCode = province.value;
  setOptions(ward, [], provinceCode ? 'Đang tải xã/phường...' : 'Chọn xã/phường');
  if (!provinceCode) return;
  try {
    const data = await fetchAdministrativeUnits(`current/provinces/${provinceCode}/wards`);
    if (sequence !== catalogueSequence) return;
    setOptions(ward, data.items, 'Chọn xã/phường');
  } catch {
    if (sequence === catalogueSequence) setOptions(ward, [], 'Không tải được xã/phường');
  }
};

province.addEventListener('change', () => { clearResults(); loadWards(); });
ward.addEventListener('change', clearResults);
for (const id of ['detail', 'query']) byId(id).addEventListener('input', clearResults);

const safeDirections = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && url.hostname === 'www.google.com' &&
      url.pathname === '/maps/dir/' && url.searchParams.get('api') === '1' ? url.href : null;
  } catch { return null; }
};

const safeOfficialSource = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      url.hostname.endsWith('.gov.vn') ? url.href : null;
  } catch { return null; }
};

const safeGooglePlace = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      url.hostname === 'www.google.com' && url.pathname.startsWith('/maps/place/') ? url.href : null;
  } catch { return null; }
};

const referenceHoursSource = (hours) => {
  if (hours?.source_type !== 'reviewed_website' || hours.verification_status !== 'reference') return null;
  try {
    const url = new URL(hours.source_url);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      url.hostname === 'tinhthanhvn.com' && url.pathname.startsWith('/ubnd/') ? url.href : null;
  } catch { return null; }
};

const hoursPriority = (hours) => {
  if (!hours || typeof hours.text !== 'string' || !hours.text.trim()) return 0;
  if (safeGooglePlace(hours.source_url)) return 4;
  if (safeOfficialSource(hours.source_url)) return 3;
  if (referenceHoursSource(hours)) return 2;
  return hours.source_type === 'ai_summary' && hours.verification_status === 'unverified' &&
    hours.text.length <= 500 && /\b(?:[01]?\d|2[0-3])[:h][0-5]\d\b/.test(hours.text) ? 1 : 0;
};

const officeMapIdentity = (item) => {
  if (typeof item.name !== 'string' || typeof item.address !== 'string' || !item.address.trim()) return null;
  const reviewed = /^ChIJ[A-Za-z0-9_-]{10,200}$/.test(item.google_place_id || '') &&
    (safeOfficialSource(item.source_url) || (item.map_identity_source === 'google_places' &&
      safeGooglePlace(item.map_identity_source_url)));
  const name = reviewed && typeof item.map_destination_name === 'string' ? item.map_destination_name : item.name;
  // A non-reviewed name can make Maps jump to a similarly named office in a
  // different area. Use the exact visible address for the pin and route.
  const query = reviewed ? `${name}, ${item.address}` : item.address;
  const search = new URL('https://www.google.com/maps/search/');
  search.searchParams.set('api', '1');
  search.searchParams.set('query', query);
  if (reviewed) search.searchParams.set('query_place_id', item.google_place_id);
  // Rebuild from the visible card instead of trusting an old cached coordinate URL.
  const route = new URL('https://www.google.com/maps/dir/');
  route.searchParams.set('api', '1');
  route.searchParams.set('destination', query);
  if (reviewed) route.searchParams.set('destination_place_id', item.google_place_id);
  const suppliedRoute = safeDirections(item.directions_url);
  const origin = suppliedRoute && new URL(suppliedRoute).searchParams.get('origin');
  if (origin) route.searchParams.set('origin', origin);
  const embed = new URL('https://www.google.com/maps');
  embed.searchParams.set('q', query);
  embed.searchParams.set('z', '17');
  embed.searchParams.set('output', 'embed');
  const web = new URL('https://www.google.com/search');
  web.searchParams.set('q', `${item.name}, ${item.address}`);
  return { query, mapsUrl: search.href, directionsUrl: route.href, embedUrl: embed.href,
    webSearchUrl: web.href, reviewed };
};

const safeAppointment = (value, source) => {
  if (!safeOfficialSource(source)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      url.hostname === 'xephangqrcode.web.app' && !url.search && !url.hash &&
      /^\/[A-Za-z0-9]{20}\/hen-gio-giao-dich\/[A-Za-z0-9]{20}$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
};

const safePhoto = (value) => typeof value === 'string' && /^\/images\/offices\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(value) ? value : null;
const safePhone = (value) => typeof value === 'string' && /^(?:0[2-9]\d{8,9}|\+84\d{9,10}|1[89]00\d{4,6}|1022)$/.test(value) ? value : null;
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const symbol = (name) => {
  const node = element('span', 'material-symbols-outlined', name);
  node.setAttribute('aria-hidden', 'true');
  return node;
};
const externalLink = (href, label, className = '') => {
  const link = element('a', className, label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
};
const addFact = (list, icon, label, value) => {
  const row = element('div', 'office-fact');
  const content = element('div');
  content.append(element('span', 'office-fact__label', label),
    typeof value === 'string' ? element('p', '', value) : value);
  row.append(symbol(icon), content);
  list.append(row);
};

const renderHours = (text) => {
  const schedule = element('div', 'office-hours');
  // Keep ranges and split shifts together; each day/group gets its own row.
  const lines = text.split(/\s*·\s*|\r?\n|;\s*/).filter(line => line.trim());
  for (const line of lines) schedule.append(element('p', 'office-hours__row', line.trim()));
  return schedule;
};

const renderOffice = (item, index) => {
  const card = element('article', `office-card${index === 0 ? ' office-card--first' : ''}`);
  const media = element('figure', 'office-media');
  const fallback = element('div', 'office-photo-fallback');
  fallback.append(symbol('account_balance'), element('span', '', 'Ảnh cơ quan chưa được cập nhật'));
  media.append(fallback);
  const photoUrl = safePhoto(item.photo?.url);
  if (photoUrl) {
    const image = element('img');
    image.alt = item.photo.alt || `Hình ảnh ${item.name}`;
    image.width = 185;
    image.height = 240;
    image.loading = 'lazy';
    image.decoding = 'async';
    if (/^(?:100|\d{1,2})% (?:100|\d{1,2})%$/.test(item.photo.object_position || '')) image.style.objectPosition = item.photo.object_position;
    image.addEventListener('error', () => { image.remove(); fallback.hidden = false; }, { once: true });
    image.src = photoUrl;
    fallback.hidden = true;
    media.append(image);
  }
  const info = element('div', 'office-info');
  const top = element('div', 'office-card__top');
  const headingWrap = element('div', 'office-heading');
  const heading = element('h3', '', item.unit_name || item.name);
  heading.title = item.name;
  if (item.category_label) headingWrap.append(element('p', 'office-category', item.category_label));
  headingWrap.append(heading);
  if (index === 0) {
    const rank = element('p', 'office-rank');
    rank.append(symbol('check_circle'), document.createTextNode('Gần nhất trong kết quả'));
    headingWrap.append(rank);
  }
  const distance = element('div', 'office-distance');
  distance.append(element('small', '', 'Khoảng cách'));
  const km = element('strong', '', Number.isFinite(item.distance_meters)
    ? (item.distance_meters / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '?');
  km.append(element('span', '', 'km'));
  distance.append(km);
  top.append(headingWrap, distance);
  const facts = element('div', 'office-facts');
  const identity = officeMapIdentity(item);
  addFact(facts, 'location_on', 'Địa chỉ', item.address);
  const hoursSource = hoursPriority(item.opening_hours);
  const appointmentSource = safeOfficialSource(item.appointment_source_url);
  const appointmentUrl = safeAppointment(item.appointment_url, appointmentSource);
  const hours = hoursSource && typeof item.opening_hours.text === 'string' && item.opening_hours.text.trim()
    ? item.opening_hours.text : 'Chưa có giờ làm việc được xác minh';
  const schedule = renderHours(hours);
  addFact(facts, 'schedule', appointmentUrl && !hoursSource ? 'Lịch tiếp nhận trên website'
    : 'Giờ làm việc',
    appointmentUrl && !hoursSource ? externalLink(appointmentUrl, 'Xem khung giờ theo ngày và quầy') : schedule);
  const phoneSource = safeOfficialSource(item.contact_source_url);
  const phone = phoneSource && safePhone(item.contact_phone);
  if (phone) {
    const contact = element('a', '', phone);
    contact.href = `tel:${phone}`;
    addFact(facts, 'call', item.contact_label || 'Liên hệ', contact);
  }
  const actions = element('div', 'office-actions');
  const href = identity && safeDirections(item.directions_url) ? identity.directionsUrl : null;
  if (href) {
    const link = externalLink(href, '', 'primary-button');
    link.append(symbol('directions'), document.createTextNode('Chỉ đường'));
    actions.append(link);
  }
  if (identity && !identity.reviewed) {
    const webLink = externalLink(identity.webSearchUrl, '', 'secondary-button');
    webLink.append(symbol('search'), document.createTextNode('Tìm trên web'));
    actions.append(webLink);
  }
  const websiteUrl = safeOfficialSource(item.website_url);
  if (websiteUrl) actions.append(externalLink(websiteUrl, 'Website cơ quan', 'secondary-button'));
  const onlineServiceUrl = safeOfficialSource(item.online_service_url);
  if (onlineServiceUrl) actions.append(externalLink(onlineServiceUrl, 'Nộp hồ sơ trực tuyến', 'secondary-button'));
  if (identity) {
    const mapLink = externalLink(identity.mapsUrl, '', 'secondary-button');
    mapLink.append(symbol('map'), document.createTextNode('Xem Google Maps'));
    actions.append(mapLink);
  }
  info.append(top, facts, actions);
  card.append(media, info);
  return card;
};

const renderResults = (data) => {
  results.replaceChildren();
  const items = data.items.slice(0, 5);
  count.textContent = String(items.length);
  count.hidden = false;
  loading.hidden = true;
  empty.hidden = items.length > 0;
  resolved.replaceChildren(element('span', '', 'Vị trí tìm kiếm: '), element('strong', '', data.origin.resolved_address));
  resolved.hidden = false;
  const visibleWarnings = data.warnings.filter((warning) => warning.code !== 'OFFICIAL_COORDINATES_INCOMPLETE');
  coverage.hidden = !visibleWarnings.length && !(data.is_partial && data.coverage?.source !== 'official_directory');
  if (!coverage.hidden) {
    byId('coverage-title').textContent = visibleWarnings.some(w => w.code === 'LOCAL_RESULTS_UNAVAILABLE')
      ? `Chưa có dữ liệu phù hợp tại ${data.coverage?.province || 'địa phương đã chọn'}`
      : visibleWarnings.some(w => w.code === 'UNVERIFIED_LOCATIONS_EXCLUDED')
        ? 'Một số địa điểm chưa khớp địa chỉ'
        : 'Một phần thông tin chưa tải được';
    byId('coverage-message').textContent = visibleWarnings.map((item) => item.message).join(' ') || 'Một số địa điểm chưa tải được.';
  }
  if (!items.length) {
    byId('empty-title').textContent = 'Chưa có cơ quan phù hợp';
    byId('empty-description').textContent = 'Thử tên cơ quan hoặc kiểm tra lại địa chỉ. Thông tin tìm kiếm của bạn vẫn được giữ lại.';
    byId('empty-hint').hidden = true;
    status.textContent = data.coverage?.source === 'official_directory'
      ? (data.is_partial ? 'Chưa có vị trí cơ quan được xác minh cho từ khóa này.'
        : 'Chưa tìm thấy cơ quan phù hợp trong danh mục chính thức. Hãy kiểm tra tên cơ quan hoặc từ khóa.')
      : (data.is_partial ? 'Chưa có kết quả phù hợp; một số địa điểm chưa tải được. Vui lòng thử lại.'
        : `Chưa tìm thấy địa điểm phù hợp từ dữ liệu bản đồ${data.coverage?.province ? ` tại ${data.coverage.province}` : ''}. Hãy thử tên cơ quan cụ thể hoặc từ khóa khác.`);
    return;
  }
  status.textContent = `${items.length} địa điểm phù hợp, xếp từ gần đến xa trong dữ liệu hiện có.`;
  items.forEach((item, index) => results.append(renderOffice(item, index)));
};

// Keep enrichment inside the existing facts/actions; nothing is appended below them.
const enrichContacts = async (data, sequence) => {
  if (!data.web_lookup_id || !data.items.length) return;
  const items = data.items.slice(0, 5);
  const cards = Array.from(results.children);
  try {
    const response = await enrichOfficeContacts(data.web_lookup_id);
    if (sequence !== searchSequence) return;
    for (const [index, item] of items.entries()) {
      const patch = response.items?.find(p => p.place_id === item.place_id);
      const merged = { ...item };
      if (!safePhone(item.contact_phone) || !safeOfficialSource(item.contact_source_url)) {
        if (safePhone(patch?.contact_phone) && safeOfficialSource(patch.contact_source_url)) {
          for (const field of ['contact_phone', 'contact_label', 'contact_source_url', 'contact_evidence']) merged[field] = patch[field];
        }
      }
      if (hoursPriority(patch?.opening_hours) > 0 &&
          hoursPriority(patch.opening_hours) >= hoursPriority(item.opening_hours)) merged.opening_hours = patch.opening_hours;
      if (patch?.map_identity_source === 'google_places' && safeGooglePlace(patch.map_identity_source_url)) {
        for (const field of ['google_place_id', 'map_destination_name', 'map_identity_source', 'map_identity_source_url']) merged[field] = patch[field];
      }
      const updated = renderOffice(merged, index);
      cards[index].querySelector('.office-facts').replaceWith(updated.querySelector('.office-facts'));
      cards[index].querySelector('.office-actions').replaceWith(updated.querySelector('.office-actions'));
    }
  } catch {
    // Keep the previously verified details when a provider is unavailable.
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (searching || !form.reportValidity()) return;
  const sequence = ++searchSequence;
  const address = {
    administrative_version: 'current',
    detail: byId('detail').value.trim(),
    province_code: Number(province.value),
    district_code: null,
    ward_code: Number(ward.value)
  };
  if (!province.value || !ward.value) {
    status.textContent = 'Vui lòng chọn đầy đủ đơn vị hành chính.';
    status.setAttribute('role', 'alert');
    return;
  }
  searching = true;
  submit.disabled = true;
  submitLabel.textContent = 'Đang tìm...';
  loading.hidden = false;
  empty.hidden = true;
  count.hidden = true;
  coverage.hidden = true;
  results.setAttribute('aria-busy', 'true');
  results.replaceChildren();
  resolved.hidden = true;
  status.textContent = 'Đang tìm nơi nộp trong khu vực đã chọn...';
  status.setAttribute('role', 'status');
  try {
    const data = await searchNearbyOffices({
      address, query: byId('query').value.trim()
    });
    if (sequence === searchSequence) {
      renderResults(data);
      void enrichContacts(data, sequence);
      if (window.matchMedia('(max-width: 999px)').matches) {
        byId('results-section').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      }
    }
  } catch (error) {
    if (sequence === searchSequence) {
      status.textContent = error.backendMessage || 'Không thể tìm địa điểm lúc này. Vui lòng thử lại.';
      status.setAttribute('role', 'alert');
      empty.hidden = false;
      byId('empty-title').textContent = 'Chưa thể tải gợi ý';
      byId('empty-description').textContent = 'Vui lòng thử lại sau ít phút. Thông tin tìm kiếm của bạn vẫn được giữ lại.';
      byId('empty-hint').hidden = true;
    }
  } finally {
    searching = false;
    loading.hidden = true;
    results.setAttribute('aria-busy', 'false');
    submit.disabled = false;
    submitLabel.textContent = 'Tìm nơi nộp';
  }
});

for (const select of [province, ward]) setupAdministrativePicker(select);
loadProvinces();
