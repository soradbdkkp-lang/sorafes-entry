import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const bundle = await build({
  entryPoints: ['src/components/Completion.tsx'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  external: ['react'],
});
const loaded = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
const Completion = loaded.exports.default;

test('正常保存後の完了画面だけが受付番号・編集コード・再確認IDを表示する', () => {
  const html = renderToStaticMarkup(createElement(Completion, { value: {
    receipt: 'FAC-2026-000123',
    editCode: 'FICTIONAL-EDIT-CODE',
    recoveryId: '00000000-0000-4000-8000-000000000001',
    updated: false,
  } }));
  assert.match(html, /応募を受け付けました/);
  assert.match(html, /FAC-2026-000123/);
  assert.match(html, /FICTIONAL-EDIT-CODE/);
  assert.match(html, /00000000-0000-4000-8000-000000000001/);
  assert.match(html, /受付完了は当選・参加確定を意味しません/);
});
