import { NextRequest, NextResponse } from 'next/server';
import {
  getConfig,
  isConfigured,
  fetchLiveListings,
  getMockListings,
  EtsyApiError,
} from '@/lib/etsy';
import { analyze } from '@/lib/analysis';
import { getRates, toUsd } from '@/lib/fx';
import type { SearchParams, SearchResponse, Listing } from '@/lib/types';
import { shopVelocity } from '@/lib/shopVelocity';

export const dynamic = 'force-dynamic';

function parseParams(sp: URLSearchParams): SearchParams {
  const num = (key: string): number | undefined => {
    const v = sp.get(key);
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const sortOn = (sp.get('sortOn') ?? 'score') as SearchParams['sortOn'];
  const sortOrder = (sp.get('sortOrder') ?? 'desc') as SearchParams['sortOrder'];
  const rawLimit = num('limit') ?? 100;

  return {
    keyword: (sp.get('keyword') ?? '').trim(),
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    taxonomyId: num('taxonomyId'),
    limit: Math.max(1, Math.min(rawLimit, 300)),
    sortOn: ['score', 'price', 'created'].includes(sortOn) ? sortOn : 'score',
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
  };
}

export async function GET(req: NextRequest) {
  const params = parseParams(req.nextUrl.searchParams);

  if (!params.keyword) {
    return NextResponse.json(
      { error: 'A keyword is required.' },
      { status: 400 },
    );
  }

  const cfg = getConfig();
  const wantMock = req.nextUrl.searchParams.get('mock') === 'true';

  // Decide mode: explicit mock request, forced mock, or missing keys.
  const useMock = wantMock || cfg.forceMock || !isConfigured(cfg);

  const { rates, live: fxLive } = await getRates();

  const build = async (
    mode: 'live' | 'mock',
    rawListings: Listing[],
    warning?: string,
  ): Promise<SearchResponse> => {
    // Normalize every listing to USD so mixed-currency results are comparable.
    const listings: Listing[] = rawListings.map((l) => ({
      ...l,
      priceUsd: toUsd(l.price, l.currency, rates),
    }));
    // Summary is computed in USD (a single, coherent currency).
    const usdListings = listings.map((l) => ({
      ...l,
      price: l.priceUsd as number,
      currency: 'USD',
    }));
    const shops = [
      ...new Set(
        listings
          .map((l) => l.shopName)
          .filter((s): s is string => typeof s === 'string' && s.length > 0),
      ),
    ];
    let velocity: SearchResponse['shopVelocity'];
    try {
      velocity = await shopVelocity(shops);
      if (Object.keys(velocity).length === 0) velocity = undefined;
    } catch {
      velocity = undefined;
    }
    return {
      mode,
      params,
      listings,
      summary: analyze(usdListings, params.keyword),
      fxRates: rates,
      fxLive,
      warning,
      fetchedAt: new Date().toISOString(),
      shopVelocity: velocity,
    };
  };

  if (useMock) {
    let warning: string | undefined;
    if (!isConfigured(cfg)) {
      warning = 'No API keys set, so sample data is shown. Add keys to .env.local for live results.';
    } else if (cfg.forceMock) {
      warning = 'ETSY_FORCE_MOCK is on, so sample data is shown.';
    }
    return NextResponse.json(await build('mock', getMockListings(params), warning));
  }

  // Live mode: try the real API, but degrade gracefully to mock on failure
  // (very common while the key is still "Pending Personal Approval").
  try {
    const listings = await fetchLiveListings(cfg, params);
    return NextResponse.json(await build('live', listings));
  } catch (err) {
    const isEtsy = err instanceof EtsyApiError;
    const status = isEtsy ? err.status : 0;
    let warning: string;
    if (status === 401 || status === 403) {
      warning =
        `Etsy rejected the key (HTTP ${status}). It's likely still pending approval or the secret is wrong. Showing sample data meanwhile.`;
    } else if (status === 429) {
      warning = 'Hit Etsy rate limit (HTTP 429). Showing sample data, try again shortly.';
    } else {
      warning =
        `Live fetch failed (${isEtsy ? 'HTTP ' + status : (err as Error).message}). Showing sample data.`;
    }
    return NextResponse.json(await build('mock', getMockListings(params), warning));
  }
}
