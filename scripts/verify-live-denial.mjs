// 明示実行専用。誤った架空キーでGoogle側の認証拒否を確認する。秘密は出力しない。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadEnv } from 'vite';
const endpoint = loadEnv('development', process.cwd(), 'SORAFES_').SORAFES_APPS_SCRIPT_URL;
const report = JSON.parse(await readFile('docs/phase3-live-results.json', 'utf8'));
const saved = report.saved[0];
const response = await fetch(endpoint, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ version: 1, testOnly: true, tournamentId: 'frog-assemble-2026-test', requestId: saved.requestId, draft: saved.expectedDraft, testKey: 'intentionally-invalid-fictional-key' }),
  signal: AbortSignal.timeout(30000),
});
assert.equal(response.status, 200);
const result = await response.json();
assert.equal(result.ok, false); assert.equal(result.code, 'DENIED');
console.log('Google実環境: 誤った試験キーをDENIEDで拒否しました。');
