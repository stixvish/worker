export interface Gaming {
  isPlaying: boolean;
  platform: "xbox" | "steam";
  game: string;
  cover: { url: string; width: number | null; height: number | null };
  lastPlayedAt: string | null;
  playtimeMinutes?: number;
}
