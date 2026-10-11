import { useEffect, useRef, useState } from 'react';
import type { Draft } from '../validation';
import { prepareDraft } from '../storage/prepare-draft';
import { duplicatesWithin } from '../phase5-duplicates';
import { sendAppsScriptProduction, sendProduction } from '../storage/production-client';

export type CompletionData = { receipt: string; editCode: string; recoveryId: string; updated: boolean };
type Props = { draft: Draft; ready: boolean; load: (draft: Draft) => void; block: (blocked: boolean) => void; googleMode?: boolean; phase5Mode?: boolean; productionPreview?: boolean; productionMode?: boolean; appsScriptMode?: boolean; complete?: (value: CompletionData) => void };
async function call(payload: Record<string, unknown>, googleMode = false, phase5Mode = false, productionMode = false, appsScriptMode = false): Promise<Record<string, unknown>> {
  if (productionMode) {
    const request = { ...payload, action: String(payload.action) };
    return appsScriptMode ? sendAppsScriptProduction(request) : sendProduction(request);
  }
  const response = await fetch(googleMode ? '/api/phase4-google' : phase5Mode ? '/api/phase5-local' : '/api/phase4-local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, testOnly: true }), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error('UNKNOWN');
  const result = await response.json();
  if (result.ok !== true && result.ok !== false) throw Error('UNKNOWN');
  return result;
}
export default function LocalEntry({ draft, ready, load, block, googleMode = false, phase5Mode = false, productionPreview = false, productionMode = false, appsScriptMode = false, complete }: Props) {
  const [code, setCode] = useState(''), [receipt, setReceipt] = useState(''), [recoveryId, setRecoveryId] = useState('');
  const [saved, setSaved] = useState(false), [message, setMessage] = useState(''), [deadline, setDeadline] = useState(''), [fault, setFault] = useState('');
  const [loaded, setLoaded] = useState<{ receipt: string; version: number } | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'unknown' | 'done'>('idle');
  const pending = useRef<Record<string, unknown> | null>(null), newId = useRef(''), busy = useRef(false);
  const productionUi = productionPreview || productionMode;
  const duplicateMode = phase5Mode || productionUi;
  const duplicatePairs = duplicateMode ? duplicatesWithin(draft) : [];
  useEffect(() => {
    let active = true;
    call({ action: 'settings' }, googleMode, duplicateMode, productionMode, appsScriptMode).then(r => {
      if (!active) return;
      if (r.ok) { setDeadline(String(r.deadline)); setMessage(previous => previous.includes('設定を確認できません') || previous.includes('サーバーに接続できません') ? '' : previous); }
      else { setDeadline(''); setMessage(r.code === 'CLOSED' ? productionMode ? '現在、応募受付は停止しています。' : '試験APIは停止中です。保存・編集はできません。' : `${productionMode ? '受付' : '試験'}設定を確認できません（${r.code}）。`); }
    }).catch(() => { if (active) { setDeadline(''); setMessage(`${productionMode ? '受付' : '試験保存'}サーバーに接続できません。`); } });
    return () => { active = false; };
  }, [googleMode, duplicateMode, productionMode, appsScriptMode]);
  const generate = () => {
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      setCode(Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{4}/g)!.join('-'));
      newId.current = crypto.randomUUID(); setRecoveryId(newId.current); setSaved(false); setLoaded(null); setReceipt(''); setState('idle');
    } catch { setMessage('安全なコードを生成できません。送信は行いません。'); }
  };
  const download = () => {
    const heading = productionMode ? 'そらふぇす大会エントリー保存票' : productionPreview ? '公開前ローカル確認・正式受付ではありません' : `${googleMode ? 'Google' : phase5Mode ? 'Phase 5ローカル' : 'ローカル'}試験専用・未受付の場合もあります`;
    const url = URL.createObjectURL(new Blob([`${heading}\n大会：${productionUi ? 'frog-assemble-2026' : 'frog-assemble-2026-test'}\n再確認ID：${recoveryId}\n受付番号：${receipt || '未受領'}\n編集コード：${code}\n`], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = productionMode ? 'sorafes-entry-receipt.txt' : productionPreview ? 'sorafes-entry-public-preview.txt' : googleMode ? 'sorafes-google-test-recovery.txt' : phase5Mode ? 'sorafes-phase5-local-recovery.txt' : 'sorafes-local-recovery.txt'; anchor.click(); URL.revokeObjectURL(url);
  };
  const run = async (payload: Record<string, unknown>, sending = false) => {
    if (busy.current) return;
    busy.current = true; setState('busy'); block(true); setMessage('確認中です。');
    try {
      const request = productionUi || googleMode ? payload : { ...payload, fault: sending ? fault : '' };
      const r = await call(request, googleMode, duplicateMode, productionMode, appsScriptMode);
      if (!r.ok) {
        if (sending && r.code === 'UNKNOWN') { setState('unknown'); setMessage('保存結果を確認できません。入力を変えず、同じ操作IDで保存結果を再確認してください。'); return; }
        setState('idle'); block(false); pending.current = null;
        setMessage(r.code === 'CLOSED' ? '現在、応募受付は停止しています。入力内容は保持されています。' : r.code === 'DENIED' ? '認証できませんでした。受付番号・編集コードを確認してください。' : duplicateMode && r.code === 'DUPLICATE' ? 'このプレイヤーはすでにエントリーされています。保存を保留しました。自分の既存応募なら受付番号と編集コードで読み込んで編集してください。' : duplicateMode && r.code === 'POSSIBLE_DUPLICATE' ? '重複の可能性があります。入力内容を確認してください。保存は保留しました。自分の既存応募なら受付番号と編集コードで読み込んで編集してください。本人でない場合は運営Xアカウントへご相談ください。' : duplicateMode && r.code === 'PENDING' ? '重複候補の保存処理が未確定です。処理の確認後に再試行してください。' : r.code === 'CONFLICT' ? 'ほかの更新が先に確定しています。応募を読み直してから修正してください。' : r.code === 'BUSY' ? '現在アクセスが集中しています。時間をおいて同じ内容で再試行してください。' : r.code === 'INVALID' ? '送信内容を確認できませんでした。入力内容を見直してください。' : r.code === 'CONFIG' ? '受付設定を確認できません。運営へご連絡ください。' : `操作を完了できませんでした（${r.code}）。`); return;
      }
      setReceipt(String(r.receipt));
      if (r.status === 'pending') { setState('idle'); block(false); setMessage('保存処理は途中です。元の画面で同じ操作を再送してください。再読み込み後の途中保存復旧は、この試作では未対応です。'); return; }
      if (payload.action === 'read') { load(r.draft as Draft); setLoaded({ receipt: String(r.receipt), version: Number(r.version) }); newId.current = crypto.randomUUID(); setRecoveryId(newId.current); setSaved(false); setState('idle'); setMessage('応募を読み込みました。今回の更新用の再確認IDを手元へ保存し、内容を修正してください。'); }
      else {
        setState(sending ? 'done' : 'idle'); setLoaded(null);
        if (productionMode && sending) complete?.({ receipt: String(r.receipt), editCode: code, recoveryId, updated: payload.action === 'update' });
        setMessage(productionMode ? `応募を${payload.action === 'update' ? '更新' : '受け付け'}ました。受付番号：${r.receipt}。受付番号を含む保存票をダウンロードし、大切に保管してください。` : `${productionPreview ? '公開前ローカル' : googleMode ? 'Google試験' : phase5Mode ? 'Phase 5ローカル試験' : 'ローカル'}保存確認：${r.receipt} / 版${r.version}。正式な受付ではありません。続けて編集する場合は応募を読み込んでください。`);
      }
      pending.current = null; block(false);
    } catch { setState(sending ? 'unknown' : 'idle'); block(sending); setMessage('保存結果を確認できません。入力を変えず、同じ操作IDで保存結果を再確認してください。'); }
    finally { busy.current = false; }
  };
  const submit = () => {
    if (!saved || !ready) return;
    if (duplicatePairs.length) { setMessage('同じフォーム内に重複候補があります。プレイヤー情報を確認してください。'); return; }
    if (!pending.current) {
      try {
        const id = newId.current;
        const clean = prepareDraft({ ...draft, players: draft.players.slice(0, draft.count) });
        setRecoveryId(id);
        pending.current = loaded
          ? { action: 'update', requestId: id, editCode: code, draft: clean, receipt: loaded.receipt, expectedVersion: loaded.version }
          : { action: 'create', requestId: id, editCode: code, draft: clean };
      } catch { setMessage('入力内容を確認してください。送信は行っていません。'); return; }
    }
    void run(pending.current, true);
  };
  const locked = state === 'busy' || state === 'unknown';
  return <section className="details" aria-label={productionUi ? '応募の受付・編集' : googleMode ? 'Phase 4 Google試験' : phase5Mode ? 'Phase 5ローカル試験' : 'Phase 4ローカル試験'}><h2>{productionUi ? '応募の受付・編集' : <>受付・編集の{googleMode ? 'Google' : phase5Mode ? 'Phase 5ローカル' : 'ローカル'}試験</>}</h2>
    <p>{productionMode ? '新規応募では編集コードを生成し、保存票を手元に保管してください。既存応募は受付番号と編集コードで読み込み、締切まで修正できます。' : productionPreview ? '公開時の受付・編集操作を確認するローカル画面です。このプレビューで保存しても正式な応募にはなりません。' : googleMode ? '架空データ専用。Googleの専用試験タブへ保存します。応募一覧はリンクを知っている全員が閲覧でき、試験データは削除しません。認証情報と履歴は別の非公開ファイルへ保存します。正式な応募受付ではありません。' : '架空データ専用。Googleへ送信しません。保存先はサーバーのメモリ内で、サーバー再起動で消えます。正式な応募受付ではありません。'}</p>
    <p className="hint">{productionUi ? '応募・編集締切' : '試験締切'}：{productionUi ? '2026年10月24日23:59（日本時間）' : deadline ? new Date(deadline).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + '（日本時間・技術試験用）' : '取得できていません'}{!productionUi && '。本番締切は2026年10月24日23:59（日本時間）です。'}</p>
    <fieldset disabled={locked}><legend>新規応募の準備／既存応募の認証</legend>
      <button className="secondary" type="button" onClick={generate}>{productionUi ? '新規応募用の編集コードを生成' : '新規試験用コードを生成'}</button>
      <label className="field"><span>編集コード</span><input autoComplete="off" value={code} onChange={e => { setCode(e.target.value); setLoaded(null); setSaved(false); }} /></label>
      <label className="field"><span>受付番号</span><input autoComplete="off" value={receipt} onChange={e => { setReceipt(e.target.value); setLoaded(null); }} placeholder={productionUi ? '応募保存成功後に表示' : '試験保存成功後に表示'} /></label>
      <label className="field"><span>再確認ID（保存票に記載）</span><input autoComplete="off" value={recoveryId} onChange={e => setRecoveryId(e.target.value)} /></label>
      <button className="secondary" type="button" disabled={!code} onClick={download}>保存票をダウンロード</button>
      <button className="secondary" type="button" disabled={!receipt || !code} onClick={() => { setLoaded(null); void run({ action: 'read', receipt, editCode: code }); }}>応募を読み込んで編集</button>
      <button className="secondary" type="button" disabled={!recoveryId || !code} onClick={() => { setLoaded(null); void run({ action: 'recover', requestId: recoveryId, editCode: code }); }}>IDとコードで保存結果を確認</button>
      <label className="check"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />{productionUi ? '編集コードと再確認IDを手元に保存し、応募情報が運営アカウント限定で保存され、修正前を含め削除されないことを確認しました。' : <>全員の情報が架空で、コードと再確認IDを手元に保存しました。{googleMode && '保存情報を削除しないこと・応募一覧のリンク閲覧も確認しました。'}</>}</label>
    </fieldset>
    {!googleMode && !productionUi && <label className="field"><span>失敗試験（ローカル専用）</span><select value={fault} disabled={state === 'busy'} onChange={e => setFault(e.target.value)}><option value="">正常</option><option value="auth">準備保存前に失敗</option><option value="history">履歴保存前に失敗</option><option value="shared">共有表示への反映前に失敗</option><option value="commit">確定記録前に失敗</option><option value="response">保存成功後に応答切断</option></select></label>}
    {ready && <button className="primary" type="button" disabled={!saved || !code || !recoveryId || !deadline || duplicatePairs.length > 0 || state === 'busy' || state === 'done'} onClick={submit}>{state === 'unknown' ? '同じ操作を再確認' : productionMode ? loaded ? '応募内容を更新' : '応募を送信' : productionPreview ? loaded ? '応募内容を更新（ローカル確認）' : '応募を送信（ローカル確認）' : loaded ? '試験応募を更新' : googleMode ? 'Googleへ試験応募' : 'ローカルへ試験応募'}</button>}
    <button className="secondary" type="button" disabled={locked} onClick={() => { setCode(''); setSaved(false); setLoaded(null); setReceipt(''); setRecoveryId(''); newId.current = ''; pending.current = null; setState('idle'); setMessage('画面内の認証情報を破棄しました。保存済み応募は削除していません。'); }}>編集・認証を終了</button>
    {message && <p role="status">{message}</p>}<p className="hint">{productionMode ? 'コードを紛失した場合は運営Xアカウントへ相談してください。自動再発行は行いません。' : productionPreview ? '公開前のローカル確認のため、この画面から実応募は送信されません。コード紛失時は運営Xアカウントへ相談してください。' : phase5Mode ? '重複チェックは架空データのローカル試験です。実応募の照合・紛失時の再発行には対応しません。' : '重複応募防止・紛失時の再発行は未実装です。'}結果不明の間は入力を変更できません。</p>
  </section>;
}
