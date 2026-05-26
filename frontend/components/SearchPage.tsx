import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { SteamTag, STEAM_TAGS } from '../utils/tags';
import { STEAM_LANGUAGES, SteamLanguage } from '../utils/languages';
import { STEAM_PLATFORMS, STEAM_FEATURES, STEAM_VR, STEAM_ACCESSIBILITY, SteamFeature, SteamPlatform, SteamAccessibility } from '../utils/features';
import { SearchResult, searchGames, SortBy } from '../utils/steamApi';
import { computeScore } from '../utils/wilson';
import { ScoreFormula } from '../utils/wilson';
import { UnifiedFilterInput, FilterToken } from './UnifiedFilterInput';
import { getUserAppLists } from '../utils/userLibrary';
import { loadHideBlacklist, hideGame, blacklistGame, clearHidden, clearBlacklist, unhideGame, unblacklistGame, HideBlacklistState } from '../utils/hideBlacklist';
import { loadCollections, createCollection, deleteCollection, addGameToCollection, removeGameFromCollection, getCollectionById, getCollectionsContainingGame, GameCollection } from '../utils/savedLists';
import { SortBar } from './SortBar';
import { GameGrid } from './GameGrid';

const PAGE_SIZE = 50; // Display size per page
const INITIAL_FETCH_SIZE = 1000; // Fetch 1000 results initially for proper sorting

// Local sorting function for batch results (same logic as in steamApi.ts)
function sortBatchItems(items: SearchResult[], sortBy: SortBy, formula: ScoreFormula, reviewPeriod: 'total' | 'recent') {
  items.sort((a, b) => {
    switch (sortBy) {
      case 'Price':
        return a.price - b.price;
      case '_ASC':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'Release_Date':
        return (b.release_timestamp ?? 0) - (a.release_timestamp ?? 0);
      case 'Score': {
        const useRecent = reviewPeriod === 'recent';
        const aN = useRecent && a.recent_total_reviews ? a.recent_total_reviews : a.total_reviews;
        const aP = useRecent && a.recent_total_reviews ? (a.recent_total_positive ?? 0) : a.total_positive;
        const bN = useRecent && b.recent_total_reviews ? b.recent_total_reviews : b.total_reviews;
        const bP = useRecent && b.recent_total_reviews ? (b.recent_total_positive ?? 0) : b.total_positive;
        const sa = aN > 0 ? computeScore(aP, aN, formula) : 0;
        const sb = bN > 0 ? computeScore(bP, bN, formula) : 0;
        return sb - sa;
      }
      case 'Reviews':
      default:
        return (b.review_score * 1_000_000 + b.total_reviews) -
               (a.review_score * 1_000_000 + a.total_reviews);
    }
  });
}

// ─── Chip toggle used for every flat filter section ───────────────────────
function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <span
      onClick={onToggle}
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        margin: '3px 4px 3px 0',
        borderRadius: '3px',
        fontSize: '12px',
        cursor: 'pointer',
        userSelect: 'none',
        background: active ? 'rgba(102,192,244,0.22)' : 'rgba(255,255,255,0.06)',
        border: active ? '1px solid rgba(102,192,244,0.55)' : '1px solid rgba(255,255,255,0.1)',
        color: active ? '#66c0f4' : '#c6d4df',
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      {label}
    </span>
  );
}

// ─── Enhanced collapsible section with visual grouping ─────────────────────
function CollapsibleSection({ 
  title, 
  children, 
  defaultOpen = true,
  icon = null,
  storageKey = null 
}: { 
  title: string; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  storageKey?: string | null;
}) {
  const [open, setOpen] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) return JSON.parse(saved);
      } catch {}
    }
    return defaultOpen;
  });

  const toggleOpen = () => {
    const newState = !open;
    setOpen(newState);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newState));
    }
  };

  return (
    <div style={{ 
      marginBottom: '12px',
      background: 'rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      <button
        onClick={toggleOpen}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.03)',
          border: 'none',
          borderBottom: open ? '1px solid rgba(255,255,255,0.05)' : 'none',
          cursor: 'pointer',
          color: '#c6d4df',
          fontSize: '12px',
          fontWeight: 600,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      >
        <span style={{ 
          transform: open ? 'rotate(90deg)' : 'none', 
          display: 'inline-block', 
          transition: 'transform 0.15s',
          color: '#66c0f4',
          fontSize: '10px',
        }}>▶</span>
        {icon && <span style={{ fontSize: '14px' }}>{icon}</span>}
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
      </button>
      {open && (
        <div style={{ padding: '12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Language search box ──────────────────────────────────────────────────
function LanguagePicker({ selected, onChange }: { selected: string | null; onChange: (code: string | null) => void }) {
  const [query, setQuery] = useState('');
  const filtered = query
    ? STEAM_LANGUAGES.filter(l => l.label.toLowerCase().includes(query.toLowerCase()))
    : STEAM_LANGUAGES;

  return (
    <div>
      <input
        type="text"
        placeholder="Search language…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '3px', color: '#c6d4df', fontSize: '12px',
          padding: '4px 8px', marginBottom: '6px', width: '200px',
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {filtered.map(l => (
          <Chip
            key={l.code}
            label={l.label}
            active={selected === l.code}
            onToggle={() => onChange(selected === l.code ? null : l.code)}
          />
        ))}
      </div>
    </div>
  );
}

const STORAGE_KEY = 'steam-store-filters-search-state';

function saveSearchState(state: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSearchState(): any {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function SearchPage() {
  const savedState = loadSearchState();
  
  // Restore search results from saved state if available
  const [games, setGames] = useState<SearchResult[]>(savedState?.games ?? []);
  const [allFetchedGames, setAllFetchedGames] = useState<SearchResult[]>(savedState?.allFetchedGames ?? []);
  const [totalCount, setTotalCount] = useState(savedState?.totalCount ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(savedState?.searched ?? false);

  const [tags, setTags] = useState<SteamTag[]>(savedState?.tags ?? []);
  const [sortBy, setSortBy] = useState<SortBy>(savedState?.sortBy ?? 'Reviews');
  const [formula, setFormula] = useState<ScoreFormula>(savedState?.formula ?? 'steamdb');
  const [page, setPage] = useState(0);
  const [hiddenGems, setHiddenGems] = useState(savedState?.hiddenGems ?? false);
  const [hiddenGemsMinReviews, setHiddenGemsMinReviews] = useState(savedState?.hiddenGemsMinReviews ?? 50);
  const [hiddenGemsMaxReviews, setHiddenGemsMaxReviews] = useState(savedState?.hiddenGemsMaxReviews ?? 1500);
  const [excludeDLC, setExcludeDLC] = useState(savedState?.excludeDLC ?? true);
  const [excludeOwned, setExcludeOwned] = useState(savedState?.excludeOwned ?? false);
  const [excludeWishlisted, setExcludeWishlisted] = useState(savedState?.excludeWishlisted ?? false);
  const [showRetail, setShowRetail] = useState(savedState?.showRetail ?? false);
  const [showGreyMarket, setShowGreyMarket] = useState(savedState?.showGreyMarket ?? false);
  const [reviewPeriod, setReviewPeriod] = useState<'total' | 'recent'>(savedState?.reviewPeriod ?? 'total');

  // Release date filter state
  const [enableReleaseFilter, setEnableReleaseFilter] = useState(savedState?.enableReleaseFilter ?? false);
  const [releasePreset, setReleasePreset] = useState<'30d' | '3m' | '6m' | '1y' | null>(savedState?.releasePreset ?? null);
  const [releaseCustomEnabled, setReleaseCustomEnabled] = useState(savedState?.releaseCustomEnabled ?? false);
  const [releaseYearFrom, setReleaseYearFrom] = useState<number | null>(savedState?.releaseYearFrom ?? null);
  const [releaseYearTo, setReleaseYearTo] = useState<number | null>(savedState?.releaseYearTo ?? null);

  const [language, setLanguage] = useState<string | null>(savedState?.language ?? null);
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(savedState?.platforms ?? []));
  const [features, setFeatures] = useState<Set<number>>(new Set(savedState?.features ?? []));
  const [vrOptions, setVrOptions] = useState<Set<number>>(new Set(savedState?.vrOptions ?? []));
  const [accessibility, setAccessibility] = useState<Set<number>>(new Set(savedState?.accessibility ?? []));

  const [recentProgress, setRecentProgress] = useState<{ fetched: number; total: number } | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ fetched: number; total: number } | null>(null);

  // Hide & Blacklist state
  const [hideBlacklist, setHideBlacklist] = useState<HideBlacklistState>(() => loadHideBlacklist());
  const [showHiddenGames, setShowHiddenGames] = useState(false); // Toggle to show hidden games

  // Game Collections state
  const [collections, setCollections] = useState<GameCollection[]>(() => loadCollections());
  const [showCollections, setShowCollections] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [viewingCollection, setViewingCollection] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const allFetchedGamesRef = useRef<SearchResult[]>([]);

  function toggleSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  }

  // ── Unified filter input: derive tokens from individual states ──────────
  const availableTokens: FilterToken[] = useMemo(() => [
    ...STEAM_TAGS.map(t => ({ kind: 'tag' as const, id: t.id, label: t.label })),
    ...STEAM_LANGUAGES.map(l => ({ kind: 'language' as const, id: l.code, label: l.label })),
    ...STEAM_PLATFORMS.map(p => ({ kind: 'platform' as const, id: p.os, label: p.label })),
    ...STEAM_FEATURES.map(f => ({ kind: 'feature' as const, id: f.category, label: f.label })),
    ...STEAM_VR.map(v => ({ kind: 'vr' as const, id: v.category, label: v.label })),
    ...STEAM_ACCESSIBILITY.map(a => ({ kind: 'accessibility' as const, id: a.id, label: a.label })),
  ], []);

  const unifiedTokens: FilterToken[] = useMemo(() => {
    const out: FilterToken[] = [];
    for (const t of tags) out.push({ kind: 'tag', id: t.id, label: t.label });
    if (language) {
      const l = STEAM_LANGUAGES.find(x => x.code === language);
      if (l) out.push({ kind: 'language', id: l.code, label: l.label });
    }
    for (const os of platforms) {
      const p = STEAM_PLATFORMS.find(x => x.os === os);
      if (p) out.push({ kind: 'platform', id: p.os, label: p.label });
    }
    for (const cat of features) {
      const f = STEAM_FEATURES.find(x => x.category === cat);
      if (f) out.push({ kind: 'feature', id: f.category, label: f.label });
    }
    for (const cat of vrOptions) {
      const v = STEAM_VR.find(x => x.category === cat);
      if (v) out.push({ kind: 'vr', id: v.category, label: v.label });
    }
    for (const id of accessibility) {
      const a = STEAM_ACCESSIBILITY.find(x => x.id === id);
      if (a) out.push({ kind: 'accessibility', id: a.id, label: a.label });
    }
    return out;
  }, [tags, language, platforms, features, vrOptions, accessibility]);

  function addUnifiedToken(token: FilterToken) {
    switch (token.kind) {
      case 'tag': {
        const t = STEAM_TAGS.find(x => x.id === token.id);
        if (t && !tags.some(x => x.id === t.id)) setTags([...tags, t]);
        break;
      }
      case 'language':
        setLanguage(String(token.id));
        break;
      case 'platform':
        setPlatforms(toggleSet(platforms, String(token.id)));
        break;
      case 'feature':
        setFeatures(toggleSet(features, Number(token.id)));
        break;
      case 'vr':
        setVrOptions(toggleSet(vrOptions, Number(token.id)));
        break;
      case 'accessibility':
        setAccessibility(toggleSet(accessibility, Number(token.id)));
        break;
    }
  }

  function removeUnifiedToken(token: FilterToken) {
    switch (token.kind) {
      case 'tag':
        setTags(tags.filter(t => t.id !== token.id));
        break;
      case 'language':
        setLanguage(null);
        break;
      case 'platform': {
        const next = new Set(platforms); next.delete(String(token.id)); setPlatforms(next);
        break;
      }
      case 'feature': {
        const next = new Set(features); next.delete(Number(token.id)); setFeatures(next);
        break;
      }
      case 'vr': {
        const next = new Set(vrOptions); next.delete(Number(token.id)); setVrOptions(next);
        break;
      }
      case 'accessibility': {
        const next = new Set(accessibility); next.delete(Number(token.id)); setAccessibility(next);
        break;
      }
    }
  }

  function clearAllUnified() {
    setTags([]);
    setLanguage(null);
    setPlatforms(new Set());
    setFeatures(new Set());
    setVrOptions(new Set());
    setAccessibility(new Set());
  }

  const runSearch = useCallback(async (opts: {
    tags: SteamTag[]; sortBy: SortBy; page: number;
    formula?: import('../utils/wilson').ScoreFormula;
    language: string | null; platforms: Set<string>; features: Set<number>;
    vrOptions: Set<number>; accessibility: Set<number>;
    hiddenGems?: boolean;
    hiddenGemsMinReviews?: number;
    hiddenGemsMaxReviews?: number;
    reviewPeriod?: 'total' | 'recent';
    excludeDLC?: boolean;
    excludeOwned?: boolean;
    excludeWishlisted?: boolean;
    releaseFrom?: number;
    releaseTo?: number;
  }) => {
    // Abort previous search
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setRecentProgress(null);
    setBatchProgress(null);

    try {
      // For initial search, fetch multiple pages to get 1000 results for proper sorting
      if (opts.page === 0) {
        const allItems: SearchResult[] = [];
        const fetchCount = Math.ceil(INITIAL_FETCH_SIZE / PAGE_SIZE);
        
        for (let i = 0; i < fetchCount; i++) {
          if (controller.signal.aborted) break;
          setBatchProgress({ fetched: i, total: fetchCount });
          const result = await searchGames({
            tags: opts.tags.map(t => t.id),
            sortBy: opts.sortBy,
            start: i * PAGE_SIZE,
            count: PAGE_SIZE,
            formula: opts.formula,
            language: opts.language ?? undefined,
            os: opts.platforms.size > 0 ? Array.from(opts.platforms) : undefined,
            features: opts.features.size > 0 ? Array.from(opts.features) : undefined,
            vrSupport: opts.vrOptions.size > 0 ? Array.from(opts.vrOptions) : undefined,
            accessibilityFeatures: opts.accessibility.size > 0 ? Array.from(opts.accessibility) : undefined,
            hiddenGems: opts.hiddenGems,
            hiddenGemsMinReviews: opts.hiddenGemsMinReviews,
            hiddenGemsMaxReviews: opts.hiddenGemsMaxReviews,
            reviewPeriod: opts.reviewPeriod,
            excludeDLC: opts.excludeDLC,
            releaseFrom: opts.releaseFrom,
            releaseTo: opts.releaseTo,
            signal: controller.signal,
            skipLocalSort: true, // Skip local sorting per page, we'll sort the full batch
            onProgress: (partial, progress) => {
              if (controller.signal.aborted) return;
              setRecentProgress(progress.fetched < progress.total ? progress : null);
            },
          });
          if (!controller.signal.aborted) {
            allItems.push(...result.items);
            setTotalCount(result.total_count);
          }
        }

        if (!controller.signal.aborted) {
          let items = allItems;
          // Deduplicate by appid
          const seen = new Set<number>();
          items = items.filter(g => {
            if (seen.has(g.appid)) return false;
            seen.add(g.appid);
            return true;
          });
          // Always filter out blacklisted games
          items = items.filter(g => !hideBlacklist.blacklisted.has(g.appid));
          if (opts.excludeOwned || opts.excludeWishlisted) {
            const lists = await getUserAppLists();
            if (opts.excludeOwned) items = items.filter(g => !lists.owned.has(g.appid));
            if (opts.excludeWishlisted) items = items.filter(g => !lists.wishlist.has(g.appid));
          }
          // Sort the full batch locally
          sortBatchItems(items, opts.sortBy, opts.formula ?? 'steamdb', opts.reviewPeriod ?? 'total');
          setAllFetchedGames(items);
          // Filter hidden games for display (unless showHiddenGames is true)
          const displayItems = showHiddenGames ? items : items.filter(g => !hideBlacklist.hidden.has(g.appid));
          setGames(displayItems.slice(0, (page + 1) * PAGE_SIZE));
          setSearched(true);
        }
      } else {
        // For pagination, fetch next batch
        const result = await searchGames({
          tags: opts.tags.map(t => t.id),
          sortBy: opts.sortBy,
          start: allFetchedGames.length,
          count: PAGE_SIZE,
          formula: opts.formula,
          language: opts.language ?? undefined,
          os: opts.platforms.size > 0 ? Array.from(opts.platforms) : undefined,
          features: opts.features.size > 0 ? Array.from(opts.features) : undefined,
          vrSupport: opts.vrOptions.size > 0 ? Array.from(opts.vrOptions) : undefined,
          accessibilityFeatures: opts.accessibility.size > 0 ? Array.from(opts.accessibility) : undefined,
          hiddenGems: opts.hiddenGems,
          hiddenGemsMinReviews: opts.hiddenGemsMinReviews,
          hiddenGemsMaxReviews: opts.hiddenGemsMaxReviews,
          reviewPeriod: opts.reviewPeriod,
          excludeDLC: opts.excludeDLC,
          releaseFrom: opts.releaseFrom,
          releaseTo: opts.releaseTo,
          signal: controller.signal,
          skipLocalSort: true, // Skip local sorting per page
          onProgress: (partial, progress) => {
            if (controller.signal.aborted) return;
            setRecentProgress(progress.fetched < progress.total ? progress : null);
          },
        });
        
        if (!controller.signal.aborted) {
          let items = result.items;
          // Always filter out blacklisted games
          items = items.filter(g => !hideBlacklist.blacklisted.has(g.appid));
          if (opts.excludeOwned || opts.excludeWishlisted) {
            const lists = await getUserAppLists();
            if (opts.excludeOwned) items = items.filter(g => !lists.owned.has(g.appid));
            if (opts.excludeWishlisted) items = items.filter(g => !lists.wishlist.has(g.appid));
          }
          // Add new items to all fetched games, deduplicating by appid
          const existingAppids = new Set(allFetchedGames.map(g => g.appid));
          const newItems = items.filter(g => !existingAppids.has(g.appid));
          const updatedAll = [...allFetchedGames, ...newItems];
          // Sort the full set
          sortBatchItems(updatedAll, opts.sortBy, opts.formula ?? 'steamdb', opts.reviewPeriod ?? 'total');
          setAllFetchedGames(updatedAll);
          // Filter hidden games for display
          const displayItems = showHiddenGames ? updatedAll : updatedAll.filter(g => !hideBlacklist.hidden.has(g.appid));
          setGames(displayItems.slice(0, (opts.page + 1) * PAGE_SIZE));
          setSearched(true);
        }
      }
      setRecentProgress(null);
      setBatchProgress(null);
    } catch (err: any) {
      // Ignore abort errors (user clicked search again)
      if (err.name === 'AbortError' || controller.signal.aborted) {
        console.log('[steam-store-filters] Search aborted');
        return;
      }
      if (!controller.signal.aborted) setError(err?.message ?? 'Search failed.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRecentProgress(null);
        setBatchProgress(null);
      }
    }
  }, [allFetchedGames]);

  // Save state whenever it changes
  React.useEffect(() => {
    saveSearchState({
      tags,
      sortBy,
      formula,
      reviewPeriod,
      hiddenGems,
      hiddenGemsMinReviews,
      hiddenGemsMaxReviews,
      excludeDLC,
      excludeOwned,
      excludeWishlisted,
      showRetail,
      showGreyMarket,
      enableReleaseFilter,
      releasePreset,
      releaseCustomEnabled,
      releaseYearFrom,
      releaseYearTo,
      language,
      platforms: Array.from(platforms),
      features: Array.from(features),
      vrOptions: Array.from(vrOptions),
      accessibility: Array.from(accessibility),
      games,
      allFetchedGames,
      totalCount,
      searched,
    });
  }, [tags, sortBy, formula, reviewPeriod, hiddenGems, hiddenGemsMinReviews, hiddenGemsMaxReviews, excludeDLC, excludeOwned, excludeWishlisted, showRetail, showGreyMarket, enableReleaseFilter, releasePreset, releaseCustomEnabled, releaseYearFrom, releaseYearTo, language, platforms, features, vrOptions, accessibility, games, allFetchedGames, totalCount, searched]);

  // Auto-run search if saved state exists but has no results
  React.useEffect(() => {
    if (savedState && tags.length > 0 && !savedState.games) {
      handleSearch();
    }
  }, []);

  // Track last search params to prevent duplicate searches
  const lastSearchParams = useRef<string>('');
  
  const getSearchParamsKey = useCallback(() => {
    return JSON.stringify({
      tags: tags.map(t => t.id).sort(),
      sortBy,
      formula,
      language,
      platforms: Array.from(platforms).sort(),
      features: Array.from(features).sort(),
      vrOptions: Array.from(vrOptions).sort(),
      accessibility: Array.from(accessibility).sort(),
      hiddenGems,
      hiddenGemsMinReviews,
      hiddenGemsMaxReviews,
      reviewPeriod,
      excludeDLC,
      excludeOwned,
      excludeWishlisted,
      enableReleaseFilter,
      releasePreset,
      releaseCustomEnabled,
      releaseYearFrom,
      releaseYearTo,
    });
  }, [tags, sortBy, formula, language, platforms, features, vrOptions, accessibility, hiddenGems, hiddenGemsMinReviews, hiddenGemsMaxReviews, reviewPeriod, excludeDLC, excludeOwned, excludeWishlisted, enableReleaseFilter, releasePreset, releaseCustomEnabled, releaseYearFrom, releaseYearTo]);

  // Compute release timestamps from filter state
  const computeReleaseTimestamps = useCallback(() => {
    if (!enableReleaseFilter) return { releaseFrom: undefined, releaseTo: undefined };

    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    if (releasePreset === '30d') {
      return { releaseFrom: Math.floor((now - 30 * msPerDay) / 1000), releaseTo: undefined };
    } else if (releasePreset === '3m') {
      return { releaseFrom: Math.floor((now - 90 * msPerDay) / 1000), releaseTo: undefined };
    } else if (releasePreset === '6m') {
      return { releaseFrom: Math.floor((now - 180 * msPerDay) / 1000), releaseTo: undefined };
    } else if (releasePreset === '1y') {
      return { releaseFrom: Math.floor((now - 365 * msPerDay) / 1000), releaseTo: undefined };
    } else if (releaseCustomEnabled && releaseYearFrom && releaseYearTo) {
      const fromDate = new Date(releaseYearFrom, 0, 1); // Jan 1st of year
      const toDate = new Date(releaseYearTo, 11, 31, 23, 59, 59); // Dec 31st 23:59:59
      return {
        releaseFrom: Math.floor(fromDate.getTime() / 1000),
        releaseTo: Math.floor(toDate.getTime() / 1000)
      };
    }

    return { releaseFrom: undefined, releaseTo: undefined };
  }, [enableReleaseFilter, releasePreset, releaseCustomEnabled, releaseYearFrom, releaseYearTo]);

  const handleSearch = useCallback(() => {
    const currentKey = getSearchParamsKey();
    if (currentKey === lastSearchParams.current && searched) {
      console.log('[steam-store-filters] Search params unchanged, skipping');
      return;
    }
    lastSearchParams.current = currentKey;
    setPage(0);
    const { releaseFrom, releaseTo } = computeReleaseTimestamps();
    runSearch({ tags, sortBy, page: 0, formula, language, platforms, features, vrOptions, accessibility, hiddenGems, hiddenGemsMinReviews, hiddenGemsMaxReviews, reviewPeriod, excludeDLC, excludeOwned, excludeWishlisted, releaseFrom, releaseTo });
  }, [getSearchParamsKey, tags, sortBy, formula, language, platforms, features, vrOptions, accessibility, hiddenGems, hiddenGemsMinReviews, hiddenGemsMaxReviews, reviewPeriod, excludeDLC, excludeOwned, excludeWishlisted, searched, computeReleaseTimestamps]);

  const handleRetry = useCallback(() => {
    lastSearchParams.current = null; // Reset cache to force re-run
    setPage(0);
    const { releaseFrom, releaseTo } = computeReleaseTimestamps();
    runSearch({ tags, sortBy, page: 0, formula, language, platforms, features, vrOptions, accessibility, hiddenGems, hiddenGemsMinReviews, hiddenGemsMaxReviews, reviewPeriod, excludeDLC, excludeOwned, excludeWishlisted, releaseFrom, releaseTo });
  }, [tags, sortBy, formula, language, platforms, features, vrOptions, accessibility, hiddenGems, hiddenGemsMinReviews, hiddenGemsMaxReviews, reviewPeriod, excludeDLC, excludeOwned, excludeWishlisted, computeReleaseTimestamps, runSearch]);

  function handlePageChange(p: number) {
    setPage(p);
    // For custom sorts (Score), we already have all results fetched - use ref to avoid stale closure
    if (sortBy === 'Score') {
      const fetched = allFetchedGamesRef.current;
      const displayItems = showHiddenGames 
        ? fetched.filter(g => !hideBlacklist.blacklisted.has(g.appid))
        : fetched.filter(g => !hideBlacklist.hidden.has(g.appid) && !hideBlacklist.blacklisted.has(g.appid));
      setGames(displayItems.slice(0, (p + 1) * PAGE_SIZE));
    } else {
      // For native Steam sorts, fetch more from Steam
      const { releaseFrom, releaseTo } = computeReleaseTimestamps();
      runSearch({ tags, sortBy, page: p, formula, language, platforms, features, vrOptions, accessibility, hiddenGems, hiddenGemsMinReviews, hiddenGemsMaxReviews, reviewPeriod, excludeDLC, excludeOwned, excludeWishlisted, releaseFrom, releaseTo });
    }
    // Don't scroll to top when showing more results
  }

  function handleSortChange(s: SortBy) {
    setSortBy(s);
    if (searched) { 
      setPage(0); 
      const { releaseFrom, releaseTo } = computeReleaseTimestamps();
      runSearch({ tags, sortBy: s, page: 0, formula, language, platforms, features, vrOptions, accessibility, hiddenGems, hiddenGemsMinReviews, hiddenGemsMaxReviews, reviewPeriod, excludeDLC, excludeOwned, excludeWishlisted, releaseFrom, releaseTo }); 
    }
  }

  function handleFormulaChange(f: import('../utils/wilson').ScoreFormula) {
    setFormula(f);
    // Re-sort if currently sorting by Score
    if (searched && sortBy === 'Score') { 
      setPage(0); 
      const { releaseFrom, releaseTo } = computeReleaseTimestamps();
      runSearch({ tags, sortBy, page: 0, formula: f, language, platforms, features, vrOptions, accessibility, hiddenGems, hiddenGemsMinReviews, hiddenGemsMaxReviews, reviewPeriod, excludeDLC, excludeOwned, excludeWishlisted, releaseFrom, releaseTo }); 
    }
  }

  // Hide & Blacklist handlers
  function handleHide(appid: number) {
    setHideBlacklist(prev => hideGame(prev, appid));
    // Remove from displayed games immediately
    setGames(prev => prev.filter(g => g.appid !== appid));
  }

  function handleBlacklist(appid: number) {
    setHideBlacklist(prev => blacklistGame(prev, appid));
    // Remove from displayed games and allFetchedGames immediately
    setGames(prev => prev.filter(g => g.appid !== appid));
    setAllFetchedGames(prev => prev.filter(g => g.appid !== appid));
  }

  function handleUnhide(appid: number) {
    setHideBlacklist(prev => unhideGame(prev, appid));
  }

  // Calculate hidden count for current results
  const hiddenCount = useMemo(() => {
    return allFetchedGames.filter(g => hideBlacklist.hidden.has(g.appid)).length;
  }, [allFetchedGames, hideBlacklist.hidden]);

  // Game Collections handlers
  function handleCreateCollection() {
    const name = newCollectionName.trim() || `Collection ${collections.length + 1}`;
    const updated = createCollection(name);
    setCollections(updated);
    setNewCollectionName('');
    setShowCollections(true);
  }

  function handleDeleteCollection(id: string) {
    const updated = deleteCollection(id);
    setCollections(updated);
    if (viewingCollection === id) {
      setViewingCollection(null);
      // Clear the games view when deleting the viewed collection
      setGames([]);
      setAllFetchedGames([]);
      setTotalCount(0);
      setSearched(false);
    }
  }

  function handleViewCollection(collection: GameCollection) {
    setGames(collection.games);
    setAllFetchedGames(collection.games);
    setTotalCount(collection.games.length);
    setSearched(true);
    setPage(0);
    setViewingCollection(collection.id);
  }

  function handleAddToCollection(collectionId: string, game: SearchResult) {
    const updated = addGameToCollection(collectionId, game);
    setCollections(updated);
  }

  function handleRemoveFromCollection(collectionId: string, appid: number) {
    const updated = removeGameFromCollection(collectionId, appid);
    setCollections(updated);
    // If currently viewing this collection, update the displayed games
    if (viewingCollection === collectionId) {
      const updatedCollection = updated.find(c => c.id === collectionId);
      if (updatedCollection) {
        setGames(updatedCollection.games);
        setAllFetchedGames(updatedCollection.games);
        setTotalCount(updatedCollection.games.length);
      }
    }
  }

  function handleClearSearch() {
    // Clear search to go back to normal search mode
    setViewingCollection(null);
    setGames([]);
    setAllFetchedGames([]);
    setTotalCount(0);
    setSearched(false);
    setPage(0);
  }

  // Keep ref in sync with allFetchedGames state
  useEffect(() => {
    allFetchedGamesRef.current = allFetchedGames;
  }, [allFetchedGames]);

  // Recalculate displayed games when showHiddenGames or hideBlacklist changes
  useEffect(() => {
    if (searched) {
      const displayItems = showHiddenGames 
        ? allFetchedGames.filter(g => !hideBlacklist.blacklisted.has(g.appid))
        : allFetchedGames.filter(g => !hideBlacklist.hidden.has(g.appid) && !hideBlacklist.blacklisted.has(g.appid));
      setGames(displayItems.slice(0, (page + 1) * PAGE_SIZE));
    }
  }, [showHiddenGames, hideBlacklist, allFetchedGames, page, searched]);

  return (
    <div style={s.page} onKeyDown={e => e.key === 'Enter' && handleSearch()}>
      <div style={s.header}>
        <h1 style={s.title}>Steam Store Filters</h1>
        <p style={s.subtitle}>Search the Steam catalog · Sort by Wilson score or SteamDB rating</p>
      </div>

      <div style={s.panel}>
        {/* Top Bar - Unified Filter Input + Sort */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          alignItems: 'flex-start',
          marginBottom: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '6px', color: '#4c9fd6', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Filters</div>
            <UnifiedFilterInput
              tokens={unifiedTokens}
              available={availableTokens}
              onAdd={addUnifiedToken}
              onRemove={removeUnifiedToken}
              onClearAll={clearAllUnified}
            />
          </div>
          <div style={{ minWidth: '280px' }}>
            <div style={{ marginBottom: '6px', color: '#4c9fd6', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Sort</div>
            <SortBar sortBy={sortBy} onSortChange={handleSortChange}
              formula={formula} onFormulaChange={handleFormulaChange} />
          </div>
        </div>

        {/* Section 1: Filters (default open) — Tags, Languages, Platforms, Features, VR, Accessibility */}
        <CollapsibleSection title="Filters" defaultOpen={true} icon="🏷️" storageKey="ssf-section-content">
          {/* Browse all tags as a flat list */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '6px', color: '#8f98a0', fontSize: '11px', fontWeight: 600 }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {STEAM_TAGS.map(tag => (
                <Chip
                  key={tag.id + tag.label}
                  label={tag.label}
                  active={tags.some(t => t.id === tag.id && t.label === tag.label)}
                  onToggle={() => {
                    const exists = tags.some(t => t.id === tag.id && t.label === tag.label);
                    setTags(exists ? tags.filter(t => !(t.id === tag.id && t.label === tag.label)) : [...tags, tag]);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Languages */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '6px', color: '#8f98a0', fontSize: '11px', fontWeight: 600 }}>Languages</div>
            <LanguagePicker selected={language} onChange={setLanguage} />
          </div>

          {/* Platforms */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '6px', color: '#8f98a0', fontSize: '11px', fontWeight: 600 }}>Platforms</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {STEAM_PLATFORMS.map(p => (
                <Chip key={p.os} label={p.label} active={platforms.has(p.os)}
                  onToggle={() => setPlatforms(toggleSet(platforms, p.os))} />
              ))}
            </div>
          </div>
          {/* Features */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '6px', color: '#8f98a0', fontSize: '11px', fontWeight: 600 }}>Features</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {STEAM_FEATURES.map(f => (
                <Chip key={f.category + f.label} label={f.label} active={features.has(f.category)}
                  onToggle={() => setFeatures(toggleSet(features, f.category))} />
              ))}
            </div>
          </div>

          {/* VR */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '6px', color: '#8f98a0', fontSize: '11px', fontWeight: 600 }}>VR Support</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {STEAM_VR.map(f => (
                <Chip key={f.category + f.label} label={f.label} active={vrOptions.has(f.category)}
                  onToggle={() => setVrOptions(toggleSet(vrOptions, f.category))} />
              ))}
            </div>
          </div>

          {/* Accessibility */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '6px', color: '#8f98a0', fontSize: '11px', fontWeight: 600 }}>Accessibility</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {STEAM_ACCESSIBILITY.map(a => (
                <Chip key={a.id} label={a.label} active={accessibility.has(a.id)}
                  onToggle={() => setAccessibility(toggleSet(accessibility, a.id))} />
              ))}
            </div>
          </div>

        </CollapsibleSection>

        {/* Section 2: Advanced Options (default closed) */}
        <CollapsibleSection title="Advanced Options" defaultOpen={false} icon="⚙️" storageKey="ssf-section-advanced">
          {/* Exclude DLC / Owned / Wishlisted */}
          <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
              <input type="checkbox" checked={excludeDLC} onChange={e => setExcludeDLC(e.target.checked)} style={{ cursor: 'pointer' }} />
              <span style={{ color: '#8f98a0', fontSize: '12px' }}>Exclude DLC and other extensions</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
              <input type="checkbox" checked={excludeOwned} onChange={e => setExcludeOwned(e.target.checked)} style={{ cursor: 'pointer' }} />
              <span style={{ color: '#8f98a0', fontSize: '12px' }}>Exclude games already in my library</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
              <input type="checkbox" checked={excludeWishlisted} onChange={e => setExcludeWishlisted(e.target.checked)} style={{ cursor: 'pointer' }} />
              <span style={{ color: '#8f98a0', fontSize: '12px' }}>Exclude games on my wishlist</span>
            </label>
          </div>

          {/* Price display options */}
          <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
              <input type="checkbox" checked={showRetail} onChange={e => setShowRetail(e.target.checked)} style={{ cursor: 'pointer' }} />
              <span style={{ color: '#8f98a0', fontSize: '12px' }}>Retail prices</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
              <input type="checkbox" checked={showGreyMarket} onChange={e => setShowGreyMarket(e.target.checked)} style={{ cursor: 'pointer' }} />
              <span style={{ color: '#8f98a0', fontSize: '12px' }}>Grey market prices</span>
            </label>
          </div>

          {/* Review Period (only relevant for Score sort) */}
          {sortBy === 'Score' && (
            <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#c6d4df', fontSize: '12px', fontWeight: 600 }}>Review Period</span>
                <select
                  value={reviewPeriod}
                  onChange={e => setReviewPeriod(e.target.value as 'total' | 'recent')}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#c6d4df',
                    padding: '4px 8px',
                    borderRadius: '3px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="total">All Reviews</option>
                  <option value="recent">Recent Reviews</option>
                </select>
              </div>
            </div>
          )}

          {/* Hidden Gems */}
          <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#c6d4df', fontSize: '12px', fontWeight: 600 }}>Hidden Gems</span>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={hiddenGems}
                  onChange={e => setHiddenGems(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ color: '#8f98a0', fontSize: '11px' }}>
                  Enable
                </span>
              </label>
            </div>
            {hiddenGems && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#8f98a0', fontSize: '10px', display: 'block', marginBottom: '4px' }}>
                    Min Reviews
                  </label>
                  <select
                    value={hiddenGemsMinReviews}
                    onChange={e => setHiddenGemsMinReviews(Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#c6d4df',
                      padding: '4px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                    <option value={1500}>1500</option>
                    <option value={2500}>2500</option>
                    <option value={5000}>5000</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#8f98a0', fontSize: '10px', display: 'block', marginBottom: '4px' }}>
                    Max Reviews
                  </label>
                  <select
                    value={hiddenGemsMaxReviews}
                    onChange={e => setHiddenGemsMaxReviews(Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#c6d4df',
                      padding: '4px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                    <option value={1500}>1500</option>
                    <option value={2500}>2500</option>
                    <option value={5000}>5000</option>
                    <option value={10000}>10000</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Release Date Filter */}
          <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={enableReleaseFilter}
                onChange={e => {
                  setEnableReleaseFilter(e.target.checked);
                  if (!e.target.checked) {
                    setReleasePreset(null);
                    setReleaseCustomEnabled(false);
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: '#c6d4df', fontSize: '12px', fontWeight: 600 }}>Filter by release date</span>
            </label>

          {enableReleaseFilter && (
            <div style={{ marginTop: '8px', paddingLeft: '24px' }}>
              {/* Preset options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { key: '30d', label: 'Last 30 days' },
                  { key: '3m', label: 'Last 3 months' },
                  { key: '6m', label: 'Last 6 months' },
                  { key: '1y', label: 'Last 1 year' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={releasePreset === key}
                      onChange={() => {
                        if (releasePreset === key) {
                          setReleasePreset(null);
                        } else {
                          setReleasePreset(key as any);
                          setReleaseCustomEnabled(false);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ color: '#8f98a0', fontSize: '12px' }}>{label}</span>
                  </label>
                ))}

                {/* Custom period */}
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '6px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={releaseCustomEnabled}
                    onChange={() => {
                      setReleaseCustomEnabled(!releaseCustomEnabled);
                      if (!releaseCustomEnabled) {
                        setReleasePreset(null);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: '#8f98a0', fontSize: '12px' }}>Custom period</span>
                </label>

                {releaseCustomEnabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', marginLeft: '20px' }}>
                    <select
                      value={releaseYearFrom ?? ''}
                      onChange={e => setReleaseYearFrom(e.target.value ? parseInt(e.target.value) : null)}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#c6d4df',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">From</option>
                      {Array.from({ length: 30 }, (_, i) => 2025 - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <span style={{ color: '#8f98a0', fontSize: '12px' }}>to</span>
                    <select
                      value={releaseYearTo ?? ''}
                      onChange={e => setReleaseYearTo(e.target.value ? parseInt(e.target.value) : null)}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#c6d4df',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">To</option>
                      {Array.from({ length: 30 }, (_, i) => 2025 - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>

          {/* Game Collections */}
          <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <div style={{ marginBottom: '8px', color: '#c6d4df', fontSize: '12px', fontWeight: 600 }}>Game Collections</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="New collection name..."
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '3px',
                  color: '#c6d4df',
                }}
              />
              <button style={s.smallBtn} onClick={handleCreateCollection}>
                📁 Create
              </button>
            </div>
            
            {collections.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {collections.map((collection) => (
                  <div 
                    key={collection.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      background: viewingCollection === collection.id ? 'rgba(102, 192, 244, 0.15)' : 'rgba(0,0,0,0.15)',
                      borderRadius: '3px',
                      fontSize: '11px',
                      border: viewingCollection === collection.id ? '1px solid rgba(102, 192, 244, 0.3)' : 'none',
                    }}
                  >
                    <span style={{ color: '#c6d4df', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {collection.name} <span style={{ color: '#8f98a0' }}>({collection.games.length})</span>
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        style={{...s.smallBtn, padding: '2px 6px', fontSize: '10px'}} 
                        onClick={() => handleViewCollection(collection)}
                      >
                        👁️
                      </button>
                      <button 
                        style={{...s.smallBtn, padding: '2px 6px', fontSize: '10px', color: '#e86161'}} 
                        onClick={() => handleDeleteCollection(collection.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Search button — centered below panel */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px', marginBottom: '16px' }}>
        <button style={{ ...s.searchBtn, padding: '10px 48px', fontSize: '14px' }} onClick={handleSearch}>Search</button>
      </div>

      {batchProgress && (
        <div style={{
          margin: '12px 0',
          padding: '8px 12px',
          background: 'rgba(102, 192, 244, 0.08)',
          border: '1px solid rgba(102, 192, 244, 0.25)',
          borderRadius: '4px',
          color: '#c6d4df',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            display: 'inline-block', width: '12px', height: '12px',
            border: '2px solid rgba(102,192,244,0.3)', borderTopColor: '#66c0f4',
            borderRadius: '50%', animation: 'ssf-spin 0.8s linear infinite',
          }} />
          <span>
            Fetching results for sorting&hellip; {batchProgress.fetched + 1}/{batchProgress.total}
          </span>
          <style>{`@keyframes ssf-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {recentProgress && (
        <div style={{
          margin: '12px 0',
          padding: '8px 12px',
          background: 'rgba(102, 192, 244, 0.08)',
          border: '1px solid rgba(102, 192, 244, 0.25)',
          borderRadius: '4px',
          color: '#c6d4df',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            display: 'inline-block', width: '12px', height: '12px',
            border: '2px solid rgba(102,192,244,0.3)', borderTopColor: '#66c0f4',
            borderRadius: '50%', animation: 'ssf-spin 0.8s linear infinite',
          }} />
          <span>
            Refining ranking with recent reviews&hellip; {recentProgress.fetched}/{recentProgress.total}
          </span>
          <style>{`@keyframes ssf-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Hidden/Blacklist Management */}
      {(hideBlacklist.hidden.size > 0 || hideBlacklist.blacklisted.size > 0) && (
        <div style={s.hideBlacklistPanel}>
          <div style={s.hideBlacklistHeader}>
            <span style={s.hideBlacklistTitle}>Hidden & Blacklisted Games</span>
            {hiddenCount > 0 && !showHiddenGames && (
              <span style={s.hiddenCountBadge}>{hiddenCount} hidden in results</span>
            )}
          </div>
          <div style={s.hideBlacklistActions}>
            {hideBlacklist.hidden.size > 0 && (
              <>
                <label style={s.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={showHiddenGames}
                    onChange={() => setShowHiddenGames(!showHiddenGames)}
                  />
                  <span>Show {hideBlacklist.hidden.size} hidden game{hideBlacklist.hidden.size !== 1 ? 's' : ''}</span>
                </label>
                <button style={s.smallBtn} onClick={() => { setHideBlacklist(clearHidden(hideBlacklist)); setShowHiddenGames(false); }}>
                  Unhide all
                </button>
              </>
            )}
            {hideBlacklist.blacklisted.size > 0 && (
              <button style={s.smallBtnDanger} onClick={() => setHideBlacklist(clearBlacklist(hideBlacklist))}>
                Clear {hideBlacklist.blacklisted.size} blacklisted
              </button>
            )}
          </div>
        </div>
      )}

      {(searched || loading) && (
        <GameGrid games={games} loading={loading} error={error}
          totalCount={sortBy === 'Score' ? allFetchedGames.length : totalCount} page={page} pageSize={PAGE_SIZE}
          sortBy={sortBy} formula={formula} showReviews={true} showRetail={showRetail} showGreyMarket={showGreyMarket}
          onPageChange={handlePageChange} showLoading={page === 0}
          onHide={handleHide} onBlacklist={handleBlacklist} hiddenCount={hiddenCount}
          collections={collections}
          viewingCollection={viewingCollection}
          onAddToCollection={handleAddToCollection}
          onRemoveFromCollection={handleRemoveFromCollection}
          onUnhide={handleUnhide}
          hiddenSet={hideBlacklist.hidden}
          onRetry={handleRetry} />
      )}

      {!searched && !loading && (
        <div style={s.placeholder}>
          <p style={s.placeholderText}>Select filters and press <strong>Search</strong>.</p>
          <p style={s.placeholderSub}>Results ranked by Wilson score or SteamDB rating.</p>
        </div>
      )}

      <div style={s.footer}>
        Inspired by{' '}
        <a style={s.link} href="https://www.lorenzostanco.com/lab/steam/"
          onClick={e => { e.preventDefault(); (window as any).SteamClient?.System?.OpenInSystemBrowser?.('https://www.lorenzostanco.com/lab/steam/'); }}>
          lorenzostanco.com/lab/steam
        </a>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '20px 32px', width: '100%', margin: '0 auto', color: '#c6d4df', fontFamily: 'inherit', overflowY: 'auto', maxHeight: '100vh', boxSizing: 'border-box' },
  header: { marginBottom: '16px' },
  title: { margin: '0 0 4px', fontSize: '20px', fontWeight: 600, color: '#c6d4df' },
  subtitle: { margin: 0, color: '#8f98a0', fontSize: '12px' },
  panel: {
    backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '6px', padding: '16px', marginBottom: '20px',
  },
  searchBtn: {
    marginTop: '10px',
    background: 'linear-gradient(to bottom, #4c9fd6, #2a79b8)',
    border: 'none', color: '#fff', borderRadius: '3px',
    padding: '8px 22px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  placeholder: { textAlign: 'center', padding: '50px 24px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' },
  placeholderText: { margin: 0, color: '#c6d4df', fontSize: '14px' },
  placeholderSub: { margin: 0, color: '#8f98a0', fontSize: '12px' },
  footer: { marginTop: '28px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#8f98a0', fontSize: '11px', textAlign: 'center' },
  link: { color: '#66c0f4', textDecoration: 'none' },
  // Hide & Blacklist styles
  hideBlacklistPanel: {
    backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '6px', padding: '12px 16px', marginBottom: '16px',
  },
  hideBlacklistHeader: {
    display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px',
  },
  hideBlacklistTitle: {
    fontSize: '13px', fontWeight: 600, color: '#c6d4df',
  },
  hiddenCountBadge: {
    fontSize: '11px', padding: '2px 8px', background: 'rgba(240,160,32,0.15)',
    border: '1px solid rgba(240,160,32,0.3)', borderRadius: '3px', color: '#f0a020',
  },
  hideBlacklistActions: {
    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' as const,
  },
  toggleLabel: {
    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#c6d4df', cursor: 'pointer',
  },
  smallBtn: {
    padding: '4px 12px', fontSize: '11px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px',
    color: '#c6d4df', cursor: 'pointer', ':hover': { background: 'rgba(255,255,255,0.1)' } as any,
  },
  smallBtnDanger: {
    padding: '4px 12px', fontSize: '11px', background: 'rgba(232,97,97,0.15)',
    border: '1px solid rgba(232,97,97,0.3)', borderRadius: '3px',
    color: '#e86161', cursor: 'pointer', ':hover': { background: 'rgba(232,97,97,0.2)' } as any,
  },
};
