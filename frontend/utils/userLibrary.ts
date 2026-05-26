// Fetches the user's owned games + wishlist from Steam's dynamicstore endpoint.
// This is the same call the Steam store front-end uses to mark "In Library" /
// "On Wishlist" badges; it relies on the user's session cookie which is shared
// with the Steam client browser context, so no auth token is needed.

const USERDATA_URL = 'https://store.steampowered.com/dynamicstore/userdata/';
const CACHE_KEY = 'steam-store-filters.userdata_v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface UserAppLists {
  owned: Set<number>;
  wishlist: Set<number>;
}

interface CachedShape {
  ts: number;
  owned: number[];
  wishlist: number[];
}

let inflight: Promise<UserAppLists> | null = null;
let memo: UserAppLists | null = null;

function loadFromCache(): UserAppLists | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedShape = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return { owned: new Set(parsed.owned), wishlist: new Set(parsed.wishlist) };
  } catch { return null; }
}

function saveToCache(lists: UserAppLists) {
  const payload: CachedShape = {
    ts: Date.now(),
    owned: Array.from(lists.owned),
    wishlist: Array.from(lists.wishlist),
  };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch { /* quota */ }
}

export async function getUserAppLists(force = false): Promise<UserAppLists> {
  if (!force && memo) return memo;
  if (!force) {
    const cached = loadFromCache();
    if (cached) { memo = cached; return cached; }
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const resp = await fetch(USERDATA_URL, { credentials: 'include' });
      if (!resp.ok) throw new Error(`userdata HTTP ${resp.status}`);
      const data = await resp.json();
      const owned: number[] = [
        ...(data.rgOwnedApps ?? []),
        ...(data.rgPackages ?? []), // packages are not appids, ignored downstream
      ].filter((n: any) => Number.isFinite(n));
      const wishlist: number[] = (data.rgWishlist ?? []).filter((n: any) => Number.isFinite(n));
      const lists: UserAppLists = {
        owned: new Set(data.rgOwnedApps ?? []),
        wishlist: new Set(wishlist),
      };
      memo = lists;
      saveToCache(lists);
      return lists;
    } catch (e) {
      console.warn('[steam-store-filters] userdata fetch failed:', e);
      const empty: UserAppLists = { owned: new Set(), wishlist: new Set() };
      memo = empty;
      return empty;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
