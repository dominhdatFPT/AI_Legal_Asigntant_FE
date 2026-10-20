export const domainLabels = {
  land: 'Đất đai & Bất động sản', business: 'Doanh nghiệp & Hộ kinh doanh',
  cooperative: 'Hợp tác xã', social_insurance: 'Bảo hiểm xã hội'
};
export const statusLabels = { source: 'Bản nguồn · Chỉ xem', needs_review: 'Cần rà soát nội dung', specific_case: 'Mẫu cho tình huống riêng' };
export const groupLabel = (group) => group.code ? `${group.code} · ${group.name}` : group.name;
export const proceduresOf = (item) => item.procedures || [{ key: item.procedure, code: item.procedure_code ?? item.procedure, name: item.procedure_name }];
export const procedureLabel = (item) => groupLabel(proceduresOf(item)[0]);
export function procedureChoices(items) {
  const choices = new Map();
  for (const item of items) for (const group of proceduresOf(item)) choices.set(group.key, groupLabel(group));
  return choices;
}

export function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
}

export function filterReferences(items, { query = '', domain = '', procedure = '', status = '' } = {}) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => (!domain || item.domain === domain)
    && (!procedure || proceduresOf(item).some((p) => p.key === procedure || p.code === procedure))
    && (!status || item.content_status === status)
    && words.every((word) => normalizeSearch(`${item.name} ${item.description || ''} ${item.source_filename || ''} ${domainLabels[item.domain] || ''} ${proceduresOf(item).map(groupLabel).join(' ')}`).includes(word)));
}

// Chỉ tài liệu tham khảo chưa điền được đóng gói cùng FE. Không gọi API nháp hoặc generation.
export async function loadReferenceCatalog(fetcher = fetch) {
  const response = await fetcher('/api/reference-catalog', { cache: 'no-cache' });
  if (!response.ok) throw new Error('REFERENCE_CATALOG_UNAVAILABLE');
  const envelope = await response.json();
  const payload = envelope.data || envelope;
  if (!payload.read_only || !Array.isArray(payload.items) || payload.items.some((item) =>
    typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.text !== 'string'
    || (item.procedure && (typeof item.procedure !== 'string' || typeof item.procedure_name !== 'string' || !item.procedure_name.trim()))
    || item.view_only !== true || item.can_fill !== false || !statusLabels[item.content_status]
    || !Array.isArray(item.procedures) || !item.procedures.length
    || !Array.isArray(item.pages) || !item.pages.length || item.pages.length !== item.page_count
    || item.pages.some((page) => !/^\/reference-templates\/[a-z0-9-]+\.png$/.test(page)))) {
    throw new Error('REFERENCE_CATALOG_INVALID');
  }
  return payload;
}

export async function loadReferences(fetcher = fetch) { return (await loadReferenceCatalog(fetcher)).items; }
