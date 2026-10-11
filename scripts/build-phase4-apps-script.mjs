import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
const result = await build({ entryPoints: ['apps-script/phase4-server.ts'], bundle: true, format: 'iife', globalName: 'SorafesPhase4', target: 'es2020', write: false });
await mkdir('apps-script/phase4-generated', { recursive: true });
await writeFile('apps-script/phase4-generated/Code.gs', result.outputFiles[0].text + '\nfunction doPost(e) { return SorafesPhase4.doPost(e); }\n');
console.log('Phase 4専用Code.gsを生成しました。配備と旧コードの変更は行っていません。');
