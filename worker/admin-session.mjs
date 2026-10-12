export const COOKIE = '__Host-sorafes-admin';
export const SESSION_SECONDS = 3600;
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function authConfigured(env) {
  return env.ADMIN_ENABLED === 'true' && typeof env.ADMIN_PASSWORD === 'string' &&
    encoder.encode(env.ADMIN_PASSWORD).length >= 20 && encoder.encode(env.ADMIN_PASSWORD).length <= 256 &&
    typeof env.ADMIN_SESSION_SECRET === 'string' && /^[a-fA-F0-9]{64}$/.test(env.ADMIN_SESSION_SECRET) &&
    typeof env.ADMIN_AUTH?.idFromName === 'function' && typeof env.ADMIN_AUTH?.get === 'function';
}
async function key(env, context) {
  // パスワード／署名鍵の変更で既存Cookieも無効化する。用途別に鍵を分離。
  const material = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify([context, env.ADMIN_SESSION_SECRET, env.ADMIN_PASSWORD])));
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function passwordMatches(value, env) {
  const k = await key(env, 'password-compare-v1');
  const expected = await crypto.subtle.sign('HMAC', k, encoder.encode(env.ADMIN_PASSWORD));
  return crypto.subtle.verify('HMAC', k, expected, encoder.encode(value));
}
export async function authStore(env, payload) {
  const stub = env.ADMIN_AUTH.get(env.ADMIN_AUTH.idFromName('single-operator-v1'));
  const response = await stub.fetch('https://admin-auth.internal/', { method: 'POST', body: JSON.stringify(payload) });
  if (!response.ok) throw Error('AUTH_STORE');
  const result = await response.json();
  if (result.ok !== true) throw Error('AUTH_STORE');
  return result;
}
export async function ipKey(ip, env) {
  return b64(await crypto.subtle.sign('HMAC', await key(env, 'rate-ip-v1'), encoder.encode(ip)));
}
export async function createSession(request, env) {
  const id = b64(crypto.getRandomValues(new Uint8Array(32)));
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const body = `${id}.${expires}`;
  const signature = b64(await crypto.subtle.sign('HMAC', await key(env, 'session-v1'), encoder.encode(`${new URL(request.url).origin}|${body}`)));
  await authStore(env, { action: 'create', id, expires });
  return `${body}.${signature}`;
}
export async function verifiedSessionId(request, env) {
  if (!authConfigured(env) || new URL(request.url).protocol !== 'https:') return null;
  try {
    const values = (request.headers.get('Cookie') ?? '').split(';').map(s => s.trim()).filter(s => s.startsWith(`${COOKIE}=`));
    if (values.length !== 1) return null;
    const token = values[0].slice(COOKIE.length + 1);
    if (!/^[A-Za-z0-9_-]{43}\.[0-9]{10}\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const [id, exp, signature] = token.split('.');
    if (b64(unb64(signature)) !== signature) return null;
    const now = Math.floor(Date.now() / 1000);
    if (Number(exp) <= now || Number(exp) > now + SESSION_SECONDS) return null;
    const valid = await crypto.subtle.verify('HMAC', await key(env, 'session-v1'), unb64(signature), encoder.encode(`${new URL(request.url).origin}|${id}.${exp}`));
    if (!valid) return null;
    return { id, expires: Number(exp) };
  } catch { return null; }
}
export async function sessionId(request, env) {
  try {
    const token = await verifiedSessionId(request, env);
    return token && (await authStore(env, { action: 'check', ...token })).active === true ? token.id : null;
  } catch { return null; }
}
export function cookie(value = '') {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${value ? SESSION_SECONDS : 0}`;
}

// 公開ルートを持たないWorker内部binding。単一Objectで全拠点の試行と失効を管理。
export class AdminAuth {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    try {
      const input = await request.json();
      const now = Math.floor(Date.now() / 1000);
      return await this.storage.transaction(async txn => {
        const data = await txn.get('auth-state') ?? { attempts: [], sessions: {} };
        data.attempts = data.attempts.filter(a => a.at > now - 60);
        for (const [id, expires] of Object.entries(data.sessions)) if (expires <= now) delete data.sessions[id];
        let result;
        if (input.action === 'attempt' && typeof input.ipKey === 'string') {
          const allowed = data.attempts.length < 20 && data.attempts.filter(a => a.ip === input.ipKey).length < 5;
          if (allowed) data.attempts.push({ at: now, ip: input.ipKey });
          result = { allowed };
        } else if (input.action === 'create' && /^[A-Za-z0-9_-]{43}$/.test(input.id) && Number.isInteger(input.expires) && input.expires > now && input.expires <= now + SESSION_SECONDS) {
          // 一人運営向けに同時セッションを最大10件に制限。古いものから失効。
          const ids = Object.keys(data.sessions).sort((a, b) => data.sessions[a] - data.sessions[b]);
          if (ids.length >= 10) delete data.sessions[ids[0]];
          data.sessions[input.id] = input.expires;
          result = {};
        } else if (input.action === 'check') {
          result = { active: data.sessions[input.id] === input.expires && input.expires > now };
        } else if (input.action === 'revoke') {
          delete data.sessions[input.id]; result = {};
        } else return json({ ok: false }, 400);
        await txn.put('auth-state', data);
        return json({ ok: true, ...result });
      });
    } catch { return json({ ok: false }, 503); }
  }
}
