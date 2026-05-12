import type { Gaming } from "./types";

const gameImage = (appid: number) => `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;

const ENDPOINTS = {
  playerSummary: (steamId: string, key: string) =>
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${steamId}`,
  ownedGames: (steamId: string, key: string) =>
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`,
};

async function fetchCurrentGameId(env: Env): Promise<number | null> {
  const statusRes = await fetch(ENDPOINTS.playerSummary(env.STEAM_ID, env.STEAM_API_KEY)).catch(() => null);
  if (!statusRes || !statusRes.ok) return null;

  const statusData = (await statusRes.json()) as { response: { players: { gameid?: number }[] } };
  // the gameid is only present if the user is currently in-game
  return statusData.response.players[0]?.gameid ?? null;
}

export async function fetchSteam(env: Env): Promise<Gaming | null> {
  const currentGID = await fetchCurrentGameId(env);

  const gamesRes = await fetch(ENDPOINTS.ownedGames(env.STEAM_ID, env.STEAM_API_KEY)).catch(() => null);
  if (!gamesRes || !gamesRes.ok) return null;

  const gameData = (await gamesRes.json()) as {
    response: { games: { appid: number; name: string; playtime_forever: number; rtime_last_played: number }[] };
  };

  const game = currentGID
    ? gameData.response.games.find((g) => g.appid === Number(currentGID))
    : gameData.response.games.sort((a, b) => b.rtime_last_played - a.rtime_last_played)[0];
  if (!game) return null;

  return {
    isPlaying: !!currentGID,
    platform: "steam",
    game: game.name,
    cover: { url: gameImage(game.appid), width: 600, height: 900 },
    lastPlayedAt: new Date(game.rtime_last_played * 1000).toISOString(),
    playtimeMinutes: game.playtime_forever,
  };
}
