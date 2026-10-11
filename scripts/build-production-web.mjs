import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const result = await build({
  configFile: false,
  root: process.cwd(),
  logLevel: 'warn',
  build: {
    write: false,
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const output = Array.isArray(result) ? result.flatMap(item => item.output) : result.output;
const script = output.find(item => item.type === 'chunk' && item.isEntry);
const style = output.find(item => item.type === 'asset' && item.fileName.endsWith('.css'));
if (!script || !style || typeof style.source !== 'string') throw Error('本番画面の生成物を確認できません。');

const escapeScript = value => value.replace(/<\/script/gi, '<\\/script');
const escapeStyle = value => value.replace(/<\/style/gi, '<\\/style');
const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>そらふぇす 大会エントリー</title>
  <style>${escapeStyle(style.source)}</style>
</head>
<body>
  <div id="root"></div>
  <script>window.__SORAFES_APPS_SCRIPT__=true;</script>
  <script>${escapeScript(script.code)}</script>
</body>
</html>
`;

await mkdir('apps-script/production-generated', { recursive: true });
await writeFile('apps-script/production-generated/Index.html', html);
console.log('Apps Script HTML Service用のIndex.htmlを生成しました。外部への配備・公開は行っていません。');
