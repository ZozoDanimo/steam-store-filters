/**
 * Saved Searches management for Steam Store Filters
 * Stores search configurations in localStorage
 */

import { SteamTag } from './tags';
import { SteamLanguage } from './languages';
import { SteamPlatform, SteamFeature, SteamAccessibility } from './features';
import { ScoreFormula } from './wilson';
import { SortBy } from './steamApi';

const STORAGE_KEY = 'steam-store-filters-saved-searches';

export interface SavedSearch {
  id: string;
  name: string;
  createdAt: number;
  // Search parameters
  tags: SteamTag[];
  sortBy: SortBy;
  formula: ScoreFormula;
  language: SteamLanguage | null;
  platforms: SteamPlatform[];
  features: SteamFeature[];
  vrOptions: string[];
  accessibility: SteamAccessibility[];
  hiddenGems: boolean;
  hiddenGemsMinReviews: number;
  hiddenGemsMaxReviews: number;
  reviewPeriod: 'total' | 'recent';
  excludeDLC: boolean;
  excludeOwned: boolean;
  excludeWishlisted: boolean;
  // Release date filter
  enableReleaseFilter: boolean;
  releasePreset: '30d' | '90d' | '1y' | 'custom' | null;
  releaseCustomEnabled: boolean;
  releaseYearFrom: number;
  releaseYearTo: number;
}

/** Load all saved searches from localStorage */
export function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[steam-store-filters] Failed to load saved searches:', e);
    return [];
  }
}

/** Save a new search configuration */
export function saveSearch(
  name: string,
  params: Omit<SavedSearch, 'id' | 'name' | 'createdAt'>
): SavedSearch[] {
  const searches = loadSavedSearches();
  const newSearch: SavedSearch = {
    id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim() || `Search ${searches.length + 1}`,
    createdAt: Date.now(),
    ...params,
  };
  const updated = [newSearch, ...searches];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[steam-store-filters] Failed to save search:', e);
  }
  return updated;
}

/** Delete a saved search by ID */
export function deleteSearch(id: string): SavedSearch[] {
  const searches = loadSavedSearches();
  const updated = searches.filter(s => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[steam-store-filters] Failed to delete search:', e);
  }
  return updated;
}

/** Update an existing saved search */
export function updateSearch(
  id: string,
  updates: Partial<SavedSearch>
): SavedSearch[] {
  const searches = loadSavedSearches();
  const updated = searches.map(s =>
    s.id === id ? { ...s, ...updates, id } : s
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[steam-store-filters] Failed to update search:', e);
  }
  return updated;
}

/** Load a specific saved search by ID */
export function getSearchById(id: string): SavedSearch | null {
  const searches = loadSavedSearches();
  return searches.find(s => s.id === id) || null;
}

/** Clear all saved searches */
export function clearAllSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[steam-store-filters] Failed to clear searches:', e);
  }
}

/** Generate a default name for a new saved search based on its parameters */
export function generateSearchName(params: {
  tags: SteamTag[];
  sortBy: SortBy;
  platforms: SteamPlatform[];
}): string {
  const parts: string[] = [];
  
  if (params.tags.length > 0) {
    parts.push(params.tags.slice(0, 2).map(t => t.label).join(', '));
    if (params.tags.length > 2) parts.push('...');
  }
  
  if (params.platforms.length > 0) {
    parts.push(params.platforms.join(', '));
  }
  
  parts.push(params.sortBy.replace('_', ' '));
  
  return parts.join(' | ') || 'New Search';
}
