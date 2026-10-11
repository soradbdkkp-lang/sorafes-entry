import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['apps-script/phase4-server.ts'], bundle: true, write: false, format: 'iife', globalName: 'Phase4', platform: 'browser', target: 'es2020' });
const clone = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const key = randomBytes(24).toString('hex');
  const props = new Map(Object.entries({ PHASE4_ENABLED: 'true', PHASE4_TEST_KEY: key, PHASE4_AUTH_ID: 'private-auth', PHASE4_HISTORY_ID: 'private-history', PHASE4_DEADLINE_UTC: '2099-01-01T00:00:00Z' }));
  const headers = [
    ['記録日時UTC', '処理状態', '受付番号', '認証管理JSON', '操作JSON'],
    ['受付番号', '版', '処理ID', '保存日時UTC', '応募原本JSON'],
    ['受付番号', '版', '処理ID', '処理状態', '保存日時UTC', '応募原本JSON'],
  ];
  let writes = 0, fault = null, lastWrite = 0, locked = false;
  const sheets = headers.map(header => ({
    rows: [header], getLastRow() { return this.rows.length; },
    getRange(row, col, height, width) {
      const sheet = this;
      return {
        getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => sheet.rows[row - 1 + i]?.[col - 1 + j] ?? '')),
        setValues(values) {
          lastWrite = ++writes;
          if (fault?.at === writes && fault.stage === 'before') throw Error('Injected');
          values.forEach((valuesRow, i) => { sheet.rows[row - 1 + i] = clone(valuesRow); });
          if (fault?.at === writes && fault.stage === 'after') throw Error('Injected');
        },
      };
    },
  }));
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    SpreadsheetApp: {
      openById: id => ({ getSheetByName: name => {
        const index = id === 'private-auth' ? 0 : id === 'private-history' ? 1 : 2;
        return name === ['認証管理', '応募履歴', 'sorafes-entry_PHASE4_TEST_v1'][index] ? sheets[index] : null;
      } }),
      flush: () => { if (fault?.at === lastWrite && fault.stage === 'flush') throw Error('Injected'); },
    },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_, value) => [...createHash('sha256').update(value).digest()].map(b => b > 127 ? b - 256 : b) },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => {} }) },
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  return {
    handle: request => clone(context.Phase4.handlePhase4({ testOnly: true, testKey: key, ...request })),
    sheets, props, key,
    fail: (at, stage) => { writes = 0; lastWrite = 0; fault = at ? { at, stage } : null; },
    lock: value => { locked = value; },
  };
}
function request(kind = 'solo', count = ({ killer: 1, solo: 1, duo: 2, survivors: 4, team: 4 })[kind]) {
  const history = () => ({ name: '', appearances: '', wins: '', runnersUp: '' });
  return { action: 'create', requestId: randomUUID(), editCode: randomBytes(16).toString('hex'), draft: {
    kind, count, teamName: kind === 'team' ? '架空試験チーム' : '', representative: 0, time: '16:00開始でも参加可能',
    players: Array.from({ length: count }, (_, i) => ({ name: `架空${i}`, xId: `fiction_${i}`, platform: 'Steam', otherPlatform: '', gameId: `Fiction${i}#0000`, hours: '12.5', killer: ['team', 'killer'].includes(kind), duty: ['team', 'killer'].includes(kind) ? 'both' : '', killers: ['team', 'killer'].includes(kind) ? ['trapper'] : [], favorite: ['team', 'killer'].includes(kind) ? 'trapper' : '', dif: 'no', dck: 'no', other: 'no', difDetails: history(), dckDetails: history(), histories: [] })),
  } };
}
const edit = (req, saved) => ({ ...clone(req), action: 'update', requestId: randomUUID(), receipt: saved.receipt, expectedVersion: saved.version });
test('Googleアダプター: 7人数形式、読込、編集、再送と古い操作の回復で最新版を保持', () => {
  for (const [kind, count] of [['killer', 1], ['solo', 1], ['duo', 2], ['survivors', 4], ['team', 4], ['team', 5], ['team', 6]]) {
    const f = fixture(), req = request(kind, count), saved = f.handle(req);
    assert.equal(saved.ok, true);
    assert.deepEqual(f.handle(req), saved);
    const update = edit(req, saved); update.draft.players[0].name = '架空更新';
    assert.equal(f.handle(update).version, 2);
    assert.equal(f.handle(edit(req, saved)).code, 'CONFLICT');
    assert.deepEqual(f.handle({ action: 'recover', requestId: req.requestId, editCode: req.editCode }), saved);
    assert.equal(f.sheets[2].rows[1][1], 2);
    const read = f.handle({ action: 'read', receipt: saved.receipt, editCode: req.editCode });
    assert.equal(read.draft.players[0].name, '架空更新');
    assert.equal(f.sheets[1].rows.length, 3);
    const visible = JSON.stringify([f.sheets[1].rows, f.sheets[2].rows, read]);
    assert.equal(visible.includes(req.editCode), false);
    assert.equal(visible.includes(f.key), false);
    assert.equal(JSON.stringify(f.sheets).includes(req.editCode), false);
    const verifier = JSON.parse(f.sheets[0].rows[1][3]).verifier;
    assert.equal(visible.includes(verifier), false);
  }
});
test('Googleアダプター: 各書込の前後・flush失敗を再送で回復し、履歴を重複させない', () => {
  for (const stage of ['before', 'after', 'flush']) for (let at = 1; at <= 5; at++) {
    const f = fixture(), req = request(); f.fail(at, stage);
    assert.equal(f.handle(req).code, 'UNKNOWN', `${at}/${stage}`);
    f.fail(null);
    const saved = f.handle(req); assert.equal(saved.ok, true, `${at}/${stage}`);
    assert.equal(f.sheets[1].rows.length, 2); assert.equal(f.sheets[2].rows.length, 2);
    assert.equal(f.sheets[2].rows[1][3], 'committed');
    const update = edit(req, saved); update.draft.players[0].name = '架空回復';
    f.fail(at, stage); assert.equal(f.handle(update).code, 'UNKNOWN'); f.fail(null);
    const recovered = at === 1 && stage === 'before' ? f.handle(update) : f.handle({ action: 'recover', requestId: update.requestId, editCode: req.editCode });
    assert.equal(recovered.version, 2, `${at}/${stage}`);
    assert.equal(f.sheets[1].rows.length, 3); assert.equal(f.sheets[2].rows[1][3], 'committed');
    assert.deepEqual(f.handle(update), recovered);
  }
});
test('Googleアダプター: 停止・設定不足・誤認証・故障指定・排他・締切を保存側で拒否', () => {
  const f = fixture(), req = request();
  assert.equal(f.handle({ ...req, testKey: 'wrong' }).code, 'DENIED');
  assert.equal(f.handle({ ...req, testOnly: false }).code, 'DENIED');
  const saved = f.handle(req);
  assert.equal(f.handle({ action: 'read', receipt: saved.receipt, editCode: randomBytes(16).toString('hex') }).code, 'DENIED');
  assert.equal(f.handle({ ...request(), fault: 'commit' }).code, 'INVALID');
  f.lock(true); assert.equal(f.handle(request()).code, 'BUSY'); f.lock(false);
  f.props.set('PHASE4_DEADLINE_UTC', '2000-01-01T00:00:00Z');
  assert.equal(f.handle(request()).code, 'CLOSED'); assert.deepEqual(f.handle(req), saved);
  f.props.set('PHASE4_AUTH_ID', 'private-history'); assert.equal(f.handle(request()).code, 'CONFIG');
  f.props.set('PHASE4_ENABLED', 'false'); assert.equal(f.handle(req).code, 'CLOSED');
});
test('Googleアダプター: 途中更新中の旧版読込と別更新拒否、列不一致で既存行を保持', () => {
  const f = fixture(), req = request(), saved = f.handle(req), update = edit(req, saved);
  update.draft.players[0].name = '架空未確定'; f.fail(4, 'before');
  assert.equal(f.handle(update).code, 'UNKNOWN'); f.fail(null);
  const read = f.handle({ action: 'read', receipt: saved.receipt, editCode: req.editCode });
  assert.equal(read.version, 1); assert.equal(read.draft.players[0].name, '架空0');
  assert.equal(f.handle(edit(req, saved)).code, 'PENDING');
  assert.equal(f.handle({ action: 'recover', requestId: update.requestId, editCode: req.editCode }).version, 2);
  f.sheets[1].rows[0][0] = '不一致'; const before = clone(f.sheets[1].rows);
  assert.equal(f.handle(request()).code, 'UNKNOWN'); assert.deepEqual(f.sheets[1].rows, before);
});
