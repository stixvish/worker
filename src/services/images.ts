const EXCLUDED = new Set(["profile_cropped.jpeg", "3vish.JPG", "londonhouse.jpeg", "sdCreative.JPG"]);
const BASE_URL = "https://images.stixvish.com";
const PICK_COUNT = 15;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function fetchImages(env: Env) {
  const listed = await env.IMAGES_BUCKET.list({ include: ["customMetadata"] });

  const eligible = listed.objects.filter((obj) => !EXCLUDED.has(obj.key));
  const picked = shuffle(eligible).slice(0, PICK_COUNT);

  return picked.map((obj) => {
    const gravity = obj.customMetadata?.focal ?? "0.50x0.50";
    return {
      url: `${BASE_URL}/cdn-cgi/image/height=500,width=500,fit=cover,format=auto,quality=75,gravity=${gravity}/${obj.key}`,
      alt: obj.customMetadata?.alt ?? "",
    };
  });
}
