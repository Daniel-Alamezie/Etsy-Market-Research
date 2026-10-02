'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SearchResponse, StatusResponse, Listing, Summary } from '@/lib/types';
import { money, compact, fromEpoch, percent, splitTitle, decodeEntities } from '@/lib/format';
import { analyze } from '@/lib/analysis';
import { Dropdown } from './components/Dropdown';

// Quick niches pulled straight from the 2026 trend research, so the tool
// opens with useful starting points instead of a blank box.
const QUICK_NICHES = [
  'sage green japandi wall art',
  'boho mountain print set',
  'nursery print set',
  'botanical line art',
  'mid century abstract print',
  'gothic christmas wall art',
];

const DISPLAY_CURRENCIES = ['USD', 'GBP', 'EUR'] as const;
type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
const CUR_SYMBOL: Record<DisplayCurrency, string> = { USD: '$', GBP: '£', EUR: '€' };

const SORT_OPTIONS = [
  { value: 'score:desc', label: 'Relevance' },
  { value: 'created:desc', label: 'Newest first' },
  { value: 'created:asc', label: 'Oldest first' },
  { value: 'price:asc', label: 'Price: low to high' },
  { value: 'price:desc', label: 'Price: high to low' },
];

const LIMIT_OPTIONS = [
  { value: '50', label: '50 listings' },
  { value: '100', label: '100 listings' },
  { value: '200', label: '200 listings' },
  { value: '300', label: '300 listings' },
];

interface FormState {
  keyword: string;
  minPrice: string;
  maxPrice: string;
  limit: string;
  sortOn: 'score' | 'price' | 'created';
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FORM: FormState = {
  keyword: '',
  minPrice: '',
  maxPrice: '',
  limit: '100',
  sortOn: 'score',
  sortOrder: 'desc',
};

type TableSort = { key: 'price' | 'favorites' | 'createdTimestamp' | 'title'; dir: 'asc' | 'desc' };

export default function Home() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<TableSort>({ key: 'favorites', dir: 'desc' });
  const [currency, setCurrency] = useState<DisplayCurrency>('GBP');

  useEffect(() => {
    fetch('/api/etsy/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const runSearch = useCallback(async (overrideKeyword?: string) => {
    const keyword = (overrideKeyword ?? form.keyword).trim();
    if (!keyword) {
      setError('Enter a niche keyword to research.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        keyword,
        limit: form.limit,
        sortOn: form.sortOn,
        sortOrder: form.sortOrder,
      });
      if (form.minPrice) qs.set('minPrice', form.minPrice);
      if (form.maxPrice) qs.set('maxPrice', form.maxPrice);

      const res = await fetch(`/api/etsy/search?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Search failed.');
      setData(json as SearchResponse);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [form]);

  const onQuickNiche = (niche: string) => {
    setForm((f) => ({ ...f, keyword: niche }));
    runSearch(niche);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Convert every listing from its USD-normalized price into the chosen display
  // currency, then recompute the summary so all figures stay consistent.
  const displayListings = useMemo<Listing[]>(() => {
    if (!data) return [];
    const rate = data.fxRates[currency] ?? 1;
    return data.listings.map((l) => ({
      ...l,
      price: (l.priceUsd ?? l.price) * rate,
      currency,
    }));
  }, [data, currency]);

  const summary = useMemo<Summary | null>(
    () => (data ? analyze(displayListings, data.params.keyword) : null),
    [displayListings, data],
  );

  const sortedListings = useMemo(
    () => sortListings(displayListings, tableSort),
    [displayListings, tableSort],
  );

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">E</div>
          <div>
            <h1>Etsy Niche Research</h1>
            <p>Prices, tags, favorites and listing age, from public Etsy data</p>
          </div>
        </div>
        <div className="topbar-right">
          <CurrencyToggle value={currency} onChange={setCurrency} live={data?.fxLive} />
          <StatusBadge status={status} mode={data?.mode} />
        </div>
      </header>

      <SearchForm
        form={form}
        set={set}
        loading={loading}
        onSubmit={() => runSearch()}
        onQuickNiche={onQuickNiche}
      />

      <div className="caveat" role="note">
        <span aria-hidden>ⓘ</span>
        <span>
          <b>Favorites, not sales.</b> Etsy does not tell us how many items a listing has
          sold, so we use favorites as a rough sign of demand. It is good for judging price
          and competition. For sales estimates, use it alongside a tool like EverBee.
        </span>
      </div>

      {data?.warning && <div className="warning-banner">⚠ {data.warning}</div>}

      {error && (
        <div className="card card-pad error" role="alert">
          <div className="big">Something went wrong</div>
          <div>{error}</div>
        </div>
      )}

      {loading && <LoadingState />}

      {!loading && !data && !error && <EmptyState />}

      {!loading && data && summary && (
        <Results
          data={data}
          summary={summary}
          listings={sortedListings}
          currency={currency}
          tableSort={tableSort}
          onTableSort={setTableSort}
        />
      )}

      <p className="footnote">
        Personal research tool. Data from the Etsy Open API. Prices shown in {currency}
        {data && !data.fxLive ? ' using approximate exchange rates' : ''}. Favorites are a
        rough sign of demand, not confirmed sales.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CurrencyToggle({
  value,
  onChange,
  live,
}: {
  value: DisplayCurrency;
  onChange: (c: DisplayCurrency) => void;
  live?: boolean;
}) {
  const title =
    live === undefined
      ? 'Show prices in this currency'
      : live
        ? 'Prices converted with live FX rates'
        : 'Prices converted with approximate FX rates';
  return (
    <div className="cur-toggle" role="group" aria-label="Display currency" title={title}>
      {DISPLAY_CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          className={`cur-btn${c === value ? ' active' : ''}`}
          aria-pressed={c === value}
          onClick={() => onChange(c)}
        >
          {CUR_SYMBOL[c]} {c}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status, mode }: { status: StatusResponse | null; mode?: 'live' | 'mock' }) {
  const isLive = mode === 'live' || (mode == null && status?.keyActive === true);
  const cls = isLive ? 'live' : 'mock';
  const label = isLive ? 'Live data' : 'Sample data';
  const title = status?.message ?? 'Checking connection';
  return (
    <span className={`status-badge ${cls}`} title={title}>
      <span className="dot" />
      {label}
    </span>
  );
}

function SearchForm({
  form,
  set,
  loading,
  onSubmit,
  onQuickNiche,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  loading: boolean;
  onSubmit: () => void;
  onQuickNiche: (n: string) => void;
}) {
  return (
    <div className="card card-pad search-card">
      <form
        className="search-grid"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="field field-keyword">
          <label htmlFor="keyword">Niche keyword</label>
          <input
            id="keyword"
            placeholder="e.g. sage green japandi wall art"
            value={form.keyword}
            onChange={(e) => set('keyword', e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="minPrice">Min price</label>
          <input
            id="minPrice"
            type="number"
            min="0"
            placeholder="any"
            value={form.minPrice}
            onChange={(e) => set('minPrice', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="maxPrice">Max price</label>
          <input
            id="maxPrice"
            type="number"
            min="0"
            placeholder="any"
            value={form.maxPrice}
            onChange={(e) => set('maxPrice', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="sortOn">Sort by</label>
          <Dropdown
            id="sortOn"
            ariaLabel="Sort by"
            value={`${form.sortOn}:${form.sortOrder}`}
            options={SORT_OPTIONS}
            onChange={(v) => {
              const [on, order] = v.split(':');
              set('sortOn', on as FormState['sortOn']);
              set('sortOrder', order as FormState['sortOrder']);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="limit">Results</label>
          <Dropdown
            id="limit"
            ariaLabel="Number of listings"
            value={form.limit}
            options={LIMIT_OPTIONS}
            onChange={(v) => set('limit', v)}
          />
        </div>
        <div className="field field-submit">
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </form>

      <div className="chips">
        <span className="chips-label">Try:</span>
        {QUICK_NICHES.map((n) => (
          <button key={n} className="chip" type="button" onClick={() => onQuickNiche(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Results({
  data,
  summary,
  listings,
  currency,
  tableSort,
  onTableSort,
}: {
  data: SearchResponse;
  summary: Summary;
  listings: Listing[];
  currency: DisplayCurrency;
  tableSort: TableSort;
  onTableSort: (s: TableSort) => void;
}) {
  const s = summary;
  const maxBucket = Math.max(1, ...s.priceBuckets.map((b) => b.count));

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Listings analyzed"
          value={compact(s.count)}
          hint={`sample pulled for "${data.params.keyword}"`}
        />
        <Stat
          label="Typical price"
          value={money(s.price.median, currency)}
          hint="the median, so half cost more and half cost less"
          tip="The median is more reliable than the average, because one very expensive listing cannot pull it up. The average is shown below for comparison."
          extra={`average ${money(s.price.mean, currency)}`}
        />
        <Stat
          label="Price range"
          value={`${money(s.price.min, currency)} to ${money(s.price.max, currency)}`}
          hint="from the cheapest to the most expensive listing"
        />
        <Stat
          label="Typical favorites"
          value={compact(Math.round(s.favorites.mean))}
          hint="average favorites per listing, a rough sign of demand"
          tip="Favorites is the closest thing to demand the API gives us. It is not the number of sales. A lot of favorites on only a few listings can point to an opening."
          extra={`top listing ${compact(s.favorites.max)} favorites`}
        />
      </div>

      <div className="panels">
        <div className="card card-pad">
          <div className="panel-head">
            <h3 className="section-title">Price distribution</h3>
            <span className="panel-sub">where sellers set their prices ({currency})</span>
          </div>
          <div className="hist">
            {s.priceBuckets.map((b, i) => (
              <div className="hist-row" key={i}>
                <span className="hist-label">
                  {money(b.min, currency)} to {money(b.max, currency)}
                </span>
                <div className="hist-track">
                  <div className="hist-bar" style={{ width: `${(b.count / maxBucket) * 100}%` }} />
                </div>
                <span className="hist-count">{b.count}</span>
              </div>
            ))}
          </div>
          <p className="panel-foot">
            The longest bars are the most common price points. A quiet gap between the
            busy ones can be a good place to price your own listing.
          </p>
        </div>

        <div className="card card-pad">
          <div className="panel-head">
            <h3 className="section-title">Top competitor tags</h3>
            <span className="panel-sub">the keywords sellers use most</span>
          </div>
          {s.topTags.length ? (
            <div className="tag-cloud">
              {s.topTags.map((t) => (
                <span className="tag" key={t.tag} title={`${t.count} of ${s.count} listings use "${t.tag}"`}>
                  {t.tag}
                  <span className="n">{t.count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-faint)' }}>No tags returned for this search.</p>
          )}
          <p className="panel-foot">
            <b>{percent(s.dateRange.freshShare)}</b> of these listings are recent
            ({fromEpoch(s.dateRange.oldest ?? 0)} to {fromEpoch(s.dateRange.newest ?? 0)}). A
            high share means a lot of new listings are going up.
          </p>
        </div>
      </div>

      <div className="card card-pad">
        <div className="table-head">
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>
              Listings ({listings.length})
            </h3>
            <span className="panel-sub">Click a column to sort. Prices in {currency}.</span>
          </div>
          <button className="btn-ghost" onClick={() => exportCsv(data, listings, currency)}>
            Export CSV
          </button>
        </div>
        <div className="table-scroll">
          <table className="results">
            <thead>
              <tr>
                <th className="rank-col">#</th>
                <Th label="Title" col="title" sort={tableSort} onSort={onTableSort} />
                <Th label="Price" col="price" sort={tableSort} onSort={onTableSort} num />
                <Th label="Favorites" col="favorites" sort={tableSort} onSort={onTableSort} num />
                <Th label="Created" col="createdTimestamp" sort={tableSort} onSort={onTableSort} num />
                {data.shopVelocity ? <th className="num">30d sales</th> : null}
                {data.shopVelocity ? <th className="num">Trend</th> : null}
              </tr>
            </thead>
            <tbody>
              {listings.map((l, i) => {
                const { primary, rest } = splitTitle(l.title);
                return (
                  <tr key={l.id}>
                    <td className="rank-cell">{i + 1}</td>
                    <td className="title-cell">
                      <div className="title-row">
                        {l.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="thumb"
                            src={l.thumbnailUrl}
                            alt=""
                            width={44}
                            height={44}
                            loading="lazy"
                          />
                        ) : (
                          <div className="thumb thumb-ph" aria-hidden />
                        )}
                        <div className="title-text">
                          <a
                            className="title-primary"
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={decodeEntities(l.title)}
                          >
                            {primary}
                          </a>
                          <div className="title-rest">
                            {l.shopName ? <span className="title-shop">{l.shopName}</span> : null}
                            {l.shopName && rest ? ', ' : ''}
                            {rest}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{money(l.price, currency)}</td>
                    <td className="num">{compact(l.favorites)}</td>
                    <td className="num">{fromEpoch(l.createdTimestamp)}</td>
                    {data.shopVelocity ? (
                      <td className="num">
                        {(() => {
                          const v = l.shopName ? data.shopVelocity![l.shopName] : undefined;
                          if (!v || v.status === 'no_coverage' || v.sales30d == null) return 'n/a';
                          return compact(v.sales30d);
                        })()}
                      </td>
                    ) : null}
                    {data.shopVelocity ? (
                      <td className="num">
                        {(() => {
                          const v = l.shopName ? data.shopVelocity![l.shopName] : undefined;
                          if (!v || v.status === 'no_coverage') return 'n/a';
                          return v.breakout ? 'breakout' : '—';
                        })()}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Th({
  label,
  col,
  sort,
  onSort,
  num,
}: {
  label: string;
  col: TableSort['key'];
  sort: TableSort;
  onSort: (s: TableSort) => void;
  num?: boolean;
}) {
  const active = sort.key === col;
  const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th
      className={num ? 'num sortable' : 'sortable'}
      style={{ color: active ? 'var(--brand-ink)' : undefined }}
      onClick={() => onSort({ key: col, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
    >
      {label}
      {arrow}
    </th>
  );
}

function Stat({
  label,
  value,
  hint,
  extra,
  tip,
}: {
  label: string;
  value: string;
  hint: string;
  extra?: string;
  tip?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        {tip && (
          <span className="info" tabIndex={0} title={tip} aria-label={tip}>
            ⓘ
          </span>
        )}
      </div>
      <div className="value">{value}</div>
      <div className="hint">{hint}</div>
      {extra && <div className="extra">{extra}</div>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="card card-pad loading">
      <div className="spinner" />
      <div>Loading listings and working out the numbers.</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card card-pad empty">
      <div className="big">Research a print niche</div>
      <div>
        Enter a keyword (or tap a suggestion above) to pull public Etsy listings and see
        pricing, competitor tags, favorites, and listing freshness.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function sortListings(listings: Listing[], sort: TableSort): Listing[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...listings].sort((a, b) => {
    if (sort.key === 'title') return a.title.localeCompare(b.title) * dir;
    return ((a[sort.key] as number) - (b[sort.key] as number)) * dir;
  });
}

function exportCsv(data: SearchResponse, listings: Listing[], currency: string) {
  const rows = [
    ['title', `price_${currency}`, 'price_usd', 'favorites', 'created', 'shop', 'url', 'tags'],
    ...listings.map((l) => [
      l.title,
      l.price.toFixed(2),
      (l.priceUsd ?? l.price).toFixed(2),
      String(l.favorites),
      fromEpoch(l.createdTimestamp),
      l.shopName ?? '',
      l.url,
      l.tags.join('; '),
    ]),
  ];
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = data.params.keyword.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  a.href = url;
  a.download = `etsy-${safe}-${data.mode}-${currency}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
