import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Wranglerに同梱されたランタイムで検証。実Secret・本番URL・Google通信は使用しない。
const bundle = await build({ entryPoints: ['worker/index.mjs'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const runtime = new Miniflare(convertV4MiniflareOptions({
  cf: false, workers: [{ name: 'admin-local-test',
  modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-11',
  bindings: { ADMIN_ENABLED: 'true', ADMIN_PASSWORD: 'fictional-runtime-password-only', ADMIN_SESSION_SECRET: 'a'.repeat(64) },
  durableObjects: { ADMIN_AUTH: { className: 'AdminAuth', useSQLite: true } },
  serviceBindings: { ASSETS: () => new Response('fictional-admin-shell') },
  }],
}));
try {
  const call = (path, options = {}) => runtime.dispatchFetch(`https://example.test${path}`, options);
  const login = (password, ip = '192.0.2.1') => call('/api/admin/login', { method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ password }) });
  assert.equal((await call('/admin/entries')).status, 403);
  assert.equal((await call('/api/admin/entries')).status, 403);
  assert.equal((await login('wrong')).status, 403);
  const result = await login('fictional-runtime-password-only');
  assert.equal(result.status, 200);
  const token = result.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await call('/admin/entries', { headers: { Cookie: token } })).status, 200);
  // 認証成功でもバックエンド未設定ならデータを返さない。
  assert.equal((await call('/api/admin/entries', { headers: { Cookie: token } })).status, 503);
  assert.equal((await call('/api/admin/logout', { method: 'POST', headers: { Cookie: token, Origin: 'https://example.test' } })).status, 200);
  assert.equal((await call('/admin/entries', { headers: { Cookie: token } })).status, 403);
  for (let i = 0; i < 3; i++) assert.equal((await login('wrong')).status, 403);
  assert.equal((await login('fictional-runtime-password-only')).status, 429);
  console.log('管理Worker実ランタイム: ログイン・画面/API保護・失効・試行制限を確認。外部通信なし。');
} finally { await runtime.dispose(); }
