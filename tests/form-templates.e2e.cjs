// Kiểm thử đầu-cuối "Thêm mẫu đơn" (admin dựng mẫu, công dân điền, tải PDF) bằng Playwright + Chrome đã cài.
// Chạy: PORT=3100 node AI_Legal/src/index.js  rồi  node tests/form-templates.e2e.cjs
// Admin: khung "Thêm mẫu đơn" trên /landforms và /business-form-templates. Công dân: /lam-don.
// Biến môi trường: BASE_URL (mặc định http://localhost:3100), PLAYWRIGHT (đường dẫn gói playwright nếu không cài trong dự án),
//   CHROME (mặc định Chrome trên Windows), SHOTS (thư mục ảnh chụp + PDF, mặc định ../screenshots-mau-don).
// Phiên đăng nhập là phiên giả trong script (chặn /api/users/me...), không đi qua /login (Firebase đang hỏng).
// Dữ liệu mẫu đơn dùng mock trong bộ nhớ của form-template-service.js (mở trang với ?api=mock).
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const SHOTS = path.resolve(process.env.SHOTS || path.join(__dirname, '..', '..', 'screenshots-mau-don'));
fs.mkdirSync(SHOTS, { recursive: true });

const PROCEDURES = [
  { id: 'p-dd-001', code: 'DD-001', name: 'Đăng ký biến động do chuyển nhượng', domain: 'land' },
  { id: 'p-hkd-001', code: 'HKD-001', name: 'Đăng ký thành lập hộ kinh doanh', domain: 'business' }
];
const PROFILE = {
  user_id: 'u2', id_number: '001095012345', full_name: 'NGUYỄN THỊ HƯƠNG', date_of_birth: '1995-03-12', gender: 'Nữ',
  nationality: 'Việt Nam', issue_date: '2021-06-01', issue_place: 'Cục Cảnh sát QLHC về TTXH', expiry_date: null,
  permanent_address: { detail: '12 Lê Lợi', ward: 'Phường Bến Nghé', province: 'Thành phố Hồ Chí Minh' },
  current_same_as_permanent: true, current_address: null, phone: '0901234567', email: 'huong@example.vn', tax_code: null
};

async function fakeSession(page, user, profile = PROFILE) {
  await page.route('**/api/users/me', (route) => route.fulfill({ json: { data: user } }));
  await page.route('**/api/users/me/citizen-profile', (route) => route.fulfill({ json: { data: profile } }));
  await page.route('**/api/procedures/domains/all/names', (route) => route.fulfill({ json: { data: { items: PROCEDURES } } }));
}

const errors = [];
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => /Assertion failed/.test(message.text()) && errors.push(message.text()));
};
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const ids = (page, selector, attr) => page.locator(selector).evaluateAll((els, a) => els.map((el) => el.getAttribute(a)), attr);
const step = (name) => console.log(`✓ ${name}`);

async function admin(browser) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  watch(page);
  await fakeSession(page, { id: 'u1', role: 'admin', full_name: 'Quản trị thử', email: 'admin@example.vn' });
  await page.goto(`${BASE}/landforms?api=mock`);
  await page.waitForSelector('#ftl-rows strong');
  // Trang Hồ sơ đất đai chỉ hiện mẫu lĩnh vực đất đai
  assert.deepEqual(await page.locator('#ftl-rows strong').allInnerTexts(), ['Đơn đề nghị tách thửa đất', 'Hợp đồng ủy quyền']);
  await page.locator('#ft-app').scrollIntoViewIfNeeded();
  await shot(page, '01-admin-danh-sach');

  // Tạo mẫu bằng nút "Thêm mẫu đơn" có sẵn của trang: 2 mục, thẻ "Thông tin cá nhân" lặp lại, trường tự do
  await page.click('#add-template-card');
  await page.waitForSelector('.ftb-overlay:not([hidden]) [data-info="name"]');
  assert.equal(await page.inputValue('[data-info="domain"]'), 'dat_dai');
  await page.fill('[data-info="name"]', 'Hợp đồng thuê nhà ở');
  await page.fill('[data-info="code"]', 'HĐ-TN/01');
  await page.selectOption('[data-info="procedure_id"]', 'p-dd-001');
  await page.fill('[data-sec-title="sec_1"]', 'I. Bên cho thuê');
  await page.click('[data-act="add-block"][data-key="personal_info"]');
  await page.click('[data-act="add-block"][data-key="phone"]');
  await page.click('[data-act="sec-add"]');
  await page.fill('[data-sec-title="sec_2"]', 'II. Bên thuê');
  // Kéo thẻ từ thư viện thả vào mục II
  await page.dragAndDrop('[data-lib="personal_info"]', '[data-drop-blocks="sec_2"]');
  await page.fill('#ftb-free-title', 'Giá thuê mỗi tháng (đồng)');
  await page.selectOption('#ftb-free-type', 'number');
  await page.click('[data-act="add-free"]');
  assert.deepEqual(await ids(page, '[data-drop-blocks="sec_1"] [data-blk]', 'data-blk'), ['personal_info_1', 'phone_1']);
  assert.deepEqual(await ids(page, '[data-drop-blocks="sec_2"] [data-blk]', 'data-blk'), ['personal_info_2', 'free_1']);
  step('tạo mẫu 2 mục, thẻ lặp lại có instance_id riêng, trường tự do');

  // Kéo thả: đổi thứ tự mục, chuyển thẻ sang mục khác, đổi thứ tự thẻ trong mục
  await page.dragAndDrop('[data-sec="sec_2"] .ftb-sec__head .ftb-handle', '[data-sec="sec_1"] .ftb-sec__head', { targetPosition: { x: 20, y: 2 } });
  assert.deepEqual(await ids(page, '[data-sec]', 'data-sec'), ['sec_2', 'sec_1']);
  await page.click('[data-act="sec-up"][data-id="sec_1"]'); // bàn phím/nút: đưa mục I lên lại
  assert.deepEqual(await ids(page, '[data-sec]', 'data-sec'), ['sec_1', 'sec_2']);
  await page.dragAndDrop('[data-blk="phone_1"] .ftb-handle', '[data-drop-blocks="sec_2"]', { targetPosition: { x: 40, y: 4 } });
  assert.deepEqual(await ids(page, '[data-drop-blocks="sec_2"] [data-blk]', 'data-blk'), ['phone_1', 'personal_info_2', 'free_1']);
  const zone = await page.locator('[data-drop-blocks="sec_2"]').boundingBox(); // thả ở cuối mục
  await page.dragAndDrop('[data-blk="phone_1"] .ftb-handle', '[data-drop-blocks="sec_2"]', { targetPosition: { x: 40, y: zone.height - 4 } });
  assert.deepEqual(await ids(page, '[data-drop-blocks="sec_2"] [data-blk]', 'data-blk'), ['personal_info_2', 'free_1', 'phone_1']);
  await page.selectOption('[data-move-to="phone_1"]', 'sec_1');
  assert.deepEqual(await ids(page, '[data-drop-blocks="sec_1"] [data-blk]', 'data-blk'), ['personal_info_1', 'phone_1']);
  await shot(page, '02-admin-dung-mau');
  step('kéo thả đổi thứ tự mục/thẻ, chuyển thẻ sang mục khác (cả bằng nút)');

  // Nhãn thẻ có sẵn bị khóa: không có ô sửa nhãn, chỉ trường tự do có ô tiêu đề
  assert.equal(await page.locator('[data-free-title]').count(), 1);

  // Xem trước dùng chung component với màn công dân
  await page.click('[data-tab="preview"]');
  await page.waitForSelector('.ft-form');
  assert.equal(await page.locator('.ft-section legend').allInnerTexts().then((t) => t.join('|')), 'I. Bên cho thuê|II. Bên thuê');
  assert.equal(await page.locator('[name="personal_info_2.full_name"]').count(), 1);
  assert.equal(await page.locator('[name="free_1.value"]').count(), 1);
  await shot(page, '03-admin-tong-hop');
  await page.click('[data-act="back-edit"]');
  assert.equal(await page.locator('[data-sec]').count(), 2);
  step('Tổng hợp + Quay lại chỉnh sửa');

  // Rời khi chưa lưu: đóng khung, bấm link trong trang đều hỏi lại; beforeunload khi tải trang khác
  await page.click('[data-act="back"]');
  await page.waitForSelector('dialog.ft-dialog[open]');
  await shot(page, '04-admin-canh-bao-roi-trang');
  await page.click('dialog.ft-dialog [value="cancel"]');
  assert.ok(await page.locator('.ftb-overlay').isVisible());
  await page.evaluate(() => document.querySelector('.admin-nav__link[href="/dashboard"]').click());
  await page.waitForSelector('dialog.ft-dialog[open]');
  await page.click('dialog.ft-dialog [value="cancel"]');
  assert.equal(new URL(page.url()).pathname, '/landforms');
  const beforeUnload = new Promise((resolve) => page.once('dialog', async (d) => { resolve(d.type()); await d.dismiss(); }));
  await page.evaluate(() => { document.body.click(); }); // cần có tương tác người dùng để Chrome hiện beforeunload
  await page.click('[data-info="name"]');
  await page.goto(`${BASE}/dashboard?api=mock`).catch(() => {});
  assert.equal(await beforeUnload, 'beforeunload');
  assert.equal(new URL(page.url()).pathname, '/landforms');
  step('cảnh báo khi rời chưa lưu (đóng khung, link trong trang, beforeunload)');

  // Lưu nháp, xuất bản
  await page.click('[data-act="save"]');
  await page.waitForFunction(() => document.getElementById('ftb-status')?.textContent.includes('Đã lưu'));
  assert.match(await page.textContent('#ftb-status'), /Phiên bản 1 · Bản nháp · Đã lưu/);
  const content = await page.evaluate(async () => {
    const { formTemplates } = await import('/form-template-service.js');
    const { items } = await formTemplates.listAdmin({});
    return items.find((row) => row.name === 'Hợp đồng thuê nhà ở');
  });
  assert.equal(content.status, 'draft');
  assert.equal(content.content.schema_version, 1);
  assert.equal(content.content.procedure_id, 'p-dd-001');
  assert.deepEqual(content.content.sections[1].blocks.map((b) => [b.instance_id, b.order]), [['personal_info_2', 1], ['free_1', 2]]);
  assert.deepEqual(content.content.sections[1].blocks[1].fields, [{ key: 'value', label: 'Giá thuê mỗi tháng (đồng)', type: 'number', required: false }]);
  assert.equal(content.content.sections[0].blocks[0].fields[0].autofill, 'profile.full_name');
  fs.writeFileSync(path.join(SHOTS, 'mau-json-gui-be.json'), JSON.stringify(content.content, null, 2));
  await page.click('[data-act="publish"]');
  await page.waitForSelector('#ftl-rows');
  const row = page.locator('#ftl-rows tr', { hasText: 'Hợp đồng thuê nhà ở' });
  await row.locator('text=Đang xuất bản').waitFor();
  step('lưu nháp (JSON đúng mục 4) và xuất bản');

  // Sửa mẫu đang xuất bản → tạo phiên bản 2 (nháp), xuất bản → bản 1 lưu trữ
  await row.locator('[data-row-act="edit"]').click();
  await page.waitForFunction(() => document.getElementById('ftb-status')?.textContent.includes('Phiên bản 2'));
  await page.fill('[data-sec-title="sec_2"]', 'II. Bên thuê nhà');
  await page.click('[data-act="publish"]');
  await page.waitForSelector('#ftl-rows');
  await page.selectOption('[data-filter="status"]', 'archived');
  await page.locator('#ftl-rows tr', { hasText: 'Hợp đồng thuê nhà ở' }).locator('text=v1').waitFor();
  await page.selectOption('[data-filter="status"]', 'published');
  await page.locator('#ftl-rows tr', { hasText: 'Hợp đồng thuê nhà ở' }).locator('text=v2').waitFor();
  await shot(page, '05-admin-phien-ban-moi');
  step('tạo version mới từ bản đã xuất bản, xuất bản → bản cũ chuyển archived');

  // Ẩn, xóa mềm, khôi phục
  const v2 = () => page.locator('#ftl-rows tr', { hasText: 'Hợp đồng thuê nhà ở' });
  await page.selectOption('[data-filter="status"]', '');
  await v2().filter({ hasText: 'v2' }).locator('[data-row-act="hide"]').click();
  await v2().filter({ hasText: 'v2' }).locator('text=Đã ẩn').waitFor();
  await v2().filter({ hasText: 'v2' }).locator('[data-row-act="delete"]').click();
  await page.click('dialog.ft-dialog [value="ok"]');
  await page.waitForFunction(() => ![...document.querySelectorAll('#ftl-rows tr')].some((tr) => tr.textContent.includes('Hợp đồng thuê nhà ở') && tr.textContent.includes('v2')));
  await page.check('[data-filter="includeDeleted"]');
  await v2().filter({ hasText: 'Đã xóa' }).locator('[data-row-act="restore"]').click();
  await v2().filter({ hasText: 'v2' }).locator('[data-row-act="delete"]').waitFor();
  step('ẩn, xóa mềm, khôi phục');

  // Xuất bản bị chặn khi trường tự do chưa có tiêu đề
  await page.click('#add-template-card');
  await page.fill('[data-info="name"]', 'Mẫu thiếu tiêu đề ô');
  await page.fill('[data-sec-title="sec_1"]', 'I. Thông tin');
  await page.fill('#ftb-free-title', 'Tạm');
  await page.click('[data-act="add-free"]');
  await page.fill('[data-free-title="free_1"]', '');
  await page.click('[data-act="publish"]');
  assert.match(await page.textContent('#ftb-errors'), /trường tự do chưa có tiêu đề ô/);
  step('chặn xuất bản khi trường tự do chưa có tiêu đề');
  await page.close();

  // Trang Hồ sơ hộ kinh doanh dùng chung khung "Thêm mẫu đơn"
  const biz = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  watch(biz);
  await fakeSession(biz, { id: 'u1', role: 'admin', full_name: 'Quản trị thử', email: 'admin@example.vn' });
  await biz.goto(`${BASE}/business-form-templates?api=mock`);
  await biz.waitForSelector('#ftl-rows strong');
  assert.deepEqual(await biz.locator('#ftl-rows strong').allInnerTexts(), ['Giấy đề nghị đăng ký hộ kinh doanh']);
  await biz.click('#add-template-card');
  await biz.waitForSelector('.ftb-overlay:not([hidden]) [data-info="domain"]');
  assert.deepEqual(await biz.locator('[data-info="domain"] option').evaluateAll((els) => els.map((el) => el.value)), ['ho_kinh_doanh', 'doanh_nghiep']);
  await biz.fill('[data-info="name"]', 'Giấy đề nghị thay đổi nội dung đăng ký hộ kinh doanh');
  await biz.fill('[data-sec-title="sec_1"]', 'I. Chủ hộ kinh doanh');
  await biz.click('[data-act="add-block"][data-key="personal_info"]');
  await biz.click('[data-act="add-block"][data-key="organization"]');
  await shot(biz, '05b-admin-ho-kinh-doanh-dung-mau');
  await biz.click('[data-act="save"]');
  await biz.click('[data-act="back"]');
  await biz.waitForSelector('.ftb-overlay[hidden]', { state: 'attached' });
  await biz.locator('#ftl-rows', { hasText: 'thay đổi nội dung' }).waitFor();
  step('trang hộ kinh doanh: cùng khung dựng mẫu, lĩnh vực hộ kinh doanh/doanh nghiệp, danh sách lọc theo trang');
  await biz.close();
}

async function citizen(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const page = await context.newPage();
  watch(page);
  await fakeSession(page, { id: 'u2', role: 'citizen', full_name: 'Nguyễn Thị Hương', email: 'huong@example.vn' });
  await page.goto(`${BASE}/lam-don?api=mock`);
  await page.waitForSelector('.ff-card');
  assert.deepEqual(await page.locator('.ff-card h2').allInnerTexts(), ['Hợp đồng ủy quyền', 'Giấy đề nghị đăng ký hộ kinh doanh']); // chỉ mẫu đã xuất bản
  await page.selectOption('[data-filter="domain"]', 'ho_kinh_doanh');
  await page.waitForFunction(() => document.querySelectorAll('.ff-card').length === 1);
  await page.selectOption('[data-filter="domain"]', '');
  await page.waitForFunction(() => document.querySelectorAll('.ff-card').length === 2);
  await shot(page, '06-cong-dan-danh-sach');
  step('công dân: chỉ thấy mẫu đã xuất bản, lọc theo lĩnh vực');

  await page.click('[data-act="preview"] >> nth=0');
  await page.waitForSelector('.ff-preview .ft-form');
  assert.ok(await page.locator('.ff-preview [name="personal_info_1.full_name"]').isDisabled());
  await page.click('[data-act="fill"]');
  await page.waitForSelector('#ff-form');

  // Tự điền vào thẻ Bên được ủy quyền (thẻ lặp lại thứ 2), không điền Bên ủy quyền
  const options = await page.locator('#ff-target option').allInnerTexts();
  assert.deepEqual(options, ['I. Bên ủy quyền · Thông tin cá nhân', 'I. Bên ủy quyền · Số điện thoại',
    'II. Bên được ủy quyền · Thông tin cá nhân', 'II. Bên được ủy quyền · Số điện thoại']);
  await page.selectOption('#ff-target', 'personal_info_2');
  await page.click('[data-act="autofill"]');
  assert.equal(await page.inputValue('[name="personal_info_2.full_name"]'), 'NGUYỄN THỊ HƯƠNG');
  assert.equal(await page.inputValue('[name="personal_info_2.permanent_address"]'), '12 Lê Lợi, Phường Bến Nghé, Thành phố Hồ Chí Minh');
  assert.equal(await page.inputValue('[name="phone_2.phone"]'), '0901234567');
  assert.equal(await page.inputValue('[name="personal_info_1.full_name"]'), '');
  await page.fill('[name="personal_info_2.full_name"]', 'NGUYỄN THỊ HƯƠNG LAN'); // ô tự điền vẫn sửa được
  step('tự điền vào đúng thẻ đã chọn, không điền tất cả, vẫn sửa được');

  // Validate từng kiểu
  const fill = async (values) => { for (const [name, value] of Object.entries(values)) await page.fill(`[name="${name}"]`, value); };
  await fill({
    'personal_info_1.full_name': 'Trần Văn Bình', 'personal_info_1.dob': '2999-01-01', 'personal_info_1.cccd_number': '12345678',
    'personal_info_1.cccd_issue_date': '1980-01-01', 'personal_info_1.cccd_issue_place': 'Hà Nội', 'phone_1.phone': '0201234567',
    'land_parcel_1.land_area': '1,000'
  });
  await page.click('#ff-form [type="submit"]');
  const error = (name) => page.locator(`#ft-${name.replace(/[^a-z0-9_]/gi, '-')}-error`).innerText();
  assert.equal(await error('personal_info_1.dob'), 'Ngày sinh không được ở tương lai.');
  assert.equal(await error('personal_info_1.cccd_number'), 'Số CCCD phải gồm đúng 12 chữ số.');
  assert.equal(await error('personal_info_1.cccd_issue_date'), 'Ngày cấp không hợp lệ.');
  assert.match(await error('phone_1.phone'), /Số điện thoại chưa đúng/);
  assert.match(await error('land_parcel_1.land_area'), /Giá trị chưa đúng/);
  assert.equal(await error('personal_info_1.permanent_address'), 'Vui lòng nhập thông tin này.');
  assert.equal(await page.evaluate(() => window.__printed || 0), 0);
  await shot(page, '07-cong-dan-loi-validate');
  step('validate CCCD 12 số, SĐT, ngày sinh tương lai, ngày cấp trước ngày sinh, số, bắt buộc');

  await fill({
    'personal_info_1.dob': '1980-07-20', 'personal_info_1.cccd_number': '0010 8001 2345', 'personal_info_1.cccd_issue_date': '2021-04-10',
    'personal_info_1.permanent_address': 'Số 5 ngõ 18 phố Huế, phường Hai Bà Trưng, Hà Nội', 'phone_1.phone': '+84 912 345 678',
    'land_parcel_1.plot_number': '125', 'land_parcel_1.map_sheet_number': '07', 'land_parcel_1.land_address': 'Xã Đông Anh, Hà Nội',
    'land_parcel_1.land_area': '1.250,5', 'free_1.value': 'Thay mặt bên ủy quyền nộp hồ sơ, nhận kết quả và ký các giấy tờ liên quan.'
  });
  await page.selectOption('[name="land_parcel_1.land_use_purpose"]', 'Đất ở tại nông thôn (ONT)');
  await page.click('#ff-form [type="submit"]');
  await page.waitForFunction(() => window.__printed === 1);
  const printed = await page.locator('#ft-print').innerText();
  for (const text of ['Mẫu số HD-UQ', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', 'HỢP ĐỒNG ỦY QUYỀN',
    'Số điện thoại liên hệ: 0912345678', 'Số CCCD: 001080012345', 'Ngày tháng năm sinh: 20/07/1980', 'NGƯỜI LÀM ĐƠN', '(Ký, ghi rõ họ tên)']) {
    assert.ok(printed.includes(text) || printed.toUpperCase().includes(text), `bản in thiếu "${text}"`);
  }
  assert.equal(await page.locator('#ft-print .ft-dots').count() > 0, true, 'ô trống phải in dòng chấm');
  await page.emulateMedia({ media: 'print' });
  const pdfPath = path.join(SHOTS, 'hop-dong-uy-quyen.pdf');
  await page.pdf({ path: pdfPath, format: 'A4', preferCSSPageSize: true });
  await page.screenshot({ path: path.join(SHOTS, '08-ban-in-a4.png'), fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  try {
    const text = execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', pdfPath, '-'], { encoding: 'utf8' });
    for (const expected of ['Mẫu số HD-UQ', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', 'HỢP ĐỒNG ỦY QUYỀN',
      'NGUYỄN THỊ HƯƠNG LAN', 'Thay mặt bên ủy quyền nộp hồ sơ', 'NGƯỜI LÀM ĐƠN', '(Ký, ghi rõ họ tên)', 'ngày … tháng … năm']) {
      assert.ok(text.includes(expected), `PDF thiếu "${expected}"`);
    }
    fs.writeFileSync(path.join(SHOTS, 'hop-dong-uy-quyen.txt'), text);
    step('PDF A4 đúng tiếng Việt, có quốc hiệu, tiêu ngữ, mã mẫu, phần ký (kiểm bằng pdftotext)');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    console.log('! Không có pdftotext: chỉ kiểm nội dung bản in trên trang, PDF đã lưu ở', pdfPath);
  }
  await context.close();

  // Hồ sơ chưa có CCCD → báo cần cập nhật hồ sơ
  const page2 = await browser.newPage();
  watch(page2);
  await fakeSession(page2, { id: 'u3', role: 'citizen', full_name: 'Chưa khai hồ sơ', email: 'moi@example.vn' }, null);
  await page2.goto(`${BASE}/lam-don?api=mock`);
  await page2.click('[data-act="preview"] >> nth=0');
  await page2.click('[data-act="fill"]');
  await page2.waitForSelector('text=Cần cập nhật hồ sơ cá nhân');
  assert.equal(await page2.locator('#ff-form').count(), 0);
  await shot(page2, '09-cong-dan-chua-co-cccd');
  step('hồ sơ chưa có CCCD → yêu cầu cập nhật hồ sơ trước khi làm đơn');
  await page2.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    await admin(browser);
    await citizen(browser);
    assert.deepEqual(errors, [], `lỗi trên trang: ${errors.join('; ')}`);
    console.log(`Tất cả ca kiểm thử đạt. Ảnh chụp và PDF: ${SHOTS}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
