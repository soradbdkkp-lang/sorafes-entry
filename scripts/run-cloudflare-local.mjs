import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv } from 'vite';

const local = loadEnv('development', process.cwd(), 'SORAFES_PRODUCTION_');
const environment = {
  ...process.env,
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
};
if (local.SORAFES_PRODUCTION_APPS_SCRIPT_URL) {
  environment.SORAFES_PRODUCTION_APPS_SCRIPT_URL = local.SORAFES_PRODUCTION_APPS_SCRIPT_URL;
}

const child = spawn(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js',
  'dev',
  '--local',
  '--persist-to',
  join(tmpdir(), 'sorafes-entry-wrangler'),
], { stdio: 'inherit', env: environment });

child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
