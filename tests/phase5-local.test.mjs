import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { createPhase4Store } from '../scripts/phase4-store.mjs';

async function load(entry) {
  const bundled = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
}
const { makeRequest } = await load('src/storage/contract.ts');
const duplicate = await load('src/phase5-duplicates.ts');
const history = () => ({ name: '', appearances: '', wins: '', runnersUp: '' });
function player(n) {
  return { name: `架空${n}`, xId: `user_${n}`, platform: 'Steam', otherPlatform: '', gameId: `Player${n}#0000`, hours: '10', killer: false, duty: '', killers: [], favorite: '', dif: 'no', dck: 'no', other: 'no', difDetails: history(), dckDetails: history(), histories: [] };
}
function draft(count = 1, offset = 0) {
  return { kind: count === 1 ? 'solo' : 'duo', count, teamName: '', representative: 0, time: '16:00開始でも参加可能', players: Array.from({ length: count }, (_, i) => player(offset + i)) };
}
const request = value => ({ action: 'create', testOnly: true, requestId: randomUUID(), editCode: randomBytes(16).toString('hex'), draft: value });
const store = () => createPhase4Store({ prepare: (value, id) => makeRequest(value, id).draft, duplicate: { within: duplicate.duplicatesWithin, strength: duplicate.duplicateStrengthBetween } });

test('比較用のX IDは@と英字大小をそろえ、ゲーム内IDの#以降と大小は保つ', () => {
  assert.equal(duplicate.duplicateXKey('  @AbC_1 '), 'abc_1');
  assert.equal(duplicate.duplicateGameKey(' Name#AbC '), 'Name#AbC');
  const a = draft(1), b = draft(1, 4);
  b.players[0].xId = ' @USER_0 ';
  assert.equal(duplicate.duplicatesBetween(a, b), true);
  assert.equal(duplicate.duplicateStrengthBetween(a, b), 1);
  b.players[0].xId = 'other'; b.players[0].gameId = 'Player0#0000';
  assert.equal(duplicate.duplicatesBetween(a, b), true);
  assert.equal(duplicate.duplicateStrengthBetween(a, b), 1);
  b.players[0].gameId = 'player0#0000';
  assert.equal(duplicate.duplicatesBetween(a, b), false);
  b.players[0].xId = '@USER_0'; b.players[0].gameId = ' Player0#0000 ';
  assert.equal(duplicate.duplicateStrengthBetween(a, b), 2);
});

test('フォーム内では有効人数だけを照合し、片方のIDだけでも候補にする', () => {
  const value = draft(2); value.players[1].xId = ' @USER_0 ';
  assert.deepEqual(duplicate.duplicatesWithin(value), [{ first: 0, second: 1, xId: true, gameId: false }]);
  value.players[1].xId = 'different'; value.players[1].gameId = ' Player0#0000 ';
  assert.deepEqual(duplicate.duplicatesWithin(value), [{ first: 0, second: 1, xId: false, gameId: true }]);
  value.count = 1;
  assert.deepEqual(duplicate.duplicatesWithin(value), []);
});

test('同じ大会の別応募との一方のID一致を保留し、認証済み自己編集を除外する', async () => {
  const saved = store(), first = request(draft()), created = await saved.handle(first);
  assert.equal(created.ok, true);
  const sameX = request(draft(1, 2)); sameX.draft.players[0].xId = ' @USER_0 ';
  assert.deepEqual(await saved.handle(sameX), { ok: false, code: 'POSSIBLE_DUPLICATE' });
  const sameGame = request(draft(1, 3)); sameGame.draft.players[0].gameId = ' Player0#0000 ';
  assert.deepEqual(await saved.handle(sameGame), { ok: false, code: 'POSSIBLE_DUPLICATE' });
  const both = request(draft());
  assert.deepEqual(await saved.handle(both), { ok: false, code: 'DUPLICATE' });
  assert.equal(saved.inspect().auth.length, 1);
  const edit = { ...first, action: 'update', receipt: created.receipt, expectedVersion: 1, requestId: randomUUID() };
  assert.equal((await saved.handle(edit)).version, 2);
  const changed = { ...edit, requestId: randomUUID(), expectedVersion: 2, draft: draft(1, 8) };
  assert.equal((await saved.handle(changed)).version, 3);
  assert.equal((await saved.handle(request(draft()))).ok, true);
});

test('処理途中の一致は復旧まで保留し、確定後は重複として扱う', async () => {
  const saved = store(), first = request(draft());
  assert.equal((await saved.handle({ ...first, fault: 'history' })).code, 'UNKNOWN');
  const second = request(draft(1, 7)); second.draft.players[0].xId = 'USER_0';
  assert.deepEqual(await saved.handle(second), { ok: false, code: 'PENDING' });
  assert.equal((await saved.handle(first)).ok, true);
  assert.deepEqual(await saved.handle(second), { ok: false, code: 'POSSIBLE_DUPLICATE' });
  assert.equal(saved.inspect().history.length, 1);
});

test('同時に同じIDを保存しても一方だけが確定し、再送は同じ結果を返す', async () => {
  const saved = store(), first = request(draft()), second = request(draft(1, 9));
  second.draft.players[0].gameId = 'Player0#0000';
  const results = await Promise.all([saved.handle(first), saved.handle(second)]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => result.code === 'POSSIBLE_DUPLICATE').length, 1);
  const winner = results[0].ok ? first : second;
  assert.deepEqual(await saved.handle(winner), results.find(result => result.ok));
  assert.equal(saved.inspect().history.length, 1);
});

test('全5応募形式とチーム4～6名で、最後の有効メンバーも既存応募と照合する', async () => {
  for (const [kind, count] of [['killer', 1], ['solo', 1], ['duo', 2], ['survivors', 4], ['team', 4], ['team', 5], ['team', 6]]) {
    const saved = store(), first = request(draft(count, 20));
    first.draft.kind = kind;
    first.draft.teamName = kind === 'team' ? '架空検証チーム' : '';
    if (kind === 'killer' || kind === 'team') {
      const killer = first.draft.players[0];
      Object.assign(killer, { killer: true, duty: 'both', killers: ['trapper'], favorite: 'trapper' });
    }
    assert.equal((await saved.handle(first)).ok, true, `${kind}/${count} initial save`);
    const last = first.draft.players[count - 1];
    const second = request(draft(1, 100));
    second.draft.players[0].xId = `@${last.xId.toUpperCase()}`;
    assert.deepEqual(await saved.handle(second), { ok: false, code: 'POSSIBLE_DUPLICATE' }, `${kind}/${count} X`);
    second.draft.players[0].xId = 'new_candidate';
    second.draft.players[0].gameId = last.gameId;
    assert.deepEqual(await saved.handle(second), { ok: false, code: 'POSSIBLE_DUPLICATE' }, `${kind}/${count} game ID`);
    assert.equal(saved.inspect().auth.length, 1, `${kind}/${count} must hold second save`);
  }
});
