const obj = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const str = (v: unknown) => typeof v === 'string' ? v : '';
const history = (v: unknown) => Object.fromEntries(['name', 'appearances', 'wins', 'runnersUp'].map(k => [k, str(obj(v)[k])]));
export const testReceipts = new Set(Array.from({ length: 5 }, (_, i) => `FAC-2026-${String(i + 1).padStart(6, '0')}`));
export function projectEntry(value: unknown) {
  const v = obj(value), d = obj(v.draft);
  if (!/^FAC-2026-\d{6}$/.test(v.receipt) || !Number.isSafeInteger(v.version) || v.version < 1 || v.status !== 'committed') throw Error('INVALID');
  return {
    receipt: v.receipt as string, version: v.version as number, status: 'committed' as const,
    submittedAt: str(v.submittedAt), updatedAt: str(v.updatedAt),
    kind: str(d.kind), teamName: str(d.teamName), time: str(d.time),
    representative: Number.isInteger(d.representative) ? d.representative as number : 0,
    players: (Array.isArray(d.players) ? d.players.slice(0, 6) : []).map((raw: unknown) => {
      const p = obj(raw);
      return { name: str(p.name), xId: str(p.xId), gameId: str(p.gameId), platform: str(p.platform), otherPlatform: str(p.otherPlatform), hours: str(p.hours),
        killer: p.killer === true, duty: str(p.duty), favorite: str(p.favorite), killers: Array.isArray(p.killers) ? p.killers.filter((k: unknown) => typeof k === 'string') as string[] : [],
        dif: str(p.dif), dck: str(p.dck), other: str(p.other), difDetails: history(p.difDetails), dckDetails: history(p.dckDetails), histories: Array.isArray(p.histories) ? p.histories.map(history) : [] };
    }),
  };
}
export type AdminEntry = ReturnType<typeof projectEntry>;
// 認証ログの操作IDごとの最終状態から、各応募の最大committed版を算出。
export function committedEntries(rows: unknown[][]): AdminEntry[] {
  const operations = new Map<string, any>();
  for (const row of rows) {
    const op = obj(JSON.parse(String(row[4])));
    if (typeof op.id !== 'string' || op.receipt !== row[2] || op.state !== row[1]) throw Error('SCHEMA');
    operations.set(op.id, op);
  }
  const latest = new Map<string, any>();
  const first = new Map<string, string>();
  for (const op of operations.values()) {
    if (op.state !== 'committed') continue;
    if (!first.has(op.receipt) || op.version === 1) first.set(op.receipt, str(op.admittedAt));
    if (!latest.has(op.receipt) || latest.get(op.receipt).version < op.version) latest.set(op.receipt, op);
  }
  return [...latest.values()].filter(op => !testReceipts.has(op.receipt)).map(op => projectEntry({ ...op, status: 'committed', submittedAt: first.get(op.receipt), updatedAt: op.admittedAt })).sort((a, b) => b.receipt.localeCompare(a.receipt));
}
export function matchesEntry(entry: AdminEntry, query: string) {
  const q = query.trim().toLocaleLowerCase().replace(/^@/, '');
  return [entry.receipt, entry.teamName, ...entry.players.flatMap(p => [p.name, p.xId])].some(s => s.toLocaleLowerCase().includes(q));
}
