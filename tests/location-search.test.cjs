const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '../AI_Legal');
const page = fs.readFileSync(path.join(root, 'src/pages/location-search.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/location-search.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'public/auth-api.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');

test('standalone search page is authenticated and available as a route', () => {
  assert.match(routes, /app\.get\('\/location-search'/);
  assert.match(page, /protectPage\(\['citizen', 'lawyer'\]\)/);
  assert.match(page, /id="location-form"/);
  assert.match(page, /id="results"/);
});

test('only current administrative units are shown and stale replies are ignored', () => {
  assert.match(script, /fetchAdministrativeUnits\(/);
  assert.match(script, /'current\/provinces'/);
  assert.doesNotMatch(script, /legacy\//);
  assert.doesNotMatch(page, /id="(?:version|district|district-wrap)"/);
  assert.match(script, /sequence !== catalogueSequence/);
  assert.match(script, /sequence === searchSequence/);
  assert.match(script, /setOptions\(ward, \[\]/);
});

test('paid search occurs only on submit and always sends current numeric codes', () => {
  assert.match(script, /form\.addEventListener\('submit'/);
  assert.equal((script.match(/searchNearbyOffices\(/g) || []).length, 1);
  assert.match(script, /province_code: Number\(province\.value\)/);
  assert.match(script, /ward_code: Number\(ward\.value\)/);
  assert.match(script, /administrative_version: 'current'/);
  assert.match(api, /authRequest\('\/api\/locations\/offices\/search'/);
});

test('provider text is rendered as text, distances and links are explicitly labeled', () => {
  assert.match(script, /node\.textContent = text/);
  assert.match(script, /'Khoảng cách'/);
  assert.doesNotMatch(script + page, /Khoảng cách đường thẳng/);
  assert.match(script, /link\.rel = 'noopener noreferrer'/);
  assert.match(script, /url\.hostname === 'www\.google\.com'/);
  assert.doesNotMatch(script, /innerHTML/);
});

const render = (data, overrides = {}) => {
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {}; this._text = ''; }
    get textContent() { return this._text + this.children.map(x => x.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.children = []; }
    get childElementCount() { return this.children.length; }
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
    replaceChildren(...items) { this.children = []; this._text = ''; this.append(...items); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    remove() { this.parent.children = this.parent.children.filter(x => x !== this); }
    querySelector(selector) {
      return this.children.find(x => x.className?.split(' ').includes(selector.slice(1))) ||
        this.children.map(x => x.querySelector(selector)).find(Boolean) || null;
    }
    replaceWith(node) {
      node.parent = this.parent;
      this.parent.children = this.parent.children.map(x => x === this ? node : x);
    }
  }
  const nodes = {};
  const byId = (id) => nodes[id] ??= new Element();
  const context = { URL, byId, nodes, resolved: byId('resolved-address'), results: byId('results'),
    status: byId('status'), count: byId('result-count'), empty: byId('empty-state'),
    coverage: byId('coverage-note'), loading: byId('loading-state'),
    document: { createElement: (tag) => new Element(tag), createTextNode: (text) => {
      const node = new Element('#text'); node.textContent = text; return node;
    } }, ...overrides };
  vm.createContext(context);
  const body = script.slice(script.indexOf('const safeDirections ='), script.indexOf("form.addEventListener('submit'"));
  vm.runInContext(`${body}\nrenderResults(${JSON.stringify(data)});`, context);
  return context;
};
const descendants = (node) => [node, ...node.children.flatMap(descendants)];

test('search has no radius or result count controls and sends neither option', () => {
  assert.doesNotMatch(page, /id="(?:radius|limit)"/);
  assert.doesNotMatch(script, /radius_meters|byId\('radius'\)|byId\('limit'\)/);
  assert.match(page, /tối đa 5 gợi ý/i);
});

test('empty response explains map coverage and keyword choices without claiming no offices exist', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, items: [], is_partial: false, warnings: [] });
  assert.match(ui.status.textContent, /dữ liệu bản đồ/);
  assert.match(ui.status.textContent, /từ khóa khác/);
  assert.equal(ui.resolved.hidden, false);
});

test('partial empty response keeps provider warning visible and asks to retry', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, items: [], is_partial: true,
    warnings: [{ message: 'Chi tiết bản đồ chưa tải được.' }] });
  assert.match(ui.status.textContent, /thử lại/);
  assert.equal(ui.nodes['coverage-message'].textContent, 'Chi tiết bản đồ chưa tải được.');
  assert.equal(ui.coverage.hidden, false);
});

test('partial successful response renders warnings and the actual result safely', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, is_partial: true, warnings: [], items: [
    { name: '<script>bad</script>', address: 'Đà Nẵng', distance_meters: 2800 }
  ] });
  assert.match(ui.status.textContent, /1 địa điểm/);
  assert.equal(ui.results.children.length, 1);
  assert.equal(descendants(ui.results).find(x => x.tagName === 'h3').textContent, '<script>bad</script>');
  assert.equal(descendants(ui.results).filter(x => x.tagName === 'script').length, 0);
});

test('cards end at the action row even when sources and notes are available', () => {
  const ui = render({ origin: { resolved_address: 'Hồ Chí Minh' }, items: [{
    name: 'Cơ quan', address: '92 Nguyễn Trãi', distance_meters: 100,
    source_url: 'https://phuongbenthanh.gov.vn/', source_checked_at: '2026-10-25',
    map_location_note: 'Ghi chú bản đồ', service_note: 'Ghi chú dịch vụ',
    opening_hours: { text: '07:30–17:00', source_url: 'https://phuongbenthanh.gov.vn/' }
  }], warnings: [], is_partial: false });
  const card = ui.results.children[0];
  const info = card.children.find(x => x.className === 'office-info');
  assert.equal(info.children.at(-1).className, 'office-actions');
  assert.equal(descendants(card).filter(x => ['iframe', 'details'].includes(x.tagName)).length, 0);
  assert.doesNotMatch(card.textContent, /Ghi chú|Nguồn thông tin|Đã đối chiếu/);
});

test('missing official coordinates explain the data gap without asking for a retry', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, coverage: { source: 'official_directory' },
    items: [], is_partial: true, warnings: [{ code: 'OFFICIAL_COORDINATES_INCOMPLETE', message: 'Chưa xác minh tọa độ.' }] });
  assert.match(ui.status.textContent, /Chưa có vị trí cơ quan được xác minh/);
  assert.doesNotMatch(ui.status.textContent, /thử lại/);
  assert.equal(ui.coverage.hidden, true);
});

test('official directory coordinate counts are not shown above results', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, coverage: { source: 'official_directory' },
    items: [{ name: 'Hòa Khánh', address: '168 Nguyễn Sinh Sắc', distance_meters: 1600 }],
    is_partial: true, warnings: [{ code: 'OFFICIAL_COORDINATES_INCOMPLETE', message: '72 cơ quan chưa có tọa độ' }] });
  assert.equal(ui.coverage.hidden, true);
  assert.doesNotMatch(ui.status.textContent, /72/);
});

test('office cards show distance, real photo attribution and safe phone contact', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, items: [{ name: 'Trung tâm Hòa Khánh',
    address: '168 Nguyễn Sinh Sắc', distance_meters: 1663, contact_phone: '02363730807',
    contact_source_url: 'https://hoakhanh.danang.gov.vn/',
    photo: { url: '/images/offices/hoa-khanh.jpg', alt: 'Ảnh Hòa Khánh', credit: 'Thư Viện Pháp Luật',
      source_url: 'https://thuvienphapluat.vn/example' } }], is_partial: false, warnings: [] });
  const nodes = descendants(ui.results);
  assert.ok(nodes.some(x => x.tagName === 'img' && x.src === '/images/offices/hoa-khanh.jpg'));
  assert.ok(nodes.some(x => x.tagName === 'a' && x.href === 'tel:02363730807'));
  assert.match(ui.results.textContent, /Khoảng cách1,7km/);
  assert.match(ui.results.textContent, /Giờ làm việcChưa có giờ làm việc được xác minh/);
  const image = nodes.find(x => x.tagName === 'img');
  image.listeners.error();
  assert.equal(descendants(ui.results).filter(x => x.tagName === 'img').length, 0);
  assert.equal(descendants(ui.results).find(x => x.className === 'office-photo-fallback').hidden, false);
});

test('Maps opens externally by exact address without content below the buttons', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, items: [{ name: 'Cơ quan',
    address: '168 Nguyễn Sinh Sắc', latitude: 16.07, longitude: 108.15, distance_meters: 1600
  }], is_partial: false, warnings: [] });
  const link = descendants(ui.results).find(x => x.tagName === 'a' && x.textContent.includes('Xem Google Maps'));
  assert.equal(new URL(link.href).searchParams.get('query'), '168 Nguyễn Sinh Sắc');
  assert.equal(link.target, '_blank');
  assert.equal(descendants(ui.results).filter(x => x.tagName === 'iframe').length, 0);
});

test('Google Maps hours are shown only from a recognized place URL', () => {
  const place = 'https://www.google.com/maps/place/UBND+Phuong+Hoa+Khanh/data=!4m2!3m1!1s0x3142190065719737:0xdd527ea4baef4fef';
  const embed = 'https://www.google.com/maps/embed?pb=verified-place';
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, items: [{
    name: 'Trung tâm Hòa Khánh', address: '168 Nguyễn Sinh Sắc', latitude: 16.0724872, longitude: 108.1581356,
    distance_meters: 1600, maps_url: place, map_embed_url: embed,
    source_url: 'https://hoakhanh.danang.gov.vn/', google_place_id: 'ChIJN5dxZQAZQjER70_vuqR-Ut0',
    opening_hours: { text: 'Thứ Hai–Thứ Sáu: 07:30–17:00', source_url: place }
  }], is_partial: false, warnings: [] });
  assert.match(ui.results.textContent, /07:30–17:00/);
  assert.equal(descendants(ui.results).filter(x => x.tagName === 'iframe').length, 0);
  assert.ok(descendants(ui.results).some(x => x.tagName === 'a' && x.href?.includes('query_place_id=ChIJN5dxZQAZQjER70_vuqR-Ut0')));
});

test('website-verified phone and linked appointment calendar are available on the card', () => {
  const appointment = 'https://xephangqrcode.web.app/VIXtogioqBHK9NFNLRf8/hen-gio-giao-dich/Cy49Nzo9YDSvl7taE6Sf';
  const item = { name: 'Hòa Khánh', address: '168 Nguyễn Sinh Sắc', distance_meters: 1600,
    contact_phone: '02363730807', contact_source_url: 'https://hoakhanh.danang.gov.vn/',
    website_url: 'https://hoakhanh.danang.gov.vn/', appointment_url: appointment,
    appointment_source_url: 'https://hoakhanh.danang.gov.vn/' };
  let ui = render({ origin: { resolved_address: '16 Hòa Mỹ 3' }, items: [item], is_partial: false, warnings: [] });
  assert.ok(descendants(ui.results).some(x => x.tagName === 'a' && x.href === appointment));
  assert.match(ui.results.textContent, /Xem khung giờ theo ngày và quầy/);
  assert.ok(descendants(ui.results).some(x => x.tagName === 'a' && x.href === 'tel:02363730807'));
  item.contact_source_url = 'https://evil.test/';
  item.appointment_source_url = 'https://evil.test/';
  ui = render({ origin: { resolved_address: '16 Hòa Mỹ 3' }, items: [item], is_partial: false, warnings: [] });
  assert.ok(!descendants(ui.results).some(x => x.tagName === 'a' && x.href === appointment));
  assert.ok(!descendants(ui.results).some(x => x.tagName === 'a' && x.href?.startsWith('tel:')));
});

test('missing or unsafe photo, phone and hours never become fabricated details', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, is_partial: false, warnings: [], items: [{
    name: 'Cơ quan', address: 'Đà Nẵng', distance_meters: 500, photo: { url: 'javascript:alert(1)' },
    contact_phone: '0905 onclick=bad', opening_hours: { text: 'Mở cửa 24/7', source_url: 'https://evil.test/' }
  }] });
  assert.equal(descendants(ui.results).filter(x => x.tagName === 'img').length, 0);
  assert.equal(descendants(ui.results).filter(x => x.tagName === 'a' && x.href.startsWith('tel:')).length, 0);
  assert.doesNotMatch(ui.results.textContent, /24\/7/);
  assert.match(ui.results.textContent, /Ảnh cơ quan chưa được cập nhật/);
  assert.match(ui.results.textContent, /Chưa có giờ làm việc được xác minh/);
});

test('unreviewed offices route by exact address and offer a web search fallback', () => {
  const ui = render({ origin: { resolved_address: '120 Nguyễn Thị Minh Khai' }, is_partial: false,
    warnings: [], items: [{ name: 'Trung tâm hành chính công Quận 1',
      address: '120 Nguyễn Thị Minh Khai, Cầu Ông Lãnh, Hồ Chí Minh', latitude: 10.77,
      longitude: 106.69, distance_meters: 800,
      directions_url: 'https://www.google.com/maps/dir/?api=1&origin=120+Nguyen+Thi+Minh+Khai&destination=old' }] });
  const links = descendants(ui.results).filter(x => x.tagName === 'a');
  const route = links.find(x => x.textContent.includes('Chỉ đường'));
  const web = links.find(x => x.textContent.includes('Tìm trên web'));
  assert.equal(new URL(route.href).searchParams.get('destination'),
    '120 Nguyễn Thị Minh Khai, Cầu Ông Lãnh, Hồ Chí Minh');
  assert.equal(new URL(web.href).searchParams.get('q'), 'Trung tâm hành chính công Quận 1, 120 Nguyễn Thị Minh Khai, Cầu Ông Lãnh, Hồ Chí Minh');
});

test('only hours with an accepted source are displayed and cards stay limited to five', () => {
  const item = { name: 'Cơ quan', address: 'Đà Nẵng', distance_meters: 500,
    opening_hours: { text: 'Thứ Hai đến Thứ Sáu, 07:30 đến 11:00', source_url: 'https://thangan.danang.gov.vn/hours' } };
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, is_partial: false, warnings: [], items: Array(6).fill(item) });
  assert.equal(ui.results.children.length, 5);
  assert.match(ui.results.textContent, /Thứ Hai đến Thứ Sáu, 07:30 đến 11:00/);
});

test('no empty native Details disclosure appears for an unsourced map result', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, is_partial: false, warnings: [], items: [
    { name: 'Phòng đăng ký kinh doanh', address: 'Hải Châu, Đà Nẵng', distance_meters: 7000 }
  ] });
  assert.equal(descendants(ui.results).filter(x => x.tagName === 'details').length, 0);
});

test('empty local search explains province restriction even without provider errors', () => {
  const ui = render({ origin: { resolved_address: 'Đà Nẵng' }, is_partial: false, items: [],
    coverage: { province: 'Đà Nẵng', source: 'goong_candidates' },
    warnings: [{ code: 'LOCAL_RESULTS_UNAVAILABLE', message: 'Chưa có dữ liệu phù hợp tại Đà Nẵng.' }] });
  assert.equal(ui.coverage.hidden, false);
  assert.match(ui.nodes['coverage-title'].textContent, /Đà Nẵng/);
  assert.match(ui.status.textContent, /tại Đà Nẵng/);
});

test('page background uses the same photographs as dashboard and has motion controls', () => {
  const dashboard = fs.readFileSync(path.join(root, 'src/pages/user-dashboard.html'), 'utf8');
  for (const id of ['photo-1500382017468-9049fed747ef', 'photo-1486406146926-c627a92ad1ab', 'photo-1450101499163-c8848c66ca85']) {
    assert.ok(dashboard.includes(id));
    assert.ok(page.includes(id));
  }
  assert.match(page, /data-background-pause/);
  assert.match(page, /location-background-shade/);
});


test('Google Places identity is used without requiring an official website or opening hours', () => {
  const ui = render({ origin: { resolved_address: 'Hồ Chí Minh' }, items: [{
    name: 'Trung tâm hành chính công Bến Thành', address: '92 Nguyễn Trãi', distance_meters: 100,
    google_place_id: 'ChIJp79jqT0vdTER_Bxv4VTO6lY', map_destination_name: 'UBND Phường Bến Thành',
    map_identity_source: 'google_places',
    map_identity_source_url: 'https://www.google.com/maps/place/?q=place_id:ChIJp79jqT0vdTER_Bxv4VTO6lY',
    directions_url: 'https://www.google.com/maps/dir/?api=1&destination=old'
  }], warnings: [], is_partial: false });
  const links = descendants(ui.results).filter(x => x.tagName === 'a');
  const route = new URL(links.find(x => x.textContent.includes('Chỉ đường')).href);
  assert.equal(route.searchParams.get('destination_place_id'), 'ChIJp79jqT0vdTER_Bxv4VTO6lY');
  assert.equal(route.searchParams.get('destination'), 'UBND Phường Bến Thành, 92 Nguyễn Trãi');
  assert.ok(!links.some(x => x.textContent.includes('Tìm trên web')));
});

test('administrative search filters the existing list without changing the selected code', () => {
  const context = {Map};
  vm.createContext(context);
  vm.runInContext(script.slice(script.indexOf('const administrativeOptions'), script.indexOf('const closePicker')), context);
  const items = [{name:'Thành phố Đà Nẵng',code:48},{name:'Thành phố Hồ Chí Minh',code:79}];
  context.items = items;
  const find = query => vm.runInContext(`matchingAdministrativeUnits(items, ${JSON.stringify(query)})`, context);
  assert.equal(find('da nang')[0].code, 48);
  assert.equal(find('HỒ CHÍ MINH')[0].code, 79);
  assert.equal(find('khong co').length, 0);
  assert.equal(find('').length, 2);
  assert.equal(items.length, 2);
  const filtering = script.slice(script.indexOf('const filterOptions'), script.indexOf('const setupAdministrativePicker'));
  assert.doesNotMatch(filtering, /select\.replaceChildren|select\.value = ''/);
  assert.doesNotMatch(page, /<input id="(?:province|ward)-filter"/);
});

test('opening hours are vertical rows and preserve split shifts', () => {
  const ui = render({origin:{resolved_address:'Hồ Chí Minh'},warnings:[],is_partial:false,items:[{
    name:'Cơ quan',address:'92 Nguyễn Trãi',distance_meters:100,
    opening_hours:{text:'Thứ Hai–Thứ Sáu: 07:30–11:30, 13:00–17:00 · Thứ Bảy: 07:30–11:30 · Chủ Nhật: đóng cửa',
      source_url:'https://www.google.com/maps/place/?q=place_id:ChIJp79jqT0vdTER_Bxv4VTO6lY'}
  }]});
  const rows = descendants(ui.results).filter(x => x.className === 'office-hours__row');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].textContent, 'Thứ Hai–Thứ Sáu: 07:30–11:30, 13:00–17:00');
  assert.equal(rows[1].textContent, 'Thứ Bảy: 07:30–11:30');
  assert.equal(rows[2].textContent, 'Chủ Nhật: đóng cửa');
});

test('enrichment updates Google identity and hours inside facts/actions without adding lower content', async () => {
  const data = { web_lookup_id: 'lookup', origin: { resolved_address: 'Hồ Chí Minh' }, items: [{
    place_id: 'office', name: 'Trung tâm hành chính công Bến Thành', address: '92 Nguyễn Trãi', distance_meters: 100,
    directions_url: 'https://www.google.com/maps/dir/?api=1&destination=old'
  }], warnings: [], is_partial: false };
  const patch = { place_id: 'office', web_lookup_status: 'verified',
    google_place_id: 'ChIJp79jqT0vdTER_Bxv4VTO6lY', map_destination_name: 'UBND Phường Bến Thành',
    map_identity_source: 'google_places',
    map_identity_source_url: 'https://www.google.com/maps/place/?q=place_id:ChIJp79jqT0vdTER_Bxv4VTO6lY',
    opening_hours: { text: 'Thứ Hai: 07:30–11:30', source_url: 'https://www.google.com/maps/place/?q=place_id:ChIJp79jqT0vdTER_Bxv4VTO6lY' }
  };
  const ui = render(data, { searchSequence: 1, enrichOfficeContacts: async () => ({items:[patch]}) });
  const card = ui.results.children[0];
  await vm.runInContext(`enrichContacts(${JSON.stringify(data)}, 1)`, ui);
  assert.equal(ui.results.children[0], card);
  assert.match(card.textContent, /Thứ Hai: 07:30–11:30/);
  const info = card.querySelector('.office-info');
  assert.equal(info.children.at(-1).className, 'office-actions');
  const route = descendants(card).find(x => x.tagName === 'a' && x.textContent.includes('Chỉ đường'));
  assert.equal(new URL(route.href).searchParams.get('destination_place_id'), patch.google_place_id);
  assert.ok(!descendants(card).some(x => x.textContent === 'Tìm trên web'));
});

test('late enrichment cannot overwrite results after the address changes', async () => {
  const data = {web_lookup_id:'lookup', origin:{resolved_address:'Hồ Chí Minh'}, items:[{
    place_id:'office', name:'Cơ quan', address:'92 Nguyễn Trãi', distance_meters:100
  }], warnings:[], is_partial:false};
  let resolve;
  const ui = render(data, {searchSequence:1, enrichOfficeContacts:() => new Promise(done => { resolve=done; })});
  const before = ui.results.textContent;
  const pending = vm.runInContext(`enrichContacts(${JSON.stringify(data)}, 1)`, ui);
  ui.searchSequence = 2;
  resolve({items:[{place_id:'office', opening_hours:{text:'Should not appear', source_url:'https://phuongbenthanh.gov.vn/'}}]});
  await pending;
  assert.equal(ui.results.textContent, before);
});


test('location uses the shared user navigation instead of a separate header', () => {
  assert.match(page, /<!-- user-header -->/);
  assert.doesNotMatch(page, /class="service-header"|class="service-nav"/);
  assert.match(routes, /'\/location-search': 'location-search'/);
  assert.match(routes, /sendUserPage\('location-search.html'\)/);
});

test('both reviewed Da Nang offices show named Google destinations and vertical hours', () => {
  const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, '../../backend/services/location-service/app/data/office_profiles.json'), 'utf8'));
  for (const id of ['danang-public-service-03', 'danang-public-service-09']) {
    const profile = profiles[id];
    const ui = render({origin:{resolved_address:'Đà Nẵng'},warnings:[],is_partial:false,items:[{
      name:profile.map_destination_name, address:'Đà Nẵng', distance_meters:500,
      source_url:profile.website_url, ...profile,
      directions_url:'https://www.google.com/maps/dir/?api=1&destination=old'
    }]});
    const map = descendants(ui.results).find(x=> x.tagName==='a' && x.textContent.includes('Xem Google Maps'));
    const params = new URL(map.href).searchParams;
    assert.equal(params.get('query_place_id'),profile.google_place_id);
    assert.ok(params.get('query').startsWith(profile.map_destination_name));
    assert.ok(descendants(ui.results).filter(x=>x.className==='office-hours__row').length>=2);
  }
});


test('weekend day groups stay on the same vertical hours row', () => {
  const ui = render({origin:{resolved_address:'Đà Nẵng'},warnings:[],is_partial:false,items:[{
    name:'UBND',address:'Đà Nẵng',distance_meters:100,
    opening_hours:{text:'Thứ Hai–Thứ Sáu: 07:30–17:00 · Thứ Bảy, Chủ Nhật: đóng cửa',
      source_url:'https://www.google.com/maps/place/?q=place_id:ChIJR3N1XAAZQjERXyT442XL2Cc'}
  }]});
  const rows=descendants(ui.results).filter(x=>x.className==='office-hours__row');
  assert.equal(rows.length,2);
  assert.equal(rows[1].textContent,'Thứ Bảy, Chủ Nhật: đóng cửa');
});


test('missing hours no longer add a link to view hours on Google Maps', () => {
  const ui=render({origin:{resolved_address:'Đà Nẵng'},warnings:[],is_partial:false,items:[{
    name:'Cơ quan',address:'15 Lê Hồng Phong',distance_meters:100
  }]});
  assert.doesNotMatch(ui.results.textContent,/Xem giờ trên Google Maps/);
  assert.match(ui.results.textContent,/Chưa có giờ làm việc được xác minh/);
});

test('reviewed web hours use the normal label and keep split shifts vertical', () => {
  const profiles=JSON.parse(fs.readFileSync(path.join(__dirname,'../../backend/services/location-service/app/data/office_profiles.json'),'utf8'));
  const hours=profiles['danang-public-service-01'].opening_hours;
  const data={origin:{resolved_address:'Đà Nẵng'},warnings:[],is_partial:false,items:[{
    name:'Trung tâm Phục vụ hành chính công phường Hải Châu',address:'15 Lê Hồng Phong, Hải Châu, Đà Nẵng',distance_meters:100,opening_hours:hours
  }]};
  let ui=render(data);
  assert.match(ui.results.textContent,/Giờ làm việc/);
  assert.doesNotMatch(ui.results.textContent,/tham khảo/);
  assert.ok(!descendants(ui.results).some(x => x.title?.startsWith('Nguồn:')));
  const rows=descendants(ui.results).filter(x=>x.className==='office-hours__row');
  assert.equal(rows.length,3);
  assert.equal(rows[1].textContent,'Sáng: 07:30–11:30');
  assert.equal(rows[2].textContent,'Chiều: 13:30–17:00');
  data.items[0].opening_hours={...hours,source_url:'https://evil.test/ubnd/hai-chau'};
  ui=render(data);
  assert.doesNotMatch(ui.results.textContent,/07:30/);
  data.items[0].opening_hours={...hours,verification_status:'verified'};
  ui=render(data);
  assert.doesNotMatch(ui.results.textContent,/07:30/);
});

test('AI search hours fill missing hours without showing provenance and preserve Maps hours', async () => {
  const summary = {text:'Thứ Hai–Thứ Sáu · Sáng: 07:30–11:30 · Chiều: 13:30–17:00',
    source_type:'ai_summary', verification_status:'unverified'};
  for (const existing of [undefined, {text:'Thứ Hai: 08:00–16:00',
      source_url:'https://www.google.com/maps/place/?q=place_id:ChIJR3N1XAAZQjERXyT442XL2Cc'}]) {
    const data = {web_lookup_id:'lookup',origin:{resolved_address:'Đà Nẵng'},warnings:[],is_partial:false,
      items:[{place_id:'office',name:'UBND',address:'Đà Nẵng',distance_meters:100,opening_hours:existing}]};
    const ui=render(data,{searchSequence:1,enrichOfficeContacts:async()=>({
      items:[{place_id:'office',opening_hours:summary}],google_search_widgets:['internal metadata']})});
    await vm.runInContext(`enrichContacts(${JSON.stringify(data)}, 1)`,ui);
    assert.match(ui.results.textContent,existing ? /08:00–16:00/ : /07:30–11:30/);
    assert.doesNotMatch(ui.results.textContent,/tham khảo|Nguồn:|internal metadata|ai_summary/);
    assert.equal(ui.results.children[0].querySelector('.office-info').children.at(-1).className,'office-actions');
  }
});
