// =============================================================================
// MODULE GỌI API MẪU ĐƠN (Procedure service, qua Gateway /api/procedures/...).
// Hợp đồng API cho BE: docs/form-template-api-contract.md. Mỗi mẫu trả về:
//   { id, template_group_id, version, status, name, domain, procedure_id, content, created_at, updated_at, deleted_at }
// status: draft | published | hidden | archived. content = JSON mẫu (schema_version, name, code, domain, procedure_id, sections).
// Dữ liệu lưu trực tiếp 100% xuống Database PostgreSQL (Supabase) qua API Gateway.
// =============================================================================
import { api } from '/admin-api.js';

export const USE_MOCK = false;

const ADMIN = '/api/procedures/admin/form-templates';
const PUBLIC = '/api/procedures/form-templates';

const query = (params) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};
const post = (path, body) => api(path, { method: 'POST', ...(body && { body }) });

export const formTemplates = {
  listAdmin: ({ domain, status, includeDeleted } = {}) =>
    api(`${ADMIN}${query({ domain, status, include_deleted: includeDeleted || undefined })}`),
  getAdmin: (id) => api(`${ADMIN}/${encodeURIComponent(id)}`),
  create: (content) => post(ADMIN, content),
  createDraft: (content) => post(ADMIN, content),
  update: (id, content) => api(`${ADMIN}/${encodeURIComponent(id)}`, { method: 'PUT', body: content }),
  updateDraft: (id, content) => api(`${ADMIN}/${encodeURIComponent(id)}`, { method: 'PUT', body: content }),
  publish: (id) => post(`${ADMIN}/${encodeURIComponent(id)}/publish`),
  hide: (id) => post(`${ADMIN}/${encodeURIComponent(id)}/hide`),
  newVersion: (id) => post(`${ADMIN}/${encodeURIComponent(id)}/new-version`),
  remove: (id) => api(`${ADMIN}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restore: (id) => post(`${ADMIN}/${encodeURIComponent(id)}/restore`),
  listPublished: ({ domain, procedureId } = {}) =>
    api(`${PUBLIC}${query({ domain, procedure_id: procedureId })}`),
  getPublished: (id) => api(`${PUBLIC}/${encodeURIComponent(id)}`)
};

// Lĩnh vực của mẫu đơn (khác 'land'/'business' của danh mục thủ tục) và tiền tố mã thủ tục tương ứng.
export const DOMAINS = { dat_dai: 'Đất đai', ho_kinh_doanh: 'Hộ kinh doanh', doanh_nghiep: 'Doanh nghiệp' };
export const PROCEDURE_PREFIX = { dat_dai: 'DD-', ho_kinh_doanh: 'HKD-', doanh_nghiep: 'DN-' };
export const STATUSES = { draft: 'Bản nháp', published: 'Đang xuất bản', hidden: 'Đã ẩn', archived: 'Lưu trữ' };
