import { projectEntry, testReceipts } from '../src/admin/data.ts';
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export async function authorized(request, env, fetchImpl = fetch) {
  try {
    if (env.ADMIN_ENABLED !== 'true' || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ADMIN_ACCESS_ISSUER) || !env.ADMIN_ACCESS_AUD) return false;
    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? '';
    if (token.length > 16000) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claim = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now = Date.now() / 1000;
    if (header.alg !== 'RS256' || claim.iss !== env.ADMIN_ACCESS_ISSUER || !Array.isArray(claim.aud) || !claim.aud.includes(env.ADMIN_ACCESS_AUD) || !Number.isFinite(claim.exp) || claim.exp <= now || !Number.isFinite(claim.iat) || claim.iat > now || (claim.nbf !== undefined && (!Number.isFinite(claim.nbf) || claim.nbf > now))) return false;
    const res = await fetchImpl(`${env.ADMIN_ACCESS_ISSUER}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const { keys } = await res.json();
    const jwk = keys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts.slice(0, 2).join('.')));
  } catch { return false; }
}
export async function adminRequest(request, env, fetchImpl = fetch) {
  if (!await authorized(request, env, fetchImpl)) return response({ ok: false, code: 'DENIED' }, 403);
  const url = new URL(request.url);
  if (request.method !== 'GET') return response({ ok: false, code: 'INVALID' }, 405);
  if (url.pathname.startsWith('/admin')) {
    const result = await env.ASSETS.fetch(request);
    const headers = new Headers(result.headers); headers.set('Cache-Control', 'no-store');
    return new Response(result.body, { status: result.status, headers });
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
