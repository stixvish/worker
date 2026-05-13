import { DurableObject } from "cloudflare:workers";
import { fetchSpotify } from "./services/spotify";
import { fetchGaming } from "./services/gaming";
import type { CachedEntry, RouteConfig } from "./types";

const ROUTES: Record<string, RouteConfig> = {
  spotify: {
    ttl: 1_000 * 30, // 30s
    fetch: (env, storage) => fetchSpotify(env, storage),
  },
  gaming: {
    ttl: 1_000 * 90, // 90s
    fetch: (env, storage) => fetchGaming(env, storage),
  },
};

export class APICache extends DurableObject<Env> {
  async get(route: string): Promise<Response> {
    // check to see if the route exists
    const config = ROUTES[route];
    if (!config) {
      return new Response("unknown route", { status: 404 });
    }
    // see if we have a cached response and if it's still valid
    const cached = await this.ctx.storage.get<CachedEntry>(route);
    if (cached && Date.now() < cached.expiresAt) {
      return Response.json(cached.data);
    }
    // if not, fetch new data, cache it, and return it
    const data = await config.fetch(this.env, this.ctx.storage);
    await this.ctx.storage.put(route, {
      data,
      expiresAt: Date.now() + config.ttl,
    });
    return Response.json(data);
  }
}
