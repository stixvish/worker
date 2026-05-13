const ENDPOINTS = {
  token: "https://accounts.spotify.com/api/token",
  currentlyPlaying: "https://api.spotify.com/v1/me/player/currently-playing",
  recentlyPlayed: "https://api.spotify.com/v1/me/player/recently-played?limit=1",
  playlist: (playlistId: string) => `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,images`,
  artist: (artistId: string) => `https://api.spotify.com/v1/artists/${artistId}`,
};

const KNOWN_PLAYLISTS: Record<string, { name: string; cover: { url: string; height: number; width: number } }> = {
  "37i9dQZEVXbdOgSQQ4vq0e": {
    name: "Release Radar",
    cover: {
      url: "https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/release-radar-v1/37i9dQZEVXbdOgSQQ4vq0e/en",
      height: 320,
      width: 320,
    },
  },
  "37i9dQZEVXcTSfAWcLwg77": {
    name: "Discover Weekly",
    cover: { url: "https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/dw/cover/en", height: 320, width: 320 },
  },
  "37i9dQZF1Fa66WHkaHjY4W": {
    name: "Your Top Songs 2023",
    cover: {
      url: "https://wrapped-images.spotifycdn.com/image/yts-2023/default/your-top-songs-2023_DEFAULT_en.jpg",
      height: 300,
      width: 300,
    },
  },
  "37i9dQZF1F0sijgNaJdgit": {
    name: "Your Top Songs 2022",
    cover: {
      url: "https://wrapped-images.spotifycdn.com/image/yts-2022/default/your-top-songs-2022_default_en.jpg",
      height: 300,
      width: 300,
    },
  },
};

interface SpotifyToken {
  accessToken: string;
  expiresAt: number;
}

interface SpotifyResponse {
  isPlaying: boolean;
  name: string;
  url: string;
  artists: { name: string; url: string }[];
  album: { name: string; url: string; cover: { url: string; width: number; height: number } };
  context: { type: string; name: string; url: string; cover: { url: string; width: number | null; height: number | null } } | null;
  progress?: { positionMs: number; durationMs: number; timestamp: number };
}

async function fetchAccessToken(env: Env, storage: DurableObjectStorage): Promise<string> {
  // check if access token is cached and still valid
  const cached = await storage.get<SpotifyToken>("spotify:token");
  if (cached && Date.now() < cached.expiresAt) {
    return cached.accessToken;
  }
  // use refresh token to get new access token
  const res = await fetch(ENDPOINTS.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) {
    throw new Error(`failed to refresh spotify access token: ${res.status}`);
  }
  // check if the response actually has an access token
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("failed to refresh spotify access token: no access token in response");
  }
  // cache the access token
  await storage.put<SpotifyToken>("spotify:token", {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  });
  return data.access_token;
}

async function fetchContext(track: any, context: any, accessToken: string): Promise<SpotifyResponse["context"]> {
  const uriParts = context.uri.split(":");
  const type = context.type;
  const id = uriParts.at(-1);
  const url = context.external_urls.spotify;

  if (type === "playlist") {
    if (id in KNOWN_PLAYLISTS) {
      // if it's a known playlist, return saved info
      return { type, url, ...KNOWN_PLAYLISTS[id] };
    } else if (id.startsWith("37i9dQZ")) {
      // if it's an unknown playlist but starts with the auto generated prefix, return a generic name and cover
      return {
        type,
        name: "Spotify Auto-Generated Playlist",
        url,
        cover: { url: "https://daylist.spotifycdn.com/playlist-covers-mix/en/afternoon_default.jpg", width: 300, height: 300 },
      };
    } else {
      // otherwise fetch playlist details
      const res = await fetch(ENDPOINTS.playlist(id), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        return null;
      }
      const data =
        res.status === 204
          ? null
          : ((await res.json()) as { images: { url: string; width: number | null; height: number | null }[]; name: string });
      if (data) {
        return {
          type,
          name: data.name,
          url,
          cover: { url: data.images[0]?.url || "", width: data.images[0]?.width || null, height: data.images[0]?.height || null },
        };
      } else {
        return null;
      }
    }
  } else if (type === "collection") {
    // this should just be my liked songs
    return {
      type,
      name: "Liked Songs",
      url,
      cover: { url: "https://misc.scdn.co/liked-songs/liked-songs-640.jpg", width: 640, height: 640 },
    };
  } else if (type === "album") {
    return {
      type,
      name: track.album.name,
      url,
      cover: {
        url: track.album.images[0]?.url || "",
        width: track.album.images[0]?.width || null,
        height: track.album.images[0]?.height || null,
      },
    };
  } else if (type === "artist") {
    const res = await fetch(ENDPOINTS.artist(id), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return null;
    }
    const data =
      res.status === 204
        ? null
        : ((await res.json()) as { name: string; images: { url: string; width: number | null; height: number | null }[] });
    if (data) {
      return {
        type,
        name: data.name,
        url,
        cover: { url: data.images[0]?.url || "", width: data.images[0]?.width || null, height: data.images[0]?.height || null },
      };
    } else {
      return null;
    }
  }
  return null;
}

export async function fetchSpotify(env: Env, storage: DurableObjectStorage): Promise<unknown> {
  // get the access token
  const accessToken = await fetchAccessToken(env, storage);
  // try and get the currently playing track
  const res = await fetch(ENDPOINTS.currentlyPlaying, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok && res.status !== 204) {
    const track = (await res.json()) as any;
    const data: SpotifyResponse = {
      isPlaying: track.is_playing,
      name: track.item.name,
      url: track.item.external_urls.spotify,
      artists: track.item.artists.map((artist: any) => ({
        name: artist.name,
        url: artist.external_urls.spotify,
      })),
      album: {
        name: track.item.album.name,
        url: track.item.album.external_urls.spotify,
        cover: {
          url: track.item.album.images[0]?.url || "",
          width: track.item.album.images[0]?.width || 0,
          height: track.item.album.images[0]?.height || 0,
        },
      },
      context: null,
    };
    if (track.context) {
      data.context = await fetchContext(track.item, track.context, accessToken);
    }
    if (track.is_playing) {
      data.progress = { positionMs: track.progress_ms, durationMs: track.item.duration_ms, timestamp: Date.now() };
    }
    return data;
  }

  // if there's no currently playing track, get the most recently played track and return that with isPlaying set to false
  const recentRes = await fetch(ENDPOINTS.recentlyPlayed, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!recentRes.ok || recentRes.status === 204) {
    throw new Error(`failed to fetch recently played track: ${recentRes.status}`);
  }
  const recentData = (await recentRes.json()) as any;
  const track = recentData.items[0].track;
  const data: SpotifyResponse = {
    isPlaying: false,
    name: track.name,
    url: track.external_urls.spotify,
    artists: track.artists.map((artist: any) => ({
      name: artist.name,
      url: artist.external_urls.spotify,
    })),
    album: {
      name: track.album.name,
      url: track.album.external_urls.spotify,
      cover: {
        url: track.album.images[0]?.url || "",
        width: track.album.images[0]?.width || 0,
        height: track.album.images[0]?.height || 0,
      },
    },
    context: null,
  };
  if (recentData.items[0].context) {
    data.context = await fetchContext(track, recentData.items[0].context, accessToken);
  }
  return data;
}
