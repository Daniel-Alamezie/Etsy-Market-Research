import { ApifyClient } from 'apify-client';

export type ShopVelocityRow = {
  sales30d: number | null;
  ratePerDay: number | null;
  breakout: boolean | null;
  readings: number;
  fidelity: string | null;
  status: 'ok' | 'no_coverage';
  /** Live Actor field aliases */
  delta_28d: number | null;
  sales_per_day: number | null;
  history_days: number;
  sales_precision: string | null;
};

/**
 * Optional hosted shop sales history via publicrecords/etsy-shop-velocity.
 * Off without APIFY_TOKEN. Live fields confirmed against Actor dataset
 * (run Y4DLGuoWhmkhSvIa3): delta_28d, sales_per_day, breakout, history_days,
 * sales_precision; shops absent from the panel are treated as no_coverage.
 */
export async function shopVelocity(shops: string[]): Promise<Record<string, ShopVelocityRow>> {
  if (!process.env.APIFY_TOKEN || shops.length === 0) return {};
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const run = await client.actor('publicrecords/etsy-shop-velocity').call({ shops });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const out: Record<string, ShopVelocityRow> = {};
  const seen = new Set<string>();
  for (const r of items as Record<string, unknown>[]) {
    const shop = typeof r.shop === 'string' ? r.shop : null;
    if (!shop) continue;
    seen.add(shop);
    const delta28 = typeof r.delta_28d === 'number' ? r.delta_28d : null;
    const rate = typeof r.sales_per_day === 'number' ? r.sales_per_day : null;
    const history = typeof r.history_days === 'number' ? r.history_days : 0;
    const precision = typeof r.sales_precision === 'string' ? r.sales_precision : null;
    out[shop] = {
      sales30d: delta28,
      ratePerDay: rate,
      breakout: typeof r.breakout === 'boolean' ? r.breakout : null,
      readings: history,
      fidelity: precision,
      status: 'ok',
      delta_28d: delta28,
      sales_per_day: rate,
      history_days: history,
      sales_precision: precision,
    };
  }
  for (const shop of shops) {
    if (!seen.has(shop)) {
      out[shop] = {
        sales30d: null,
        ratePerDay: null,
        breakout: null,
        readings: 0,
        fidelity: null,
        status: 'no_coverage',
        delta_28d: null,
        sales_per_day: null,
        history_days: 0,
        sales_precision: null,
      };
    }
  }
  return out;
}
