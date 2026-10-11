import type { Draft } from '../validation';
import { prepareDraft } from './prepare-draft';

export const tournamentId = 'frog-assemble-2026-test';
export interface SaveRequest { version: 1; tournamentId: string; testOnly: true; requestId: string; draft: Draft }
export type SaveResult = { ok: true; requestId: string; savedId: string } | { ok: false; code: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';

// 公開入力は型を信頼せず、選択肢と人数も保存側で検証する。
export function prepareRequest(input: unknown): SaveRequest {
  if (!object(input) || input.version !== 1 || input.testOnly !== true || input.tournamentId !== tournamentId ||
    !str(input.requestId) || !/^[a-f0-9-]{36}$/.test(input.requestId) || !object(input.draft)) throw Error('INVALID');
  if (JSON.stringify(input).length > 24000) throw Error('TOO_LARGE');
  return { version: 1, tournamentId, testOnly: true, requestId: input.requestId, draft: prepareDraft(input.draft) };
}

export function makeRequest(draft: Draft, requestId: string): SaveRequest {
  return prepareRequest({ version: 1, tournamentId, testOnly: true, requestId, draft: { ...draft, players: draft.players.slice(0, draft.count) } });
}
