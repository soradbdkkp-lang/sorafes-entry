import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../apps-script/generated/Code.gs', import.meta.url), 'utf8');
function fixture() {
  const p = { name: '=架空プレイヤー', xId: ' @fictional ', platform: 'Steam', otherPlatform: '対象外', gameId: ' Fiction#0000 ', hours: '12.5', killer: false, duty: '', killers: [], favorite: '', dif: 'no', dck: 'no', other: 'no', difDetails: { name: '', appearances: '', wins: '', runnersUp: '' }, dckDetails: { name: '', appearances: '', wins: '', runnersUp: '' }, histories: [{ name: '対象外', appearances: '1', wins: '0', runnersUp: '0' }] };
  return { version: 1, testOnly: true, testKey: 'fixture-key', tournamentId: 'frog-assemble-2026-test', requestId: '00000000-0000-4000-8000-000000000001', draft: { kind: 'solo', count: 1, teamName: '', representative: 0, time: '16:00開始でも参加可能', players: [p] } };
}
function harness() {
  const rows = []; let exists = false; let releases = 0; let writeFailure = false; let flushFailure = false; let busy = false; let closed = false; let deniedAccess = false;
  const range = (r, c, nr, nc) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')),
    setValues: values => { if (writeFailure) throw Error('write'); values.forEach((row, i) => { rows[r - 1 + i] = [...row]; }); },
  });
  const sheet = { getRange: range, getLastRow: () => rows.length, setFrozenRows: () => {} };
  const ctx = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => ({ TEST_ENABLED: closed ? 'false' : 'true', TEST_KEY: 'fixture-key' })[key] }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !busy, releaseLock: () => { releases++; } }) },
    SpreadsheetApp: { openById: () => { if (deniedAccess) throw Error('access'); return { getSheetByName: () => exists ? sheet : null, insertSheet: name => { assert.equal(name, 'sorafes-entry_TEST_v1'); exists = true; return sheet; } }; }, flush: () => { if (flushFailure) throw Error('flush'); } },
    Utilities: { getUuid: () => 'fixture-saved-id' },
  });
  vm.runInContext(code, ctx);
  return { save: request => JSON.parse(JSON.stringify(ctx.SorafesTest.saveTestEntry(request))), rows, releases: () => releases, failWrite: () => { writeFailure = true; }, failFlush: () => { flushFailure = true; }, busy: () => { busy = true; }, close: () => { closed = true; }, denyAccess: () => { deniedAccess = true; } };
}
test('サーバーは原本を1行保存し、対象外情報と認証キーを除外する', () => {
  const h = harness(); assert.equal(h.save(fixture()).ok, true); assert.equal(h.rows.length, 2);
  const json = h.rows[1][6]; assert.equal(json[0], '{'); assert.ok(!json.includes('fixture-key')); assert.ok(!json.includes('対象外'));
  assert.equal(JSON.parse(json).players[0].xId, 'fictional'); assert.equal(JSON.parse(json).players[0].name, '=架空プレイヤー'); assert.equal(h.releases(), 1);
});
test('同一再送は同じ保存ID、異なる内容の同一IDは拒否する', () => {
  const h = harness(); const req = fixture(); const first = h.save(req); assert.deepEqual(h.save(req), first); assert.equal(h.rows.length, 2);
  req.draft.players[0].name = '変更'; assert.equal(h.save(req).code, 'CONFLICT'); assert.equal(h.rows.length, 2);
});
test('改ざんした人数・選択肢・型・必須条件・大会ID・認証を拒否する', () => {
  const changes = [r => r.draft.count = 0, r => r.draft.representative = 0.5, r => r.draft.players[0].dif = 'forged', r => r.draft.players[0].duty = 'forged', r => r.draft.players[0].killers = ['forged'], r => r.draft.players[0].name = '', r => r.draft.players = [], r => r.tournamentId = 'production', r => r.testOnly = false, r => r.testKey = 'bad'];
  for (const change of changes) { const h = harness(); const req = fixture(); change(req); assert.equal(h.save(req).ok, false); assert.equal(h.rows.length, 0); }
});
test('書き込み例外でも成功せず排他を解除する', () => {
  const h = harness(); h.failWrite(); assert.equal(h.save(fixture()).code, 'UNKNOWN'); assert.equal(h.releases(), 1);
});
test('保存後に応答確定で失敗しても再送は多重保存しない', () => {
  const h = harness(); h.failFlush(); assert.equal(h.save(fixture()).code, 'UNKNOWN'); assert.equal(h.rows.length, 2);
  assert.equal(h.save(fixture()).ok, true); assert.equal(h.rows.length, 2);
});
test('排他取得失敗時は保存しない', () => {
  const h = harness(); h.busy(); assert.equal(h.save(fixture()).code, 'BUSY'); assert.equal(h.rows.length, 0);
});
test('受付停止時は既存データを保持して保存を拒否する', () => {
  const h = harness(); h.save(fixture()); const before = JSON.stringify(h.rows); h.close();
  assert.equal(h.save(fixture()).code, 'CLOSED'); assert.equal(JSON.stringify(h.rows), before);
});
test('保存先の権限拒否を成功扱いせず排他を解除する', () => {
  const h = harness(); h.denyAccess(); assert.equal(h.save(fixture()).code, 'UNKNOWN');
  assert.equal(h.rows.length, 0); assert.equal(h.releases(), 1);
});
test('列構成の不一致時は既存データを上書きしない', () => {
  const h = harness(); h.save(fixture()); h.rows[0][0] = '別の列名'; const before = JSON.stringify(h.rows);
  assert.equal(h.save(fixture()).code, 'SCHEMA'); assert.equal(JSON.stringify(h.rows), before);
});
