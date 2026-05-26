/**
 * Hide & Blacklist management for Steam Store Filters
 * Stores hidden/blacklisted appids in localStorage
 */

const STORAGE_KEY_HIDDEN = 'steam-store-filters-hidden';
const STORAGE_KEY_BLACKLIST = 'steam-store-filters-blacklist';

export interface HideBlacklistState {
  hidden: Set<number>;    // Appids to hide from current results
  blacklisted: Set<number>; // Appids to permanently exclude from all searches
}

/** Load hidden/blacklisted sets from localStorage */
export function loadHideBlacklist(): HideBlacklistState {
  try {
    const hiddenRaw = localStorage.getItem(STORAGE_KEY_HIDDEN);
    const blacklistRaw = localStorage.getItem(STORAGE_KEY_BLACKLIST);
    
    const hidden = hiddenRaw ? new Set<number>(JSON.parse(hiddenRaw)) : new Set<number>();
    const blacklisted = blacklistRaw ? new Set<number>(JSON.parse(blacklistRaw)) : new Set<number>();
    
    return { hidden, blacklisted };
  } catch (e) {
    console.error('[steam-store-filters] Failed to load hide/blacklist:', e);
    return { hidden: new Set(), blacklisted: new Set() };
  }
}

/** Save hidden/blacklisted sets to localStorage */
export function saveHideBlacklist(state: HideBlacklistState): void {
  try {
    localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(Array.from(state.hidden)));
    localStorage.setItem(STORAGE_KEY_BLACKLIST, JSON.stringify(Array.from(state.blacklisted)));
  } catch (e) {
    console.error('[steam-store-filters] Failed to save hide/blacklist:', e);
  }
}

/** Add an appid to hidden list */
export function hideGame(state: HideBlacklistState, appid: number): HideBlacklistState {
  const newHidden = new Set(state.hidden);
  newHidden.add(appid);
  const newState = { ...state, hidden: newHidden };
  saveHideBlacklist(newState);
  return newState;
}

/** Add an appid to blacklist (and remove from hidden if present) */
export function blacklistGame(state: HideBlacklistState, appid: number): HideBlacklistState {
  const newBlacklist = new Set(state.blacklisted);
  newBlacklist.add(appid);
  // Also remove from hidden since it's now permanently blacklisted
  const newHidden = new Set(state.hidden);
  newHidden.delete(appid);
  const newState = { hidden: newHidden, blacklisted: newBlacklist };
  saveHideBlacklist(newState);
  return newState;
}

/** Remove an appid from hidden list */
export function unhideGame(state: HideBlacklistState, appid: number): HideBlacklistState {
  const newHidden = new Set(state.hidden);
  newHidden.delete(appid);
  const newState = { ...state, hidden: newHidden };
  saveHideBlacklist(newState);
  return newState;
}

/** Remove an appid from blacklist */
export function unblacklistGame(state: HideBlacklistState, appid: number): HideBlacklistState {
  const newBlacklist = new Set(state.blacklisted);
  newBlacklist.delete(appid);
  const newState = { ...state, blacklisted: newBlacklist };
  saveHideBlacklist(newState);
  return newState;
}

/** Clear all hidden games */
export function clearHidden(state: HideBlacklistState): HideBlacklistState {
  const newState = { ...state, hidden: new Set<number>() };
  saveHideBlacklist(newState);
  return newState;
}

/** Clear entire blacklist */
export function clearBlacklist(state: HideBlacklistState): HideBlacklistState {
  const newState = { ...state, blacklisted: new Set<number>() };
  saveHideBlacklist(newState);
  return newState;
}

/** Check if a game is hidden */
export function isHidden(state: HideBlacklistState, appid: number): boolean {
  return state.hidden.has(appid);
}

/** Check if a game is blacklisted */
export function isBlacklisted(state: HideBlacklistState, appid: number): boolean {
  return state.blacklisted.has(appid);
}

/** Filter games - removes blacklisted and optionally hidden ones */
export function filterGames<T extends { appid: number }>(
  games: T[],
  state: HideBlacklistState,
  includeHidden: boolean = false
): T[] {
  return games.filter(game => {
    // Always filter out blacklisted games
    if (state.blacklisted.has(game.appid)) return false;
    // Filter out hidden games unless includeHidden is true
    if (!includeHidden && state.hidden.has(game.appid)) return false;
    return true;
  });
}
