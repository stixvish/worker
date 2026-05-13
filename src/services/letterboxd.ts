const RSS_URL = "https://letterboxd.com/stixvish/rss/";

interface LetterboxdResponse {
  title: string;
  year: number;
  rating: number | null;
  stars: string | null;
  review: string | null;
  watchedAt: string;
  reviewedAt: string;
  url: string;
  poster: { url: string; width: number | null; height: number | null };
}

function toStars(rating: number): string {
  return "★".repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? "½" : "");
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`));
  return m ? m[1].trim() : null;
}

function cdata(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${name}>`));
  return m ? m[1].trim() : null;
}

export async function fetchLetterboxd(_env: Env, _storage: DurableObjectStorage): Promise<unknown> {
  const res = await fetch(RSS_URL).catch(() => null);
  if (!res || !res.ok) return null;

  const xml = await res.text();
  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!itemMatch) return null;
  const item = itemMatch[1];

  const title = tag(item, "letterboxd:filmTitle");
  const yearStr = tag(item, "letterboxd:filmYear");
  const ratingStr = tag(item, "letterboxd:memberRating");
  const watchedAt = tag(item, "letterboxd:watchedDate");
  const pubDate = tag(item, "pubDate");
  const url = tag(item, "link");
  const description = cdata(item, "description");

  if (!title || !yearStr || !watchedAt || !pubDate || !url) return null;

  const ratingNum = ratingStr ? parseFloat(ratingStr) : null;

  const posterMatch = description?.match(/<img src="([^"]+)"/);
  const posterUrl = posterMatch?.[1] ?? "";
  const dimMatch = posterUrl.match(/-0-(\d+)-0-(\d+)-crop/);

  const reviewHtml = description?.replace(/<p><img[^>]*\/?><\/p>\s*/, "") ?? "";
  const reviewText = reviewHtml.replace(/<[^>]+>/g, "").trim();

  return {
    title,
    year: parseInt(yearStr, 10),
    rating: ratingNum,
    stars: ratingNum !== null ? toStars(ratingNum) : null,
    review: reviewText || null,
    watchedAt,
    reviewedAt: new Date(pubDate).toISOString(),
    url,
    poster: {
      url: posterUrl,
      width: dimMatch ? parseInt(dimMatch[1], 10) : null,
      height: dimMatch ? parseInt(dimMatch[2], 10) : null,
    },
  } satisfies LetterboxdResponse;
}
