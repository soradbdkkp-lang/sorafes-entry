import { prepareRequest, type SaveResult } from '../src/storage/contract';
declare const PropertiesService: any;
declare const ContentService: any;
declare const LockService: any;
declare const SpreadsheetApp: any;
declare const Utilities: any;
const headers = ['試験保存ID', '保存日時UTC', '再送識別ID', '大会ID', '応募形式', '人数', '応募原本JSON'];
const sheetId = '1FU3cimJuHg5JGmJvVJpc-U0VNc4zTP5nB-DwiyW8VXE';
const sheetName = 'sorafes-entry_TEST_v1';

export function saveTestEntry(raw: unknown): SaveResult {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('TEST_ENABLED') !== 'true') return { ok: false, code: 'CLOSED' };
  const key = props.getProperty('TEST_KEY');
  if (!key || !raw || typeof raw !== 'object' || (raw as { testKey?: unknown }).testKey !== key) return { ok: false, code: 'DENIED' };
  let request;
  try { request = prepareRequest(raw); } catch { return { ok: false, code: 'INVALID' }; }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'BUSY' };
  try {
    const book = SpreadsheetApp.openById(sheetId);
    let sheet = book.getSheetByName(sheetName);
    if (!sheet) {
      sheet = book.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
    const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (JSON.stringify(actual) !== JSON.stringify(headers)) return { ok: false, code: 'SCHEMA' };
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues() : [];
    const canonical = JSON.stringify(request.draft);
    const existing = rows.find((row: unknown[]) => row[2] === request.requestId);
    if (existing) return existing[6] === canonical ? { ok: true, requestId: request.requestId, savedId: existing[0] } : { ok: false, code: 'CONFLICT' };
    const savedId = 'TEST-' + Utilities.getUuid();
    // 自由入力はJSONセルに収める。先頭が { なので数式として解釈されない。
    const row = [savedId, new Date().toISOString(), request.requestId, request.tournamentId, request.draft.kind, request.draft.count, canonical];
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
    SpreadsheetApp.flush();
    return { ok: true, requestId: request.requestId, savedId };
  } catch { return { ok: false, code: 'UNKNOWN' }; }
  finally { lock.releaseLock(); }
}

export function doPost(event: { postData?: { contents?: string } }) {
  let result: SaveResult;
  try {
    const text = event.postData?.contents ?? '';
    result = text.length <= 26000 ? saveTestEntry(JSON.parse(text)) : { ok: false, code: 'INVALID' };
  } catch { result = { ok: false, code: 'INVALID' }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
