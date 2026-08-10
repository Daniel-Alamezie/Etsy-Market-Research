import 'server-only';
import type { Listing, SearchParams } from './types';
import { buildMockListings } from './mock';

const ETSY_BASE = 'https://api.etsy.com/v3/application';
const PAGE_SIZE = 100; // Etsy max per request
const HARD_CAP = 300; // safety cap so we never hammer the rate limit

export interface EtsyConfig {
  keystring: string;
  sharedSecret: string;
  forceMock: boolean;
}

export function getConfig(): EtsyConfig {
  return {
    keystring: (process.env.ETSY_KEYSTRING ?? '').trim(),
    sharedSecret: (process.env.ETSY_SHARED_SECRET ?? '').trim(),
    forceMock: (process.env.ETSY_FORCE_MOCK ?? '').trim().toLowerCase() === 'true',
  };
}

export function isConfigured(cfg: EtsyConfig = getConfig()): boolean {
  return cfg.keystring.length > 0 && cfg.sharedSecret.length > 0;
}

/** Etsy requires: x-api-key: <keystring>:<shared_secret> on every request. */
function apiKeyHeader(cfg: EtsyConfig): string {
  return `${cfg.keystring}:${cfg.sharedSecret}`;
}

interface EtsyRawListing {
  listing_id: number;
  title: string;
  price?: { amount: number; divisor: number; currency_code: string };
  num_favorers?: number;
  created_timestamp?: number;
  original_creation_timestamp?: number;
  tags?: string[];
  url: string;
  quantity?: number;
  shop?: { shop_name?: string };
}

function normalize(raw: EtsyRawListing): Listing {
  const divisor = raw.price?.divisor || 100;
  const amount = raw.price?.amount ?? 0;
  return {
    id: raw.listing_id,
    title: raw.title ?? '(untitled)',
    price: amount / divisor,
    currency: raw.price?.currency_code ?? 'USD',
    favorites: raw.num_favorers ?? 0,
    createdTimestamp:
      raw.created_timestamp ?? raw.original_creation_timestamp ?? 0,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    url: raw.url,
    quantity: raw.quantity,
    shopName: raw.shop?.shop_name,
  };
}

export class EtsyApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'EtsyApiError';
  }
}

async function fetchPage(
  cfg: EtsyConfig,
  params: SearchParams,
  offset: number,
  pageLimit: number,
): Promise<EtsyRawListing[]> {
  const url = new URL(`${ETSY_BASE}/listings/active`);
  url.searchParams.set('keywords', params.keyword);
  url.searchParams.set('limit', String(pageLimit));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('sort_on', params.sortOn);
  url.searchParams.set('sort_order', params.sortOrder);
  // Pull the fields we analyze in one shot.
  url.searchParams.set('includes', 'Shop');
  if (params.minPrice != null) url.searchParams.set('min_price', String(params.minPrice));
  if (params.maxPrice != null) url.searchParams.set('max_price', String(params.maxPrice));
  if (params.taxonomyId != null) url.searchParams.set('taxonomy_id', String(params.taxonomyId));

  const res = await fetch(url.toString(), {
    headers: {
      'x-api-key': apiKeyHeader(cfg),
      Accept: 'application/json',
    },
    // Never cache research pulls.
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.error ?? body?.message ?? detail;
    } catch {
      /* ignore parse errors */
    }
    throw new EtsyApiError(res.status, detail);
  }

  const json = await res.json();
  return Array.isArray(json?.results) ? (json.results as EtsyRawListing[]) : [];
}

interface EtsyBatchImage {
  rank?: number;
  url_75x75?: string;
  url_170x135?: string;
  alt_text?: string;
}

/**
 * The search endpoint doesn't return images, but /listings/batch does when asked
 * with includes=Images. Fetch thumbnails for the given ids (up to 100 per call)
 * and return a map of listing_id → thumbnail URL. Failures are non-fatal.
 */
async function fetchThumbnails(
  cfg: EtsyConfig,
  ids: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();

  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    const chunk = ids.slice(i, i + PAGE_SIZE);
    const url = new URL(`${ETSY_BASE}/listings/batch`);
    url.searchParams.set('listing_ids', chunk.join(','));
    url.searchParams.set('includes', 'Images');

    try {
      const res = await fetch(url.toString(), {
        headers: { 'x-api-key': apiKeyHeader(cfg), Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) continue; // skip this chunk, keep whatever we have
      const json = await res.json();
      for (const l of json?.results ?? []) {
        const imgs: EtsyBatchImage[] = Array.isArray(l.images) ? l.images : [];
        if (!imgs.length) continue;
        const primary = imgs.find((im) => im.rank === 1) ?? imgs[0];
        const thumb = primary.url_170x135 || primary.url_75x75;
        if (thumb) map.set(l.listing_id, thumb);
      }
    } catch {
      /* non-fatal — listings just render without a thumbnail */
    }
  }

  return map;
}

/** Fetch live listings from Etsy, paging until we hit the requested limit. */
export async function fetchLiveListings(
  cfg: EtsyConfig,
  params: SearchParams,
): Promise<Listing[]> {
  const target = Math.min(params.limit, HARD_CAP);
  const collected: Listing[] = [];
  let offset = 0;

  while (collected.length < target) {
    const pageLimit = Math.min(PAGE_SIZE, target - collected.length);
    const page = await fetchPage(cfg, params, offset, pageLimit);
    if (page.length === 0) break; // no more results
    collected.push(...page.map(normalize));
    offset += page.length;
    if (page.length < pageLimit) break; // reached the end
  }

  // Attach thumbnails in a second pass (the search endpoint omits images).
  const thumbs = await fetchThumbnails(cfg, collected.map((l) => l.id));
  for (const l of collected) {
    const t = thumbs.get(l.id);
    if (t) l.thumbnailUrl = t;
  }

  return collected;
}

/** Mock listings so the whole UI is usable before the API key is approved. */
export function getMockListings(params: SearchParams): Listing[] {
  return buildMockListings(params);
}
