import { describe, it, expect } from 'vitest';
import { buildMockListings } from './mock';
import type { SearchParams } from './types';

function params(overrides: Partial<SearchParams> = {}): SearchParams {
  return {
    keyword: 'trinket dish',
    limit: 20,
    sortOn: 'score',
    sortOrder: 'desc',
    ...overrides,
  };
}

describe('buildMockListings', () => {
  it('respects the requested limit (capped at 60)', () => {
    expect(buildMockListings(params({ limit: 20 }))).toHaveLength(20);
    expect(buildMockListings(params({ limit: 300 }))).toHaveLength(60);
  });

  it('is deterministic for the same query', () => {
    const a = buildMockListings(params());
    const b = buildMockListings(params());
    expect(a).toEqual(b);
  });

  it('varies with the keyword', () => {
    const a = buildMockListings(params({ keyword: 'trinket dish' }));
    const b = buildMockListings(params({ keyword: 'wall art' }));
    expect(a[0].title).not.toBe(b[0].title);
  });

  it('produces valid listings that mention the keyword', () => {
    const listings = buildMockListings(params({ keyword: 'ring holder' }));
    for (const l of listings) {
      expect(l.price).toBeGreaterThan(0);
      expect(l.favorites).toBeGreaterThanOrEqual(0);
      expect(l.tags).toContain('ring holder');
    }
  });

  it('sorts by price ascending when requested', () => {
    const listings = buildMockListings(params({ sortOn: 'price', sortOrder: 'asc' }));
    const prices = listings.map((l) => l.price);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });
});
