import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { committedEntries, projectEntry, matchesEntry } from '../src/admin/data.ts';
import { authorized, adminRequest } from '../worker/admin.mjs';
import { handleRequest } from '../worker/index.mjs';
import { build } from 'esbuild';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const receipt = 'FAC-2026-000006';
const draft = { kind: 'solo', representative: 0, players: [{ name: '架空Player', xId: 'fake_x', gameId: 'fake#123' }] };
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
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test' };
const env = { ADMIN_ENABLED: 'true', ADMIN_ACCESS_ISSUER: 'https://example.cloudflareaccess.com', ADMIN_ACCESS_AUD: 'test-aud', ADMIN_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/FAKE/exec', ADMIN_RELAY_SECRET: 'x'.repeat(32), ASSETS: { fetch: () => new Response('shell') } };
function request(path = '/api/admin/entries', claims = {}, header = {}) {
  const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const data = `${encode({ alg: 'RS256', kid: 'test', ...header })}.${encode({ iss: env.ADMIN_ACCESS_ISSUER, aud: [env.ADMIN_ACCESS_AUD], iat: Date.now() / 1000 - 10, exp: Date.now() / 1000 + 60, ...claims })}`;
  return new Request(`https://example.test${path}`, { headers: { 'Cf-Access-Jwt-Assertion': `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}` } });
}
const upstream = async url => new Response(JSON.stringify(String(url).endsWith('/certs') ? { keys: [jwk] } : { ok: true, entries: [projectEntry({ receipt, version: 1, status: 'committed', draft })] }));
test('admin 認証未設定・偽装・期限・aud・iss・アルゴリズムを拒否', async () => {
  assert.equal(await authorized(request(), {}, upstream), false);
  assert.equal(await authorized(new Request('https://example.test'), env, upstream), false);
  for (const claims of [{ exp: 0 }, { aud: ['wrong'] }, { iss: 'https://evil.test' }, { nbf: Date.now() / 1000 + 100 }]) assert.equal(await authorized(request(undefined, claims), env, upstream), false);
  assert.equal(await authorized(request(undefined, {}, { alg: 'none' }), env, upstream), false);
  const forged = request(); forged.headers.set('Cf-Access-Jwt-Assertion', forged.headers.get('Cf-Access-Jwt-Assertion').slice(0, -8) + 'AAAAAAAA');
  assert.equal(await authorized(forged, env, upstream), false);
  assert.equal(await authorized(request(), env, upstream), true);
});
test('admin 画面/API保護・成功・上流異常・no-store・秘密非露出', async () => {
  for (const path of ['/admin', '/admin/entries', '/api/admin/entries']) assert.equal((await handleRequest(new Request(`https://example.test${path}`), {}, upstream)).status, 403);
  assert.equal(await (await adminRequest(request('/admin/entries'), env, upstream)).text(), 'shell');
  const res = await adminRequest(request(), env, upstream);
  assert.equal(res.status, 200); assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.ok(!(await res.text()).includes(env.ADMIN_RELAY_SECRET));
  for (const reply of [() => new Response('bad'), () => new Response('{}'), () => new Response('', { status: 500 }), () => { throw Error(); }]) {
    const fail = await adminRequest(request(), env, async url => String(url).endsWith('/certs') ? upstream(url) : reply());
    assert.equal(fail.status, 502);
  }
});
test('admin 独立Apps Scriptは読取のみ・認証拒否・安全な投影', async () => {
  const bundle = await build({ entryPoints: ['apps-script/admin-server.ts'], bundle: true, write: false, format: 'iife', globalName: 'Admin' });
  const context = vm.createContext({ PropertiesService: { getScriptProperties: () => ({ getProperty: k => k === 'ADMIN_RELAY_SECRET' ? env.ADMIN_RELAY_SECRET : 'fake-id' }) }, SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => [['記録日時UTC', '処理状態', '受付番号', '認証管理JSON', '操作JSON'], row()] }) }) }) } });
  vm.runInContext(bundle.outputFiles[0].text, context);
  assert.equal(context.Admin.handleAdmin({ action: 'entries', secret: 'wrong' }).code, 'DENIED');
  assert.equal(context.Admin.handleAdmin({ action: 'entries', secret: env.ADMIN_RELAY_SECRET }).entries.length, 1);
});
