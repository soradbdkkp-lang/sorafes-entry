import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminAuth, COOKIE, sessionId } from '../worker/admin-session.mjs';
import { committedEntries, projectEntry, matchesEntry } from '../src/admin/data.ts';
import { adminRequest } from '../worker/admin.mjs';
import { handleRequest } from '../worker/index.mjs';
import { build } from 'esbuild';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const receipt = 'FAC-2026-000006';
const draft = { kind: 'solo', representative: 0, players: [{ name: '架空Player', xId: 'fake_x', gameId: 'fake#123' }] };
// 架空の認証値のみ。本番Secretを読み込まない。
const baseEnv = { ADMIN_ENABLED: 'true', ADMIN_PASSWORD: 'fictional-test-password-only', ADMIN_SESSION_SECRET: 'a'.repeat(64), ADMIN_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/FAKE/exec', ADMIN_RELAY_SECRET: 'x'.repeat(32), ASSETS: { fetch: () => new Response('shell') } };
const env = baseEnv;
function fixture() {
  const records = new Map(); let queue = Promise.resolve(); let auth;
  const txn = { get: async k => structuredClone(records.get(k)), put: async (k, v) => { records.set(k, structuredClone(v)); } };
  const storage = { transaction: callback => { const next = queue.then(() => callback(txn)); queue = next.catch(() => {}); return next; } };
  const restart = () => { auth = new AdminAuth({ storage }); };
  restart();
  return { records, restart, env: { ...baseEnv, ADMIN_AUTH: { idFromName: name => name, get: () => ({ fetch: (url, options) => auth.fetch(new Request(url, options)) }) } } };
}
function req(path = '/api/admin/entries', options = {}) {
  const { token, ip = '192.0.2.1', ...init } = options;
  return new Request(`https://example.test${path}`, { ...init, headers: { 'CF-Connecting-IP': ip, ...(token ? { Cookie: token } : {}), ...init.headers } });
}
const login = (environment, password = baseEnv.ADMIN_PASSWORD, options = {}) => adminRequest(req('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }), headers: { 'Content-Type': 'application/json', Origin: 'https://example.test' }, ...options }), environment);
const tokenFrom = res => res.headers.get('Set-Cookie').split(';')[0];
const upstream = async () => new Response(JSON.stringify({ ok: true, entries: [projectEntry({ receipt, version: 1, status: 'committed', draft })] }));

test('admin パスワード照合・Cookie属性・画面とAPI認証・秘密非露出', async () => {
  const f = fixture();
  assert.equal((await login(f.env, 'wrong')).status, 403);
  const result = await login(f.env);
  assert.equal(result.status, 200);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=3600']) assert.ok(result.headers.get('Set-Cookie').includes(flag));
  assert.ok(!result.headers.get('Set-Cookie').includes('Domain='));
  assert.deepEqual(await result.json(), { ok: true });
  const token = tokenFrom(result);
  for (const path of ['/admin', '/admin/entries', '/admin/entries/anything', '/api/admin/entries']) assert.equal((await handleRequest(req(path), f.env, upstream)).status, 403);
  assert.equal((await handleRequest(req('/admin/login'), f.env)).status, 200);
  const shell = await handleRequest(req('/admin/entries', { token }), f.env);
  assert.equal(await shell.text(), 'shell'); assert.equal(shell.headers.get('X-Frame-Options'), 'DENY');
  const data = await adminRequest(req(undefined, { token }), f.env, upstream);
  assert.equal(data.status, 200); assert.equal(data.headers.get('Cache-Control'), 'no-store');
  const body = await data.text();
  for (const secret of [baseEnv.ADMIN_PASSWORD, baseEnv.ADMIN_SESSION_SECRET, baseEnv.ADMIN_RELAY_SECRET, token]) assert.ok(!body.includes(secret));
  assert.ok(!JSON.stringify(f.records.get('auth-state')).includes(baseEnv.ADMIN_PASSWORD));
});
test('admin 改ざん・重複Cookie・別ホスト・署名鍵/パスワード変更・期限切れ拒否', async () => {
  const f = fixture(), result = await login(f.env), token = tokenFrom(result);
  assert.equal(await sessionId(req(undefined, { token }), f.env) !== null, true);
  for (const invalid of [token.slice(0, -6) + 'AAAAAA', token + '; ' + token, `${COOKIE}=invalid`, token.replace(/\.[0-9]{10}\./, '.9999999999.')]) assert.equal(await sessionId(req(undefined, { token: invalid }), f.env), null);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const alias = token.slice(0, -1) + alphabet[alphabet.indexOf(token.at(-1)) + 1];
  assert.equal(await sessionId(req(undefined, { token: alias }), f.env), null);
  assert.equal(await sessionId(new Request('https://other.test/admin/entries', { headers: { Cookie: token } }), f.env), null);
  assert.equal(await sessionId(req(undefined, { token }), { ...f.env, ADMIN_PASSWORD: 'another-fictional-long-password' }), null);
  assert.equal(await sessionId(req(undefined, { token }), { ...f.env, ADMIN_SESSION_SECRET: 'b'.repeat(64) }), null);
  const original = Date.now;
  try { Date.now = () => original() + 3600_000; assert.equal(await sessionId(req(undefined, { token }), f.env), null); }
  finally { Date.now = original; }
});
test('admin ログアウトでサーバー失効・Cookie削除・旧Cookieの再利用不可', async () => {
  const f = fixture(), token = tokenFrom(await login(f.env));
  const res = await adminRequest(req('/api/admin/logout', { token, method: 'POST', headers: { Origin: 'https://example.test' } }), f.env);
  assert.equal(res.status, 200); assert.ok(res.headers.get('Set-Cookie').includes('Max-Age=0'));
  assert.equal(await sessionId(req(undefined, { token }), f.env), null);
  assert.equal((await adminRequest(req(undefined, { token }), f.env, upstream)).status, 403);
  assert.equal((await adminRequest(req('/api/admin/logout', { method: 'GET' }), f.env)).status, 405);
});
test('admin Origin/Fetch Metadata・HTTP・不正入力・旧Accessヘッダー拒否', async () => {
  const f = fixture();
  for (const headers of [{ Origin: 'https://evil.test' }, {}, { Origin: 'null' }, { Origin: 'https://example.test', 'Sec-Fetch-Site': 'same-site' }]) {
    assert.equal((await adminRequest(req('/api/admin/login', { method: 'POST', headers, body: '{}' }), f.env)).status, 403);
  }
  const token = tokenFrom(await login(f.env));
  assert.equal((await adminRequest(req(undefined, { token, headers: { Origin: 'https://evil.test' } }), f.env)).status, 403);
  assert.equal((await adminRequest(new Request('http://example.test/admin/login'), f.env)).status, 403);
  assert.equal((await adminRequest(req(undefined, { headers: { 'Cf-Access-Jwt-Assertion': 'previous-token' } }), f.env)).status, 403);
  for (const body of ['null', '{', JSON.stringify({ password: 'x'.repeat(1025) }), JSON.stringify({ password: baseEnv.ADMIN_PASSWORD, extra: true })]) {
    assert.equal((await adminRequest(req('/api/admin/login', { method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' }, body }), fixture().env)).status, 400);
  }
});
test('admin レート制限はIP5回/分・全体20回/分、再起動・並行要求・時間経過', async () => {
  const f = fixture();
  const responses = await Promise.all(Array.from({ length: 8 }, () => login(f.env, 'wrong')));
  assert.equal(responses.filter(r => r.status === 403).length, 5);
  assert.equal(responses.filter(r => r.status === 429).length, 3);
  f.restart(); assert.equal((await login(f.env)).status, 429);
  const g = fixture();
  for (let i = 0; i < 20; i++) assert.equal((await login(g.env, 'wrong', { ip: `192.0.2.${i + 1}` })).status, 403);
  const limited = await login(g.env, undefined, { ip: '192.0.2.100' });
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
  assert.ok(!JSON.stringify(g.records.get('auth-state')).includes('192.0.2'));
  const original = Date.now;
  try { Date.now = () => original() + 60_000; assert.equal((await login(f.env)).status, 200); }
  finally { Date.now = original; }
});
test('admin 設定欠落・ストレージ障害をfail closedにする', async () => {
  const f = fixture();
  for (const field of ['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'ADMIN_AUTH', 'ADMIN_ENABLED']) {
    const broken = { ...f.env, [field]: undefined };
    for (const path of ['/admin/login', '/admin/entries', '/api/admin/entries']) assert.equal((await adminRequest(req(path), broken)).status, 403);
    assert.equal((await login(broken)).status, 403);
  }
  const token = tokenFrom(await login(f.env));
  const broken = { ...f.env, ADMIN_AUTH: { idFromName: n => n, get: () => ({ fetch: () => { throw Error('offline'); } }) } };
  assert.equal((await login(broken)).status, 503);
  assert.equal((await adminRequest(req(undefined, { token }), broken)).status, 403);
  assert.equal((await adminRequest(req('/api/admin/logout', { token, method: 'POST', headers: { Origin: 'https://example.test' } }), broken)).status, 503);
});
test('admin 上流異常は502・設定不足は503・共有SecretはWorkerだけが付与', async () => {
  const f = fixture(), token = tokenFrom(await login(f.env));
  const res = await adminRequest(req(undefined, { token }), f.env, async (url, init) => {
    assert.equal(url, f.env.ADMIN_APPS_SCRIPT_URL);
    assert.deepEqual(JSON.parse(init.body), { action: 'entries', secret: f.env.ADMIN_RELAY_SECRET }); return upstream();
  });
  assert.equal(res.status, 200);
  assert.equal((await adminRequest(req(undefined, { token }), { ...f.env, ADMIN_RELAY_SECRET: undefined })).status, 503);
  for (const reply of [() => new Response('bad'), () => new Response('{}'), () => new Response('', { status: 500 }), () => { throw Error(); }]) assert.equal((await adminRequest(req(undefined, { token }), f.env, reply)).status, 502);
});
test('admin 詳細はメンバーカード・キラー名・欠損表示・HTMLエスケープ', async () => {
  const b = await build({ entryPoints: ['src/admin/Entries.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react'], loader: { '.css': 'empty' } });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', b.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const entry = projectEntry({ receipt, version: 2, status: 'committed', draft: { ...draft, kind: 'team', players: Array.from({ length: 6 }, () => ({ name: '<script>alert(1)</script>', killer: true, duty: 'both', killers: ['trapper'], favorite: 'trapper' })) } });
  const html = renderToStaticMarkup(createElement(loaded.exports.EntryDetails, { entry }));
  assert.match(html, /メンバー6/); assert.match(html, /トラッパー/); assert.match(html, /未記録/); assert.ok(!html.includes('<script>')); assert.match(html, /兼任可/);
});
const row = (r = receipt, version = 1, state = 'committed', id = `${r}-${version}`) => ['', state, r, '{"verifier":"must-not-return"}', JSON.stringify({ id, receipt: r, version, state, draft, admittedAt: `2026-10-12T10:0${version}:00Z` })];
test('admin committedのみ・preparedのみ除外・試験5件除外・最新版・未確定編集では前の確定版', () => {
  const rows = [row(), row(receipt, 2), row(receipt, 3, 'prepared'), row('FAC-2026-000007', 1, 'prepared'), ...Array.from({ length: 5 }, (_, i) => row(`FAC-2026-00000${i + 1}`))];
  const entries = committedEntries(rows);
  assert.equal(entries.length, 1); assert.equal(entries[0].version, 2);
  assert.equal(entries[0].submittedAt, '2026-10-12T10:01:00Z');
  assert.ok(!JSON.stringify(entries).includes('verifier'));
});
test('admin 個人・6人チーム・キラー・欠損・検索', () => {
  for (const kind of ['solo', 'team', 'killer']) {
    const e = projectEntry({ receipt, version: 1, status: 'committed', draft: { ...draft, kind, teamName: '架空Team', players: Array.from({ length: kind === 'team' ? 6 : 1 }, () => ({ ...draft.players[0], killer: kind === 'killer', killers: ['trapper'] })) } });
    assert.equal(e.players.length, kind === 'team' ? 6 : 1);
    for (const q of [receipt, 'PLAYER', '@FAKE_X', 'Team']) assert.ok(matchesEntry(e, q));
    assert.ok(!matchesEntry(e, 'no-match'));
  }
  assert.equal(projectEntry({ receipt, version: 1, status: 'committed' }).players.length, 0);
  assert.throws(() => projectEntry({ receipt, version: 1, status: 'prepared' }));
});
test('admin 独立Apps Scriptは読取のみ・認証拒否・安全な投影', async () => {
  const bundle = await build({ entryPoints: ['apps-script/admin-server.ts'], bundle: true, write: false, format: 'iife', globalName: 'Admin' });
  const context = vm.createContext({ PropertiesService: { getScriptProperties: () => ({ getProperty: k => k === 'ADMIN_RELAY_SECRET' ? env.ADMIN_RELAY_SECRET : 'fake-id' }) }, SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => [['記録日時UTC', '処理状態', '受付番号', '認証管理JSON', '操作JSON'], row()] }) }) }) } });
  vm.runInContext(bundle.outputFiles[0].text, context);
  assert.equal(context.Admin.handleAdmin({ action: 'entries', secret: 'wrong' }).code, 'DENIED');
  assert.equal(context.Admin.handleAdmin({ action: 'entries', secret: env.ADMIN_RELAY_SECRET }).entries.length, 1);
});
