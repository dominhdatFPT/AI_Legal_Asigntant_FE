// =============================================================================
// MODULE DUY NHẤT GỌI API MẪU ĐƠN (Procedure service, qua Gateway /api/procedures/...).
// Hợp đồng API cho BE: docs/form-template-api-contract.md. Mỗi mẫu trả về:
//   { id, template_group_id, version, status, name, domain, procedure_id, content, created_at, updated_at, deleted_at }
// status: draft | published | hidden | archived. content = JSON mẫu (schema_version, name, code, domain, procedure_id, sections).
// =============================================================================
import { api } from '/admin-api.js';
import { snapshotBlock } from '/form-blocks.js';

// Cờ chuyển nguồn dữ liệu: mặc định gọi API thật (Procedure service). Thêm ?api=mock vào URL để dùng mock trong bộ nhớ (test e2e, demo không cần BE).
// Mock chỉ sống trong một lần tải trang (không dùng localStorage), nên mẫu admin vừa tạo không sang được trang công dân.
export const USE_MOCK = new URLSearchParams(window.location.search).get('api') === 'mock';

const ADMIN = '/api/procedures/admin/form-templates';
const PUBLIC = '/api/procedures/form-templates';
const query = (params) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};
const post = (path, body) => api(path, { method: 'POST', ...(body && { body }) });

const real = {
  listAdmin: ({ domain, status, includeDeleted } = {}) => api(`${ADMIN}${query({ domain, status, include_deleted: includeDeleted || undefined })}`),
  getAdmin: (id) => api(`${ADMIN}/${encodeURIComponent(id)}`),
  create: (content) => post(ADMIN, content),
  update: (id, content) => api(`${ADMIN}/${encodeURIComponent(id)}`, { method: 'PUT', body: content }),
  publish: (id) => post(`${ADMIN}/${encodeURIComponent(id)}/publish`),
  hide: (id) => post(`${ADMIN}/${encodeURIComponent(id)}/hide`),
  newVersion: (id) => post(`${ADMIN}/${encodeURIComponent(id)}/new-version`),
  remove: (id) => api(`${ADMIN}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restore: (id) => post(`${ADMIN}/${encodeURIComponent(id)}/restore`),
  listPublished: ({ domain, procedureId } = {}) => api(`${PUBLIC}${query({ domain, procedure_id: procedureId })}`),
  getPublished: (id) => api(`${PUBLIC}/${encodeURIComponent(id)}`)
};

// ===== Mock: cùng quy tắc trạng thái/phiên bản như hợp đồng API =====
const fail = (status, code, message) => Promise.reject(Object.assign(new Error(message), { status, code }));
const now = () => new Date().toISOString();
let seq = 0;
const rows = [];
const insert = (content, { group, version = 1, status = 'draft' } = {}) => {
  seq += 1;
  const row = { id: `mock-${seq}`, template_group_id: group || `group-${seq}`, version, status, name: content.name, domain: content.domain,
    procedure_id: content.procedure_id ?? null, content: structuredClone(content), created_at: now(), updated_at: now(), deleted_at: null };
  rows.push(row);
  return row;
};
const copy = (row) => structuredClone(row);
const find = (id) => rows.find((row) => row.id === id);
const alive = (id) => {
  const row = find(id);
  return row && !row.deleted_at ? Promise.resolve(row) : fail(404, 'TEMPLATE_NOT_FOUND', 'Không tìm thấy mẫu đơn.');
};
const touch = (row, changes) => Object.assign(row, changes, { updated_at: now() });

const mock = {
  listAdmin: async ({ domain, status, includeDeleted } = {}) => {
    const items = rows.filter((row) => (!domain || row.domain === domain) && (!status || row.status === status) && (includeDeleted || !row.deleted_at));
    return { items: items.map(copy).reverse(), total: items.length };
  },
  getAdmin: async (id) => copy(await alive(id)),
  create: async (content) => copy(insert(content)),
  update: async (id, content) => {
    const row = await alive(id);
    if (row.status !== 'draft') return fail(409, 'TEMPLATE_NOT_DRAFT', 'Chỉ sửa được bản nháp. Hãy tạo phiên bản mới.');
    return copy(touch(row, { content: structuredClone(content), name: content.name, domain: content.domain, procedure_id: content.procedure_id ?? null }));
  },
  publish: async (id) => {
    const row = await alive(id);
    if (!['draft', 'hidden'].includes(row.status)) return fail(409, 'INVALID_STATUS', 'Chỉ xuất bản được bản nháp hoặc mẫu đang ẩn.');
    rows.filter((other) => other.template_group_id === row.template_group_id && other !== row && ['published', 'hidden'].includes(other.status))
      .forEach((other) => touch(other, { status: 'archived' }));
    return copy(touch(row, { status: 'published' }));
  },
  hide: async (id) => {
    const row = await alive(id);
    if (row.status !== 'published') return fail(409, 'INVALID_STATUS', 'Chỉ ẩn được mẫu đang xuất bản.');
    return copy(touch(row, { status: 'hidden' }));
  },
  newVersion: async (id) => {
    const row = await alive(id);
    const group = rows.filter((other) => other.template_group_id === row.template_group_id && !other.deleted_at);
    const draft = group.find((other) => other.status === 'draft');
    if (draft) return copy(draft); // mỗi nhóm chỉ một bản nháp: trả lại bản đang có
    return copy(insert(row.content, { group: row.template_group_id, version: Math.max(...group.map((other) => other.version)) + 1 }));
  },
  remove: async (id) => { touch(await alive(id), { deleted_at: now() }); return null; },
  restore: async (id) => {
    const row = find(id);
    if (!row) return fail(404, 'TEMPLATE_NOT_FOUND', 'Không tìm thấy mẫu đơn.');
    return copy(touch(row, { deleted_at: null }));
  },
  listPublished: async ({ domain, procedureId } = {}) => {
    const items = rows.filter((row) => row.status === 'published' && !row.deleted_at && (!domain || row.domain === domain) && (!procedureId || row.procedure_id === procedureId));
    return { items: items.map(copy), total: items.length };
  },
  getPublished: async (id) => {
    const row = find(id);
    return row && row.status === 'published' && !row.deleted_at ? copy(row) : fail(404, 'TEMPLATE_NOT_FOUND', 'Mẫu đơn không tồn tại hoặc đã ngừng sử dụng.');
  }
};

// Dữ liệu mẫu cho mock: một mẫu có thẻ lặp lại (Bên A/Bên B) + trường tự do, một mẫu hộ kinh doanh, một bản nháp.
const seedSections = (spec) => {
  const used = new Set();
  return spec.map(([title, blocks], i) => ({ id: `sec_${i + 1}`, title, order: i + 1, blocks: blocks.map(([key, free], j) => {
    const block = { ...snapshotBlock(key, used, free), order: j + 1 };
    used.add(block.instance_id);
    return block;
  }) }));
};
const seed = (name, code, domain, spec, status) => {
  const content = { schema_version: 1, name, code, domain, procedure_id: null, sections: seedSections(spec) };
  return insert(content, { status });
};
if (USE_MOCK) {
  seed('Hợp đồng ủy quyền', 'HD-UQ', 'dat_dai', [
    ['I. Bên ủy quyền', [['personal_info'], ['phone']]],
    ['II. Bên được ủy quyền', [['personal_info'], ['phone']]],
    ['III. Nội dung ủy quyền', [['land_parcel'], ['free_field', { label: 'Phạm vi ủy quyền', type: 'textarea' }], ['free_field', { label: 'Thời hạn ủy quyền đến ngày', type: 'date' }]]]
  ], 'published');
  seed('Giấy đề nghị đăng ký hộ kinh doanh', '01/HKD', 'ho_kinh_doanh', [
    ['I. Chủ hộ kinh doanh', [['personal_info'], ['phone'], ['email']]],
    ['II. Thông tin hộ kinh doanh', [['organization'], ['business_lines'], ['tax_code']]]
  ], 'published');
  seed('Đơn đề nghị tách thửa đất', '', 'dat_dai', [
    ['I. Người sử dụng đất', [['personal_info']]],
    ['II. Thửa đất đề nghị tách', [['land_parcel'], ['free_field', { label: 'Lý do tách thửa', type: 'textarea' }]]]
  ], 'draft');
}

export const formTemplates = USE_MOCK ? mock : real;

// Lĩnh vực của mẫu đơn (khác 'land'/'business' của danh mục thủ tục) và tiền tố mã thủ tục tương ứng.
export const DOMAINS = { dat_dai: 'Đất đai', ho_kinh_doanh: 'Hộ kinh doanh', doanh_nghiep: 'Doanh nghiệp' };
export const PROCEDURE_PREFIX = { dat_dai: 'DD-', ho_kinh_doanh: 'HKD-', doanh_nghiep: 'DN-' };
export const STATUSES = { draft: 'Bản nháp', published: 'Đang xuất bản', hidden: 'Đã ẩn', archived: 'Lưu trữ' };
