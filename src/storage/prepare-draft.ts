import { newHistory, newPlayer, type History } from '../model';
import { tournament } from '../config/tournament';
import { killerCatalog } from '../config/killers';
import { killerEnabled, validate, type Draft } from '../validation';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string';
const history = (value: unknown): value is History => object(value) && ['name', 'appearances', 'wins', 'runnersUp'].every(key => string(value[key]));

// 試験・本番で共通の保存対象を作る。通信モードや大会IDの検証は各契約側で行う。
export function prepareDraft(input: unknown): Draft {
  if (!object(input) || JSON.stringify(input).length > 24000) throw Error('INVALID');
  const entry = tournament.entries.find(candidate => candidate.id === input.kind);
  if (!entry || !Number.isInteger(input.count) ||
      (input.kind === 'team' ? ![4, 5, 6].includes(input.count as number) : input.count !== entry.count) ||
      !Number.isInteger(input.representative) || !string(input.teamName) || !string(input.time) ||
      !Array.isArray(input.players) || input.players.length !== input.count) throw Error('INVALID');

  for (const player of input.players) {
    if (!object(player) || !['name', 'xId', 'platform', 'otherPlatform', 'gameId', 'hours', 'duty', 'favorite'].every(key => string(player[key])) ||
        typeof player.killer !== 'boolean' || !['', 'dedicated', 'both'].includes(player.duty as string) ||
        !Array.isArray(player.killers) || !player.killers.every(killer => string(killer) && killerCatalog.items.some(item => item.id === killer)) ||
        new Set(player.killers).size !== player.killers.length ||
        !['dif', 'dck', 'other'].every(key => ['yes', 'no'].includes(player[key] as string)) ||
        !history(player.difDetails) || !history(player.dckDetails) ||
        !Array.isArray(player.histories) || !player.histories.every(history)) throw Error('INVALID');
  }

  const draft = input as unknown as Draft;
  if (validate(draft, tournament).length) throw Error('INVALID');
  const cleanHistory = (value: History): History => ({
    name: value.name.trim(),
    appearances: value.appearances.trim(),
    wins: value.wins.trim(),
    runnersUp: value.runnersUp.trim(),
  });
  return {
    kind: draft.kind,
    count: draft.count,
    teamName: draft.kind === 'team' ? draft.teamName.trim() : '',
    representative: draft.representative,
    time: draft.time,
    players: draft.players.map(player => ({
      ...newPlayer(),
      name: player.name.trim(),
      xId: player.xId.trim().replace(/^@/, ''),
      platform: player.platform,
      otherPlatform: player.platform === 'その他' ? player.otherPlatform.trim() : '',
      gameId: player.gameId.trim(),
      hours: player.hours.trim(),
      killer: killerEnabled(draft.kind, player, tournament),
      duty: killerEnabled(draft.kind, player, tournament) ? player.duty : '',
      killers: killerEnabled(draft.kind, player, tournament) ? [...player.killers].sort() : [],
      favorite: killerEnabled(draft.kind, player, tournament) ? player.favorite : '',
      dif: player.dif,
      difDetails: player.dif === 'yes' ? cleanHistory(player.difDetails) : newHistory(),
      dck: player.dck,
      dckDetails: player.dck === 'yes' ? cleanHistory(player.dckDetails) : newHistory(),
      other: player.other,
      histories: player.other === 'yes' ? player.histories.map(cleanHistory) : [],
    })),
  };
}
