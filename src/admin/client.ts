import { projectEntry, testReceipts, type AdminEntry } from './data';
export async function loadEntries(fetchImpl: typeof fetch = fetch): Promise<AdminEntry[]> {
  const res = await fetchImpl('/api/admin/entries', { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  if (!res.ok) throw Error(res.status === 403 ? '運営認証が必要です。' : '応募を取得できませんでした。');
  const data = await res.json();
  if (data.ok !== true || !Array.isArray(data.entries)) throw Error('応募を取得できませんでした。');
  return data.entries.map((e: unknown) => { const v = e as Record<string, unknown>; return projectEntry({ ...v, draft: v }); }).filter((e: AdminEntry) => !testReceipts.has(e.receipt));
}
