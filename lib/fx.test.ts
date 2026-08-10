import { describe, it, expect, vi, afterEach } from 'vitest';
import { toUsd, CURRENCY_SYMBOL, DISPLAY_CURRENCIES, getRates } from './fx';

describe('toUsd', () => {
  const rates = { USD: 1, GBP: 0.79, EUR: 0.92 };

  it('converts a GBP amount to USD', () => {
    expect(toUsd(79, 'GBP', rates)).toBeCloseTo(100, 5);
  });
  it('leaves USD unchanged', () => {
    expect(toUsd(50, 'USD', rates)).toBe(50);
  });
  it('falls back to the raw amount for an unknown currency', () => {
    expect(toUsd(100, 'XYZ', rates)).toBe(100);
  });
});

describe('currency metadata', () => {
  it('exposes symbols for all display currencies', () => {
    for (const c of DISPLAY_CURRENCIES) {
      expect(CURRENCY_SYMBOL[c]).toBeTruthy();
    }
    expect(CURRENCY_SYMBOL.GBP).toBe('£');
  });
});

describe('getRates fallback', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns static rates when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const { rates, live } = await getRates();
    expect(live).toBe(false);
    expect(rates.USD).toBe(1);
    expect(rates.GBP).toBeGreaterThan(0);
  });
});
