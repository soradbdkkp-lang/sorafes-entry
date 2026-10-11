import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';

const result = await build({
  entryPoints: ['apps-script/production-server.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'SorafesProduction',
  target: 'es2020',
  write: false,
});

await mkdir('apps-script/production-generated', { recursive: true });
await writeFile(
  'apps-script/production-generated/Code.gs',
  result.outputFiles[0].text +
    '\nfunction doGet() { return SorafesProduction.doGet(); }\n' +
    'function doPost(e) { return SorafesProduction.doPost(e); }\n' +
    'function handleProduction(payload) { return SorafesProduction.handleProduction(payload); }\n',
);
await writeFile(
  'apps-script/production-generated/appsscript.json',
  JSON.stringify({
    timeZone: 'Asia/Tokyo',
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8',
    oauthScopes: ['https://www.googleapis.com/auth/spreadsheets'],
  }, null, 2) + '\n',
);
console.log('本番候補のCode.gsを生成しました。Googleへの配備・公開は行っていません。');
