import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const bundle = await build({ entryPoints: ['src/components/LocalEntry.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react', 'react/jsx-runtime', 'react-dom'] });
const require = createRequire(import.meta.url);
const id = '00000000-0000-4000-8000-000000000001';
const code = 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-0000-1111'; // 架空
const committed = { ok: true, receipt: 'FAC-2026-000001', version: 1, requestId: id, status: 'committed' };
const flush = () => new Promise(resolve => setImmediate(resolve));

// 実コンポーネントのイベント・非同期処理を実行。DOM/ブラウザ描画は対象外。
function mount(reply, { productionMode = true, ready = false, closed = false, separated = true, now = '2026-10-24T14:00:00.000Z' } = {}) {
  let clock = Date.parse(now), tick;
  const browserClock = { setInterval(fn) { tick = fn; return 1; }, clearInterval() {} };
  class Clock extends Date { static now() { return clock; } }
  const slots = []; let cursor = 0, first = true, blocked = false, completion;
  const requests = [], effects = [];
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(effect) { if (first) effects.push(effect); },
  };
  const localFetch = async (_url, options) => {
    const payload = JSON.parse(options.body); requests.push(payload);
    if (payload.action === 'settings' && closed) return Response.json({ ok: false, code: 'CLOSED' });
    if (payload.action === 'settings') return Response.json({ ok: true, mode: 'production', tournamentId: 'frog-assemble-2026', deadline: '2026-10-24T14:59:00Z' });
    return Response.json(await reply(payload));
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'window', 'Date', bundle.outputFiles[0].text)(name => name === 'react' ? hooks : name === 'react-dom' ? { createPortal: (children, target) => ({ type: 'portal', props: { children, target } }) } : require(name), module, module.exports, localFetch, browserClock, Clock);
  const history = { name: '', appearances: '', wins: '', runnersUp: '' };
  const draft = { kind: 'solo', count: 1, representative: 0, teamName: '', time: '16:00開始でも参加可能', players: [{ name: '架空', xId: 'fictional', platform: 'Steam', otherPlatform: '', gameId: 'Fiction#0000', hours: '10', killer: false, duty: '', favorite: '', killers: [], dif: 'no', dck: 'no', other: 'no', difDetails: history, dckDetails: history, histories: [] }] };
  let tree;
  const render = () => {
    cursor = 0;
    tree = module.exports.default({ draft, ready, productionMode, ...(separated ? { reviewTarget: {} } : {}), load: () => {}, block: value => { blocked = value; }, complete: value => { completion = value; } });
    first = false; while (effects.length) effects.shift()();
    return tree;
  };
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(n => nodes(n));
    return [node, ...nodes(node.props?.children ?? null)];
  }
  const text = node => Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' && node ? text(node.props?.children) : String(node ?? '');
  const button = label => nodes().find(n => n.type === 'button' && text(n) === label);
  const field = label => nodes().find(n => n.type === 'label' && text(n).startsWith(label)).props.children.find(n => n.type === 'input');
  render();
  return { time(value) { clock = Date.parse(value); tick(); render(); }, render, requests, button, field, draft, nodes, text: () => text(tree), setReady(value) { ready = value; render(); }, blocked: () => blocked, completion: () => completion,
    locked: () => nodes().find(n => n.type === 'fieldset').props.disabled,
    message: () => text(nodes().find(n => n.props?.role === 'status')),
    recover() { field('編集コード').props.onChange({ target: { value: code } }); field('再確認ID').props.onChange({ target: { value: id } }); render(); button('IDとコードで保存結果を確認').props.onClick(); },
    prepare() { button('新規応募用の編集コードを生成').props.onClick(); render(); nodes().find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); render(); },
  };
}

for (const failure of ['UNKNOWN', 'CLOSED', 'DENIED', 'BUSY', 'PENDING', 'network', 'invalid', 'pending']) {
  test(`再読み込み後recover ${failure}は固定し、同じ要求の再確認後に完了する`, async () => {
    let attempts = 0;
    const ui = mount(() => {
      if (++attempts > 1) return { ...committed, version: 2 };
      if (failure === 'network') throw Error('offline');
      if (failure === 'invalid') return { ...committed, requestId: 'wrong' };
      if (failure === 'pending') return { ...committed, status: 'pending' };
      return { ok: false, code: failure };
    });
    await flush(); ui.render(); ui.recover();
    assert.equal(ui.blocked(), true);
    await flush(); ui.render();
    assert.equal(ui.locked(), true); assert.equal(ui.blocked(), true);
    assert.equal(ui.button('編集・認証を終了').props.disabled, true);
    assert.equal(ui.completion(), undefined); assert.match(ui.message(), /まだ確定できません/);
    assert.equal(ui.button('応募を送信'), undefined);
    ui.button('同じ操作を再確認').props.onClick();
    ui.button('同じ操作を再確認').props.onClick(); // 同一描画からの連打も1要求
    await flush(); ui.render();
    const operations = ui.requests.filter(r => r.action !== 'settings');
    assert.equal(operations.length, 2); assert.deepEqual(operations[0], operations[1]);
    assert.equal(operations[1].action, 'recover');
    assert.deepEqual(ui.completion(), { receipt: committed.receipt, editCode: code, recoveryId: id, updated: true });
  });
}

test('recoverで新規応募のcommittedを確認すると完了へ進む', async () => {
  const ui = mount(() => committed);
  await flush(); ui.render(); ui.recover(); await flush(); ui.render();
  assert.deepEqual(ui.completion(), { receipt: committed.receipt, editCode: code, recoveryId: id, updated: false });
  assert.equal(ui.requests.filter(r => r.action === 'create' || r.action === 'update').length, 0);
});

test('pending応答は固定を維持してrecoverを継続する（ローカル契約）', async () => {
  let attempts = 0;
  const ui = mount(() => ++attempts === 1 ? { ...committed, status: 'pending' } : committed, { productionMode: false });
  await flush(); ui.render(); ui.recover(); await flush(); ui.render();
  assert.equal(ui.locked(), true); assert.match(ui.message(), /保存処理は途中/);
  ui.button('同じ操作を再確認').props.onClick(); await flush(); ui.render();
  assert.deepEqual(ui.requests[1], ui.requests[2]); assert.equal(ui.locked(), false);
});

for (const unknown of [false, true]) {
  test(`通常送信${unknown ? 'の結果不明から同じ原本を再送' : 'の正常完了'}を維持する`, async () => {
    let attempts = 0;
    const ui = mount(payload => unknown && ++attempts === 1 ? { ok: false, code: 'UNKNOWN' } : { ...committed, requestId: payload.requestId }, { ready: true });
    await flush(); ui.render(); ui.prepare(); ui.button('応募を送信').props.onClick();
    await flush(); ui.render();
    if (unknown) {
      assert.equal(ui.locked(), true);
      ui.draft.players[0].name = '変更されても送信原本は維持';
      ui.button('同じ操作を再確認').props.onClick(); await flush(); ui.render();
      assert.deepEqual(ui.requests[1], ui.requests[2]);
    }
    assert.equal(ui.completion().updated, false);
    assert.equal(ui.button('応募を送信').props.disabled, true);
  });
}


test('STEP 8で生成→保存確認→送信の順に解禁し、連打でも1要求になる', async () => {
  const ui = mount(payload => ({ ...committed, requestId: payload.requestId }), { ready: true });
  await flush(); ui.render();
  assert.equal(ui.button('応募を送信').props.disabled, true);
  ui.button('応募を送信').props.onClick();
  assert.equal(ui.requests.length, 1);
  assert.match(ui.text(), /編集コードを生成し/);
  const generate = ui.button('新規応募用の編集コードを生成').props.onClick;
  generate(); ui.render();
  const firstCode = ui.field('編集コード').props.value;
  generate(); ui.render();
  assert.equal(ui.field('編集コード').props.value, firstCode);
  assert.equal(ui.button('応募を送信').props.disabled, true);
  assert.equal(ui.field('編集コード').props.readOnly, true);
  const code = ui.field('編集コード').props.value, id = ui.field('再確認ID').props.value;
  assert.match(code, /^(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/);
  assert.match(id, /^[a-f0-9-]{36}$/);
  ui.nodes().find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); ui.render();
  assert.equal(ui.button('応募を送信').props.disabled, false);
  const send = ui.button('応募を送信').props.onClick; send(); send();
  await flush(); ui.render();
  const creates = ui.requests.filter(r => r.action === 'create');
  assert.equal(creates.length, 1); assert.equal(creates[0].editCode, code); assert.equal(creates[0].requestId, id);
  assert.equal(ui.completion().recoveryId, id);
});

test('前STEPで修正してSTEP 8へ戻っても生成済み認証情報と保存確認を保持する', async () => {
  const ui = mount(payload => ({ ...committed, requestId: payload.requestId }), { ready: true });
  await flush(); ui.render(); ui.prepare();
  const code = ui.field('編集コード').props.value, id = ui.field('再確認ID').props.value;
  ui.setReady(false); ui.draft.players[0].name = '架空修正';
  assert.equal(ui.button('新規応募用の編集コードを生成'), undefined);
  ui.setReady(true);
  assert.equal(ui.field('編集コード').props.value, code); assert.equal(ui.field('再確認ID').props.value, id);
  assert.equal(ui.button('新規応募用の編集コードを生成'), undefined);
  assert.equal(ui.button('応募を送信').props.disabled, false);
  ui.button('応募を送信').props.onClick(); await flush();
  assert.equal(ui.requests[1].draft.players[0].name, '架空修正');
  assert.equal(ui.requests[1].requestId, id); assert.equal(ui.requests[1].editCode, code);
});

test('CLOSED設定ではSTEP 8の送信位置を示すが、保存確認後も送信しない', async () => {
  const ui = mount(() => { throw Error('must not send'); }, { ready: true, closed: true });
  await flush(); ui.render(); ui.prepare();
  assert.equal(ui.button('応募を送信').props.disabled, true);
  ui.button('応募を送信').props.onClick(); await flush();
  assert.equal(ui.requests.length, 1); assert.match(ui.text(), /現在、送信できません/);
});

test('既存応募読込後はコードを維持し、更新用IDの保存確認から更新する', async () => {
  let ui;
  ui = mount(payload => payload.action === 'read' ? { ...committed, draft: ui.draft } : { ...committed, version: 2, requestId: payload.requestId });
  await flush(); ui.render();
  ui.field('編集コード').props.onChange({ target: { value: code } });
  ui.field('受付番号').props.onChange({ target: { value: committed.receipt } }); ui.render();
  ui.button('応募を読み込んで編集').props.onClick(); await flush(); ui.setReady(true);
  assert.equal(ui.field('編集コード').props.value, code);
  assert.equal(ui.button('応募を送信'), undefined);
  assert.equal(ui.button('応募内容を更新').props.disabled, true);
  ui.nodes().find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); ui.render();
  const id = ui.field('再確認ID').props.value;
  ui.button('応募内容を更新').props.onClick(); await flush(); ui.render();
  assert.equal(ui.requests[2].action, 'update'); assert.equal(ui.requests[2].editCode, code);
  assert.equal(ui.requests[2].requestId, id); assert.equal(ui.requests[2].expectedVersion, 1);
  assert.equal(ui.completion().updated, true);
});

 test('分離配置でもSTEP 8送信準備と下部のread/recoverを一つの状態で維持する', async () => {
  const ui = mount(() => committed, { ready: true, separated: true });
  await flush(); ui.render();
  const portal = ui.nodes().find(n => n.type === 'portal');
  const portalNodes = ui.nodes(portal);
  assert.ok(portalNodes.some(n => n.type === 'button' && n.props.children === '新規応募用の編集コードを生成'));
  assert.equal(portalNodes.some(n => n.type === 'button' && n.props.children === '応募を読み込んで編集'), false);
  assert.ok(ui.button('応募を読み込んで編集'));
  assert.ok(ui.button('IDとコードで保存結果を確認'));
  ui.prepare();
  const generated = ui.field('編集コード').props.value;
  ui.setReady(false);
  assert.equal(ui.nodes().some(n => n.type === 'portal'), false);
  assert.equal(ui.field('編集コード').props.value, generated);
  assert.equal(ui.button('応募を送信'), undefined);
  ui.setReady(true);
  assert.equal(ui.field('編集コード').props.value, generated);
  assert.equal(ui.button('応募を送信').props.disabled, false);
});


test('追加期間はサバイバーの新規だけ送信可、時計の進行で自動終了する', async () => {
  const ui = mount(() => committed, { ready: true, now: '2026-10-24T15:00:00Z' });
  await flush(); ui.render(); ui.prepare();
  assert.equal(ui.button('応募を送信').props.disabled, false);
  ui.draft.players[0].killer = true; ui.render();
  assert.equal(ui.button('応募を送信').props.disabled, true);
  ui.button('応募を送信').props.onClick();
  assert.equal(ui.requests.some(r => r.action === 'create'), false);
  ui.draft.players[0].killer = false; ui.render();
  assert.equal(ui.button('応募を送信').props.disabled, false);
  ui.time('2026-10-25T14:59:00Z');
  assert.equal(ui.button('応募を送信').props.disabled, true);
});

test('追加期間に既存応募を読み込んでも更新を送信できない', async () => {
  const ui = mount(() => ({ ...committed, draft: ui.draft }), { ready: true, now: '2026-10-24T15:00:00Z' });
  await flush(); ui.render();
  ui.field('編集コード').props.onChange({ target: { value: code } });
  ui.field('受付番号').props.onChange({ target: { value: committed.receipt } });
  ui.render(); ui.button('保存済み応募を確認（編集終了）').props.onClick();
  await flush(); ui.render();
  assert.equal(ui.button('応募内容を更新').props.disabled, true);
  ui.button('応募内容を更新').props.onClick();
  assert.equal(ui.requests.some(r => r.action === 'update'), false);
});
