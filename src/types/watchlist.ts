export type WatchDateOption = 'dec-17' | 'after-17';

export type GroupSizeOption = 'solo' | 'plus-one' | 'squad';

export interface PublicWatchlistEntry {
  id: string;
  name: string;
  watchDate: WatchDateOption;
  groupSize: GroupSizeOption;
  info?: string;
  createdAt: string;
}

export interface RsvpSubmission extends PublicWatchlistEntry {
  contact?: string;
}
