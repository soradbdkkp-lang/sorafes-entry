import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const bundle = await build({ entryPoints: ['src/components/LocalEntry.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react', 'react/jsx-runtime'] });
const require = createRequire(import.meta.url);
const id = '00000000-0000-4000-8000-000000000001';
const code = 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-0000-1111'; // 架空
const committed = { ok: true, receipt: 'FAC-2026-000001', version: 1, requestId: id, status: 'committed' };
const flush = () => new Promise(resolve => setImmediate(resolve));

// 実コンポーネントのイベント・非同期処理を実行。DOM/ブラウザ描画は対象外。
function mount(reply, { productionMode = true, ready = false } = {}) {
  const slots = []; let cursor = 0, first = true, blocked = false, completion;
  const requests = [], effects = [];
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(effect) { if (first) effects.push(effect); },
  };
  const localFetch = async (_url, options) => {
    const payload = JSON.parse(options.body); requests.push(payload);
    if (payload.action === 'settings') return Response.json({ ok: true, mode: 'production', tournamentId: 'frog-assemble-2026', deadline: '2026-10-24T14:59:00Z' });
    return Response.json(await reply(payload));
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', bundle.outputFiles[0].text)(name => name === 'react' ? hooks : require(name), module, module.exports, localFetch);
  const history = { name: '', appearances: '', wins: '', runnersUp: '' };
  const draft = { kind: 'solo', count: 1, representative: 0, teamName: '', time: '16:00開始でも参加可能', players: [{ name: '架空', xId: 'fictional', platform: 'Steam', otherPlatform: '', gameId: 'Fiction#0000', hours: '10', killer: false, duty: '', favorite: '', killers: [], dif: 'no', dck: 'no', other: 'no', difDetails: history, dckDetails: history, histories: [] }] };
  let tree;
  const render = () => {
    cursor = 0;
    tree = module.exports.default({ draft, ready, productionMode, load: () => {}, block: value => { blocked = value; }, complete: value => { completion = value; } });
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
  return { render, requests, button, field, draft, blocked: () => blocked, completion: () => completion,
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
