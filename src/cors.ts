const ALLOWED_ORIGINS = ["https://stixvish.com", "https://www.stixvish.com", "http://localhost:4321", "http://10.0.0.86:4321"];

export function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin ?? "") ? origin : null;

  return {
    "Access-Control-Allow-Origin": allowedOrigin ?? "",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}
