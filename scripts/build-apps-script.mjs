import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
const result = await build({ entryPoints: ['apps-script/server.ts'], bundle: true, format: 'iife', globalName: 'SorafesTest', target: 'es2020', write: false });
await mkdir('apps-script/generated', { recursive: true });
await writeFile('apps-script/generated/Code.gs', result.outputFiles[0].text + '\nfunction doPost(e) { return SorafesTest.doPost(e); }\n');
console.log('Apps Script用 Code.gs を生成しました。外部への配備は行っていません。');
