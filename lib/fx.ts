import 'server-only';

// Currencies we let the user view prices in.
export const DISPLAY_CURRENCIES = ['USD', 'GBP', 'EUR'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
};

// Rates are "units of X per 1 USD". Used to (a) normalize any listing's native
// price to USD, and (b) convert USD → the user's chosen display currency.
// Static fallback (approx, mid-2026) so the tool always works offline; we try
// to refresh from a free no-key endpoint at runtime.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  CAD: 1.37,
  AUD: 1.51,
  JPY: 157,
  NZD: 1.64,
  CHF: 0.9,
  SEK: 10.6,
  DKK: 6.9,
  NOK: 10.7,
  PLN: 3.95,
};

interface RateCache {
  rates: Record<string, number>;
  fetchedAtMs: number;
  live: boolean;
}

let cache: RateCache | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface FxResult {
  rates: Record<string, number>;
  live: boolean;
}

/** Get USD-based FX rates, cached, with a static fallback. */
export async function getRates(): Promise<FxResult> {
  const now = Date.now();
  if (cache && now - cache.fetchedAtMs < TTL_MS) {
    return { rates: cache.rates, live: cache.live };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.rates && typeof json.rates.USD === 'number') {
        // Merge onto fallback so we always have our display currencies.
        const rates = { ...FALLBACK_RATES, ...json.rates };
        cache = { rates, fetchedAtMs: now, live: true };
        return { rates, live: true };
      }
    }
  } catch {
    /* network failed — fall through to static rates */
  } finally {
    clearTimeout(timer);
  }

  cache = { rates: FALLBACK_RATES, fetchedAtMs: now, live: false };
  return { rates: FALLBACK_RATES, live: false };
}

/** Convert a native-currency amount to USD using USD-based rates. */
export function toUsd(amount: number, currency: string, rates: Record<string, number>): number {
  const rate = rates[currency];
  if (!rate || rate <= 0) return amount; // unknown currency → assume already USD-ish
  return amount / rate;
}
