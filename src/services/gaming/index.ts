import { fetchXbox } from "./xbox";
import { fetchSteam } from "./steam";
import type { Gaming } from "./types";
export type { Gaming };

export async function fetchGaming(env: Env, _storage: DurableObjectStorage): Promise<Gaming | null> {
  const [steam, xbox] = await Promise.all([fetchSteam(env), fetchXbox(env)]);

  // prefer steam if playing on both
  if (steam?.isPlaying) return steam;
  if (xbox?.isPlaying) return xbox;

  // neither playing — find most recently played across both platforms
  if (!steam && !xbox) return null;
  if (!steam) return xbox;
  if (!xbox) return steam;

  const steamTime = new Date(steam.lastPlayedAt!).getTime();
  const xboxTime = new Date(xbox.lastPlayedAt!).getTime();
  return steamTime >= xboxTime ? steam : xbox;
}
