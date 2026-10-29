export const domainLabels = {
  land: 'Đất đai & Bất động sản', business: 'Doanh nghiệp & Hộ kinh doanh',
  cooperative: 'Hợp tác xã', social_insurance: 'Bảo hiểm xã hội'
};
export const statusLabels = { source: 'Bản nguồn · Chỉ xem', needs_review: 'Cần rà soát nội dung', specific_case: 'Mẫu cho tình huống riêng' };

const FALLBACK_CODES = {
  'coop-branch-registration': 'HTX-001',
  'vat-declaration': 'DN-012',
  'household-certificate-reissue': 'HKD-003',
  'social-insurance-authorization': 'BHXH-001',
  'land-allocation-rental': 'DD-013',
  'land-dispute-mediation': 'DD-014',
  'land-survey': 'DD-015',
  'agricultural-land-term-confirmation': 'DD-016',
  'land-allocation-method-change': 'DD-017',
};

export const groupLabel = (group) => {
  const code = group.code || group.procedure_code || FALLBACK_CODES[group.key] || FALLBACK_CODES[group.procedure] || '';
  return code ? `${code} · ${group.name}` : group.name;
};

export const proceduresOf = (item) => item.procedures || [{ key: item.procedure, code: item.procedure_code ?? FALLBACK_CODES[item.procedure] ?? item.procedure, name: item.procedure_name }];
export const procedureLabel = (item) => groupLabel(proceduresOf(item)[0]);

export function procedureChoices(items) {
  const choices = new Map();
  for (const item of items) {
    for (const group of proceduresOf(item)) {
      choices.set(group.key, groupLabel(group));
    }
  }
  const sortedEntries = Array.from(choices.entries()).sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  return new Map(sortedEntries);
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

// Public, unfilled source PDFs, including administrator uploads.
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
    || !Array.isArray(item.page_dimensions) || item.page_dimensions.length !== item.pages.length
    || item.page_dimensions.some((size) => !Number.isFinite(size.width) || size.width <= 0 || !Number.isFinite(size.height) || size.height <= 0)
    || item.pages.some((page, index) => !/^\/reference-templates\/[a-z0-9-]+\.png$/.test(page)
      && (!/^\/api\/reference-assets\/[0-9a-f-]{36}-page-[1-9][0-9]{0,2}\.png$/.test(page)
        || page !== `/api/reference-assets/${item.id}-page-${index + 1}.png`)))) {
    throw new Error('REFERENCE_CATALOG_INVALID');
  }
  return payload;
}

export async function loadReferences(fetcher = fetch) { return (await loadReferenceCatalog(fetcher)).items; }
