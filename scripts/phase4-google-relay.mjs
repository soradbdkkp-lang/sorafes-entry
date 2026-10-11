// 開発サーバー専用。試験キーはサーバー側だけで付与する。
export async function relayPhase4(payload, { endpoint, key, oldEndpoint, fetchImpl = fetch }) {
  if (!endpoint || !key) return { ok: false, code: 'NOT_CONFIGURED' };
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint) || endpoint === oldEndpoint) return { ok: false, code: 'CONFIG' };
  if (!payload || payload.testOnly !== true || payload.fault || !['settings', 'create', 'read', 'update', 'recover'].includes(payload.action)) return { ok: false, code: 'INVALID' };
  try {
    const body = JSON.stringify({ ...payload, testKey: key });
    if (body.length > 26000) return { ok: false, code: 'INVALID' };
    const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(25000) });
    if (!response.ok) return { ok: false, code: 'UNKNOWN' };
    const result = await response.json();
    if (!result || typeof result.ok !== 'boolean') return { ok: false, code: 'UNKNOWN' };
    if (!result.ok) {
      const known = ['CLOSED', 'DENIED', 'INVALID', 'CONFIG', 'BUSY', 'CONFLICT', 'PENDING', 'UNKNOWN'];
      return { ok: false, code: known.includes(result.code) ? result.code : 'UNKNOWN' };
    }
    if (payload.action === 'settings') {
      if (result.localOnly !== false || !Number.isFinite(Date.parse(result.deadline))) return { ok: false, code: 'UNKNOWN' };
      return { ok: true, deadline: result.deadline, localOnly: false };
    }
    if (!/^P4TEST-[0-9]{6,}$/.test(result.receipt) || !Number.isSafeInteger(result.version) || result.version < 1 || result.status !== 'committed') return { ok: false, code: 'UNKNOWN' };
    if (payload.action === 'read') {
      if (result.receipt !== payload.receipt || !result.draft || typeof result.draft !== 'object') return { ok: false, code: 'UNKNOWN' };
      return { ok: true, receipt: result.receipt, version: result.version, status: 'committed', draft: result.draft };
    }
    if (result.requestId !== payload.requestId || (payload.action === 'update' && result.receipt !== payload.receipt)) return { ok: false, code: 'UNKNOWN' };
    return { ok: true, receipt: result.receipt, version: result.version, requestId: result.requestId, status: 'committed' };
  } catch { return { ok: false, code: 'UNKNOWN' }; }
}
