import type { Gaming } from "./types";

const ENDPOINTS = {
  presence: "https://api.xbl.io/v2/presence",
  titles: "https://api.xbl.io/v2/titles",
  stats: (titleId: string) => `https://api.xbl.io/v2/achievements/stats/${titleId}`,
};

function headers(env: Env) {
  return { "X-Authorization": env.XBL_API_KEY };
}

async function fetchPresence(env: Env) {
  const res = await fetch(ENDPOINTS.presence, { headers: headers(env) }).catch(() => null);
  if (!res || !res.ok) return null;

  const data = (await res.json()) as {
    content: { state: "Online" | "Offline" };
    devices: { type: string; titles: { id: string; name: string }[] }[];
  };
  if (data.content.state === "Offline") return null;

  const device = data.devices.find((d) => d.type === "XboxOne" || d.type === "XboxSeriesX");
  if (!device) return null;

  return {
    isPlaying: true,
    platform: "xbox",
    game: device.titles[0]?.name ?? "Unknown",
    titleId: device.titles[0]?.id,
  };
}

export async function fetchXbox(env: Env): Promise<Gaming | null> {
  const live = await fetchPresence(env);

  const titlesRes = await fetch(ENDPOINTS.titles, { headers: headers(env) }).catch(() => null);
  if (!titlesRes || !titlesRes.ok) return null;
  const titlesData = (await titlesRes.json()) as {
    content: { titles: { titleId: string; name: string; displayImage: string; titleHistory: { lastTimePlayed: string } }[] };
  };
  if (titlesData.content.titles.length === 0) return null;

  const title = live
    ? titlesData.content.titles.find((t) => t.titleId === live.titleId)
    : titlesData.content.titles.sort(
        (a, b) => new Date(b.titleHistory.lastTimePlayed).getTime() - new Date(a.titleHistory.lastTimePlayed).getTime()
      )[0];
  if (!title) return null;

  const statsRes = await fetch(ENDPOINTS.stats(title.titleId), { headers: headers(env) }).catch(() => null);
  if (!statsRes || !statsRes.ok) return null;
  const stats = (await statsRes.json()) as { content: { statlistscollection: { stats: { name: string; value: string }[] }[] } };

  return {
    isPlaying: !!live,
    platform: "xbox",
    game: title.name,
    cover: { url: title.displayImage, width: null, height: null },
    lastPlayedAt: live ? null : title.titleHistory.lastTimePlayed,
    playtimeMinutes: parseInt(stats.content.statlistscollection[0]?.stats.find((s) => s.name === "MinutesPlayed")?.value ?? "0", 10),
  };
}
