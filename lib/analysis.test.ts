import { describe, it, expect } from 'vitest';
import { analyze } from './analysis';
import type { Listing } from './types';

const DAY = 24 * 60 * 60;
const NOW = Math.floor(Date.parse('2026-08-10T00:00:00Z') / 1000);

function makeListing(partial: Partial<Listing>): Listing {
  return {
    id: Math.floor(Math.random() * 1e6),
    title: 'Test listing',
    price: 10,
    currency: 'USD',
    favorites: 0,
    createdTimestamp: NOW,
    tags: [],
    url: 'https://example.com',
    ...partial,
  };
}

describe('analyze', () => {
  const listings: Listing[] = [
    makeListing({ price: 10, favorites: 5, tags: ['boho', 'wall art'], createdTimestamp: NOW }),
    makeListing({ price: 20, favorites: 15, tags: ['boho', 'minimalist'], createdTimestamp: NOW - 10 * DAY }),
    makeListing({ price: 30, favorites: 0, tags: ['zen'], createdTimestamp: NOW - 200 * DAY }),
  ];
  const s = analyze(listings, 'print');

  it('counts listings', () => {
    expect(s.count).toBe(3);
  });

  it('computes price stats', () => {
    expect(s.price.min).toBe(10);
    expect(s.price.max).toBe(30);
    expect(s.price.mean).toBe(20);
    expect(s.price.median).toBe(20);
  });

  it('computes favorites stats', () => {
    expect(s.favorites.total).toBe(20);
    expect(s.favorites.max).toBe(15);
    expect(s.favorites.mean).toBeCloseTo(6.667, 2);
  });

  it('ranks tags by frequency and filters stop/keyword tags', () => {
    const boho = s.topTags.find((t) => t.tag === 'boho');
    expect(boho?.count).toBe(2);
    // 'wall art' is a stop tag and should be excluded.
    expect(s.topTags.some((t) => t.tag === 'wall art')).toBe(false);
  });

  it('buckets prices so counts sum to the listing total', () => {
    const total = s.priceBuckets.reduce((acc, b) => acc + b.count, 0);
    expect(total).toBe(3);
  });

  it('computes date range and freshness (last 90 days)', () => {
    expect(s.dateRange.newest).toBe(NOW);
    expect(s.dateRange.oldest).toBe(NOW - 200 * DAY);
    // 2 of 3 listings are within 90 days of the newest.
    expect(s.dateRange.freshShare).toBeCloseTo(2 / 3, 5);
  });

  it('handles an empty listing set without throwing', () => {
    const empty = analyze([], 'print');
    expect(empty.count).toBe(0);
    expect(empty.price.median).toBe(0);
    expect(empty.topTags).toEqual([]);
  });
});
