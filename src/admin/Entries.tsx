import { useEffect, useState } from 'react';
import { loadEntries } from './client';
import { matchesEntry, type AdminEntry } from './data';
import { tournament } from '../config/tournament';
import { killerCatalog } from '../config/killers';
import './admin.css';
const text = (v: string | number | undefined) => v === '' || v === undefined ? '未記録' : v;
const date = (v: string) => Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(v)) + ' JST' : '未記録';
const killer = (id: string) => killerCatalog.items.find(k => k.id === id)?.name ?? text(id);
const experience = (v: string) => v === 'yes' ? 'あり' : v === 'no' ? 'なし' : '未記録';
function Facts({ values }: { values: [string, string | number | undefined][] }) {
  return <dl className="admin-facts">{values.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{text(v)}</dd></div>)}</dl>;
}
export function EntryDetails({ entry: e }: { entry: AdminEntry }) {
  return <section aria-label={`${e.receipt}の詳細`}><h3>基本情報</h3><Facts values={[
    ['応募ID', e.receipt], ['応募日時', date(e.submittedAt)], ['最終更新日時', date(e.updatedAt)], ['応募形式', tournament.entries.find(k => k.id === e.kind)?.label ?? '未記録'], ['現在版', e.version], ['チーム名', e.teamName], ['代表者', e.players[e.representative]?.name], ['参加可能時間', e.time], ['状態', '確定済み（committed）'],
  ]} />{e.players.map((p, i) => <article className="admin-member" key={i}><h3>メンバー{i + 1}：{text(p.name)}{i === e.representative ? '（代表者）' : ''}</h3><Facts values={[
    ['プレイヤー名', p.name], ['X ID', p.xId ? `@${p.xId}` : ''], ['ゲーム内ID（Steam / PlayStation / Switch等）', p.gameId], ['プラットフォーム', [p.platform, p.otherPlatform].filter(Boolean).join(' / ')], ['担当ロール', p.killer ? (p.duty === 'both' ? 'キラー・サバイバー兼任' : p.duty === 'dedicated' ? 'キラー専任' : 'キラー担当可能') : 'サバイバー'], ['総プレイ時間', p.hours ? `${p.hours}時間` : ''],
    ['DIF大会経験', experience(p.dif)], ['DCK大会経験', experience(p.dck)], ['その他大会経験', experience(p.other)],
  ]} />{p.killer && <Facts values={ [['キラー兼任可否', p.duty === 'both' ? '兼任可' : p.duty === 'dedicated' ? '専任' : '未記録'], ['使用可能キラー', p.killers.map(killer).join('、')], ['最得意キラー', killer(p.favorite)]]} />}
    {[...(p.dif === 'yes' ? [{ ...p.difDetails, name: 'DIF' }] : []), ...(p.dck === 'yes' ? [{ ...p.dckDetails, name: 'DCK' }] : []), ...(p.other === 'yes' ? p.histories : [])].map((h, n) => <div key={n}><h4>{text(h.name)} 大会実績</h4><Facts values={ [['出場回数', h.appearances], ['優勝回数', h.wins], ['準優勝回数', h.runnersUp]]} /></div>)}
  </article>)}</section>;
}
export default function Entries() {
  const [entries, setEntries] = useState<AdminEntry[]>([]), [query, setQuery] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(''); setEntries([]); void loadEntries().then(v => { if (active) setEntries(v); }).catch(() => { if (active) setError('応募を取得できませんでした。運営認証・接続設定を確認してください。'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [attempt]);
  const filtered = entries.filter(e => matchesEntry(e, query));
  return <main className="admin-page"><h1>運営専用 応募管理</h1><p>読み取り専用・最新確定応募のみ。試験応募5件を除外しています。</p><button onClick={() => setAttempt(a => a + 1)} disabled={loading}>再取得</button><label className="admin-search">応募ID・プレイヤー名・X ID・チーム名で検索<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
    {loading && <p role="status">読み込み中…</p>}{error && <p role="alert">{error}</p>}{!loading && !error && <p role="status">{filtered.length}件{filtered.length === 0 ? '：該当する応募はありません。' : ''}</p>}
    {filtered.map(e => <article className="admin-card" key={e.receipt}><h2>{e.receipt}</h2><p>{tournament.entries.find(k => k.id === e.kind)?.label ?? '応募形式未記録'} / {e.players.length}名</p>{e.teamName && <h3>{e.teamName}</h3>}<Facts values={ [['代表者／応募者', e.players[e.representative]?.name], ['代表者X ID', e.players[e.representative]?.xId ? `@${e.players[e.representative].xId}` : ''], ['応募日時', date(e.submittedAt)], ['状態', '確定済み（committed）']]}/><details><summary>詳細を見る</summary><EntryDetails entry={e} /></details></article>)}
  </main>;
}
