const GG_API_KEY = 'mwauuk7lS7ptVoP5J6a09rNdu2T7y5jv';
const GG_BASE = 'https://api.gg.deals/v1/prices/by-steam-app-id';

const CACHE_DEALS_TTL = 60 * 60 * 1000;            // 1 hour

export interface MarketDeal {
  shop: string;
  price: number;
  currency: string;
  url: string;
  badge: 'RT' | 'GR'; // RT = Retail, GR = Grey market
}

// ─── Country/currency detection ───────────────────────────────────────────

export function detectCountry(): string {
  const lang = navigator.language || 'en-US';
  const parts = lang.split('-');
  return parts.length >= 2 ? parts[parts.length - 1].toUpperCase() : 'US';
}

// ─── localStorage helpers ─────────────────────────────────────────────────

function cacheGet<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > ttl) { localStorage.removeItem(key); return null; }
    return data as T;
  } catch { return null; }
}

function cacheSet(key: string, data: unknown): void {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// ─── gg.deals (grey markets + retail) via Lua proxy ─────────────────────────────

async function ggDeals(appid: number, country: string): Promise<MarketDeal[]> {
  const region = country.toLowerCase();
  let raw: string;
  try {
    raw = await Millennium.callServerMethod('fetch_gg_deals', {
      appids_csv: String(appid),
      region,
    });
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const json: { success: boolean; data: Record<string, { title: string; url: string; prices: { currentRetail: string | null; currentKeyshops: string | null; currency: string } | null }> } = JSON.parse(raw);
    if (!json.success || !json.data[appid]) return [];
    const game = json.data[appid];
    if (!game) return [];
    const deals: MarketDeal[] = [];
    if (game.prices.currentKeyshops) {
      deals.push({
        shop: 'Keyshops (grey market)',
        price: parseFloat(game.prices.currentKeyshops),
        currency: game.prices.currency,
        url: game.url,
        badge: 'GR',
      });
    }
    if (game.prices.currentRetail) {
      deals.push({
        shop: 'Retail stores',
        price: parseFloat(game.prices.currentRetail),
        currency: game.prices.currency,
        url: game.url,
        badge: 'RT',
      });
    }
    return deals.sort((a, b) => a.price - b.price);
  } catch {
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function fetchBestDeals(appid: number, skipCache = false, showRetail = true, showGreyMarket = true): Promise<MarketDeal[]> {
  const country = detectCountry();
  const cacheKey = `market_deals_${appid}_${country}`;
  if (!skipCache) {
    const cached = cacheGet<MarketDeal[]>(cacheKey, CACHE_DEALS_TTL);
    if (cached) return cached.filter(d => (d.badge === 'RT' && showRetail) || (d.badge === 'GR' && showGreyMarket));
  }

  // Use gg.deals (GET, batch support, grey markets)
  let deals: MarketDeal[] = [];
  try { deals = await ggDeals(appid, country); } catch {}

  if (deals.length > 0) cacheSet(cacheKey, deals);
  return deals.filter(d => (d.badge === 'RT' && showRetail) || (d.badge === 'GR' && showGreyMarket));
}
