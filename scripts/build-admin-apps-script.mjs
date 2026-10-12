import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
// 出力先は既存のGit除外対象。Googleへの配置は行わない。
const result = await build({ entryPoints: ['apps-script/admin-server.ts'], bundle: true, format: 'iife', globalName: 'SorafesAdmin', target: 'es2020', write: false });
await mkdir('.wrangler/admin-apps-script', { recursive: true });
await writeFile('.wrangler/admin-apps-script/Code.gs', result.outputFiles[0].text + '\nfunction doPost(e) { return SorafesAdmin.doPost(e); }\n');
await writeFile('.wrangler/admin-apps-script/appsscript.json', JSON.stringify({ timeZone: 'Asia/Tokyo', runtimeVersion: 'V8', dependencies: { enabledAdvancedServices: [{ userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' }] }, oauthScopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] }, null, 2));
