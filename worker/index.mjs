const TOURNAMENT_ID = 'frog-assemble-2026';
const ENDPOINT_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
const RECEIPT_PATTERN = /^FAC-2026-\d{6}$/;
const ACTIONS = new Set(['settings', 'create', 'read', 'update', 'recover']);
const FAILURE_CODES = new Set([
  'CLOSED', 'DENIED', 'INVALID', 'CONFIG', 'BUSY', 'CONFLICT',
  'PENDING', 'UNKNOWN', 'DUPLICATE', 'POSSIBLE_DUPLICATE',
]);
const MAX_BODY_BYTES = 26000;

const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});

function safeResult(payload, value) {
  if (!object(value) || (value.ok !== true && value.ok !== false)) return { ok: false, code: 'UNKNOWN' };
  if (value.ok === false) {
    return { ok: false, code: typeof value.code === 'string' && FAILURE_CODES.has(value.code) ? value.code : 'UNKNOWN' };
  }

  if (payload.action === 'settings') {
    if (value.mode !== 'production' || value.tournamentId !== TOURNAMENT_ID ||
        typeof value.deadline !== 'string' || !Number.isFinite(Date.parse(value.deadline))) {
      return { ok: false, code: 'UNKNOWN' };
    }
    return { ok: true, mode: 'production', tournamentId: TOURNAMENT_ID, deadline: value.deadline };
  }

  if (typeof value.receipt !== 'string' || !RECEIPT_PATTERN.test(value.receipt) ||
      !Number.isSafeInteger(value.version) || value.version < 1 || value.status !== 'committed') {
    return { ok: false, code: 'UNKNOWN' };
  }

  if (payload.action === 'read') {
    if (value.receipt !== payload.receipt || !object(value.draft)) return { ok: false, code: 'UNKNOWN' };
    return { ok: true, receipt: value.receipt, version: value.version, status: 'committed', draft: value.draft };
  }

  if (typeof payload.requestId !== 'string' || value.requestId !== payload.requestId ||
      (payload.action === 'update' && value.receipt !== payload.receipt)) {
    return { ok: false, code: 'UNKNOWN' };
  }
  return { ok: true, receipt: value.receipt, version: value.version, requestId: value.requestId, status: 'committed' };
}

async function relay(request, env, fetchImpl) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ ok: false, code: 'DENIED' }, 403);
  if (request.method !== 'POST') return json({ ok: false, code: 'INVALID' }, 405);
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) return json({ ok: false, code: 'INVALID' }, 415);

  const endpoint = env.SORAFES_PRODUCTION_APPS_SCRIPT_URL;
  if (typeof endpoint !== 'string' || !ENDPOINT_PATTERN.test(endpoint)) return json({ ok: false, code: 'CONFIG' });

  let text;
  try { text = await request.text(); }
  catch { return json({ ok: false, code: 'INVALID' }); }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return json({ ok: false, code: 'INVALID' }, 413);

  let payload;
  try { payload = JSON.parse(text); }
  catch { return json({ ok: false, code: 'INVALID' }); }
  if (!object(payload) || typeof payload.action !== 'string' || !ACTIONS.has(payload.action) ||
      'fault' in payload || 'testOnly' in payload || 'mode' in payload || 'tournamentId' in payload) {
    return json({ ok: false, code: 'INVALID' });
  }

  try {
    const upstream = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'production', tournamentId: TOURNAMENT_ID, ...payload }),
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    if (!upstream.ok) return json({ ok: false, code: 'UNKNOWN' });
    let value;
    try { value = await upstream.json(); }
    catch { return json({ ok: false, code: 'UNKNOWN' }); }
    return json(safeResult(payload, value));
  } catch {
    return json({ ok: false, code: 'UNKNOWN' });
  }
}

export async function handleRequest(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  if (url.pathname === '/api/entry') return relay(request, env, fetchImpl);
  if (url.pathname.startsWith('/api/')) return json({ ok: false, code: 'INVALID' }, 404);
  return env.ASSETS.fetch(request);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
