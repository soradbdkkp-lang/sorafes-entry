import type { Draft } from '../validation';

export const normalDeadline = Date.parse('2026-10-24T14:59:00.000Z');
export const additionalStart = Date.parse('2026-10-24T15:00:00.000Z');
export const additionalDeadline = Date.parse('2026-10-25T10:24:58.000Z');
export const entryDeadlineNotice = '応募受付は終了しました。予定人数に達したため、サバイバー追加募集も締め切りました。';

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
