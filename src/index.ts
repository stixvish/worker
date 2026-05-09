import { APICache } from "./cache";

export { APICache };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const route = url.pathname.slice(1);

    if (!route) {
      return new Response("not found", { status: 404 });
    }

    const stub = env.API_CACHE.getByName("global");
    return stub.get(route);
  },
} satisfies ExportedHandler<Env>;
