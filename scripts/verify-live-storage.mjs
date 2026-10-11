// 明示実行専用。架空データを指定済みの試験タブへ追記する。npm testでは実行しない。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const endpoint = 'http://127.0.0.1:5173/api/test-entry';
const history = () => ({ name: '', appearances: '', wins: '', runnersUp: '' });
function player(i, label) {
  return { name: `架空_${label}_${i + 1}`, xId: ` @fiction_${label}_${i + 1} `,
    platform: ['Steam', 'PlayStation', 'Nintendo Switch', 'その他'][i % 4], otherPlatform: i % 4 === 3 ? '架空の試験環境' : '対象外環境',
    gameId: ` Fiction${label}${i + 1}#0000 `, hours: i ? '12.5' : '0', killer: false, duty: '', killers: [], favorite: '',
    dif: 'no', dck: 'no', other: 'no', difDetails: history(), dckDetails: history(), histories: [{ name: '対象外大会', appearances: '1', wins: '0', runnersUp: '0' }] };
}
function fixture(kind, count) {
  const label = `${kind}${count}`;
  const players = Array.from({ length: count }, (_, i) => player(i, label));
  if (kind === 'killer' || kind === 'team') players.forEach((p, i) => Object.assign(p, { killer: true, duty: i ? 'both' : 'dedicated', killers: ['sample-b', 'sample-a'], favorite: 'sample-b' }));
  if (kind === 'survivors') players.forEach(p => Object.assign(p, { killer: true, duty: 'both', killers: ['sample-a'], favorite: 'sample-a' }));
  if (kind === 'duo') Object.assign(players[1], {
    dif: 'yes', difDetails: { name: '', appearances: '3', wins: '2', runnersUp: '2' },
    dck: 'yes', dckDetails: { name: '', appearances: 'unknown', wins: '0', runnersUp: 'unknown' },
    other: 'yes', histories: [{ name: '架空大会A', appearances: '1', wins: '0', runnersUp: '0' }, { name: '架空大会B', appearances: 'unknown', wins: 'unknown', runnersUp: 'unknown' }],
  });
  return { version: 1, testOnly: true, tournamentId: 'frog-assemble-2026-test', requestId: randomUUID(),
    draft: { kind, count, teamName: kind === 'team' ? `架空チーム${count}` : '対象外チーム', representative: count - 1, players,
      time: ['16:00開始でも参加可能', '18:00以降の開始を希望', 'どちらでも問題ない'][count % 3] } };
}
async function send(request) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(35000) });
  assert.equal(response.status, 200);
  return response.json();
}
function expectedDraft(request) {
  const draft = structuredClone(request.draft);
  if (draft.kind !== 'team') draft.teamName = '';
  for (const p of draft.players) {
    p.xId = p.xId.trim().replace(/^@/, ''); p.gameId = p.gameId.trim();
    if (p.platform !== 'その他') p.otherPlatform = '';
    if (draft.kind === 'survivors') Object.assign(p, { killer: false, duty: '', killers: [], favorite: '' });
    p.killers.sort();
    if (p.other === 'no') p.histories = [];
  }
  return draft;
}
const report = { date: '2026-10-07', mode: 'fictional-only', saved: [], rejected: [] };
for (const [kind, count] of [['killer', 1], ['solo', 1], ['duo', 2], ['survivors', 4], ['team', 4], ['team', 5], ['team', 6]]) {
  const request = fixture(kind, count);
  const first = await send(request);
  assert.equal(first.ok, true, `${kind}${count}: ${first.code}`);
  assert.equal(first.requestId, request.requestId);
  assert.match(first.savedId, /^TEST-/);
  const repeat = await send(request);
  assert.deepEqual(repeat, first);
  report.saved.push({ kind, count, requestId: request.requestId, savedId: first.savedId, expectedDraft: expectedDraft(request) });
  await writeFile('docs/phase3-live-results.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`${kind} / ${count}名: 保存と同一再送が成功`);
}
for (const [label, mutate] of [
  ['形式と人数の不一致', r => r.draft.count = 2],
  ['代表者が範囲外', r => r.draft.representative = 1],
  ['実績の優勝回数超過', r => { r.draft.players[0].dif = 'yes'; r.draft.players[0].difDetails = { name: '', appearances: '1', wins: '2', runnersUp: '0' }; }],
  ['キラー専任回答なし', r => { r.draft.kind = 'killer'; }],
  ['必須IDなし', r => r.draft.players[0].xId = ' @ '],
  ['本番モード指定', r => r.testOnly = false],
]) {
  const request = fixture('solo', 1); mutate(request);
  const response = await send(request);
  assert.equal(response.ok, false); assert.equal(response.code, 'INVALID');
  report.rejected.push(label); console.log(`${label}: 保存拒否を確認`);
}
await writeFile('docs/phase3-live-results.json', JSON.stringify(report, null, 2) + '\n');
console.log('架空データ7件の保存と再送、6件の不正入力拒否を確認。シート照合は別途行います。');
