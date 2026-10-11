import { prepareDraft } from '../src/storage/prepare-draft';
import { duplicatesWithin, duplicateStrengthBetween } from '../src/phase5-duplicates';

declare const PropertiesService: any, SpreadsheetApp: any, Utilities: any, LockService: any, ContentService: any, HtmlService: any;

const tournamentId = 'frog-assemble-2026';
const deadlineUtc = Date.parse('2026-10-24T14:59:00.000Z');
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
  if (values.some(value => typeof value === 'string' && value.length > 49000)) throw Error('TOO_LARGE');
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
}

const copy = (value: any) => JSON.parse(JSON.stringify(value));
const normalizeCode = (value: unknown) => typeof value === 'string' ? value.trim().replace(/-/g, '').toUpperCase() : '';
const digest = (receipt: string, code: string) => Utilities.computeDigest(
  Utilities.DigestAlgorithm.SHA_256,
  JSON.stringify(['sorafes-entry-production-v1', tournamentId, receipt, code]),
  Utilities.Charset.UTF_8,
).map((byte: number) => (byte & 255).toString(16).padStart(2, '0')).join('');
const equal = (left: string, right: string) => {
  let difference = left.length ^ right.length;
  for (let index = 0; index < 64; index++) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
};

// 本番候補。必要設定がすべて揃い、PRODUCTION_ENABLED=true の場合だけ受付する。
export function handleProduction(raw: any): any {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('PRODUCTION_ENABLED') !== 'true') return { ok: false, code: 'CLOSED' };
  if (!raw || raw.mode !== 'production' || raw.tournamentId !== tournamentId || raw.testOnly !== undefined ||
      JSON.stringify(raw).length > 26000 || raw.fault || !['settings', 'create', 'read', 'update', 'recover'].includes(raw.action)) {
    return { ok: false, code: 'INVALID' };
  }

  const authId = properties.getProperty('PRODUCTION_AUTH_ID');
  const historyId = properties.getProperty('PRODUCTION_HISTORY_ID');
  const publicId = properties.getProperty('PRODUCTION_PUBLIC_ID');
  const publicSheet = properties.getProperty('PRODUCTION_PUBLIC_SHEET');
  const receiptPrefix = properties.getProperty('PRODUCTION_RECEIPT_PREFIX');
  const configuredDeadline = Date.parse(properties.getProperty('PRODUCTION_DEADLINE_UTC') ?? '');
  if (!authId || !historyId || !publicId || !publicSheet || !receiptPrefix ||
      !/^[A-Z0-9]+(?:-[A-Z0-9]+)*-$/.test(receiptPrefix) || receiptPrefix.length > 20 ||
      new Set([authId, historyId, publicId]).size !== 3 || configuredDeadline !== deadlineUtc) {
    return { ok: false, code: 'CONFIG' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'BUSY' };
  try {
    const traffic: number[] = JSON.parse(properties.getProperty('PRODUCTION_TRAFFIC') ?? '[]')
      .filter((timestamp: number) => timestamp > Date.now() - 60000);
    if (traffic.length >= 200) return { ok: false, code: 'BUSY' };
    traffic.push(Date.now());
    properties.setProperty('PRODUCTION_TRAFFIC', JSON.stringify(traffic));
    if (raw.action === 'settings') return { ok: true, mode: 'production', tournamentId, deadline: new Date(deadlineUtc).toISOString() };

    const code = normalizeCode(raw.editCode);
    if (!/^[A-F0-9]{32}$/.test(code)) return { ok: false, code: 'DENIED' };
    const auth = table(authId, '認証管理', eventHeaders);
    const applications = new Map<string, any>();
    const operations = new Map<string, any>();
    for (const row of auth.rows) {
      const application = JSON.parse(row[3]);
      const operation = JSON.parse(row[4]);
      applications.set(application.receipt, application);
      operations.set(operation.id, operation);
    }

    const denied = () => ({ ok: false, code: 'DENIED' });
    function authenticate(receipt: unknown) {
      if (typeof receipt !== 'string' || receipt.length > 40 || !receipt.startsWith(receiptPrefix) || !/^[A-Z0-9-]+$/.test(receipt)) return null;
      const attemptsKey = 'PRODUCTION_FAIL_' + receipt;
      const attempts: number[] = JSON.parse(properties.getProperty(attemptsKey) ?? '[]')
        .filter((timestamp: number) => timestamp > Date.now() - 60000);
      if (attempts.length >= 5) return null;
      const application = applications.get(receipt);
      if (!application || !equal(application.verifier, digest(receipt, code))) {
        attempts.push(Date.now());
        properties.setProperty(attemptsKey, JSON.stringify(attempts));
        return null;
      }
      return application;
    }

    const result = (operation: any) => ({
      ok: true,
      receipt: operation.receipt,
      version: operation.version,
      requestId: operation.id,
      status: 'committed',
    });
    let operation = operations.get(raw.requestId);
    let application: any;

    if (raw.action === 'read') {
      application = authenticate(raw.receipt);
      if (!application || !application.version) return denied();
      return { ok: true, receipt: application.receipt, version: application.version, status: 'committed', draft: copy(application.draft) };
    }

    if (raw.action === 'recover') {
      application = authenticate(operation?.receipt);
      if (!application || !operation) return denied();
    } else {
      let draft;
      try {
        if (typeof raw.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(raw.requestId)) throw Error('INVALID');
        draft = prepareDraft(raw.draft);
      }
      catch { return { ok: false, code: 'INVALID' }; }

      if (operation) {
        application = authenticate(operation.receipt);
        if (!application) return denied();
        if (raw.action !== operation.action || JSON.stringify(operation.draft) !== JSON.stringify(draft) ||
            (raw.action === 'update' && (operation.receipt !== raw.receipt || operation.expectedVersion !== raw.expectedVersion))) {
          return { ok: false, code: 'CONFLICT' };
        }
      } else {
        if (raw.action === 'update') {
          application = authenticate(raw.receipt);
          if (!application) return denied();
          if (application.pending) return { ok: false, code: 'PENDING' };
          if (!Number.isInteger(raw.expectedVersion) || raw.expectedVersion !== application.version) return { ok: false, code: 'CONFLICT' };
        }
        if (Date.now() >= deadlineUtc) return { ok: false, code: 'CLOSED' };

        const within = duplicatesWithin(draft);
        if (within.length) return { ok: false, code: within.some(pair => pair.xId && pair.gameId) ? 'DUPLICATE' : 'POSSIBLE_DUPLICATE' };
        let strongest: 0 | 1 | 2 = 0;
        let pendingOverlap = false;
        for (const other of applications.values()) {
          if (other === application) continue;
          if (other.version && other.draft) strongest = Math.max(strongest, duplicateStrengthBetween(draft, other.draft)) as 0 | 1 | 2;
          if (other.pending) {
            const pending = operations.get(other.pending);
            if (pending && duplicateStrengthBetween(draft, pending.draft)) pendingOverlap = true;
          }
        }
        if (strongest) return { ok: false, code: strongest === 2 ? 'DUPLICATE' : 'POSSIBLE_DUPLICATE' };
        if (pendingOverlap) return { ok: false, code: 'PENDING' };

        if (!application) {
          const next = Number(properties.getProperty('PRODUCTION_NEXT') ?? '0') + 1;
          if (!Number.isSafeInteger(next)) return { ok: false, code: 'CONFIG' };
          properties.setProperty('PRODUCTION_NEXT', String(next));
          const receipt = receiptPrefix + String(next).padStart(6, '0');
          if (applications.has(receipt)) return { ok: false, code: 'CONFIG' };
          application = { receipt, verifier: digest(receipt, code), version: 0, draft: null, pending: raw.requestId };
        }
        operation = {
          id: raw.requestId,
          action: raw.action,
          receipt: application.receipt,
          expectedVersion: application.version,
          version: application.version + 1,
          draft,
          state: 'prepared',
          admittedAt: new Date().toISOString(),
        };
        application.pending = operation.id;
        write(auth.sheet, auth.sheet.getLastRow() + 1, [new Date().toISOString(), 'prepared', application.receipt, JSON.stringify(application), JSON.stringify(operation)]);
      }
    }

    const histories = table(historyId, '応募履歴', historyHeaders);
    const publicView = table(publicId, publicSheet, publicHeaders);
    if (operation.state === 'committed') {
      const current = publicView.rows.findIndex((row: any[]) => row[0] === application.receipt);
      if (current < 0 || publicView.rows[current][1] !== application.version || publicView.rows[current][3] !== 'committed') {
        const committed = [...operations.values()].find((candidate: any) =>
          candidate.receipt === application.receipt && candidate.version === application.version && candidate.state === 'committed');
        if (!committed) throw Error('SCHEMA');
        write(publicView.sheet, current < 0 ? publicView.sheet.getLastRow() + 1 : current + 2,
          [application.receipt, application.version, committed.id, 'committed', committed.admittedAt, JSON.stringify(application.draft)]);
      }
      return result(operation);
    }

    const old = histories.rows.find((row: any[]) => row[0] === application.receipt && row[1] === operation.version);
    if (old && (old[2] !== operation.id || old[4] !== JSON.stringify(operation.draft))) throw Error('SCHEMA');
    if (!old) write(histories.sheet, histories.sheet.getLastRow() + 1,
      [application.receipt, operation.version, operation.id, operation.admittedAt, JSON.stringify(operation.draft)]);
    const current = publicView.rows.findIndex((row: any[]) => row[0] === application.receipt);
    const rowNumber = current < 0 ? publicView.sheet.getLastRow() + 1 : current + 2;
    write(publicView.sheet, rowNumber,
      [application.receipt, operation.version, operation.id, 'pending', operation.admittedAt, JSON.stringify(operation.draft)]);
    application.version = operation.version;
    application.draft = copy(operation.draft);
    application.pending = null;
    operation.state = 'committed';
    write(auth.sheet, auth.sheet.getLastRow() + 1,
      [new Date().toISOString(), 'committed', application.receipt, JSON.stringify(application), JSON.stringify(operation)]);
    write(publicView.sheet, rowNumber,
      [application.receipt, operation.version, operation.id, 'committed', operation.admittedAt, JSON.stringify(operation.draft)]);
    return result(operation);
  } catch {
    return { ok: false, code: 'UNKNOWN' };
  } finally {
    lock.releaseLock();
  }
}

export function doPost(event: any) {
  let result;
  try {
    const body = event?.postData?.contents ?? '';
    result = body.length <= 26000 ? handleProduction(JSON.parse(body)) : { ok: false, code: 'INVALID' };
  } catch {
    result = { ok: false, code: 'INVALID' };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

export function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('そらふぇす 大会エントリー')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
