const CACHE_METACRITIC_TTL = 24 * 60 * 60 * 1000; // 24 hours

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

export async function fetchMetacriticScore(appid: number): Promise<number | null> {
  const cacheKey = `metacritic_score_${appid}`;
  const cached = cacheGet<number | null>(cacheKey, CACHE_METACRITIC_TTL);
  if (cached !== null) return cached;

  try {
    const score = await Millennium.callServerMethod('fetch_metacritic_score', { steam_appid: String(appid) });
    if (score !== null && score !== undefined) {
      cacheSet(cacheKey, score);
      return score;
    }
  } catch {}
  return null;
}

// Batch fetch Metacritic scores for multiple appids (for sorting)
export async function fetchMetacriticScoresBatch(appids: number[]): Promise<Map<number, number>> {
  const scores = new Map<number, number>();
  const uncached: number[] = [];

  for (const appid of appids) {
    const cacheKey = `metacritic_score_${appid}`;
    const cached = cacheGet<number | null>(cacheKey, CACHE_METACRITIC_TTL);
    if (cached !== null) {
      scores.set(appid, cached);
    } else {
      uncached.push(appid);
    }
  }

  // Fetch uncached scores in parallel (throttled to avoid rate-limiting)
  const BATCH_SIZE = 3; // More conservative for scraping
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (appid) => {
      const score = await fetchMetacriticScore(appid);
      if (score !== null) scores.set(appid, score);
    }));
  }

  return scores;
}
