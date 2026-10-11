import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { createPhase4Store } from '../scripts/phase4-store.mjs';

const bundled = await build({ entryPoints: ['src/storage/contract.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { makeRequest } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const blankHistory = () => ({ name: '', appearances: '', wins: '', runnersUp: '' });
function draft(kind = 'solo', count = ({ killer: 1, solo: 1, duo: 2, survivors: 4, team: 4 })[kind]) {
  return { kind, count, teamName: kind === 'team' ? '架空チーム' : '', representative: count - 1, time: '16:00開始でも参加可能',
    players: Array.from({ length: count }, (_, i) => ({ name: `架空${i}`, xId: ` @fictional_${i} `, platform: 'Steam', otherPlatform: '', gameId: ` Fiction${i}#0000 `, hours: '12.5', killer: kind === 'killer' || kind === 'team', duty: kind === 'killer' || kind === 'team' ? 'both' : '', killers: kind === 'killer' || kind === 'team' ? ['trapper'] : [], favorite: kind === 'killer' || kind === 'team' ? 'trapper' : '', dif: 'no', dck: 'no', other: 'no', difDetails: blankHistory(), dckDetails: blankHistory(), histories: [] })) };
}
const fixture = (options = {}) => createPhase4Store({ prepare: (d, id) => makeRequest(d, id).draft, ...options });
const request = (d = draft()) => ({ action: 'create', testOnly: true, requestId: randomUUID(), editCode: randomBytes(16).toString('hex'), draft: d });
const update = (created, original, d = draft()) => ({ ...original, action: 'update', receipt: created.receipt, expectedVersion: created.version, requestId: randomUUID(), draft: d });

test('全5形式とチーム4/5/6名を保存・認証読込・形式変更し、原本を履歴へ保持する', async () => {
  for (const [kind, count] of [['killer', 1], ['solo', 1], ['duo', 2], ['survivors', 4], ['team', 4], ['team', 5], ['team', 6]]) {
    const store = fixture(), req = request(draft(kind, count)), saved = await store.handle(req);
    assert.equal(saved.ok, true);
    const read = await store.handle({ action: 'read', testOnly: true, receipt: saved.receipt, editCode: req.editCode });
    assert.deepEqual(read.draft, makeRequest(req.draft, req.requestId).draft);
    const edited = await store.handle(update(saved, req, draft('duo', 2)));
    assert.equal(edited.version, 2); assert.equal(edited.receipt, saved.receipt);
    const data = store.inspect(); assert.equal(data.history.length, 2); assert.equal(data.history[0].draft.kind, kind);
    assert.equal(data.shared.length, 1); assert.equal(data.shared[0].draft.kind, 'duo');
  }
});
test('同一送信の再送と認証済み再確認は同じ結果で、IDだけや誤コードでは開示しない', async () => {
  const store = fixture(), req = request(), saved = await store.handle(req);
  assert.deepEqual(await store.handle(req), saved);
  assert.deepEqual(await store.handle({ action: 'recover', testOnly: true, requestId: req.requestId, editCode: req.editCode }), saved);
  assert.deepEqual(await store.handle({ action: 'recover', testOnly: true, requestId: req.requestId }), { ok: false, code: 'DENIED' });
  for (const receipt of [saved.receipt, 'LOCAL-NOT-FOUND']) assert.deepEqual(await store.handle({ action: 'read', testOnly: true, receipt, editCode: randomBytes(16).toString('hex') }), { ok: false, code: 'DENIED' });
  const altered = structuredClone(req); altered.draft.players[0].name = '架空変更';
  assert.equal((await store.handle(altered)).code, 'CONFLICT'); assert.equal(store.inspect().history.length, 1);
});
test('古い版と同時更新を拒否し、更新再送は版競合より先に同じ結果を返す', async () => {
  const store = fixture(), req = request(), saved = await store.handle(req), a = update(saved, req), b = update(saved, req);
  a.draft.players[0].name = '架空A'; b.draft.players[0].name = '架空B';
  const results = await Promise.all([store.handle(a), store.handle(b)]);
  assert.equal(results[0].version, 2); assert.equal(results[1].code, 'CONFLICT');
  assert.deepEqual(await store.handle(a), results[0]); assert.equal(store.inspect().history.length, 2);
});
test('各保存段階の失敗から再送・再読み込み後の認証再確認で回復し二重履歴を防ぐ', async () => {
  for (const fault of ['auth', 'history', 'shared', 'commit']) {
    const store = fixture(), req = request();
    assert.equal((await store.handle({ ...req, fault })).code, 'UNKNOWN');
    const done = await store.handle(req); assert.equal(done.ok, true); assert.equal(store.inspect().history.length, 1);
    const edit = update(done, req);
    assert.equal((await store.handle({ ...edit, fault })).code, 'UNKNOWN');
    const recovered = fault === 'auth' ? await store.handle(edit) : await store.handle({ action: 'recover', testOnly: true, requestId: edit.requestId, editCode: edit.editCode });
    assert.equal(recovered.version, 2); assert.equal(store.inspect().history.length, 2);
    assert.deepEqual(await store.handle(edit), recovered);
  }
});
test('途中更新中は旧確定版だけを読み込み、別更新は拒否する', async () => {
  const store = fixture(), req = request(), saved = await store.handle(req), edit = update(saved, req);
  edit.draft.players[0].name = '架空変更';
  await store.handle({ ...edit, fault: 'commit' });
  const read = await store.handle({ action: 'read', testOnly: true, receipt: saved.receipt, editCode: req.editCode });
  assert.equal(read.version, 1); assert.equal(read.draft.players[0].name, '架空0');
  assert.equal((await store.handle(update(saved, req))).code, 'PENDING');
});
test('締切境界・未設定を閉じ、確定済み再送と締切前に準備した処理の回復は許可する', async () => {
  let clock = 100;
  const store = fixture({ now: () => clock, deadline: 200 }), req = request();
  await store.handle({ ...req, fault: 'history' }); clock = 200;
  assert.equal((await store.handle(request())).code, 'CLOSED');
  const saved = await store.handle(req); assert.equal(saved.ok, true);
  assert.deepEqual(await store.handle(req), saved);
  assert.equal((await store.handle(update(saved, req))).code, 'CLOSED');
  assert.equal((await fixture({ deadline: NaN }).handle(request())).code, 'CLOSED');
});
test('保存側の全体検証で不正人数・キラー未選択を拒否し、対象外データを落とす', async () => {
  const store = fixture(), invalid = request(draft('team', 4)); invalid.draft.players.forEach(p => { p.killer = false; });
  assert.equal((await store.handle(invalid)).code, 'INVALID');
  const bad = request(); bad.draft.count = 2; assert.equal((await store.handle(bad)).code, 'INVALID');
  const req = request(); req.draft.players[0].otherPlatform = '対象外'; req.draft.players[0].histories = [{ name: '対象外', appearances: '1', wins: '0', runnersUp: '0' }];
  await store.handle(req); assert.equal(store.inspect().shared[0].draft.players[0].otherPlatform, ''); assert.deepEqual(store.inspect().shared[0].draft.players[0].histories, []);
});
test('コード原文と検証値は履歴・共有領域・応答に混入しない', async () => {
  const store = fixture(), req = request(), saved = await store.handle(req), data = store.inspect();
  const visible = JSON.stringify([data.history, data.shared, saved]);
  assert.equal(visible.includes(req.editCode), false); assert.equal(visible.includes(data.auth[0].verifier), false);
  assert.equal(JSON.stringify(data).includes(req.editCode), false);
});
test('仮の短時間試行制限は時間経過で解除し、恒久ロックにしない', async () => {
  let clock = 0; const store = fixture({ now: () => clock, deadline: 1e9 }), req = request(), saved = await store.handle(req);
  for (let i = 0; i < 5; i++) await store.handle({ action: 'read', testOnly: true, receipt: saved.receipt, editCode: randomBytes(16).toString('hex') });
  assert.equal((await store.handle({ action: 'read', testOnly: true, receipt: saved.receipt, editCode: req.editCode })).code, 'DENIED');
  clock = 60001; assert.equal((await store.handle({ action: 'read', testOnly: true, receipt: saved.receipt, editCode: req.editCode })).ok, true);
});
