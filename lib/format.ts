// Small display formatters shared by the UI.

export function money(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function compact(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fromEpoch(sec: number): string {
  if (!sec) return '—';
  return new Date(sec * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function percent(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', deg: '°', frac12: '½', frac14: '¼', frac34: '¾',
};

/** Decode HTML entities Etsy returns in titles (&quot; &#39; &amp; …). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

/**
 * Etsy titles are keyword-stuffed (segments split by "|" or commas). Pull the
 * first segment as the real product name and keep the rest as a muted tail, so
 * the table is scannable instead of a word dump.
 */
export function splitTitle(raw: string): { primary: string; rest: string } {
  const t = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  let parts = t.split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    parts = t.split(/[,–—]/).map((s) => s.trim()).filter(Boolean);
  }
  const primary = parts[0] || t;
  const rest = parts.slice(1).join(' · ');
  return { primary, rest };
}
