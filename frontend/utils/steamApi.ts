import { callable } from '@steambrew/client';

export type SortBy = 'Reviews' | 'Release_Date' | 'Price' | '_ASC' | 'Score';

// FFI binding to Lua backend for Steam search (bypass CORS)
const fetchSteamSearchLua = callable<[{ url: string }], string>('fetch_steam_search');

// Cache for screenshot URLs (24h TTL)
const SCREENSHOT_CACHE_KEY = 'steam-store-filters-screenshots';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface ScreenshotCache {
  [appid: number]: { urls: string[]; timestamp: number };
}

function getScreenshotCache(): ScreenshotCache {
  try {
    const cached = localStorage.getItem(SCREENSHOT_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return {};
}

function setScreenshotCache(cache: ScreenshotCache) {
  try {
    localStorage.setItem(SCREENSHOT_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export async function fetchScreenshots(appid: number): Promise<string[]> {
  const cache = getScreenshotCache();
  const cached = cache[appid];
  
  // Return cached if valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.urls;
  }
  
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=french&cc=FR`;
    const response = await fetch(url);
    const data = await response.json();
    
    const appData = data[appid];
    if (!appData || !appData.success || !appData.data || !appData.data.screenshots) {
      return [];
    }
    
    const screenshots = appData.data.screenshots
      .filter((s: any) => !s.type || s.type !== 'video')
      .map((s: any) => s.path_full)
      .slice(0, 4);
    
    // Cache the result
    cache[appid] = { urls: screenshots, timestamp: Date.now() };
    setScreenshotCache(cache);
    
    return screenshots;
  } catch (e) {
    console.error('[steam-store-filters] Failed to fetch screenshots:', e);
    return [];
  }
}

export interface SearchResult {
  appid: number;
  name: string;
  tiny_image: string;     // capsule image URL
  price: number;          // final price in cents (0 = free OR data unavailable)
  price_known: boolean;   // true if price data was present in API response
  discount_percent: number;
  original_price: number; // initial price in cents
  review_score: number;        // 0–9 enum
  review_score_desc: string;   // "Overwhelmingly Positive", etc.
  total_reviews: number;
  total_positive: number;
  recent_total_reviews?: number;
  recent_total_positive?: number;
  released: boolean;
  release_date: string;
  release_timestamp: number; // Unix seconds from IStoreBrowseService
  type?: number;          // 0=game, 1=dlc, 2=software, 3=video, etc.
}

// FFI binding to Lua backend (bypasses CORS via libcurl).
// Returns "appid:total:positive;..." string. Single endpoint is sequential
// libcurl, so we cache aggressively in localStorage to keep things snappy.
const fetchRecentReviewsBatchLua = callable<[{ appids_csv: string }], string>('fetch_recent_reviews_batch');

type RecentEntry = { total_reviews: number; total_positive: number; ts: number };
const RECENT_CACHE_KEY = 'steam-store-filters.recent_reviews_v1';
const RECENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function loadRecentCache(): Record<string, RecentEntry> {
  try {
    const raw = localStorage.getItem(RECENT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveRecentCache(cache: Record<string, RecentEntry>): void {
  try { localStorage.setItem(RECENT_CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

async function fetchRecentReviewsBatch(appids: number[]): Promise<Map<number, { total_reviews: number; total_positive: number }>> {
  const out = new Map<number, { total_reviews: number; total_positive: number }>();
  if (appids.length === 0) return out;

  const cache = loadRecentCache();
  const now = Date.now();
  const toFetch: number[] = [];

  for (const id of appids) {
    const c = cache[String(id)];
    if (c && now - c.ts < RECENT_CACHE_TTL_MS) {
      out.set(id, { total_reviews: c.total_reviews, total_positive: c.total_positive });
    } else {
      toFetch.push(id);
    }
  }

  if (toFetch.length === 0) return out;

  try {
    const csv = await fetchRecentReviewsBatchLua({ appids_csv: toFetch.join(',') });
    if (typeof csv === 'string' && csv !== '') {
      for (const entry of csv.split(';')) {
        const [a, t, p] = entry.split(':').map(Number);
        if (Number.isFinite(a) && Number.isFinite(t) && Number.isFinite(p)) {
          out.set(a, { total_reviews: t, total_positive: p });
          cache[String(a)] = { total_reviews: t, total_positive: p, ts: now };
        }
      }
      saveRecentCache(cache);
    }
  } catch (e) {
    console.warn('[steam-store-filters] recent-reviews Lua call failed:', e);
  }
  return out;
}

export interface SearchResponse {
  total_count: number;
  items: SearchResult[];
  start: number;
}

// Use the "infinite scroll" endpoint: it returns JSON with HTML inside, but
// unlike /search/results?json=1 it correctly applies ALL filters
// (supportedlang, os, category2, vrsupport, etc.).
const STORE_SEARCH_BASE = 'https://store.steampowered.com/search/';
const STORE_BROWSE_BASE = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1';

/**
 * Search the Steam catalog by tag IDs, with pagination and sorting.
 */
export async function searchGames(params: {
  tags: number[];
  sortBy: SortBy;
  start: number;
  count: number;
  formula?: import('../utils/wilson').ScoreFormula;
  language?: string;
  os?: string[];
  features?: number[];
  vrSupport?: number[];
  accessibilityFeatures?: number[];
  hiddenGems?: boolean;
  hiddenGemsMinReviews?: number;
  hiddenGemsMaxReviews?: number;
  reviewPeriod?: 'total' | 'recent';
  excludeDLC?: boolean;
  releaseFrom?: number; // Unix timestamp
  releaseTo?: number;   // Unix timestamp
  signal?: AbortSignal;
  onProgress?: (items: SearchResult[], progress: { fetched: number; total: number }) => void;
  skipLocalSort?: boolean; // Skip local sorting for batch fetches
}): Promise<SearchResponse> {
  const url = new URL(STORE_SEARCH_BASE);
  url.searchParams.set('infinite', '1');
  url.searchParams.set('sort_by', params.sortBy);
  url.searchParams.set('start', String(params.start));
  url.searchParams.set('count', String(params.count));

  if (params.tags.length > 0) {
    url.searchParams.set('tags', params.tags.join(','));
  }

  if (params.language) {
    // Steam expects 'supportedlang' (no underscore). 'supported_lang' is silently
    // ignored by the search endpoint.
    url.searchParams.set('supportedlang', params.language);
  }

  if (params.os && params.os.length > 0) {
    for (const o of params.os) {
      url.searchParams.append('os', o);
    }
  }

  if (params.features && params.features.length > 0) {
    for (const f of params.features) {
      url.searchParams.append('category2', String(f));
    }
  }

  if (params.vrSupport && params.vrSupport.length > 0) {
    for (const v of params.vrSupport) {
      url.searchParams.append('vrsupport', String(v));
    }
  }

  if (params.accessibilityFeatures && params.accessibilityFeatures.length > 0) {
    for (const a of params.accessibilityFeatures) {
      url.searchParams.append('category3', String(a));
    }
  }

  // Use Lua backend to bypass CORS
  const body = await fetchSteamSearchLua({ url: url.toString() });
  if (!body) {
    throw new Error('Steam search API error: empty response');
  }

  const data = JSON.parse(body);
  const html: string = data.results_html ?? '';

  // Extract ordered appids from the HTML rows. Steam emits each result as
  // <a ... data-ds-appid="NNN" ...>. Skip rows with multiple appids (bundles)
  // by ignoring the comma in data-ds-appid value.
  const appidRegex = /data-ds-appid="(\d+)"/g;
  const seen = new Set<number>();
  const orderedAppids: number[] = [];
  for (const match of html.matchAll(appidRegex)) {
    const id = Number(match[1]);
    if (id && !seen.has(id)) { seen.add(id); orderedAppids.push(id); }
  }

  // Extract release dates from HTML - look for search_released class
  const releaseDateMap = new Map<number, number>(); // appid -> timestamp
  const releaseRegex = /<div[^>]*class="[^"]*search_released[^"]*"[^>]*>([^<]*)<\/div>/g;
  let releaseMatch;
  let appidIndex = 0;
  while ((releaseMatch = releaseRegex.exec(html)) !== null && appidIndex < orderedAppids.length) {
    const dateStr = releaseMatch[1].trim();
    if (dateStr && dateStr !== 'TBA' && dateStr !== 'Coming Soon') {
      const ts = Math.floor(new Date(dateStr).getTime() / 1000);
      if (!isNaN(ts) && ts > 0) {
        // Associate with the appid at this position
        // Note: this is approximate since HTML structure varies
        const rowMatch = html.substring(0, releaseMatch.index).match(/data-ds-appid="(\d+)"[^>]*$/);
        if (rowMatch) {
          const appid = Number(rowMatch[1]);
          if (!isNaN(appid)) {
            releaseDateMap.set(appid, ts);
          }
        }
      }
    }
  }

  const items: SearchResult[] = orderedAppids.map((appid) => {
    const releaseTs = releaseDateMap.get(appid) ?? 0;
    return {
    appid,
    name: '',
    tiny_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`,
    price: 0,
    price_known: false,
    discount_percent: 0,
    original_price: 0,
    review_score: 0,
    review_score_desc: '',
    total_reviews: 0,
    total_positive: 0,
    released: true,
    release_date: releaseTs ? new Date(releaseTs * 1000).toISOString().split('T')[0] : '',
    release_timestamp: releaseTs,
    };
  });

  // Enrich with price + review data from IStoreBrowseService/GetItems/v1
  try {
    const enriched = await fetchStoreItems(items.map(i => i.appid));
    for (const item of items) {
      const extra = enriched.get(item.appid);
      if (extra) {
        if (extra.name) item.name = extra.name;
        if (extra.tiny_image) item.tiny_image = extra.tiny_image;
        if (extra.price_known) {
          item.price = extra.price!;
          item.price_known = extra.price_known!;
          item.discount_percent = extra.discount_percent!;
          item.original_price = extra.original_price!;
        }
        if ((extra.total_reviews ?? 0) > 0) {
          item.total_reviews = extra.total_reviews!;
          item.total_positive = extra.total_positive!;
          item.review_score = extra.review_score || item.review_score;
          item.review_score_desc = extra.review_score_desc || item.review_score_desc;
        }
        if (extra.release_timestamp) item.release_timestamp = extra.release_timestamp;
        if (extra.type !== undefined) item.type = extra.type;
      }
    }
  } catch (_) { /* enrich is best-effort */ }

  // Apply Hidden Gems filtering before recent-reviews fetch (smaller batch).
  if (params.hiddenGems) {
    const minReviews = params.hiddenGemsMinReviews ?? 50;
    const maxReviews = params.hiddenGemsMaxReviews ?? 1500;
    const minReviewScore = 7; // 7=Positive, 8=Very Positive, 9=Overwhelmingly Positive
    const filtered = items.filter(item =>
      item.total_reviews >= minReviews &&
      item.total_reviews <= maxReviews &&
      item.review_score >= minReviewScore);
    items.length = 0;
    items.push(...filtered);
  }

  // Apply DLC filtering. IStoreBrowseService type: 0=game, 1=dlc, 2=software, 3=video.
  if (params.excludeDLC) {
    const filtered = items.filter(item => item.type === 0 || item.type === undefined);
    items.length = 0;
    items.push(...filtered);
  }

  // Apply release date filtering (client-side since API doesn't support it well)
  if (params.releaseFrom || params.releaseTo) {
    const filtered = items.filter(item => {
      const ts = item.release_timestamp ?? 0;
      if (ts === 0) return false;
      if (params.releaseFrom && ts < params.releaseFrom) return false;
      if (params.releaseTo && ts > params.releaseTo) return false;
      return true;
    });
    items.length = 0;
    items.push(...filtered);
  }

  const { computeScore: calcScore } = await import('../utils/wilson');
  const sortItems = (arr: SearchResult[], sortOverride?: SortBy) => {
    arr.sort((a, b) => {
      switch (params.sortBy) {
        case 'Price':
          return a.price - b.price;
        case '_ASC':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'Release_Date':
          return (b.release_timestamp ?? 0) - (a.release_timestamp ?? 0);
        case 'Score': {
          const f = params.formula ?? 'steamdb';
          const useRecent = params.reviewPeriod === 'recent';
          const aN = useRecent && a.recent_total_reviews ? a.recent_total_reviews : a.total_reviews;
          const aP = useRecent && a.recent_total_reviews ? (a.recent_total_positive ?? 0) : a.total_positive;
          const bN = useRecent && b.recent_total_reviews ? b.recent_total_reviews : b.total_reviews;
          const bP = useRecent && b.recent_total_reviews ? (b.recent_total_positive ?? 0) : b.total_positive;
          const sa = aN > 0 ? calcScore(aP, aN, f) : 0;
          const sb = bN > 0 ? calcScore(bP, bN, f) : 0;
          return sb - sa;
        }
        case 'Reviews':
        default:
          return (b.review_score * 1_000_000 + b.total_reviews) -
                 (a.review_score * 1_000_000 + a.total_reviews);
      }
    });
  };

  // Initial sort using all-reviews data (skip if requested for batch fetches).
  if (!params.skipLocalSort) {
    sortItems(items);
  }

  // Progressive fetch of recent reviews when needed, in chunks. The cache hit
  // path inside fetchRecentReviewsBatch is synchronous, so cached entries are
  // applied on the first chunk for free.
  if (params.reviewPeriod === 'recent' && items.length > 0) {
    const candidates = items.filter(i => i.total_reviews > 0).map(i => i.appid);
    const CHUNK_SIZE = 8;
    let fetched = 0;
    const total = candidates.length;

    // Initial progress event so UI can show items immediately
    params.onProgress?.([...items], { fetched: 0, total });

    for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
      if (params.signal?.aborted) break;
      const chunk = candidates.slice(i, i + CHUNK_SIZE);
      const recent = await fetchRecentReviewsBatch(chunk);
      for (const item of items) {
        const r = recent.get(item.appid);
        if (r) {
          item.recent_total_reviews = r.total_reviews;
          item.recent_total_positive = r.total_positive;
        }
      }
      fetched = Math.min(i + CHUNK_SIZE, total);
      sortItems(items);
      params.onProgress?.([...items], { fetched, total });
    }
  }

  return {
    // total_count can be 0 even with results — use items.length as minimum
    total_count: Math.max(data.total_count ?? 0, items.length),
    items,
    start: params.start,
  };
}

/**
 * Fetch price + review data for a batch of appids via IStoreBrowseService/GetItems/v1.
 * Returns a Map<appid, partial SearchResult>.
 */
export async function fetchStoreItems(
  appids: number[]
): Promise<Map<number, Partial<SearchResult>>> {
  const result = new Map<number, Partial<SearchResult>>();
  if (appids.length === 0) return result;

  const inputJson = JSON.stringify({
    ids: appids.map(id => ({ appid: id })),
    context: { language: 'english', country_code: 'US', steam_realm: 1 },
    data_request: {
      include_reviews: true,
      include_basic_info: true,
      include_prices: true,
      include_release: true,
      include_platforms: true,
      include_assets: true,
    },
  });

  const url = `${STORE_BROWSE_BASE}/?input_json=${encodeURIComponent(inputJson)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`IStoreBrowseService error: ${resp.status}`);

  const data = await resp.json();
  const storeItems: any[] = data?.response?.store_items ?? [];

  for (const si of storeItems) {
    const appid = si.appid ?? si.id;
    if (!appid) continue;

    const priceObj = si.best_purchase_option ?? si.price ?? null;
    const hasPriceData = priceObj !== null && typeof priceObj === 'object';
    const finalPrice  = hasPriceData ? (priceObj.final_price_in_cents ?? priceObj.final ?? 0) : 0;
    const initPrice   = hasPriceData ? (priceObj.original_price_in_cents ?? priceObj.initial ?? finalPrice) : 0;
    const discount    = hasPriceData ? (priceObj.discount_pct ?? priceObj.discount_percent ?? 0) : 0;

    // IStoreBrowseService uses review_count (not total_reviews) and percent_positive (not review_score)
    const rev = si.reviews?.summary_filtered ?? si.reviews?.summary_unfiltered ?? {};
    const totalReviews  = rev.review_count ?? rev.total_reviews ?? si.review_count ?? si.total_reviews ?? 0;
    const reviewPct     = rev.percent_positive ?? rev.review_percentage ?? si.review_percentage ?? 0;
    const totalPositive = totalReviews > 0 ? Math.round(totalReviews * reviewPct / 100) : 0;
    const reviewScore     = rev.review_score ?? si.review_score ?? 0;
    const reviewScoreDesc = rev.review_score_label ?? rev.review_score_desc ?? si.review_score_desc ?? '';

    const releaseTs: number = si.release?.steam_release_date 
      ?? si.release?.original_release_date 
      ?? si.steam_release_date 
      ?? si.original_release_date 
      ?? 0;
    
    // Build proper capsule URL from assets. Steam emits a per-app hash that
    // changes when art is updated; the legacy unhashed URL 404s for newer apps.
    let capsuleUrl = '';
    const assets = si.assets;
    if (assets?.asset_url_format && assets?.small_capsule) {
      const path = assets.asset_url_format.replace('${FILENAME}', assets.small_capsule);
      capsuleUrl = `https://shared.fastly.steamstatic.com/store_item_assets/${path}`;
    }

    result.set(Number(appid), {
      name: si.name,
      tiny_image: capsuleUrl || undefined,
      price: finalPrice,
      price_known: hasPriceData,
      discount_percent: discount,
      original_price: initPrice,
      total_reviews: totalReviews,
      total_positive: totalPositive,
      review_score: reviewScore,
      review_score_desc: reviewScoreDesc,
      release_timestamp: releaseTs,
      type: si.type ?? si.item_type,
    });
  }

  return result;
}

/** Format a price in cents to a readable string, e.g. 1999 → "$19.99" */
export function formatPrice(cents: number, currency = 'USD'): string {
  if (cents === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
