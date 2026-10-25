import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['apps-script/production-server.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'Production',
  platform: 'browser',
  target: 'es2020',
});
const clone = value => JSON.parse(JSON.stringify(value));
const history = () => ({ name: '', appearances: '', wins: '', runnersUp: '' });

function fixture() {
  let clock = Date.parse('2026-10-24T14:00:00.000Z');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const props = new Map(Object.entries({
    PRODUCTION_ENABLED: 'true',
    PRODUCTION_AUTH_ID: 'production-auth',
    PRODUCTION_HISTORY_ID: 'production-history',
    PRODUCTION_PUBLIC_ID: 'production-public',
    PRODUCTION_PUBLIC_SHEET: '応募一覧',
    PRODUCTION_RECEIPT_PREFIX: 'FAC-2026-',
    PRODUCTION_DEADLINE_UTC: '2026-10-24T14:59:00.000Z',
  }));
  const names = ['認証管理', '応募履歴', '応募一覧'];
  const headers = [
    ['記録日時UTC', '処理状態', '受付番号', '認証管理JSON', '操作JSON'],
    ['受付番号', '版', '処理ID', '保存日時UTC', '応募原本JSON'],
    ['受付番号', '版', '処理ID', '処理状態', '保存日時UTC', '応募原本JSON'],
  ];
  let writes = 0, lastWrite = 0, fault = null, locked = false;
  const sheets = headers.map(header => ({
    rows: [header],
    getLastRow() { return this.rows.length; },
    getRange(row, col, height, width) {
      const sheet = this;
      return {
        getValues: () => Array.from({ length: height }, (_, i) =>
          Array.from({ length: width }, (_, j) => sheet.rows[row - 1 + i]?.[col - 1 + j] ?? '')),
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
    Date: Clock,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props.get(key) ?? null,
      setProperty: (key, value) => props.set(key, value),
    }) },
    SpreadsheetApp: {
      openById: id => ({ getSheetByName: name => {
        const index = id === 'production-auth' ? 0 : id === 'production-history' ? 1 : id === 'production-public' ? 2 : -1;
        return index >= 0 && name === names[index] ? sheets[index] : null;
      } }),
      flush: () => { if (fault?.at === lastWrite && fault.stage === 'flush') throw Error('Injected'); },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (_, value) => [...createHash('sha256').update(value).digest()].map(byte => byte > 127 ? byte - 256 : byte),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => {} }) },
    HtmlService: { createHtmlOutputFromFile: file => ({
      file,
      title: '',
      meta: [],
      setTitle(value) { this.title = value; return this; },
      addMetaTag(name, value) { this.meta.push([name, value]); return this; },
    }) },
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  return {
    handle: request => clone(context.Production.handleProduction({ mode: 'production', tournamentId: 'frog-assemble-2026', ...request })),
    raw: request => clone(context.Production.handleProduction(request)),
    page: () => clone(context.Production.doGet()),
    sheets,
    props,
    time(value) { clock = Date.parse(value); },
    fail(at, stage) { writes = 0; lastWrite = 0; fault = at ? { at, stage } : null; },
    lock(value) { locked = value; },
  };
}

test('本番候補はApps Script HTML Serviceから同一Webアプリ画面を返す', () => {
  const page = fixture().page();
  assert.equal(page.file, 'Index');
  assert.equal(page.title, 'そらふぇす 大会エントリー');
  assert.deepEqual(page.meta, [['viewport', 'width=device-width, initial-scale=1']]);
});

function request(kind = 'solo', count = ({ killer: 1, solo: 1, duo: 2, survivors: 4, team: 4 })[kind], offset = 0) {
  return {
    action: 'create',
    requestId: randomUUID(),
    editCode: randomBytes(16).toString('hex'),
    draft: {
      kind,
      count,
      teamName: kind === 'team' ? '架空本番前検証チーム' : '',
      representative: 0,
      time: '16:00開始でも参加可能',
      players: Array.from({ length: count }, (_, index) => ({
        name: `架空${offset + index}`,
        xId: `fiction_${offset + index}`,
        platform: 'Steam',
        otherPlatform: '',
        gameId: `Fiction${offset + index}#0000`,
        hours: '12.5',
        killer: ['team', 'killer'].includes(kind),
        duty: ['team', 'killer'].includes(kind) ? 'both' : '',
        killers: ['team', 'killer'].includes(kind) ? ['trapper'] : [],
        favorite: ['team', 'killer'].includes(kind) ? 'trapper' : '',
        dif: 'no',
        dck: 'no',
        other: 'no',
        difDetails: history(),
        dckDetails: history(),
        histories: [],
      })),
    },
  };
}

const edit = (initial, saved) => ({
  ...clone(initial),
  action: 'update',
  requestId: randomUUID(),
  receipt: saved.receipt,
  expectedVersion: saved.version,
});

test('本番候補は必須設定と本番モードを確認し、設定不足では閉じる', () => {
  const value = fixture();
  assert.deepEqual(value.handle({ action: 'settings' }), {
    ok: true,
    mode: 'production',
    tournamentId: 'frog-assemble-2026',
    deadline: '2026-10-25T10:24:58.000Z',
  });
  assert.equal(value.raw({ action: 'settings', mode: 'production', tournamentId: 'wrong' }).code, 'INVALID');
  assert.equal(value.handle({ action: 'settings', testOnly: true }).code, 'INVALID');
  value.props.delete('PRODUCTION_AUTH_ID');
  assert.equal(value.handle({ action: 'settings' }).code, 'CONFIG');
  value.props.set('PRODUCTION_AUTH_ID', 'production-auth');
  value.props.set('PRODUCTION_ENABLED', 'false');
  assert.equal(value.handle({ action: 'settings' }).code, 'CLOSED');
});

test('確定した受付番号接頭辞を許可し、不正な区切り形式は拒否する', () => {
  const value = fixture();
  assert.equal(value.handle({ action: 'settings' }).ok, true);
  const saved = value.handle(request());
  assert.match(saved.receipt, /^FAC-2026-\d{6}$/);

  for (const invalid of ['FAC--2026-', '-FAC-2026-', 'fac-2026-', 'FAC-2026', 'FAC 2026-']) {
    const invalidValue = fixture();
    invalidValue.props.set('PRODUCTION_RECEIPT_PREFIX', invalid);
    assert.equal(invalidValue.handle({ action: 'settings' }).code, 'CONFIG', invalid);
  }
});

test('本番候補は全応募形式を保存・認証読込・更新し、秘密を公開領域へ出さない', () => {
  for (const [kind, count] of [['killer', 1], ['solo', 1], ['duo', 2], ['survivors', 4], ['team', 4], ['team', 5], ['team', 6]]) {
    const value = fixture(), initial = request(kind, count, 10), saved = value.handle(initial);
    assert.equal(saved.ok, true, `${kind}/${count}`);
    assert.match(saved.receipt, /^FAC-2026-\d{6}$/);
    assert.deepEqual(value.handle(initial), saved);
    const update = edit(initial, saved);
    update.draft.players[0].name = '架空更新';
    const updated = value.handle(update);
    assert.equal(updated.version, 2);
    const read = value.handle({ action: 'read', receipt: saved.receipt, editCode: initial.editCode });
    assert.equal(read.draft.players[0].name, '架空更新');
    assert.equal(value.sheets[1].rows.length, 3);
    assert.equal(value.sheets[2].rows.length, 2);
    const exposed = JSON.stringify([value.sheets[1].rows, value.sheets[2].rows, read, saved]);
    assert.equal(exposed.includes(initial.editCode), false);
    const verifier = JSON.parse(value.sheets[0].rows[1][3]).verifier;
    assert.equal(exposed.includes(verifier), false);
  }
});

test('本番候補は重複を保存前に保留し、認証済み自己編集を除外する', () => {
  const value = fixture(), initial = request('solo', 1, 0), saved = value.handle(initial);
  assert.equal(saved.ok, true);
  const sameX = request('solo', 1, 20);
  sameX.draft.players[0].xId = '@FICTION_0';
  assert.deepEqual(value.handle(sameX), { ok: false, code: 'POSSIBLE_DUPLICATE' });
  const sameGame = request('solo', 1, 21);
  sameGame.draft.players[0].gameId = 'Fiction0#0000';
  assert.deepEqual(value.handle(sameGame), { ok: false, code: 'POSSIBLE_DUPLICATE' });
  assert.deepEqual(value.handle(request('solo', 1, 0)), { ok: false, code: 'DUPLICATE' });
  const update = edit(initial, saved);
  update.draft.players[0].name = '架空本人更新';
  assert.equal(value.handle(update).version, 2);
  assert.equal(value.sheets[2].rows.length, 2);
});

test('本番候補は途中失敗を同じ処理IDで回復し、多重履歴を作らない', () => {
  for (const stage of ['before', 'after', 'flush']) for (let at = 1; at <= 5; at++) {
    const value = fixture(), initial = request('solo', 1, at);
    value.fail(at, stage);
    assert.equal(value.handle(initial).code, 'UNKNOWN', `${at}/${stage}`);
    value.fail(null);
    const saved = value.handle(initial);
    assert.equal(saved.ok, true, `${at}/${stage}`);
    assert.equal(value.sheets[1].rows.length, 2);
    assert.equal(value.sheets[2].rows.length, 2);
    assert.deepEqual(value.handle({ action: 'recover', requestId: initial.requestId, editCode: initial.editCode }), saved);
  }
});

test('本番候補は認証失敗・版競合・排他失敗を成功扱いしない', () => {
  const value = fixture(), initial = request(), saved = value.handle(initial);
  assert.equal(value.handle({ action: 'read', receipt: saved.receipt, editCode: randomBytes(16).toString('hex') }).code, 'DENIED');
  const first = edit(initial, saved);
  first.draft.players[0].name = '架空更新1';
  assert.equal(value.handle(first).version, 2);
  const stale = edit(initial, saved);
  stale.draft.players[0].name = '架空更新2';
  assert.equal(value.handle(stale).code, 'CONFLICT');
  value.lock(true);
  assert.equal(value.handle(request('solo', 1, 50)).code, 'BUSY');
});


test('通常締切・追加開始・追加締切の境界で新規と編集を分離する', () => {
  for (const [time, normal, additional] of [
    ['2026-10-24T14:58:59.999Z', true, false],
    ['2026-10-24T14:59:00.000Z', false, false],
    ['2026-10-24T14:59:00.001Z', false, false],
    ['2026-10-24T14:59:59.999Z', false, false],
    ['2026-10-24T15:00:00.000Z', false, true],
    ['2026-10-25T10:24:57.999Z', false, true],
    ['2026-10-25T10:24:58.000Z', false, false],
    ['2026-10-25T10:24:58.001Z', false, false],
  ]) {
    for (const kind of ['solo', 'duo', 'killer', 'survivors', 'team']) {
      const f = fixture(), initial = request('solo', 1, 100), saved = f.handle(initial);
      f.time(time);
      const before = JSON.stringify(f.sheets), next = f.props.get('PRODUCTION_NEXT');
      const result = f.handle(request(kind));
      const allowed = normal || (additional && ['solo', 'duo'].includes(kind));
      assert.equal(result.ok, allowed, time + '/' + kind);
      if (!allowed) { assert.equal(result.code, 'CLOSED'); assert.equal(JSON.stringify(f.sheets), before); assert.equal(f.props.get('PRODUCTION_NEXT'), next); }
      assert.equal(f.handle(edit(initial, saved)).ok, normal, time + '/update');
    }
  }
});

test('追加募集では1人・2人のキラー担当可能者を含む新規応募を拒否する', () => {
  for (const kind of ['solo', 'duo']) {
    const f = fixture(); f.time('2026-10-24T15:00:00.000Z');
    const req = request(kind), player = req.draft.players.at(-1);
    Object.assign(player, { killer: true, duty: 'both', killers: ['trapper'], favorite: 'trapper' });
    assert.equal(f.handle(req).code, 'CLOSED');
    assert.equal(f.props.has('PRODUCTION_NEXT'), false);
    assert.ok(f.sheets.every(sheet => sheet.rows.length === 1));
  }
});

test('締切前のprepared・committedは締切後も同一操作で回復でき別操作は拒否する', () => {
  for (const kind of ['solo', 'killer']) {
    const f = fixture(), req = request(kind);
    f.fail(2, 'before');
    assert.equal(f.handle(req).code, 'UNKNOWN');
    f.fail(0); f.time('2026-10-26T00:00:00.000Z');
    const saved = f.handle({ action: 'recover', requestId: req.requestId, editCode: req.editCode });
    assert.equal(saved.ok, true);
    const before = JSON.stringify(f.sheets), next = f.props.get('PRODUCTION_NEXT');
    assert.deepEqual(f.handle(req), saved);
    assert.equal(f.handle({ ...req, requestId: randomUUID() }).code, 'CLOSED');
    assert.equal(f.handle(edit(req, saved)).code, 'CLOSED');
    assert.equal(JSON.stringify(f.sheets), before);
    assert.equal(f.props.get('PRODUCTION_NEXT'), next);
    assert.equal(f.handle({ action: 'read', receipt: saved.receipt, editCode: req.editCode }).ok, true);
  }
});


test('追加募集で受理したpreparedも追加締切後に回復でき新しい更新は不可', () => {
  const f = fixture(), req = request('duo');
  f.time('2026-10-25T10:24:57.999Z'); f.fail(2, 'before');
  assert.equal(f.handle(req).code, 'UNKNOWN');
  f.fail(0); f.time('2026-10-25T10:24:58.000Z');
  const saved = f.handle(req);
  assert.equal(saved.ok, true);
  assert.equal(f.handle(edit(req, saved)).code, 'CLOSED');
  assert.equal(f.props.get('PRODUCTION_NEXT'), '1');
  assert.equal(f.sheets[1].rows.length, 2);
});

test('通常締切前の更新preparedを締切後に回復しても新規更新は拒否する', () => {
  const f = fixture(), initial = request('killer'), saved = f.handle(initial);
  const update = edit(initial, saved); update.draft.players[0].name = '架空修正';
  f.fail(2, 'before'); assert.equal(f.handle(update).code, 'UNKNOWN');
  f.fail(0); f.time('2026-10-24T15:00:00.000Z');
  const updated = f.handle({ action: 'recover', requestId: update.requestId, editCode: update.editCode });
  assert.equal(updated.version, 2);
  assert.equal(f.handle(edit(update, updated)).code, 'CLOSED');
  assert.equal(f.props.get('PRODUCTION_NEXT'), '1');
});
