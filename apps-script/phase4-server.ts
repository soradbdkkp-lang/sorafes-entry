import { makeRequest } from '../src/storage/contract';

declare const PropertiesService: any, SpreadsheetApp: any, Utilities: any, LockService: any, ContentService: any;
const publicId = '1FU3cimJuHg5JGmJvVJpc-U0VNc4zTP5nB-DwiyW8VXE';
const eventHeaders = ['記録日時UTC', '処理状態', '受付番号', '認証管理JSON', '操作JSON'];
const historyHeaders = ['受付番号', '版', '処理ID', '保存日時UTC', '応募原本JSON'];
const publicHeaders = ['受付番号', '版', '処理ID', '処理状態', '保存日時UTC', '応募原本JSON'];
function table(id: string, name: string, headers: string[]) {
  const sheet = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!sheet || JSON.stringify(sheet.getRange(1, 1, 1, headers.length).getValues()[0]) !== JSON.stringify(headers)) throw Error('SCHEMA');
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues() : [];
  return { sheet, rows };
}
function write(sheet: any, row: number, values: unknown[]) {
  if (values.some(v => typeof v === 'string' && v.length > 49000)) throw Error('TOO_LARGE');
  sheet.getRange(row, 1, 1, values.length).setValues([values]); SpreadsheetApp.flush();
}
const copy = (v: any) => JSON.parse(JSON.stringify(v));
const digest = (id: string, code: string) => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
  JSON.stringify(['phase4-google-test-v1', 'frog-assemble-2026-test', id, code]), Utilities.Charset.UTF_8)
  .map((b: number) => (b & 255).toString(16).padStart(2, '0')).join('');
const equal = (a: string, b: string) => { let diff = a.length ^ b.length; for (let i = 0; i < 64; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; };

// 独立したPhase 4試験プロジェクト専用。故障注入・データ一覧・コード再発行は公開しない。
export function handlePhase4(raw: any): any {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('PHASE4_ENABLED') !== 'true') return { ok: false, code: 'CLOSED' };
  if (!raw || raw.testOnly !== true || typeof raw.testKey !== 'string' || !props.getProperty('PHASE4_TEST_KEY') || raw.testKey !== props.getProperty('PHASE4_TEST_KEY')) return { ok: false, code: 'DENIED' };
  if (JSON.stringify(raw).length > 26000 || raw.fault || !['settings', 'create', 'read', 'update', 'recover'].includes(raw.action)) return { ok: false, code: 'INVALID' };
  const authId = props.getProperty('PHASE4_AUTH_ID'), historyId = props.getProperty('PHASE4_HISTORY_ID');
  const deadline = Date.parse(props.getProperty('PHASE4_DEADLINE_UTC') ?? '');
  if (!authId || !historyId || new Set([authId, historyId, publicId]).size !== 3 || !Number.isFinite(deadline)) return { ok: false, code: 'CONFIG' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'BUSY' };
  try {
    // 小規模試験用の全体制限。保持は1分分のみ、送信元制限の代替ではない。
    const traffic: number[] = JSON.parse(props.getProperty('PHASE4_TRAFFIC') ?? '[]').filter((t: number) => t > Date.now() - 60000);
    if (traffic.length >= 200) return { ok: false, code: 'BUSY' };
    traffic.push(Date.now()); props.setProperty('PHASE4_TRAFFIC', JSON.stringify(traffic));
    if (raw.action === 'settings') return { ok: true, deadline: new Date(deadline).toISOString(), localOnly: false };
    const code = typeof raw.editCode === 'string' ? raw.editCode.trim().replace(/-/g, '').toUpperCase() : '';
    if (!/^[A-F0-9]{32}$/.test(code)) return { ok: false, code: 'DENIED' };
    const auth = table(authId, '認証管理', eventHeaders);
    const apps = new Map<string, any>(), operations = new Map<string, any>();
    for (const row of auth.rows) {
      const app = JSON.parse(row[3]), op = JSON.parse(row[4]); apps.set(app.receipt, app); operations.set(op.id, op);
    }
    const denied = () => ({ ok: false, code: 'DENIED' });
    function authenticate(receipt: unknown) {
      if (typeof receipt !== 'string' || !/^P4TEST-[0-9]{6,}$/.test(receipt)) return null;
      const key = 'PHASE4_FAIL_' + receipt;
      const attempts: number[] = JSON.parse(props.getProperty(key) ?? '[]').filter((t: number) => t > Date.now() - 60000);
      if (attempts.length >= 5) return null;
      const app = apps.get(receipt);
      if (!app || !equal(app.verifier, digest(receipt, code))) { attempts.push(Date.now()); props.setProperty(key, JSON.stringify(attempts)); return null; }
      return app;
    }
    const result = (op: any) => ({ ok: true, receipt: op.receipt, version: op.version, requestId: op.id, status: 'committed' });
    let op = operations.get(raw.requestId), app: any;
    if (raw.action === 'read') {
      app = authenticate(raw.receipt); if (!app || !app.version) return denied();
      return { ok: true, receipt: app.receipt, version: app.version, status: 'committed', draft: copy(app.draft) };
    }
    if (raw.action === 'recover') {
      app = authenticate(op?.receipt); if (!app || !op) return denied();
      // 回復には保存側で検証済みの候補だけを使う。呼び出し元の内容は使わない。
    } else {
      let draft;
      try { draft = makeRequest(raw.draft, raw.requestId).draft; } catch { return { ok: false, code: 'INVALID' }; }
      if (op) {
        app = authenticate(op.receipt); if (!app) return denied();
        if (raw.action !== op.action || JSON.stringify(op.draft) !== JSON.stringify(draft) ||
          (raw.action === 'update' && (op.receipt !== raw.receipt || op.expectedVersion !== raw.expectedVersion))) return { ok: false, code: 'CONFLICT' };
      } else {
        if (raw.action === 'update') {
          app = authenticate(raw.receipt); if (!app) return denied();
          if (app.pending) return { ok: false, code: 'PENDING' };
          if (!Number.isInteger(raw.expectedVersion) || raw.expectedVersion !== app.version) return { ok: false, code: 'CONFLICT' };
        }
        if (Date.now() >= deadline) return { ok: false, code: 'CLOSED' };
        if (!app) {
          const next = Number(props.getProperty('PHASE4_NEXT') ?? '0') + 1;
          if (!Number.isSafeInteger(next)) return { ok: false, code: 'CONFIG' };
          props.setProperty('PHASE4_NEXT', String(next)); // 欠番は再利用しない。
          const receipt = 'P4TEST-' + String(next).padStart(6, '0');
          if (apps.has(receipt)) return { ok: false, code: 'CONFIG' };
          app = { receipt, verifier: digest(receipt, code), version: 0, draft: null, pending: raw.requestId };
        }
        op = { id: raw.requestId, action: raw.action, receipt: app.receipt, expectedVersion: app.version, version: app.version + 1, draft, state: 'prepared', admittedAt: new Date().toISOString() };
        app.pending = op.id;
        write(auth.sheet, auth.sheet.getLastRow() + 1, [new Date().toISOString(), 'prepared', app.receipt, JSON.stringify(app), JSON.stringify(op)]);
      }
    }
    const histories = table(historyId, '応募履歴', historyHeaders);
    const view = table(publicId, 'sorafes-entry_PHASE4_TEST_v1', publicHeaders);
    // 以前の操作の再確認で新しい確定版を巻き戻さない。
    if (op.state === 'committed') {
      const current = view.rows.findIndex((r: any[]) => r[0] === app.receipt);
      if (current < 0 || view.rows[current][1] !== app.version || view.rows[current][3] !== 'committed') {
        const committed = [...operations.values()].find((o: any) => o.receipt === app.receipt && o.version === app.version && o.state === 'committed');
        if (!committed) throw Error('SCHEMA');
        write(view.sheet, current < 0 ? view.sheet.getLastRow() + 1 : current + 2, [app.receipt, app.version, committed.id, 'committed', committed.admittedAt, JSON.stringify(app.draft)]);
      }
      return result(op);
    }
    const old = histories.rows.find((r: any[]) => r[0] === app.receipt && r[1] === op.version);
    if (old && (old[2] !== op.id || old[4] !== JSON.stringify(op.draft))) throw Error('SCHEMA');
    if (!old) write(histories.sheet, histories.sheet.getLastRow() + 1, [app.receipt, op.version, op.id, op.admittedAt, JSON.stringify(op.draft)]);
    const current = view.rows.findIndex((r: any[]) => r[0] === app.receipt);
    const rowNumber = current < 0 ? view.sheet.getLastRow() + 1 : current + 2;
    write(view.sheet, rowNumber, [app.receipt, op.version, op.id, 'pending', op.admittedAt, JSON.stringify(op.draft)]);
    app.version = op.version; app.draft = copy(op.draft); app.pending = null; op.state = 'committed';
    write(auth.sheet, auth.sheet.getLastRow() + 1, [new Date().toISOString(), 'committed', app.receipt, JSON.stringify(app), JSON.stringify(op)]);
    write(view.sheet, rowNumber, [app.receipt, op.version, op.id, 'committed', op.admittedAt, JSON.stringify(op.draft)]);
    return result(op);
  } catch { return { ok: false, code: 'UNKNOWN' }; }
  finally { lock.releaseLock(); }
}
export function doPost(event: any) {
  let result;
  try { const body = event?.postData?.contents ?? ''; result = body.length <= 26000 ? handlePhase4(JSON.parse(body)) : { ok: false, code: 'INVALID' }; }
  catch { result = { ok: false, code: 'INVALID' }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
