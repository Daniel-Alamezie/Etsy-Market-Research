import { NextResponse } from 'next/server';
import { getConfig, isConfigured, fetchLiveListings, EtsyApiError } from '@/lib/etsy';
import type { StatusResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Reports whether keys are present and, if so, probes the API with one tiny
 * request to see whether the key is actually active yet (approval can lag).
 */
export async function GET() {
  const cfg = getConfig();

  if (!isConfigured(cfg)) {
    const body: StatusResponse = {
      configured: false,
      forceMock: cfg.forceMock,
      keyActive: null,
      message: 'No API keys detected in .env.local. The tool runs on sample data.',
    };
    return NextResponse.json(body);
  }

  if (cfg.forceMock) {
    const body: StatusResponse = {
      configured: true,
      forceMock: true,
      keyActive: null,
      message: 'Keys detected, but ETSY_FORCE_MOCK is on, so sample data is being used.',
    };
    return NextResponse.json(body);
  }

  // Probe with a minimal live call.
  try {
    await fetchLiveListings(cfg, {
      keyword: 'wall art',
      limit: 1,
      sortOn: 'score',
      sortOrder: 'desc',
    });
    const body: StatusResponse = {
      configured: true,
      forceMock: false,
      keyActive: true,
      message: 'Live connection to Etsy is working. Pulling real listing data.',
    };
    return NextResponse.json(body);
  } catch (err) {
    const status = err instanceof EtsyApiError ? err.status : 0;
    const pending = status === 401 || status === 403;
    const body: StatusResponse = {
      configured: true,
      forceMock: false,
      keyActive: false,
      message: pending
        ? `Keys detected but Etsy returned HTTP ${status}. The key is probably still "Pending Personal Approval", so sample data will be used until it activates.`
        : `Keys detected but the probe failed (${status || (err as Error).message}). Using sample data.`,
    };
    return NextResponse.json(body);
  }
}
