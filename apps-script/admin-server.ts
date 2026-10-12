import { committedEntries } from '../src/admin/data';
declare const PropertiesService: any, Sheets: any, ContentService: any;
// 独立プロジェクト向け。既存保存スクリプトへ混在させない。
export function handleAdmin(raw: any) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('ADMIN_RELAY_SECRET');
  if (!secret || secret.length < 32 || raw?.secret !== secret || raw?.action !== 'entries') return { ok: false, code: 'DENIED' };
  try {
    const id = props.getProperty('ADMIN_AUTH_ID');
    if (!id) throw Error('CONFIG');
    // 認証検証値を含むD列と不要なA列は取得しない。readonly APIを1回だけ呼ぶ。
    const ranges = Sheets.Spreadsheets.Values.batchGet(id, {
      ranges: ["'認証管理'!B:C", "'認証管理'!E:E"], majorDimension: 'ROWS', valueRenderOption: 'UNFORMATTED_VALUE',
    }).valueRanges;
    if (!Array.isArray(ranges) || ranges.length !== 2) throw Error('SCHEMA');
    const states = ranges[0].values ?? [], operations = ranges[1].values ?? [];
    if (JSON.stringify(states[0]) !== JSON.stringify(['処理状態', '受付番号']) || JSON.stringify(operations[0]) !== JSON.stringify(['操作JSON']) || states.length !== operations.length) throw Error('SCHEMA');
    // 既存投影処理の列位置を保持。取得しない列は空値。
    const rows = states.slice(1).map((row: any[], index: number) => ['', row[0], row[1], '', operations[index + 1]?.[0]]);
    return { ok: true, entries: committedEntries(rows) };
  } catch { return { ok: false, code: 'UNKNOWN' }; }
}
export function doPost(event: any) {
  let result;
  try { const body = event?.postData?.contents ?? ''; result = body.length <= 1024 ? handleAdmin(JSON.parse(body)) : { ok: false, code: 'INVALID' }; }
  catch { result = { ok: false, code: 'INVALID' }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
