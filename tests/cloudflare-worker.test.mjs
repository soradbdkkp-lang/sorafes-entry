import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../worker/index.mjs';

const endpoint = 'https://script.google.com/macros/s/AKfycb-fictional-test-endpoint/exec';
const baseEnv = { SORAFES_PRODUCTION_APPS_SCRIPT_URL: endpoint, ASSETS: { fetch: async request => new Response(`asset:${new URL(request.url).pathname}`) } };
const requestId = '00000000-0000-4000-8000-000000000001';
const apiRequest = (body, init = {}) => new Request('https://entry.example.test/api/entry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://entry.example.test', ...init.headers },
  body: JSON.stringify(body),
  ...init,
});

test('Workerは本番契約をサーバー側で付与し、一致する確定応答だけを返す', async () => {
  let calledUrl, sent;
  const upstream = async (url, init) => {
    calledUrl = url;
    sent = JSON.parse(init.body);
    return Response.json({ ok: true, receipt: 'FAC-2026-000001', version: 1, requestId, status: 'committed' });
  };
  const response = await handleRequest(apiRequest({ action: 'create', requestId, editCode: 'fictional', draft: {} }), baseEnv, upstream);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, receipt: 'FAC-2026-000001', version: 1, requestId, status: 'committed' });
  assert.equal(calledUrl, endpoint);
  assert.equal(sent.mode, 'production');
  assert.equal(sent.tournamentId, 'frog-assemble-2026');
  assert.equal(sent.testOnly, undefined);
});

test('Workerは受付停止・重複・認証失敗を変更せず返す', async () => {
  for (const code of ['CLOSED', 'DUPLICATE', 'POSSIBLE_DUPLICATE', 'DENIED', 'CONFLICT', 'BUSY', 'PENDING']) {
    const response = await handleRequest(apiRequest({ action: 'settings' }), baseEnv, async () => Response.json({ ok: false, code }));
    assert.deepEqual(await response.json(), { ok: false, code });
  }
});

test('Workerは不正応答・HTTP失敗・通信失敗を結果不明にする', async () => {
  const fakes = [
    async () => new Response('', { status: 503 }),
    async () => new Response('<html>error</html>'),
    async () => Response.json({ ok: true, receipt: 'WRONG-000001', version: 1, requestId, status: 'committed' }),
    async () => Response.json({ ok: true, receipt: 'FAC-2026-000001', version: 1, requestId: 'different', status: 'committed' }),
    async () => { throw Error('network'); },
  ];
  for (const fake of fakes) {
    const response = await handleRequest(apiRequest({ action: 'create', requestId }), baseEnv, fake);
    assert.deepEqual(await response.json(), { ok: false, code: 'UNKNOWN' });
  }
});

test('WorkerはSecret未設定、別オリジン、禁止フィールド、容量超過を拒否する', async () => {
  let response = await handleRequest(apiRequest({ action: 'settings' }), { ...baseEnv, SORAFES_PRODUCTION_APPS_SCRIPT_URL: undefined }, async () => { throw Error('must not call'); });
  assert.deepEqual(await response.json(), { ok: false, code: 'CONFIG' });

  response = await handleRequest(apiRequest({ action: 'settings' }, { headers: { Origin: 'https://attacker.example' } }), baseEnv, async () => { throw Error('must not call'); });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, code: 'DENIED' });

  for (const body of [{ action: 'settings', testOnly: true }, { action: 'settings', fault: 'commit' }, { action: 'settings', mode: 'production' }]) {
    response = await handleRequest(apiRequest(body), baseEnv, async () => { throw Error('must not call'); });
    assert.deepEqual(await response.json(), { ok: false, code: 'INVALID' });
  }

  response = await handleRequest(apiRequest({ action: 'create', value: 'あ'.repeat(9000) }), baseEnv, async () => { throw Error('must not call'); });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { ok: false, code: 'INVALID' });
});

test('Workerの応答と静的配信にApps Script URLを露出しない', async () => {
  const response = await handleRequest(apiRequest({ action: 'settings' }), baseEnv, async () => new Response(endpoint));
  assert.equal((await response.text()).includes(endpoint), false);
  const asset = await handleRequest(new Request('https://entry.example.test/assets/app.js'), baseEnv, async () => { throw Error('unused'); });
  assert.equal(await asset.text(), 'asset:/assets/app.js');
});
