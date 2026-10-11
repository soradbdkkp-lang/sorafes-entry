import type { TournamentConfig } from '../model';

export const tournament: TournamentConfig = {
  brand: 'そらふぇす', name: 'ふろぐ Assemble Cup', date: '2026年11月14日',
  deadline: '2026年10月24日23:59（日本時間）', capacity: '30名 / 6チーム（拡大の場合あり）',
  entries: [
    { id: 'killer', label: 'キラーとして応募', count: 1, note: 'キラー担当で参加。サバイバーとの兼任可否も回答します。' },
    { id: 'solo', label: '1人で応募', count: 1, note: '運営がチームを編成します。' },
    { id: 'duo', label: '2人で応募', count: 2, note: '原則として2人を分割せずに編成します。' },
    { id: 'survivors', label: '4人で応募（サバイバー4名）', count: 4, note: 'キラー担当者は後から運営が編成します。' },
    { id: 'team', label: '4～6人のチームで応募', count: 4, note: 'チーム名必須。キラー担当可能者が1名以上必要です。' },
  ],
  platforms: ['Steam', 'PlayStation', 'Nintendo Switch', 'その他'],
  availability: ['16:00開始でも参加可能', '18:00以降の開始を希望', 'どちらでも問題ない'],
  historiesEnabled: true, killerQuestionsEnabled: true,
};
