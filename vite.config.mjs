import { defineConfig, loadEnv } from 'vite';
import { readFile } from 'node:fs/promises';
import { createPhase4Store } from './scripts/phase4-store.mjs';
import { relayPhase4 } from './scripts/phase4-google-relay.mjs';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SORAFES_');
  const endpoint = env.SORAFES_APPS_SCRIPT_URL;
  const key = env.SORAFES_TEST_KEY;
  return { plugins: [{ name: 'local-test-save', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const files = new Map([
        ['code', ['apps-script/production-generated/Code.gs', 'text/plain; charset=utf-8']],
        ['index', ['apps-script/production-generated/Index.html', 'text/plain; charset=utf-8']],
        ['manifest', ['apps-script/production-generated/appsscript.json', 'text/plain; charset=utf-8']],
      ]);
      const url = new URL(req.url ?? '/', 'http://localhost');
      const requested = url.searchParams.get('deploy_file');
      if (!requested) { next(); return; }
      const target = files.get(requested);
      res.setHeader('Cache-Control', 'no-store');
      if (!target) { res.statusCode = 404; res.end('Not found'); return; }
      try { res.setHeader('Content-Type', target[1]); res.end(await readFile(target[0])); }
      catch { res.statusCode = 500; res.end('Unavailable'); }
    });
    let phase4, phase5;
    server.middlewares.use('/api/phase4-google', async (req, res) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      const reply = data => res.end(JSON.stringify(data));
      if (req.method !== 'POST') { res.statusCode = 405; return reply({ ok: false, code: 'METHOD' }); }
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.statusCode = 403; return reply({ ok: false, code: 'DENIED' }); }
      try {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 26000) return reply({ ok: false, code: 'INVALID' }); }
        reply(await relayPhase4(JSON.parse(body), { endpoint: env.SORAFES_PHASE4_APPS_SCRIPT_URL, key, oldEndpoint: endpoint }));
      } catch { reply({ ok: false, code: 'UNKNOWN' }); }
    });
    server.middlewares.use('/api/phase4-local', async (req, res) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      const reply = data => res.end(JSON.stringify(data));
      if (req.method !== 'POST') { res.statusCode = 405; return reply({ ok: false, code: 'METHOD' }); }
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.statusCode = 403; return reply({ ok: false, code: 'DENIED' }); }
      try {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 26000) return reply({ ok: false, code: 'INVALID' }); }
        const raw = JSON.parse(body);
        const { makeRequest } = await server.ssrLoadModule('/src/storage/contract.ts');
        phase4 ??= createPhase4Store({ prepare: (draft, id) => makeRequest(draft, id).draft });
        const result = await phase4.handle(raw);
        if (result.ok && raw.fault === 'response') { res.destroy(); return; }
        reply(result);
      } catch { reply({ ok: false, code: 'UNKNOWN' }); }
    });
    server.middlewares.use('/api/phase5-local', async (req, res) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      const reply = data => res.end(JSON.stringify(data));
      if (req.method !== 'POST') { res.statusCode = 405; return reply({ ok: false, code: 'METHOD' }); }
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.statusCode = 403; return reply({ ok: false, code: 'DENIED' }); }
      try {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 26000) return reply({ ok: false, code: 'INVALID' }); }
        const raw = JSON.parse(body);
        const { makeRequest } = await server.ssrLoadModule('/src/storage/contract.ts');
        const { duplicatesWithin, duplicateStrengthBetween } = await server.ssrLoadModule('/src/phase5-duplicates.ts');
        phase5 ??= createPhase4Store({ prepare: (draft, id) => makeRequest(draft, id).draft, duplicate: { within: duplicatesWithin, strength: duplicateStrengthBetween } });
        const result = await phase5.handle(raw);
        if (result.ok && raw.fault === 'response') { res.destroy(); return; }
        reply(result);
      } catch { reply({ ok: false, code: 'UNKNOWN' }); }
    });
    server.middlewares.use('/api/test-entry', async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      const reply = (data) => res.end(JSON.stringify(data));
      if (req.method !== 'POST') { res.statusCode = 405; return reply({ ok: false, code: 'METHOD' }); }
      if (!endpoint || !key) return reply({ ok: false, code: 'NOT_CONFIGURED' });
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)) return reply({ ok: false, code: 'CONFIG' });
      try {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 24000) return reply({ ok: false, code: 'INVALID' }); }
        const payload = JSON.parse(body);
        const upstream = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, testKey: key }), signal: AbortSignal.timeout(25000) });
        if (!upstream.ok) return reply({ ok: false, code: 'UNKNOWN' });
        return reply(await upstream.json());
      } catch { return reply({ ok: false, code: 'UNKNOWN' }); }
    });
  } }] };
});
