import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, reviewData } from '../src/validation.ts';
import { newPlayer } from '../src/model.ts';
import { tournament } from '../src/config/tournament.ts';
import { killerCatalog } from '../src/config/killers.ts';

function validPlayer() {
  return { ...newPlayer(), name: '架空プレイヤー', xId: ' @sample_player ', platform: 'Steam', gameId: ' Sample#1234 ', hours: '0', dif: 'no', dck: 'no', other: 'no' };
}
function draft(players = [validPlayer()]) {
  return { kind: 'solo', count: players.length, teamName: '', representative: 0, players, time: tournament.availability[0] };
}

test('大会指定キラーは43体で、除外対象や試験用サンプルを含まない', () => {
  assert.equal(killerCatalog.provisional, false);
  assert.equal(killerCatalog.items.length, 43);
  assert.equal(new Set(killerCatalog.items.map(k => k.id)).size, 43);
  assert.equal(new Set(killerCatalog.items.map(k => k.name)).size, 43);
  assert.ok(killerCatalog.items.some(k => k.name === 'ジャッジメント'));
  assert.ok(!killerCatalog.items.some(k => k.name === 'スカルマーチャント' || k.id.startsWith('sample-')));
});
test('0時間は有効、負数・未入力・非数は拒否し、IDは前後を確認する', () => {
  assert.deepEqual(validate(draft(), tournament), []);
  for (const hours of ['', '-1', 'NaN']) assert.ok(validate(draft([{ ...validPlayer(), hours }]), tournament).some(e => e.step === 3));
  for (const gameId of ['name', '#1234', 'name#']) assert.ok(validate(draft([{ ...validPlayer(), gameId }]), tournament).some(e => e.message.includes('ゲーム内ID')));
  assert.equal(validate(draft([{ ...validPlayer(), hours: '12.5' }]), tournament).length, 0);
});
test('不明と0を区別し、各回数だけを比較する', () => {
  const p = { ...validPlayer(), dif: 'yes', difDetails: { name: '', appearances: '3', wins: '2', runnersUp: '2' } };
  assert.equal(validate(draft([p]), tournament).length, 0);
  p.difDetails.wins = '4'; assert.ok(validate(draft([p]), tournament).some(e => e.message.includes('超え')));
  p.difDetails.appearances = 'unknown'; assert.equal(validate(draft([p]), tournament).length, 0);
  p.difDetails.appearances = '0'; assert.ok(validate(draft([p]), tournament).some(e => e.message.includes('1以上')));
  p.difDetails.appearances = ''; assert.ok(validate(draft([p]), tournament).some(e => e.step === 5));
});
test('確認データは対象外メンバー・環境・キラー・実績を除外し、元入力を保持する', () => {
  const p = { ...validPlayer(), otherPlatform: '対象外の環境', killer: true, duty: 'both', killers: ['trapper'], favorite: 'trapper', histories: [{ name: '対象外大会', appearances: '1', wins: '0', runnersUp: '0' }] };
  const d = { ...draft([p, validPlayer()]), count: 1, kind: 'survivors' };
  const result = reviewData(d, tournament);
  assert.equal(result.players.length, 1);
  assert.equal(result.players[0].xId, 'sample_player');
  assert.equal(result.players[0].gameId, 'Sample#1234');
  assert.equal(result.players[0].otherPlatform, undefined);
  assert.equal(result.players[0].killer, undefined);
  assert.equal(result.players[0].histories.otherDetails, undefined);
  assert.equal(result.players[0].role, 'サバイバー');
  assert.equal(p.otherPlatform, '対象外の環境');
  assert.equal(p.killers.length, 1);
});
test('チームのキラー最低人数と最得意の整合', () => {
  const d = { ...draft(Array.from({ length: 4 }, validPlayer)), kind: 'team', teamName: '試験チーム' };
  assert.ok(validate(d, tournament).some(e => e.message.includes('1名以上')));
  d.players.forEach(p => Object.assign(p, { killer: true, duty: 'both', killers: ['trapper'], favorite: 'trapper' }));
  assert.deepEqual(validate(d, tournament), []);
  d.players[0].favorite = 'wraith'; assert.ok(validate(d, tournament).some(e => e.message.includes('最も得意')));
});
