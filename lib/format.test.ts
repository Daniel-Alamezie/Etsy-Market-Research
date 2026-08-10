import { describe, it, expect } from 'vitest';
import { money, compact, fromEpoch, percent, decodeEntities, splitTitle } from './format';

describe('money', () => {
  it('formats whole numbers without decimals', () => {
    expect(money(5, 'USD')).toBe('$5');
  });
  it('formats fractional amounts with 2 decimals', () => {
    expect(money(7.96, 'USD')).toBe('$7.96');
  });
  it('uses the right currency symbol', () => {
    expect(money(5.9, 'GBP')).toContain('£');
    expect(money(8.5, 'EUR')).toContain('€');
  });
});

describe('compact', () => {
  it('abbreviates thousands', () => {
    expect(compact(1800)).toBe('1.8K');
    expect(compact(24500)).toBe('24.5K');
  });
  it('leaves small numbers intact', () => {
    expect(compact(60)).toBe('60');
  });
});

describe('percent', () => {
  it('rounds a fraction to a whole percent', () => {
    expect(percent(0.18)).toBe('18%');
    expect(percent(1)).toBe('100%');
    expect(percent(0)).toBe('0%');
  });
});

describe('fromEpoch', () => {
  it('returns a placeholder for 0/empty', () => {
    expect(fromEpoch(0)).toBe('n/a');
  });
  it('formats a real timestamp with the year', () => {
    // 2026-08-10 UTC
    const out = fromEpoch(Math.floor(Date.parse('2026-08-10T12:00:00Z') / 1000));
    expect(out).toContain('2026');
  });
});

describe('decodeEntities', () => {
  it('decodes named entities', () => {
    expect(decodeEntities('28&quot;x20&quot;')).toBe('28"x20"');
    expect(decodeEntities('Salt &amp; Pepper')).toBe('Salt & Pepper');
  });
  it('decodes numeric entities', () => {
    expect(decodeEntities('22x30&#39;&#39;')).toBe("22x30''");
    expect(decodeEntities('&#x27;quoted&#x27;')).toBe("'quoted'");
  });
  it('leaves plain text unchanged', () => {
    expect(decodeEntities('Sage Green Wall Art')).toBe('Sage Green Wall Art');
  });
});

describe('splitTitle', () => {
  it('splits on pipes, keeping the first segment as the name', () => {
    const { primary, rest } = splitTitle('Verdant Mist | Large Abstract | Sage Green Wall Art');
    expect(primary).toBe('Verdant Mist');
    expect(rest).toBe('Large Abstract, Sage Green Wall Art');
  });
  it('falls back to commas when there are no pipes', () => {
    const { primary, rest } = splitTitle('Textured 3D Plaster Wall Art, Wabi Sabi, Neutral Art');
    expect(primary).toBe('Textured 3D Plaster Wall Art');
    expect(rest).toBe('Wabi Sabi, Neutral Art');
  });
  it('decodes entities inside the title', () => {
    const { primary } = splitTitle('Wall Art 28&quot;x20&quot; | Extra Keywords');
    expect(primary).toBe('Wall Art 28"x20"');
  });
  it('handles a title with no separators', () => {
    const { primary, rest } = splitTitle('Just A Simple Title');
    expect(primary).toBe('Just A Simple Title');
    expect(rest).toBe('');
  });
});
