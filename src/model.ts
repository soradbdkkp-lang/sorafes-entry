export type EntryKind = 'killer' | 'solo' | 'duo' | 'survivors' | 'team';
export type Experience = '' | 'yes' | 'no';
export interface History {
  name: string;
  appearances: string;
  wins: string;
  runnersUp: string;
}
export interface Player {
  name: string;
  xId: string;
  platform: string;
  otherPlatform: string;
  gameId: string;
  hours: string;
  killer: boolean;
  duty: '' | 'dedicated' | 'both';
  killers: string[];
  favorite: string;
  dif: Experience;
  difDetails: History;
  dck: Experience;
  dckDetails: History;
  other: Experience;
  histories: History[];
}
export const newHistory = (): History => ({ name: '', appearances: '', wins: '', runnersUp: '' });
export const newPlayer = (): Player => ({ name: '', xId: '', platform: '', otherPlatform: '', gameId: '', hours: '', killer: false, duty: '', killers: [], favorite: '', dif: '', difDetails: newHistory(), dck: '', dckDetails: newHistory(), other: '', histories: [newHistory()] });

export interface TournamentConfig {
  brand: string;
  name: string;
  date: string;
  deadline: string;
  capacity: string;
  entries: { id: EntryKind; label: string; count: number; note: string }[];
  platforms: string[];
  availability: string[];
  historiesEnabled: boolean;
  killerQuestionsEnabled: boolean;
}
