import type { History, Experience } from '../model';

export function TextField({ label, value, onChange, hint, type = 'text' }: {
  label: string; value: string; onChange: (value: string) => void; hint?: string; type?: string;
}) {
  return <label className="field"><span>{label} <small>必須</small></span><input type={type} step={type === 'number' ? 'any' : undefined} value={value} onChange={e => onChange(e.target.value)} />{hint && <span className="hint">{hint}</span>}</label>;
}

export function ExperienceField({ label, value, onChange }: { label: string; value: Experience; onChange: (v: Experience) => void }) {
  return <label className="field"><span>{label}の経験 <small>必須</small></span><select value={value} onChange={e => onChange(e.target.value as Experience)}><option value="">選択してください</option><option value="no">なし</option><option value="yes">あり</option></select></label>;
}

export function HistoryFields({ value, onChange, named = false }: { value: History; onChange: (v: History) => void; named?: boolean }) {
  return <div className="details">{named && <TextField label="大会名" value={value.name} onChange={name => onChange({ ...value, name })} />}
    <div className="grid">{([['appearances', '出場回数'], ['wins', '優勝回数'], ['runnersUp', '準優勝回数']] as const).map(([key, label]) => <div key={key}>
      <label className="field"><span>{label} <small>必須</small></span><input aria-label={label} type="number" disabled={value[key] === 'unknown'} value={value[key] === 'unknown' ? '' : value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={value[key] === 'unknown'} onChange={e => onChange({ ...value, [key]: e.target.checked ? 'unknown' : '' })} />不明</label>
    </div>)}</div></div>;
}
