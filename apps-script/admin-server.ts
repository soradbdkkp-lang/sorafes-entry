import { committedEntries } from '../src/admin/data';
declare const PropertiesService: any, SpreadsheetApp: any, ContentService: any;
// 独立プロジェクト向け。既存保存スクリプトへ混在させない。
export function handleAdmin(raw: any) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('ADMIN_RELAY_SECRET');
  if (!secret || secret.length < 32 || raw?.secret !== secret || raw?.action !== 'entries') return { ok: false, code: 'DENIED' };
  try {
    const sheet = SpreadsheetApp.openById(props.getProperty('ADMIN_AUTH_ID')).getSheetByName('認証管理');
    const rows = sheet.getDataRange().getValues();
    if (JSON.stringify(rows.shift()) !== JSON.stringify(['記録日時UTC', '処理状態', '受付番号', '認証管理JSON', '操作JSON'])) throw Error('SCHEMA');
    return { ok: true, entries: committedEntries(rows) };
  } catch { return { ok: false, code: 'UNKNOWN' }; }
}
export function doPost(event: any) {
  let result;
  try { const body = event?.postData?.contents ?? ''; result = body.length <= 1024 ? handleAdmin(JSON.parse(body)) : { ok: false, code: 'INVALID' }; }
  catch { result = { ok: false, code: 'INVALID' }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
