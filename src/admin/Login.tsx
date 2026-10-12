import { useState, type FormEvent } from 'react';
import './admin.css';
export default function Login() {
  const [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const submitted = password; setPassword('');
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: submitted }) });
      if (res.status === 429) throw Error('試行回数の上限です。1分ほど待って再試行してください。');
      if (!res.ok || (await res.json()).ok !== true) throw Error('ログインできませんでした。パスワードまたは管理設定を確認してください。');
      location.replace('/admin/entries');
    } catch (e) { setError(e instanceof Error ? e.message : 'ログインできませんでした。'); }
    finally { setBusy(false); }
  }
  return <main className="admin-page"><h1>運営ログイン</h1><p>運営者専用です。ログインは1時間で期限切れになります。</p><form onSubmit={login} className="admin-card"><label className="admin-search">管理用パスワード<input type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label><button type="submit" disabled={busy}>{busy ? '確認中…' : 'ログイン'}</button>{error && <p role="alert">{error}</p>}</form></main>;
}
