import test from 'node:test';
import assert from 'node:assert/strict';
import { sendTestEntry } from '../src/storage/client.ts';
const request = { requestId: 'fixture-request' };
async function withFetch(fake, action) {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try { await action(); } finally { globalThis.fetch = original; }
}
test('通信切断・HTTP失敗・非JSON応答は成功と扱わない', async () => {
  for (const fake of [async () => { throw new TypeError('network'); }, async () => new Response('', { status: 503 }), async () => new Response('<html>login</html>')]) {
    await withFetch(fake, async () => assert.rejects(sendTestEntry(request)));
  }
});
test('別リクエストや保存ID欠損の成功応答は拒否する', async () => {
  for (const value of [{ ok: true, requestId: 'another', savedId: 'TEST-1' }, { ok: true, requestId: request.requestId }, { ok: true, requestId: request.requestId, savedId: 'AS-1' }, { ok: 'true', requestId: request.requestId, savedId: 'TEST-1' }]) {
    await withFetch(async () => Response.json(value), async () => assert.rejects(sendTestEntry(request)));
  }
});
test('閉鎖・拒否・結果不明の応答は失敗として画面へ返す', async () => {
  for (const code of ['CLOSED', 'DENIED', 'UNKNOWN']) {
    await withFetch(async () => Response.json({ ok: false, code }), async () => assert.deepEqual(await sendTestEntry(request), { ok: false, code }));
  }
});
test('一致する確定応答だけが保存成功になる', async () => {
  const value = { ok: true, requestId: request.requestId, savedId: 'TEST-fixture' };
  await withFetch(async () => Response.json(value), async () => assert.deepEqual(await sendTestEntry(request), value));
});
