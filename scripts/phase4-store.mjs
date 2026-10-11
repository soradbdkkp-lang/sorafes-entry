import { createHash, timingSafeEqual } from 'node:crypto';

// ローカル検証専用。Google通信・ディスク保存は行わない。
export function createPhase4Store({ prepare, now = Date.now, deadline = Date.now() + 86400000, duplicate = null }) {
  const apps = new Map(), operations = new Map(), history = new Map(), shared = new Map(), failures = new Map();
  let sequence = 0, tail = Promise.resolve(), traffic = [];
  const digest = (id, code) => createHash('sha256').update(JSON.stringify(['local-v1', 'frog-assemble-2026-test', id, code])).digest('hex');
  const result = op => ({ ok: true, receipt: op.receipt, version: op.version, requestId: op.id, status: 'committed' });
  const denied = () => ({ ok: false, code: 'DENIED' });
  function authenticate(receipt, code) {
    const key = typeof receipt === 'string' ? receipt : '';
    const recent = (failures.get(key) ?? []).filter(t => t > now() - 60000);
    failures.set(key, recent);
    if (recent.length >= 5) return null;
    const app = apps.get(key);
    if (!app || !timingSafeEqual(Buffer.from(app.verifier), Buffer.from(digest(app.id, code)))) { recent.push(now()); return null; }
    return app;
  }
  async function execute(raw) {
    if (!raw || typeof raw !== 'object' || raw.testOnly !== true) return { ok: false, code: 'INVALID' };
    traffic = traffic.filter(t => t > now() - 60000);
    if (traffic.length >= 200) return { ok: false, code: 'BUSY' };
    traffic.push(now());
    if (raw.action === 'settings') return { ok: true, deadline: new Date(deadline).toISOString(), localOnly: true };
    const code = typeof raw.editCode === 'string' ? raw.editCode.trim().replace(/-/g, '').toUpperCase() : '';
    if (!/^[A-F0-9]{32}$/.test(code)) return denied();
    if (raw.action === 'recover') {
      const op = operations.get(raw.requestId), app = authenticate(op?.receipt, code);
      if (!app || !op) return denied();
      if (op.state === 'committed') return result(op);
      return execute({ testOnly: true, action: op.action, requestId: op.id, editCode: code, receipt: op.receipt, expectedVersion: op.expectedVersion, draft: structuredClone(op.draft) });
    }
    if (raw.action === 'read') {
      const app = authenticate(raw.receipt, code);
      if (!app || !app.version) return denied();
      return { ok: true, receipt: app.receipt, version: app.version, draft: structuredClone(app.draft), status: 'committed' };
    }
    if (!['create', 'update'].includes(raw.action)) return { ok: false, code: 'INVALID' };
    let clean;
    try { clean = prepare(raw.draft, raw.requestId); } catch { return { ok: false, code: 'INVALID' }; }
    const canonical = JSON.stringify(clean);
    let op = operations.get(raw.requestId), app;
    if (op) {
      app = authenticate(op.receipt, code);
      if (!app) return denied();
      if (op.action !== raw.action || op.canonical !== canonical || (raw.action === 'update' && (op.receipt !== raw.receipt || op.expectedVersion !== raw.expectedVersion))) return { ok: false, code: 'CONFLICT' };
      if (op.state === 'committed') return result(op);
    } else {
      if (raw.action === 'update') {
        app = authenticate(raw.receipt, code);
        if (!app) return denied();
        if (app.pending) return { ok: false, code: 'PENDING' };
        if (!Number.isInteger(raw.expectedVersion) || app.version !== raw.expectedVersion) return { ok: false, code: 'CONFLICT' };
      }
      if (!Number.isFinite(deadline) || now() >= deadline) return { ok: false, code: 'CLOSED' };
      if (duplicate) {
        const own = duplicate.within(clean);
        if (own.length) return { ok: false, code: own.some(pair => pair.xId && pair.gameId) ? 'DUPLICATE' : 'POSSIBLE_DUPLICATE' };
        let strongest = 0, pendingOverlap = false;
        for (const other of apps.values()) {
          if (other === app) continue;
          if (other.version) strongest = Math.max(strongest, duplicate.strength(clean, other.draft));
          if (other.pending) {
            const pending = operations.get(other.pending);
            if (pending && duplicate.strength(clean, pending.draft)) pendingOverlap = true;
          }
        }
        if (strongest) return { ok: false, code: strongest === 2 ? 'DUPLICATE' : 'POSSIBLE_DUPLICATE' };
        if (pendingOverlap) return { ok: false, code: 'PENDING' };
      }
      if (raw.fault === 'auth') return { ok: false, code: 'UNKNOWN' };
      if (!app) {
        const receipt = `LOCAL-${String(++sequence).padStart(6, '0')}`;
        app = { id: receipt, receipt, verifier: digest(receipt, code), version: 0, draft: null, pending: null };
        apps.set(receipt, app);
      }
      op = { id: raw.requestId, action: raw.action, receipt: app.receipt, expectedVersion: app.version, version: app.version + 1, canonical, draft: clean, state: 'prepared' };
      operations.set(op.id, op); app.pending = op.id;
    }
    if (raw.fault === 'history') return { ok: false, code: 'UNKNOWN' };
    const key = `${app.id}:${op.version}`;
    if (!history.has(key)) history.set(key, { receipt: app.receipt, version: op.version, requestId: op.id, draft: structuredClone(op.draft) });
    if (raw.fault === 'shared') return { ok: false, code: 'UNKNOWN' };
    shared.set(app.id, { receipt: app.receipt, version: op.version, requestId: op.id, draft: structuredClone(op.draft), status: 'pending' });
    if (raw.fault === 'commit') return { ok: false, code: 'UNKNOWN' };
    app.draft = structuredClone(op.draft); app.version = op.version; app.pending = null; op.state = 'committed'; shared.get(app.id).status = 'committed';
    return result(op);
  }
  return {
    handle(raw) { const task = tail.then(() => execute(raw)); tail = task.catch(() => {}); return task; },
    // 自動テスト専用。HTTPには公開しない。
    inspect() { return structuredClone({ auth: [...apps.values()], operations: [...operations.values()], history: [...history.values()], shared: [...shared.values()] }); },
  };
}
