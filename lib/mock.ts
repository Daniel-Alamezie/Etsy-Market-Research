import type { Listing, SearchParams } from './types';

// Deterministic pseudo-random generator so mock results are stable per query
// (no Date.now/Math.random — keeps output reproducible for the same search).
function makeRng(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

const STYLE_WORDS = [
  'Boho', 'Minimalist', 'Sage Green', 'Japandi', 'Mid-Century', 'Vintage',
  'Abstract', 'Watercolor', 'Line Art', 'Neutral', 'Retro', 'Pastel',
];
const FORMAT_WORDS = [
  'Wall Art Print', 'Poster', 'Printable Set of 3', 'Gallery Wall Set',
  'Canvas Print', 'Digital Download', 'Framed Print', 'Art Print',
];
const MODIFIER_WORDS = [
  'for Living Room', 'Nursery Decor', 'Above Bed', 'Home Office',
  'Bedroom Aesthetic', 'Housewarming Gift', 'Kitchen Wall Decor', 'Gallery Wall',
];
const EXTRA_TAGS = [
  'wall decor', 'trending now', 'living room art', 'above couch art',
  'neutral wall art', 'boho decor', 'aesthetic print', 'set of 3 prints',
  'instant download', 'large wall art', 'framed art', 'modern print',
  'housewarming gift', 'nursery print', 'minimalist decor', 'earth tones',
];

const DAY = 24 * 60 * 60;
const REF_NOW = Math.floor(Date.parse('2026-08-10T00:00:00Z') / 1000);

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/**
 * Build a realistic-looking set of listings for a keyword so the entire UI can
 * be exercised before the live API key is approved. Not real data — clearly
 * labeled as mock throughout the UI.
 */
export function buildMockListings(params: SearchParams): Listing[] {
  const rng = makeRng(params.keyword.toLowerCase() + '|' + params.limit);
  const kw = params.keyword.trim() || 'wall art';
  const kwTitle = kw.replace(/\b\w/g, (c) => c.toUpperCase());
  const count = Math.min(params.limit, 60);

  const minP = params.minPrice ?? 4;
  const maxP = params.maxPrice ?? 45;

  const listings: Listing[] = [];
  for (let i = 0; i < count; i++) {
    const style = pick(STYLE_WORDS, rng);
    const format = pick(FORMAT_WORDS, rng);
    const modifier = pick(MODIFIER_WORDS, rng);
    const title = `${style} ${kwTitle} ${format} | ${modifier}`;

    // Price skewed toward the lower end (impulse-buy prints), within range.
    const skew = rng() * rng();
    const price = Math.round((minP + skew * (maxP - minP)) * 100) / 100;

    // Favorites: heavy-tailed — a few breakout listings, many small ones.
    const favorites = Math.floor(Math.pow(rng(), 2.4) * 4200);

    // Created anywhere in the last ~2 years.
    const ageDays = Math.floor(rng() * 720);
    const createdTimestamp = REF_NOW - ageDays * DAY;

    const tagSet = new Set<string>([kw.toLowerCase(), style.toLowerCase()]);
    for (let t = 0; t < 6; t++) tagSet.add(pick(EXTRA_TAGS, rng));

    listings.push({
      id: 1_000_000 + i,
      title,
      price,
      currency: 'USD',
      favorites,
      createdTimestamp,
      tags: [...tagSet],
      url: 'https://www.etsy.com/search?q=' + encodeURIComponent(kw),
      shopName: `${pick(STYLE_WORDS, rng)}PrintCo`,
      quantity: 999,
    });
  }

  // Respect the requested sort so the table/preview behaves like live mode.
  const dir = params.sortOrder === 'asc' ? 1 : -1;
  listings.sort((a, b) => {
    if (params.sortOn === 'price') return (a.price - b.price) * dir;
    if (params.sortOn === 'created') return (a.createdTimestamp - b.createdTimestamp) * dir;
    return (a.favorites - b.favorites) * dir; // 'score' ~ popularity proxy
  });

  return listings;
}
