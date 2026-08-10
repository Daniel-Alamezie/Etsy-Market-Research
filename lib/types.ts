// Shared types for the Etsy research tool.

/** A single normalized listing we care about for research. */
export interface Listing {
  id: number;
  title: string;
  /** Final price in the listing's currency, already divided by Etsy's divisor. */
  price: number;
  currency: string;
  /** Price normalized to USD (set server-side via FX rates). */
  priceUsd?: number;
  /** Small thumbnail image URL (fetched via the batch/Images endpoint). */
  thumbnailUrl?: string;
  /** Number of users who favorited the listing — our best demand proxy. */
  favorites: number;
  /** Epoch seconds when the listing was created. */
  createdTimestamp: number;
  tags: string[];
  url: string;
  shopName?: string;
  quantity?: number;
}

export interface SearchParams {
  keyword: string;
  minPrice?: number;
  maxPrice?: number;
  /** Etsy taxonomy id (optional category filter). */
  taxonomyId?: number;
  /** How many listings to analyze (we page under the hood). */
  limit: number;
  /** Etsy-supported sort field. */
  sortOn: 'score' | 'price' | 'created';
  sortOrder: 'asc' | 'desc';
}

export interface PriceBucket {
  min: number;
  max: number;
  count: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface Summary {
  count: number;
  currency: string;
  price: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
  favorites: {
    total: number;
    mean: number;
    max: number;
  };
  priceBuckets: PriceBucket[];
  topTags: TagCount[];
  dateRange: {
    oldest: number | null;
    newest: number | null;
    /** Share of listings created within the last 90 days (freshness signal). */
    freshShare: number;
  };
}

export interface SearchResponse {
  mode: 'live' | 'mock';
  params: SearchParams;
  listings: Listing[];
  summary: Summary;
  /** USD-based FX rates (units per 1 USD) for client-side currency switching. */
  fxRates: Record<string, number>;
  /** Whether the FX rates are live or the static fallback. */
  fxLive: boolean;
  /** Non-fatal note surfaced to the UI (e.g. why we fell back to mock). */
  warning?: string;
  fetchedAt: string;
}

export interface StatusResponse {
  configured: boolean;
  forceMock: boolean;
  /** null = unknown (not tested), true/false = last live probe result. */
  keyActive: boolean | null;
  message: string;
}
