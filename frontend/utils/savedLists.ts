/**
 * Game Collections - Steam Store Filters
 * Create empty collections and add/remove games individually
 * Auto-save on every edit
 */

import { SearchResult } from './steamApi';

const STORAGE_KEY = 'steam-store-filters-collections';

export interface GameCollection {
  id: string;
  name: string;
  createdAt: number;
  games: SearchResult[];
}

/** Load all collections from localStorage */
export function loadCollections(): GameCollection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[steam-store-filters] Failed to load collections:', e);
    return [];
  }
}

/** Save all collections to localStorage (auto-save) */
function saveCollections(collections: GameCollection[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch (e) {
    console.error('[steam-store-filters] Failed to save collections:', e);
  }
}

/** Create a new empty collection */
export function createCollection(name: string): GameCollection[] {
  const collections = loadCollections();
  const newCollection: GameCollection = {
    id: `coll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim() || `Collection ${collections.length + 1}`,
    createdAt: Date.now(),
    games: [],
  };
  const updated = [newCollection, ...collections];
  saveCollections(updated);
  return updated;
}

/** Delete a collection by ID */
export function deleteCollection(id: string): GameCollection[] {
  const collections = loadCollections();
  const updated = collections.filter(c => c.id !== id);
  saveCollections(updated);
  return updated;
}

/** Add a game to a collection */
export function addGameToCollection(collectionId: string, game: SearchResult): GameCollection[] {
  const collections = loadCollections();
  const updated = collections.map(coll => {
    if (coll.id === collectionId) {
      // Check if game already exists
      if (coll.games.some(g => g.appid === game.appid)) {
        return coll;
      }
      return {
        ...coll,
        games: [...coll.games, game],
      };
    }
    return coll;
  });
  saveCollections(updated);
  return updated;
}

/** Remove a game from a collection */
export function removeGameFromCollection(collectionId: string, appid: number): GameCollection[] {
  const collections = loadCollections();
  const updated = collections.map(coll => {
    if (coll.id === collectionId) {
      return {
        ...coll,
        games: coll.games.filter(g => g.appid !== appid),
      };
    }
    return coll;
  });
  saveCollections(updated);
  return updated;
}

/** Get a specific collection by ID */
export function getCollectionById(id: string): GameCollection | null {
  const collections = loadCollections();
  return collections.find(c => c.id === id) || null;
}

/** Get all collections that contain a specific game */
export function getCollectionsContainingGame(appid: number): GameCollection[] {
  const collections = loadCollections();
  return collections.filter(c => c.games.some(g => g.appid === appid));
}

/** Rename a collection */
export function renameCollection(id: string, newName: string): GameCollection[] {
  const collections = loadCollections();
  const updated = collections.map(c =>
    c.id === id ? { ...c, name: newName.trim() || c.name } : c
  );
  saveCollections(updated);
  return updated;
}

/** Clear all collections */
export function clearAllCollections(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[steam-store-filters] Failed to clear collections:', e);
  }
}
