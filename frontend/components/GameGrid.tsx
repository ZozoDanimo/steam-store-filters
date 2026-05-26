import React from 'react';
import { SearchResult, SortBy } from '../utils/steamApi';
import { GameCollection } from '../utils/savedLists';
import { ScoreFormula } from '../utils/wilson';
import { GameCard } from './GameCard';

interface GameGridProps {
  games: SearchResult[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
  sortBy: SortBy;
  formula: ScoreFormula;
  showReviews: boolean;
  showRetail?: boolean;
  showGreyMarket?: boolean;
  onPageChange: (page: number) => void;
  showLoading?: boolean; // If false, don't show loading spinner (for "show more" scenario)
  onHide?: (appid: number) => void;
  onBlacklist?: (appid: number) => void;
  hiddenCount?: number; // Number of hidden games in current results
  collections?: GameCollection[]; // All available collections
  viewingCollection?: string | null; // ID of currently viewed collection
  onAddToCollection?: (collectionId: string, game: SearchResult) => void; // Add game to collection
  onRemoveFromCollection?: (collectionId: string, appid: number) => void; // Remove game from collection
  onUnhide?: (appid: number) => void; // Callback to unhide a game
  hiddenSet?: Set<number>; // Set of hidden appids
  onRetry?: () => void; // Retry last search on error
}

export function GameGrid({
  games,
  loading,
  error,
  totalCount,
  page,
  pageSize,
  sortBy,
  formula,
  showReviews,
  showRetail = false,
  showGreyMarket = false,
  onPageChange,
  showLoading = true,
  onHide,
  onBlacklist,
  hiddenCount = 0,
  collections = [],
  viewingCollection = null,
  onAddToCollection,
  onRemoveFromCollection,
  onUnhide,
  hiddenSet = new Set(),
  onRetry,
}: GameGridProps) {

  const totalPages = Math.ceil(totalCount / pageSize);
  // For custom sorts (Score), show more if we have more fetched results than displayed
  // For native Steam sorts, show more if we haven't fetched all results yet
  const isCustomSort = sortBy === 'Score';
  const hasMore = isCustomSort ? games.length < totalCount : games.length < totalCount;

  if (loading && showLoading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <span style={styles.loadingText}>Searching Steam catalog…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <span style={styles.error}>⚠ {error}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={styles.retryBtn}
          >
            ↺ Retry
          </button>
        )}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div style={styles.center}>
        <span style={styles.empty}>No games found. Try different tags or sort options.</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.count}>
          {totalCount.toLocaleString()} game{totalCount !== 1 ? 's' : ''} found
        </span>
        {totalPages > 1 && (
          <span style={styles.pageInfo}>
            Page {page + 1} / {totalPages}
          </span>
        )}
        {hiddenCount > 0 && (
          <span style={styles.hiddenBadge}>
            {hiddenCount} hidden
          </span>
        )}
      </div>

      <div style={styles.grid}>
        {games.map((game) => (
          <GameCard
            key={game.appid}
            game={game}
            formula={formula}
            showReviews={showReviews}
            showRetail={showRetail}
            showGreyMarket={showGreyMarket}
            onHide={onHide}
            onBlacklist={onBlacklist}
            collections={collections}
            viewingCollection={viewingCollection}
            onAddToCollection={onAddToCollection}
            onRemoveFromCollection={onRemoveFromCollection}
            onUnhide={onUnhide}
            isHidden={hiddenSet.has(game.appid)}
          />
        ))}
      </div>

      {hasMore && (
        <div style={styles.showMoreContainer}>
          <button
            style={styles.showMoreBtn}
            onClick={() => onPageChange(page + 1)}
          >
            Show more
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: {
    color: '#8f98a0',
    fontSize: '12px',
  },
  pageInfo: {
    color: '#8f98a0',
    fontSize: '12px',
  },
  hiddenBadge: {
    color: '#f0a020',
    fontSize: '11px',
    padding: '2px 8px',
    background: 'rgba(240,160,32,0.15)',
    border: '1px solid rgba(240,160,32,0.3)',
    borderRadius: '3px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '10px',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 0',
    gap: '12px',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid rgba(102,192,244,0.2)',
    borderTopColor: '#66c0f4',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#8f98a0',
    fontSize: '13px',
  },
  error: {
    color: '#e86161',
    fontSize: '13px',
  },
  retryBtn: {
    marginTop: '10px',
    background: 'rgba(232,97,97,0.15)',
    border: '1px solid rgba(232,97,97,0.4)',
    color: '#e86161',
    borderRadius: '4px',
    padding: '7px 20px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  empty: {
    color: '#8f98a0',
    fontSize: '13px',
  },
  showMoreContainer: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '12px',
  },
  showMoreBtn: {
    background: 'rgba(102,192,244,0.15)',
    border: '1px solid rgba(102,192,244,0.4)',
    color: '#66c0f4',
    borderRadius: '4px',
    padding: '8px 24px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
  },
};
