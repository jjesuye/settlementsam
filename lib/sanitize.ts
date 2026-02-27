/**
 * lib/sanitize.ts
 *
 * Strips internal scoring, pricing, and distribution fields from lead
 * objects before they are sent to any client-facing browser response.
 *
 * Never expose: score, tier, salePrice, estimatedValue, clientId,
 * deliveryStatus, delivered, replaced, disputed, exclusive_until,
 * exclusive_firm, client_id to the end-user's browser.
 */

const INTERNAL_FIELDS = new Set([
  'score',
  'tier',
  'salePrice',
  'estimatedValue',
  'clientId',
  'client_id',
  'deliveryStatus',
  'delivered',
  'replaced',
  'disputed',
  'exclusive_until',
  'exclusive_firm',
  'disqualify_reason',
  'statute_warning',
]);

/**
 * Returns a copy of the lead object with all internal fields removed.
 * Safe to send in any browser-facing API response.
 */
export function sanitizeLeadForClient(
  lead: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(lead).filter(([key]) => !INTERNAL_FIELDS.has(key)),
  );
}

/**
 * Sanitize an array of leads (e.g., for bulk client-facing responses).
 */
export function sanitizeLeadsForClient(
  leads: Record<string, unknown>[],
): Record<string, unknown>[] {
  return leads.map(sanitizeLeadForClient);
}
