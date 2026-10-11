import test from 'node:test';
import assert from 'node:assert/strict';
import { sendAppsScriptProduction, sendProduction } from '../src/storage/production-client.ts';

const deadline = '2026-10-24T14:59:00.000Z';
const settings = { ok: true, mode: 'production', tournamentId: 'frog-assemble-2026', deadline };

function host(reply, failure = false) {
  let sent;
  const runner = {
    success: null,
    failure: null,
    withSuccessHandler(handler) { this.success = handler; return this; },
    withFailureHandler(handler) { this.failure = handler; return this; },
    handleProduction(payload) {
      sent = payload;
      queueMicrotask(() => failure ? this.failure(reply) : this.success(reply));
    },
  };
  return { value: { script: { run: runner } }, sent: () => sent };
}

test('本番サイトは同一オリジンAPIだけを呼び、Apps Script URLや本番モードをブラウザから送らない', async () => {
  let target, options;
  const fake = async (input, init) => { target = input; options = init; return Response.json(settings); };
  assert.deepEqual(await sendProduction({ action: 'settings' }, fake), settings);
  assert.equal(target, '/api/entry');
  assert.deepEqual(JSON.parse(options.body), { action: 'settings' });
  assert.equal(options.method, 'POST');
  assert.equal('mode' in JSON.parse(options.body), false);
  assert.equal('tournamentId' in JSON.parse(options.body), false);
});

test('本番サイトは一致する確定応答だけを成功として返す', async () => {
  const request = { action: 'create', requestId: '00000000-0000-4000-8000-000000000001' };
  const value = { ok: true, receipt: 'FAC-2026-000001', version: 1, requestId: request.requestId, status: 'committed' };
  assert.deepEqual(await sendProduction(request, async () => Response.json(value)), value);
  for (const invalid of [
    { ...value, receipt: 'ENTRY-000001' },
    { ...value, requestId: 'different' },
    { ...value, status: 'pending' },
    { ...value, version: 0 },
  ]) {
    await assert.rejects(sendProduction(request, async () => Response.json(invalid)));
  }
});

test('受付停止・重複・認証失敗は成功へ変換しない', async () => {
  for (const code of ['CLOSED', 'DUPLICATE', 'POSSIBLE_DUPLICATE', 'DENIED', 'CONFLICT', 'BUSY', 'UNKNOWN']) {
    assert.deepEqual(await sendProduction({ action: 'settings' }, async () => Response.json({ ok: false, code })), { ok: false, code });
  }
});

test('HTTP失敗・非JSON・未知コード・不正な成功応答を拒否する', async () => {
  await assert.rejects(sendProduction({ action: 'settings' }, async () => new Response('', { status: 503 })));
  await assert.rejects(sendProduction({ action: 'settings' }, async () => new Response('<html>error</html>')));
  await assert.rejects(sendProduction({ action: 'settings' }, async () => Response.json({ ok: false, code: 'UNEXPECTED' })));
  await assert.rejects(sendProduction({ action: 'settings' }, async () => Response.json({ ok: true })));
});

test('Apps Script検証画面は従来どおり同一プロジェクトへ本番契約を付けて送る', async () => {
  const fake = host(settings);
  assert.deepEqual(await sendAppsScriptProduction({ action: 'settings' }, fake.value), settings);
  assert.deepEqual(fake.sent(), {
    mode: 'production',
    tournamentId: 'frog-assemble-2026',
    action: 'settings',
  });
  assert.equal('testOnly' in fake.sent(), false);
});

test('Apps Script検証画面も不正応答・実行失敗・環境外を成功扱いしない', async () => {
  await assert.rejects(sendAppsScriptProduction({ action: 'settings' }, host({ status: 'ok' }).value));
  await assert.rejects(sendAppsScriptProduction({ action: 'settings' }, host(Error('failure'), true).value));
  await assert.rejects(sendAppsScriptProduction({ action: 'settings' }, {}));
});
