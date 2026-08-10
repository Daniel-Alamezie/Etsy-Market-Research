import type { Listing, Summary, PriceBucket, TagCount } from './types';

const NINETY_DAYS = 90 * 24 * 60 * 60;

function median(sortedNums: number[]): number {
  if (sortedNums.length === 0) return 0;
  const mid = Math.floor(sortedNums.length / 2);
  return sortedNums.length % 2 !== 0
    ? sortedNums[mid]
    : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
}

function buildPriceBuckets(prices: number[]): PriceBucket[] {
  if (prices.length === 0) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) {
    return [{ min, max, count: prices.length }];
  }
  const BUCKETS = 8;
  const width = (max - min) / BUCKETS;
  const buckets: PriceBucket[] = Array.from({ length: BUCKETS }, (_, i) => {
    const lo = min + i * width;
    const hi = i === BUCKETS - 1 ? max : min + (i + 1) * width;
    return { min: lo, max: hi, count: 0 };
  });
  for (const p of prices) {
    let idx = Math.floor((p - min) / width);
    if (idx >= BUCKETS) idx = BUCKETS - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count += 1;
  }
  return buckets;
}

// Words too generic to be useful signal in a tag-frequency view.
const STOP_TAGS = new Set([
  'gift', 'gifts', 'gift for her', 'gift for him', 'home decor', 'wall art',
  'print', 'printable', 'digital', 'digital download', 'poster', 'art',
]);

function buildTopTags(listings: Listing[], keyword: string): TagCount[] {
  const counts = new Map<string, number>();
  const kw = keyword.trim().toLowerCase();
  for (const l of listings) {
    for (const raw of l.tags) {
      const tag = raw.trim().toLowerCase();
      if (!tag) continue;
      if (tag === kw) continue; // the searched term itself is not a signal
      if (STOP_TAGS.has(tag)) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);
}

/** Compute the research summary from a set of listings. */
export function analyze(listings: Listing[], keyword: string): Summary {
  const currency = listings[0]?.currency ?? 'USD';
  const prices = listings.map((l) => l.price).filter((p) => p > 0);
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const favorites = listings.map((l) => l.favorites);
  const timestamps = listings
    .map((l) => l.createdTimestamp)
    .filter((t) => t > 0);

  // Use the newest listing as the "now" reference so freshness is data-relative.
  const refNow = timestamps.length ? Math.max(...timestamps) : 0;
  const freshCount = timestamps.filter((t) => refNow - t <= NINETY_DAYS).length;

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return {
    count: listings.length,
    currency,
    price: {
      min: sortedPrices.length ? sortedPrices[0] : 0,
      max: sortedPrices.length ? sortedPrices[sortedPrices.length - 1] : 0,
      mean: prices.length ? sum(prices) / prices.length : 0,
      median: median(sortedPrices),
    },
    favorites: {
      total: sum(favorites),
      mean: favorites.length ? sum(favorites) / favorites.length : 0,
      max: favorites.length ? Math.max(...favorites) : 0,
    },
    priceBuckets: buildPriceBuckets(prices),
    topTags: buildTopTags(listings, keyword),
    dateRange: {
      oldest: timestamps.length ? Math.min(...timestamps) : null,
      newest: timestamps.length ? Math.max(...timestamps) : null,
      freshShare: timestamps.length ? freshCount / timestamps.length : 0,
    },
  };
}
