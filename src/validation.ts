import type { EntryKind, History, Player, TournamentConfig } from './model';

export interface Draft {
  kind: EntryKind; count: number; teamName: string; representative: number;
  players: Player[]; time: string;
}
export interface Issue { step: number; message: string }
export const normalizeX = (v: string) => v.trim().replace(/^@/, '');
export const killerEnabled = (kind: EntryKind, p: Player, config: TournamentConfig) =>
  config.killerQuestionsEnabled && kind !== 'survivors' && (kind === 'killer' || p.killer);

export function validate(draft: Draft, config: TournamentConfig): Issue[] {
  const issues: Issue[] = [];
  const add = (step: number, message: string) => issues.push({ step, message });
  if (draft.kind === 'team' && !draft.teamName.trim()) add(2, 'チーム名を入力してください。');
  if (draft.representative < 0 || draft.representative >= draft.count) add(2, '応募メンバーから代表者を選択してください。');
  const players = draft.players.slice(0, draft.count);
  if (draft.kind === 'team' && !players.some(p => killerEnabled(draft.kind, p, config))) add(4, 'チームにはキラー担当可能者が1名以上必要です。');
  function history(h: History, prefix: string, named: boolean) {
    if (named && !h.name.trim()) add(5, `${prefix}：大会名を入力してください。`);
    for (const [key, label, min] of [['appearances', '出場回数', 1], ['wins', '優勝回数', 0], ['runnersUp', '準優勝回数', 0]] as const) {
      const v = h[key].trim();
      if (v !== 'unknown' && (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)) || Number(v) < min)) add(5, `${prefix}：${label}は${min}以上の整数、または「不明」を回答してください。`);
    }
    if (/^\d+$/.test(h.appearances.trim())) for (const [key, label] of [['wins', '優勝回数'], ['runnersUp', '準優勝回数']] as const) {
      if (/^\d+$/.test(h[key].trim()) && Number(h[key]) > Number(h.appearances)) add(5, `${prefix}：${label}が出場回数を超えています。`);
    }
  }
  players.forEach((p, i) => {
    const prefix = `プレイヤー${i + 1}`;
    if (!p.name.trim()) add(3, `${prefix}：プレイヤー名を入力してください。`);
    if (!normalizeX(p.xId)) add(3, `${prefix}：X IDを入力してください。`);
    if (!config.platforms.includes(p.platform)) add(3, `${prefix}：プレイ環境を選択してください。`);
    if (p.platform === 'その他' && !p.otherPlatform.trim()) add(3, `${prefix}：具体的なプレイ環境を入力してください。`);
    const gameId = p.gameId.trim(); const split = gameId.indexOf('#');
    if (split < 1 || !gameId.slice(split + 1).trim()) add(3, `${prefix}：ゲーム内IDは#の前後を含めて入力してください。`);
    if (!p.hours.trim() || !Number.isFinite(Number(p.hours)) || Number(p.hours) < 0) add(3, `${prefix}：総プレイ時間は0以上の数値を入力してください。`);
    if (killerEnabled(draft.kind, p, config)) {
      if (!p.duty) add(4, `${prefix}：キラー専任か兼任可能かを選択してください。`);
      if (!p.killers.length) add(4, `${prefix}：使用可能キラーを1体以上選択してください。`);
      if (!p.favorite || !p.killers.includes(p.favorite)) add(4, `${prefix}：使用可能一覧から最も得意なキラーを選択してください。`);
    }
    if (config.historiesEnabled) {
      for (const [key, label] of [['dif', 'DIF'], ['dck', 'DCK']] as const) {
        if (!p[key]) add(5, `${prefix}：${label}の経験有無を回答してください。`);
        if (p[key] === 'yes') history(key === 'dif' ? p.difDetails : p.dckDetails, `${prefix} / ${label}`, false);
      }
      if (!p.other) add(5, `${prefix}：その他大会の経験有無を回答してください。`);
      if (p.other === 'yes') {
        if (!p.histories.length) add(5, `${prefix}：その他大会を1件以上入力してください。`);
        p.histories.forEach((h, n) => history(h, `${prefix} / その他大会${n + 1}`, true));
      }
    }
  });
  if (!config.availability.includes(draft.time)) add(6, '参加可能時間を選択してください。');
  return issues;
}

// 対象外の入力をコピーせず、確認表示専用のデータを組み立てる。送信処理はない。
export function reviewData(draft: Draft, config: TournamentConfig) {
  return {
    kind: draft.kind, count: draft.count,
    teamName: draft.kind === 'team' ? draft.teamName.trim() : undefined,
    representative: draft.representative, time: draft.time,
    players: draft.players.slice(0, draft.count).map(p => ({
      name: p.name.trim(), xId: normalizeX(p.xId), platform: p.platform,
      otherPlatform: p.platform === 'その他' ? p.otherPlatform.trim() : undefined,
      gameId: p.gameId.trim(), hours: p.hours.trim(),
      role: killerEnabled(draft.kind, p, config) ? (p.duty === 'both' ? 'キラー・サバイバー兼任可能' : 'キラー専任') : 'サバイバー',
      killer: killerEnabled(draft.kind, p, config) ? { duty: p.duty, available: [...p.killers], favorite: p.favorite } : undefined,
      histories: config.historiesEnabled ? {
        dif: p.dif, difDetails: p.dif === 'yes' ? p.difDetails : undefined,
        dck: p.dck, dckDetails: p.dck === 'yes' ? p.dckDetails : undefined,
        other: p.other, otherDetails: p.other === 'yes' ? p.histories : undefined,
      } : undefined,
    })),
  };
}
