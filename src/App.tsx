import { useEffect, useRef, useState } from 'react';
import { tournament as config } from './config/tournament';
import { killerCatalog } from './config/killers';
import { newHistory, newPlayer, type EntryKind, type Player } from './model';
import { ExperienceField, HistoryFields, TextField } from './components/Fields';
import Review from './components/Review';
import { validate, type Issue } from './validation';
import { makeRequest, type SaveRequest } from './storage/contract';
import { sendTestEntry } from './storage/client';
import LocalEntry from './components/LocalEntry';
import Completion from './components/Completion';
import type { CompletionData } from './components/LocalEntry';
import type { Draft } from './validation';
import { duplicatesWithin } from './phase5-duplicates';

const steps = ['参加前確認', '応募形式', '応募・チーム情報', 'プレイヤー情報', '担当ロール', '大会実績', '参加可能時間', '入力内容確認'];

export default function App({ localMode = false, googleMode = false, phase5Mode = false, productionPreview = false, productionMode = false, appsScriptMode = false }: { localMode?: boolean; googleMode?: boolean; phase5Mode?: boolean; productionPreview?: boolean; productionMode?: boolean; appsScriptMode?: boolean }) {
  const [localBlocked, setLocalBlocked] = useState(false);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<EntryKind>('solo');
  const [count, setCount] = useState(1);
  const [teamName, setTeamName] = useState('');
  const [representative, setRepresentative] = useState(0);
  // 人数を減らしても入力を一時保持する。有効な人数分だけを試験送信する。
  const [players, setPlayers] = useState<Player[]>(() => Array.from({ length: 6 }, newPlayer));
  const [time, setTime] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [editing, setEditing] = useState(false);
  const [testConsent, setTestConsent] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'unknown' | 'failed' | 'saved'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const pendingRequest = useRef<SaveRequest | null>(null);
  const inFlight = useRef(false);
  const errorHeading = useRef<HTMLHeadingElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const update = (index: number, patch: Partial<Player>) => setPlayers(previous => previous.map((p, i) => i === index ? { ...p, ...patch } : p));
  const resize = (n: number) => { setCount(n); if (representative >= n) setRepresentative(0); };
  const activePlayers = players.slice(0, count);
  const entry = config.entries.find(e => e.id === kind)!;
  const isKiller = (p: Player) => config.killerQuestionsEnabled && kind !== 'survivors' && (kind === 'killer' || p.killer);
  const draft = { kind, count, teamName, representative, players, time };
  const productionUi = productionPreview || productionMode;
  const duplicatePairs = phase5Mode || productionUi ? duplicatesWithin(draft) : [];
  const report = (errors: Issue[]) => { setIssues(errors); requestAnimationFrame(() => errorHeading.current?.focus()); };
  const go = (target: number) => {
    if (localBlocked) return;
    if (saveState === 'saving' || saveState === 'unknown') return;
    if (target !== 7 && saveState === 'saved') { setSaveState('idle'); setSaveMessage(''); }
    const errors = validate(draft, config);
    if (target === 7 && errors.length) { report(errors); return; }
    if (target > step && target !== 7) {
      const currentErrors = errors.filter(e => e.step === step);
      if (currentErrors.length) { report(currentErrors); return; }
    }
    setIssues([]); setStep(target); if (target === 7) setEditing(false);
  };
  const edit = (target: number) => { if (localBlocked || saveState === 'saving' || saveState === 'unknown') return; setSaveState('idle'); setSaveMessage(''); setEditing(true); setIssues([]); setStep(target); };
  const loadLocal = (value: Draft) => {
    setKind(value.kind); setCount(value.count); setTeamName(value.teamName); setRepresentative(value.representative); setTime(value.time);
    setPlayers([...value.players, ...Array.from({ length: 6 - value.players.length }, newPlayer)]); setIssues([]); setEditing(true); setStep(7);
  };
  const save = async () => {
    if (!testConsent || inFlight.current || saveState === 'saved') return;
    const errors = validate(draft, config);
    if (errors.length) { report(errors); return; }
    let candidate: SaveRequest;
    try { candidate = makeRequest(draft, pendingRequest.current?.requestId ?? crypto.randomUUID()); }
    catch { setSaveState('failed'); setSaveMessage('試験送信の形式または容量上限を確認してください。送信は行っていません。'); return; }
    if (pendingRequest.current && JSON.stringify(candidate.draft) !== JSON.stringify(pendingRequest.current.draft)) candidate.requestId = crypto.randomUUID();
    pendingRequest.current = candidate;
    inFlight.current = true;
    setSaveState('saving'); setSaveMessage('試験保存中です。');
    try {
      const result = await sendTestEntry(candidate);
      if (result.ok) { setSaveState('saved'); setSaveMessage(`架空データの試験保存を確認しました。保存ID：${result.savedId}。正式な応募受付ではありません。`); }
      else if (result.code === 'UNKNOWN' || result.code === 'CONFLICT') { setSaveState('unknown'); setSaveMessage('保存結果を確認できません。入力を変更せず、同じ内容で再確認してください。'); }
      else { setSaveState('failed'); setSaveMessage(result.code === 'NOT_CONFIGURED' ? 'Google側の設定がまだ完了していません。保存は行われていません。' : `試験保存を完了できませんでした（${result.code}）。入力は保持されています。`); }
    } catch { setSaveState('unknown'); setSaveMessage('保存結果を確認できません。入力を変更せず、同じ内容で再確認してください。'); }
    finally { inFlight.current = false; }
  };

  if (completion) return <>
    <header className="site-header"><div><strong>{config.brand}</strong><span>大会エントリー</span></div><span className="badge">受付完了</span></header>
    <main><div className="intro"><p className="eyebrow">ENTRY / {config.date}</p><h1>{config.name}</h1></div><Completion value={completion} /></main>
    <footer>{config.brand} / sorafes-entry · 大会エントリー</footer>
  </>;

  return <>
    <header className="site-header"><div><strong>{config.brand}</strong><span>大会エントリー</span></div><span className="badge">{productionMode ? '大会エントリー' : productionPreview ? '公開前確認' : 'UIプレビュー'}</span></header>
    <main>
      <div className="intro"><p className="eyebrow">ENTRY / {config.date}</p><h1>{config.name}</h1><p>参加する仲間の情報を、順番に入力してください。</p></div>
      <aside className="notice">{productionMode ? '入力内容を確認して応募してください。保存後に表示される受付番号・編集コード・再確認IDは、応募内容の確認や修正に必要です。' : productionPreview ? '公開時の文言と操作を確認するローカルプレビューです。Googleへ送信せず、入力した内容はサーバー再起動で消えます。実応募はまだ受け付けていません。' : localMode ? phase5Mode ? "Phase 5の重複チェックを架空データだけで試す画面です。Googleへ送信せず、保存先はサーバーのメモリ内です。本番受付ではありません。" : googleMode ? "Phase 4のGoogle試験です。架空データのみ使用してください。応募一覧はリンク閲覧可能で、保存情報は削除しません。本番受付ではありません。" : "Phase 4のローカル試験です。Googleへ送信しません。本番受付ではありません。" : <>架空データ専用の試験フォームです。設定完了後、「架空データを試験保存」で指定スプレッドシートへ保存します。保存情報は削除せず、リンクを知っている全員が閲覧できます。未送信の入力は再読み込みで消えます。本番応募は受け付けていません。</>}</aside>
      <div className="layout"><nav aria-label="入力の進捗"><ol className="steps">{steps.map((label, i) => <li key={label}><button type="button" aria-current={step === i ? 'step' : undefined} onClick={() => go(i)}><span className="number">{i + 1}</span>{label}</button></li>)}</ol></nav>
      <section className="form-panel"><p className="eyebrow">STEP {step + 1} / {steps.length}</p><h2 tabIndex={-1} ref={heading}>{steps[step]}</h2>
      {issues.length > 0 && <div className="error-panel" role="alert"><h3 tabIndex={-1} ref={errorHeading}>入力内容を確認してください</h3><ul>{issues.map((issue, i) => <li key={i}><button className="error-link" onClick={() => { setStep(issue.step); setIssues(issues.filter(e => e.step === issue.step)); }}>{issue.message}</button></li>)}</ul></div>}
      {step === 7 && <Review draft={draft} config={config} edit={edit} killerName={id => killerCatalog.items.find(k => k.id === id)?.name ?? id} production={productionMode} />}
      {localMode && <LocalEntry draft={draft} ready={step === 7} load={loadLocal} block={setLocalBlocked} googleMode={googleMode} phase5Mode={phase5Mode} productionPreview={productionPreview} productionMode={productionMode} appsScriptMode={appsScriptMode} complete={setCompletion} />}
      {!localMode && step === 7 && <div className="details"><h3>架空データの保存試験</h3><label className="check"><input type="checkbox" checked={testConsent} disabled={saveState === 'saving' || saveState === 'unknown'} onChange={e => setTestConsent(e.target.checked)} />全員の情報が架空データであり、保存情報を削除しないこと・リンク閲覧を確認しました。</label><button type="button" className="primary" disabled={!testConsent || saveState === 'saving' || saveState === 'saved'} onClick={save}>{saveState === 'saving' ? '試験保存中…' : saveState === 'unknown' ? '同じ内容で保存結果を再確認' : '架空データを試験保存'}</button>{saveMessage && <p role="status">{saveMessage}</p>}<p className="hint">結果不明の場合は画面を閉じず再確認してください。再読み込み後の復旧は未対応です。受付番号・編集コードは発行しません。</p></div>}
      {step === 0 && <><dl className="overview"><div><dt>開催日</dt><dd>{config.date}</dd></div><div><dt>開始時刻</dt><dd>未定（最早16:00開始の案）</dd></div><div><dt>応募締切</dt><dd>{config.deadline}</dd></div><div><dt>基本定員</dt><dd>{config.capacity}</dd></div></dl><div className="details"><h3>参加前の確認要項</h3><p>応募多数の場合は抽選</p><p>全員のXアカウントは応募時点で作成から3か月以上経過している必要があります。</p><p>当選者には代表者のXアカウントのDMへ、大会Discordサーバーの招待URLを送付します。</p>{productionUi ? <><p>応募情報は運営限定の履歴へ残し、そらふぇすが運営する大会でのみ使用されます。</p><p>編集コードは本番応募一覧や履歴へ保存しません。コードを紛失した場合は <a href="https://x.com/sora_kkp_game" target="_blank" rel="noreferrer">運営Xアカウント</a>へご相談ください。</p><p className="hint">Discord ID、メールアドレス、電話番号、本名、住所など、フォームで求めていない情報は入力しないでください。</p></> : <p className="hint">正式な注意事項は準備中です。</p>}</div></>}
      {step === 1 && <fieldset><legend>応募形式を選択</legend><div className="choices">{config.entries.map(e => <label className={`choice ${kind === e.id ? 'selected' : ''}`} key={e.id}><input type="radio" name="entry" checked={kind === e.id} onChange={() => { setKind(e.id); resize(e.count); }} /><span><strong>{e.label}</strong><span className="hint">{e.note}</span></span></label>)}</div></fieldset>}
      {step === 2 && <><p>{entry.label} · {count}名</p>{kind === 'team' && <><label className="field"><span>チーム人数 <small>必須</small></span><select value={count} onChange={e => resize(Number(e.target.value))}>{[4, 5, 6].map(n => <option key={n} value={n}>{n}名</option>)}</select></label><TextField label="チーム名" value={teamName} onChange={setTeamName} /></>}{count === 1 ? <p className="details">本人を連絡代表者として扱います。</p> : <label className="field"><span>連絡代表者 <small>必須</small></span><select value={representative} onChange={e => setRepresentative(Number(e.target.value))}>{activePlayers.map((p, i) => <option key={i} value={i}>プレイヤー{i + 1}{p.name && `：${p.name}`}</option>)}</select><span className="hint">代表者のXアカウントに当選連絡を送ります。</span></label>}</>}
      {[3, 4, 5].includes(step) && activePlayers.map((p, i) => <article className="player-card" key={i}><h3>プレイヤー{i + 1}{p.name && ` / ${p.name}`} {i === representative && <span className="badge">代表者</span>}</h3>
        {step === 3 && <><div className="grid"><TextField label="プレイヤー名" value={p.name} onChange={name => update(i, { name })} /><TextField label="X（Twitter）ID" value={p.xId} onChange={xId => update(i, { xId })} hint="応募時点で作成から3か月以上のアカウント" /></div><label className="field"><span>プレイ環境 <small>必須</small></span><select value={p.platform} onChange={e => update(i, { platform: e.target.value })}><option value="">選択してください</option>{config.platforms.map(v => <option key={v}>{v}</option>)}</select></label>{p.platform === 'その他' && <TextField label="具体的なプレイ環境" value={p.otherPlatform} onChange={otherPlatform => update(i, { otherPlatform })} />}<TextField label="ゲーム内ID" value={p.gameId} onChange={gameId => update(i, { gameId })} hint="#以降も含めて入力してください。" /><TextField label="Dead by Daylight総プレイ時間（時間）" type="number" value={p.hours} onChange={hours => update(i, { hours })} hint="複数プラットフォームの合計のおおよその時間で構いません。" /></>}
        {step === 4 && <>{kind === 'survivors' ? <p>サバイバー担当（この応募形式では固定）</p> : <>{kind === 'killer' ? <p>キラー担当（この応募形式では必須）</p> : <label className="field"><span>担当可能ロール <small>必須</small></span><select value={p.killer ? 'killer' : 'survivor'} onChange={e => update(i, { killer: e.target.value === 'killer' })}><option value="survivor">サバイバー</option><option value="killer">キラー担当可能</option></select></label>}{isKiller(p) && <div className="details"><label className="field"><span>キラー担当について <small>必須</small></span><select value={p.duty} onChange={e => update(i, { duty: e.target.value as Player['duty'] })}><option value="">選択してください</option><option value="dedicated">キラー専任</option><option value="both">サバイバーとの兼任可能</option></select></label><fieldset><legend>大会で使用可能なキラー（1体以上・複数可）</legend><p className="hint">大会で実際に出せる程度に使用できるキラー。スカルマーチャントを除く大会指定の43体から選んでください。</p><div className="killer-options">{killerCatalog.items.map(k => <label className="check" key={k.id}><input type="checkbox" checked={p.killers.includes(k.id)} onChange={e => { const killers = e.target.checked ? [...p.killers, k.id] : p.killers.filter(id => id !== k.id); update(i, { killers, favorite: killers.includes(p.favorite) ? p.favorite : '' }); }} />{k.name}</label>)}</div></fieldset><label className="field"><span>最も得意なキラー <small>必須</small></span><select value={p.favorite} onChange={e => update(i, { favorite: e.target.value })}><option value="">選択してください</option>{killerCatalog.items.filter(k => p.killers.includes(k.id)).map(k => <option value={k.id} key={k.id}>{k.name}</option>)}</select></label></div>}</>}</>}
        {step === 5 && config.historiesEnabled && <>{(['dif', 'dck'] as const).map(key => <div className="history" key={key}><ExperienceField label={key.toUpperCase()} value={p[key]} onChange={v => update(i, { [key]: v })} />{p[key] === 'yes' && <HistoryFields value={key === 'dif' ? p.difDetails : p.dckDetails} onChange={v => update(i, key === 'dif' ? { difDetails: v } : { dckDetails: v })} />}</div>)}<ExperienceField label="その他大会" value={p.other} onChange={other => update(i, { other })} />{p.other === 'yes' && <>{p.histories.map((h, n) => <div className="history" key={n}><h4>その他大会 {n + 1}</h4><HistoryFields named value={h} onChange={v => update(i, { histories: p.histories.map((item, j) => j === n ? v : item) })} />{p.histories.length > 1 && <button type="button" className="secondary" onClick={() => update(i, { histories: p.histories.filter((_, j) => j !== n) })}>この大会の入力を取り除く</button>}</div>)}<button className="secondary" type="button" onClick={() => update(i, { histories: [...p.histories, newHistory()] })}>＋ その他大会を追加</button></>}</>}
      </article>)}
      {(phase5Mode || productionUi) && step === 3 && duplicatePairs.length > 0 && <div className="notice" role="status"><strong>同じフォーム内に重複候補があります。</strong><ul>{duplicatePairs.map(pair => <li key={`${pair.first}-${pair.second}`}>プレイヤー{pair.first + 1}とプレイヤー{pair.second + 1}の{pair.xId && pair.gameId ? 'X IDとゲーム内ID' : pair.xId ? 'X ID' : 'ゲーム内ID'}を確認してください。</li>)}</ul></div>}
      {step === 4 && kind === 'team' && <p className="notice">キラー担当可能者が1名以上必要です。現在の選択：{activePlayers.filter(isKiller).length}名。人数の追加上限はありません。</p>}
      {step === 6 && <><p>メンバー全員の予定を確認して回答してください。</p><p className="notice">応募チーム・対戦方式によっては試合開始が16:00になる場合があります。18:00以降の希望は開始時刻を保証するものではありません。</p><fieldset><legend>参加可能時間（必須）</legend><div className="choices">{config.availability.map(v => <label key={v} className={`choice ${time === v ? 'selected' : ''}`}><input type="radio" name="time" checked={time === v} onChange={() => setTime(v)} />{v}</label>)}</div></fieldset></>}
      <div className="actions"><button type="button" className="secondary" disabled={step === 0} onClick={() => go(step - 1)}>戻る</button>{step < 7 && <button type="button" className="primary" onClick={() => go(editing ? 7 : step + 1)}>{editing || step === 6 ? '確認画面へ' : '次へ'} <span aria-hidden="true">→</span></button>}</div>
      </section></div>
    </main><footer>{config.brand} / sorafes-entry · {productionMode ? '大会エントリー' : productionPreview ? '公開前確認' : 'フォームUIプレビュー'}</footer>
  </>;
}
