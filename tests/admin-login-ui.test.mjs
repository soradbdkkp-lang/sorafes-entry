import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const bundle = await build({ entryPoints: ['src/admin/Login.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react'], loader: { '.css': 'empty' } });
function mount(fetchImpl) {
  const slots = []; let cursor = 0, tree; const redirects = [];
  const hooks = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; } };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'location', bundle.outputFiles[0].text)(name => name === 'react' ? hooks : require(name), loaded, loaded.exports, fetchImpl, { replace: path => redirects.push(path) });
  const render = () => { cursor = 0; tree = loaded.exports.default(); };
  const nodes = (node = tree) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(n => nodes(n)) : [node, ...nodes(node.props?.children ?? null)];
  render();
  return { render, nodes, redirects, change(password) { nodes().find(n => n.type === 'input').props.onChange({ target: { value: password } }); render(); }, submit() { return nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); } };
}
test('管理ログインUIは送信後入力を消し、成功時だけ管理一覧へ移動する', async () => {
  let resolve; const requests = [];
  const ui = mount((url, init) => { requests.push({ url, init }); return new Promise(r => { resolve = r; }); });
  ui.change('fictional-input-only'); const pending = ui.submit(); ui.render();
  assert.equal(ui.nodes().find(n => n.type === 'input').props.type, 'password');
  assert.equal(ui.nodes().find(n => n.type === 'input').props.value, '');
  assert.equal(ui.nodes().find(n => n.type === 'button').props.disabled, true);
  assert.equal(requests[0].url, '/api/admin/login');
  assert.deepEqual(JSON.parse(requests[0].init.body), { password: 'fictional-input-only' });
  resolve(Response.json({ ok: true })); await pending;
  assert.deepEqual(ui.redirects, ['/admin/entries']);
});
test('管理ログインUIは誤パスワード・429・通信失敗で移動しない', async () => {
  for (const fetchImpl of [async () => Response.json({ ok: false }, { status: 403 }), async () => Response.json({ ok: false }, { status: 429 }), async () => { throw Error('通信失敗'); }]) {
    const ui = mount(fetchImpl); ui.change('fictional-input-only'); await ui.submit(); ui.render();
    assert.deepEqual(ui.redirects, []); assert.ok(ui.nodes().some(n => n.props?.role === 'alert'));
    assert.equal(ui.nodes().find(n => n.type === 'input').props.value, '');
  }
});
