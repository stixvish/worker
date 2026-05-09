export interface CachedEntry {
  data: unknown;
  expiresAt: number;
}

export interface RouteConfig {
  ttl: number;
  fetch: (env: Env, storage: DurableObjectStorage) => Promise<unknown>;
}
