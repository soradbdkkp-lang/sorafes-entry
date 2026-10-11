import { reviewData, type Draft } from '../validation';
import type { History, TournamentConfig } from '../model';

const countLabel = (v: string) => v === 'unknown' ? '不明' : `${v}回`;
function HistorySummary({ label, value }: { label: string; value: History | undefined }) {
  return <p>{label}：{value ? `出場 ${countLabel(value.appearances)} / 優勝 ${countLabel(value.wins)} / 準優勝 ${countLabel(value.runnersUp)}` : '経験なし'}</p>;
}
export default function Review({ draft, config, edit, killerName, production = false }: {
  draft: Draft; config: TournamentConfig; edit: (step: number) => void; killerName: (id: string) => string; production?: boolean;
}) {
  const data = reviewData(draft, config);
  return <>
    <div className="details"><h3>応募・チーム情報</h3><p>{config.entries.find(e => e.id === data.kind)?.label} / {data.count}名</p>{data.teamName && <p>チーム名：{data.teamName}</p>}<p>代表者：プレイヤー{data.representative + 1} / {data.players[data.representative]?.name}</p><button className="secondary" onClick={() => edit(1)}>応募形式を修正</button> <button className="secondary" onClick={() => edit(2)}>応募・チーム情報を修正</button></div>
    {data.players.map((p, i) => <article className="player-card" key={i}><h3>プレイヤー{i + 1} / {p.name}{i === data.representative && <span className="badge">代表者</span>}</h3><dl className="overview"><div><dt>X ID</dt><dd>@{p.xId}</dd></div><div><dt>プレイ環境</dt><dd>{p.platform}{p.otherPlatform && `：${p.otherPlatform}`}</dd></div><div><dt>ゲーム内ID</dt><dd>{p.gameId}</dd></div><div><dt>総プレイ時間</dt><dd>{p.hours}時間</dd></div><div><dt>担当ロール</dt><dd>{p.role}</dd></div></dl><button className="secondary" onClick={() => edit(3)}>プレイヤー情報を修正</button>
      {p.killer && <div className="details"><p>使用可能キラー：{p.killer.available.map(killerName).join('、')}</p><p>最も得意：{killerName(p.killer.favorite)}</p></div>}<button className="secondary" onClick={() => edit(4)}>担当ロールを修正</button>
      {p.histories && <div className="details"><HistorySummary label="DIF" value={p.histories.difDetails} /><HistorySummary label="DCK" value={p.histories.dckDetails} />{p.histories.other === 'no' ? <p>その他大会：経験なし</p> : p.histories.otherDetails?.map((h, n) => <HistorySummary key={n} label={`その他大会 / ${h.name}`} value={h} />)}<button className="secondary" onClick={() => edit(5)}>大会実績を修正</button></div>}
    </article>)}
    <div className="details"><h3>参加可能時間</h3><p>{data.time}</p><p>応募チーム・対戦方式によっては試合開始が16:00になる場合があります。</p><button className="secondary" onClick={() => edit(6)}>参加可能時間を修正</button></div>
    <p className="notice">{production ? '内容を確認し、編集コードと再確認IDを手元に保存してから「応募を送信」を押してください。' : '内容を確認し、下の試験保存へ進んでください。正式な応募受付は行いません。'}</p>
  </>;
}
