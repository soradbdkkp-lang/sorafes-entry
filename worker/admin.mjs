import { projectEntry, testReceipts } from '../src/admin/data.ts';
import { authConfigured, authStore, cookie, createSession, ipKey, passwordMatches, sessionId, verifiedSessionId } from './admin-session.mjs';
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
export async function adminRequest(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  const denied = () => response({ ok: false, code: 'DENIED' }, 403);
  if (!authConfigured(env) || url.protocol !== 'https:') return denied();
  if (request.headers.has('Origin') && request.headers.get('Origin') !== url.origin) return denied();
  if (['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site'))) return denied();
  if (url.pathname === '/api/admin/login' || url.pathname === '/api/admin/logout') {
    if (request.method !== 'POST') return response({ ok: false, code: 'INVALID' }, 405);
    if (request.headers.get('Origin') !== url.origin) return denied();
    if (url.pathname === '/api/admin/logout') {
      const token = await verifiedSessionId(request, env);
      try { if (token) await authStore(env, { action: 'revoke', id: token.id }); }
      catch { return response({ ok: false, code: 'UNKNOWN' }, 503); }
      return withCookie(response({ ok: true }), cookie());
    }
    try {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip || ip.length > 64) return denied();
      const rate = await authStore(env, { action: 'attempt', ipKey: await ipKey(ip, env) });
      if (rate.allowed !== true) {
        const limited = response({ ok: false, code: 'RATE_LIMITED' }, 429);
        limited.headers.set('Retry-After', '60'); return limited;
      }
      if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return response({ ok: false, code: 'INVALID' }, 415);
      const payload = await loginBody(request);
      if (!payload || typeof payload.password !== 'string' || Object.keys(payload).length !== 1 || new TextEncoder().encode(payload.password).length > 256) return response({ ok: false, code: 'INVALID' }, 400);
      if (!await passwordMatches(payload.password, env)) return denied();
      return withCookie(response({ ok: true }), cookie(await createSession(request, env)));
    } catch { return response({ ok: false, code: 'UNKNOWN' }, 503); }
  }
  if (url.pathname === '/admin/login' && request.method === 'GET') return adminAsset(request, env);
  if (!await sessionId(request, env)) return denied();
  if (request.method !== 'GET') return response({ ok: false, code: 'INVALID' }, 405);
  if (url.pathname.startsWith('/admin')) {
    return adminAsset(request, env);
  }
  if (url.pathname !== '/api/admin/entries') return response({ ok: false, code: 'INVALID' }, 404);
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(env.ADMIN_APPS_SCRIPT_URL) || typeof env.ADMIN_RELAY_SECRET !== 'string' || env.ADMIN_RELAY_SECRET.length < 32) return response({ ok: false, code: 'CONFIG' }, 503);
  try {
    const result = await fetchImpl(env.ADMIN_APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'entries', secret: env.ADMIN_RELAY_SECRET }), signal: AbortSignal.timeout(25000), redirect: 'follow' });
    if (!result.ok) throw Error();
    const data = await result.json();
    if (data.ok !== true || !Array.isArray(data.entries)) throw Error();
    // 上流も専用の許可項目だけを返す。ブラウザへ秘密・認証レコードを流さない。
    const entries = data.entries.map(e => projectEntry({ ...e, draft: e })).filter(e => !testReceipts.has(e.receipt));
    if (new Set(entries.map(e => e.receipt)).size !== entries.length) throw Error();
    return response({ ok: true, entries });
  } catch { return response({ ok: false, code: 'UNKNOWN' }, 502); }
}

function withCookie(result, value) { result.headers.set('Set-Cookie', value); return result; }
async function adminAsset(request, env) {
  const result = await env.ASSETS.fetch(request);
  const headers = new Headers(result.headers);
  headers.set('Cache-Control', 'no-store'); headers.set('X-Frame-Options', 'DENY');
  headers.set('Content-Security-Policy', "frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
  headers.set('Referrer-Policy', 'no-referrer');
  return new Response(result.body, { status: result.status, headers });
}
async function loginBody(request) {
  if (Number(request.headers.get('Content-Length') ?? 0) > 1024) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
  finally { reader.releaseLock(); }
}
