import type { Draft } from './validation';

type Candidate = Pick<Draft['players'][number], 'xId' | 'gameId'>;
type ActiveDraft = Pick<Draft, 'count' | 'players'>;

export interface DuplicatePair { first: number; second: number; xId: boolean; gameId: boolean }

// 比較用のみ。表示・保存するIDの原文は変更しない。
export const duplicateXKey = (value: string) => value.trim().replace(/^@/, '').replace(/[A-Z]/g, letter => letter.toLowerCase());
export const duplicateGameKey = (value: string) => value.trim();

function same(a: Candidate, b: Candidate) {
  const leftX = duplicateXKey(a.xId), rightX = duplicateXKey(b.xId);
  const leftGame = duplicateGameKey(a.gameId), rightGame = duplicateGameKey(b.gameId);
  return { xId: !!leftX && leftX === rightX, gameId: !!leftGame && leftGame === rightGame };
}

export function duplicatesWithin(draft: ActiveDraft): DuplicatePair[] {
  const result: DuplicatePair[] = [], players = draft.players.slice(0, draft.count);
  for (let first = 0; first < players.length; first++) {
    for (let second = first + 1; second < players.length; second++) {
      const match = same(players[first], players[second]);
      if (match.xId || match.gameId) result.push({ first, second, ...match });
    }
  }
  return result;
}

export function duplicateStrengthBetween(a: ActiveDraft, b: ActiveDraft): 0 | 1 | 2 {
  let strongest: 0 | 1 = 0;
  for (const left of a.players.slice(0, a.count)) {
    for (const right of b.players.slice(0, b.count)) {
      const match = same(left, right);
      if (match.xId && match.gameId) return 2;
      if (match.xId || match.gameId) strongest = 1;
    }
  }
  return strongest;
}

export const duplicatesBetween = (a: ActiveDraft, b: ActiveDraft) => duplicateStrengthBetween(a, b) > 0;
