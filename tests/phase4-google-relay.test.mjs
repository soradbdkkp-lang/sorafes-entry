import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { relayPhase4 } from '../scripts/phase4-google-relay.mjs';

const endpoint = 'https://script.google.com/macros/s/phase4-fictional/exec';
const oldEndpoint = 'https://script.google.com/macros/s/phase3-fictional/exec';
const key = randomBytes(24).toString('hex');
const payload = () => ({ action: 'create', testOnly: true, requestId: randomUUID() });
test('Phase4中継: 未設定・旧配備URL・故障指定は外部へ送信しない', async () => {
  let count = 0; const fetchImpl = async () => { count++; throw Error(); };
  for (const [input, options, code] of [
    [payload(), { key }, 'NOT_CONFIGURED'],
    [payload(), { endpoint: oldEndpoint, key, oldEndpoint }, 'CONFIG'],
    [{ ...payload(), fault: 'response' }, { endpoint, key }, 'INVALID'],
    [{ ...payload(), testOnly: false }, { endpoint, key }, 'INVALID'],
  ]) assert.equal((await relayPhase4(input, { ...options, fetchImpl })).code, code);
  assert.equal(count, 0);
});
test('Phase4中継: キーはサーバーで付与し、確定応答の余剰フィールドは返さない', async () => {
  const req = payload();
  const result = await relayPhase4({ ...req, testKey: 'client-value' }, { endpoint, key, oldEndpoint, fetchImpl: async (_, options) => {
    assert.equal(JSON.parse(options.body).testKey, key);
    return { ok: true, json: async () => ({ ok: true, receipt: 'P4TEST-000001', version: 1, requestId: req.requestId, status: 'committed', testKey: key }) };
  } });
  assert.equal(result.ok, true); assert.equal(JSON.stringify(result).includes(key), false);
});
test('Phase4中継: 通信失敗・不正応答・処理ID違い・未知エラーを成功にしない', async () => {
  const req = payload();
  for (const response of [
    { ok: false },
    { ok: true, json: async () => { throw Error(); } },
    { ok: true, json: async () => ({ ok: true, receipt: 'P4TEST-000001', version: 1, requestId: randomUUID(), status: 'committed' }) },
    { ok: true, json: async () => ({ ok: false, code: key }) },
  ]) assert.deepEqual(await relayPhase4(req, { endpoint, key, fetchImpl: async () => response }), { ok: false, code: 'UNKNOWN' });
});
