import { APICache } from "./cache";
export { APICache };
import { getCorsHeaders } from "./cors";
import { fetchImages } from "./services/images";

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    // cors preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    const url = new URL(request.url);
    const route = url.pathname.slice(1);

    if (!route) {
      return new Response("not found", { status: 404 });
    }

    if (route === "images") {
      const data = await fetchImages(env);
      return Response.json(data, { headers: { ...getCorsHeaders(request), "Cache-Control": "no-store" } });
    }

    const stub = env.API_CACHE.getByName("global");
    const response = await stub.get(route);
    return new Response(response.body, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), ...getCorsHeaders(request) },
    });
  },
} satisfies ExportedHandler<Env>;
