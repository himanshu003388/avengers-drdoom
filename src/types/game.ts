export type BubbleKind = 'avengers' | 'thor' | 'ironman' | 'doom' | 'bomb';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  bestCombo: number;
  popped: number;
  updatedAt: string;
}
