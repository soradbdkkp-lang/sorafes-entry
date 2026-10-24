import type { Draft } from '../validation';

export const normalDeadline = Date.parse('2026-10-24T14:59:00.000Z');
export const additionalStart = Date.parse('2026-10-24T15:00:00.000Z');
export const additionalDeadline = Date.parse('2026-10-25T14:59:00.000Z');
export const entryDeadlineNotice = '通常応募・編集：2026年10月24日23:59／追加募集（1人・2人のサバイバー新規応募のみ）：10月25日23:59（日本時間）。追加募集の応募は編集できません。';

export function entryWindow(now: number) {
  if (now < normalDeadline) return 'normal';
  if (now >= additionalStart && now < additionalDeadline) return 'additional';
  return 'closed';
}

export function acceptsNewEntry(draft: Draft, now: number) {
  const window = entryWindow(now);
  return window === 'normal' || (window === 'additional' &&
    ((draft.kind === 'solo' && draft.count === 1) || (draft.kind === 'duo' && draft.count === 2)) &&
    draft.players.slice(0, draft.count).every(player => !player.killer));
}
