import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Navigation } from '@steambrew/client';
import { SearchResult, formatPrice, fetchScreenshots } from '../utils/steamApi';
import { computeScore, formatScore, ScoreFormula } from '../utils/wilson';
import { getUserAppLists } from '../utils/userLibrary';
import { fetchBestDeals, MarketDeal } from '../utils/keyPrices';
import { GameCollection } from '../utils/savedLists';

// Global state to track which card has an open context menu
let globalContextMenuClose: (() => void) | null = null;

interface GameCardProps {
  game: SearchResult;
  formula: ScoreFormula;
  showReviews: boolean;
  showRetail?: boolean;
  showGreyMarket?: boolean;
  onHide?: (appid: number) => void;
  onBlacklist?: (appid: number) => void;
  collections?: GameCollection[]; // All available collections
  viewingCollection?: string | null; // ID of currently viewed collection
  onAddToCollection?: (collectionId: string, game: SearchResult) => void; // Add game to collection
  onRemoveFromCollection?: (collectionId: string, appid: number) => void; // Remove game from collection
  onUnhide?: (appid: number) => void; // Callback to unhide a game
  isHidden?: boolean; // Whether this game is currently hidden
}

// Map Steam review_score enum (0–9) to a color
const REVIEW_COLOR = (score: number): string => {
  if (score >= 6) return '#66c0f4';  // Overwhelmingly Positive
  if (score >= 5) return '#a4d007';  // Very Positive
  if (score >= 4) return '#c6c52e';  // Mostly Positive
  if (score >= 3) return '#8f98a0';  // Mixed
  return '#e86161';                  // Negative
};

// Estimate positive ratio from Steam review_score enum (used when appreviews is CORS-blocked)
const REVIEW_RATIO: Record<number, number> = {
  6: 0.97, // Overwhelmingly Positive
  5: 0.87, // Very Positive
  4: 0.75, // Mostly Positive
  3: 0.55, // Mixed
  2: 0.30, // Mostly Negative
  1: 0.10, // Overwhelmingly Negative
};

export function GameCard({ game, formula, showReviews, showRetail = false, showGreyMarket = false, onHide, onBlacklist, collections = [], viewingCollection = null, onAddToCollection, onRemoveFromCollection, onUnhide, isHidden = false }: GameCardProps) {
  const [score, setScore] = useState<number | null>(null);
  const [ownership, setOwnership] = useState<{ owned: boolean; wishlisted: boolean }>({ owned: false, wishlisted: false });
  const [deals, setDeals] = useState<MarketDeal[] | null>(null);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [screenshots, setScreenshots] = useState<string[] | null>(null);
  const [screenshotsLoading, setScreenshotsLoading] = useState(false);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const justOpenedRef = useRef(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevShowRetail = useRef(showRetail);
  const prevShowGreyMarket = useRef(showGreyMarket);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showRetail && !showGreyMarket) { setDeals(null); prevShowRetail.current = false; prevShowGreyMarket.current = false; return; }
    const justActivated = !prevShowRetail.current && !prevShowGreyMarket.current;
    prevShowRetail.current = showRetail;
    prevShowGreyMarket.current = showGreyMarket;
    let cancelled = false;
    setDealsLoading(true);
    fetchBestDeals(game.appid, justActivated, showRetail, showGreyMarket).then(d => {
      if (cancelled) return;
      setDeals(d);
      setDealsLoading(false);
    }).catch(() => { if (!cancelled) setDealsLoading(false); });
    return () => { cancelled = true; };
  }, [game.appid, showRetail, showGreyMarket]);

  useEffect(() => {
    let cancelled = false;
    getUserAppLists().then(lists => {
      if (cancelled) return;
      setOwnership({
        owned: lists.owned.has(game.appid),
        wishlisted: lists.wishlist.has(game.appid),
      });
    });
    return () => { cancelled = true; };
  }, [game.appid]);

  useEffect(() => {
    if (!showReviews || game.total_reviews === 0) { setScore(null); return; }
    // Prefer real total_positive from IStoreBrowseService; estimate from enum as fallback
    const positiveCount = game.total_positive > 0
      ? game.total_positive
      : REVIEW_RATIO[game.review_score] !== undefined
        ? Math.round(game.total_reviews * REVIEW_RATIO[game.review_score])
        : null;
    if (positiveCount !== null)
      setScore(computeScore(positiveCount, game.total_reviews, formula));
    else
      setScore(null);
  }, [game.appid, game.review_score, game.total_reviews, game.total_positive, formula, showReviews]);

  function openStore(e?: React.MouseEvent) {
    // Don't open store if context menu is open (user clicked elsewhere to close it)
    if (contextMenu.visible) {
      closeMenu();
      return;
    }
    const storeUrl = `https://store.steampowered.com/app/${game.appid}/`;
    // Use steam:// URL to open at Steam client level (closes plugin panel)
    try {
      (window as any).SteamClient?.URL?.ExecuteSteamURL?.(`steam://store/${game.appid}`);
      return;
    } catch (e) {}
    // Fallback: SPA navigation
    try {
      Navigation.Navigate(`/store/app/${game.appid}`);
      return;
    } catch (e) {}
    // Last fallback: system browser
    (window as any).SteamClient?.System?.OpenInSystemBrowser?.(storeUrl);
  }

  const steamPriceLabel = !game.price_known
    ? '—'
    : game.discount_percent > 0
    ? `−${game.discount_percent}% ${formatPrice(game.price)}`
    : game.price === 0
    ? 'Free'
    : formatPrice(game.price);

  const bestDeal = deals && deals.length > 0 ? deals[0] : null;
  const marketPriceLabel = dealsLoading
    ? '…'
    : bestDeal
    ? bestDeal.price.toLocaleString(undefined, { style: 'currency', currency: bestDeal.currency, minimumFractionDigits: 2 })
    : deals !== null ? '—' : steamPriceLabel;

  function openDeal(e: React.MouseEvent, url: string) {
    e.stopPropagation();
    (window as any).SteamClient?.System?.OpenInSystemBrowser?.(url);
  }

  function handleMouseEnter() {
    // Clear any existing timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    
    // Set timer to show screenshots after 500ms
    hoverTimerRef.current = setTimeout(() => {
      setCurrentScreenshotIndex(0);
      // Fetch screenshots if not already loaded
      if (!screenshots && !screenshotsLoading) {
        setScreenshotsLoading(true);
        fetchScreenshots(game.appid).then(urls => {
          setScreenshots(urls);
          setScreenshotsLoading(false);
          setShowScreenshots(true); // Only show when loaded
        }).catch(() => {
          setScreenshotsLoading(false);
        });
      } else if (screenshots && screenshots.length > 0) {
        // Already loaded, just show
        setShowScreenshots(true);
      }
    }, 500);
  }

  function handleMouseLeave() {
    // Clear timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // Clear scroll interval
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    // Hide screenshots overlay but keep the fetched data for next hover
    setShowScreenshots(false);
    setCurrentScreenshotIndex(0);
  }

  // Auto-scroll through screenshots
  useEffect(() => {
    if (showScreenshots && screenshots && screenshots.length > 1) {
      scrollIntervalRef.current = setInterval(() => {
        setCurrentScreenshotIndex(prev => (prev + 1) % screenshots.length);
      }, 1500);
    }
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [showScreenshots, screenshots]);

  const closeMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (globalContextMenuClose === closeMenu) {
      globalContextMenuClose = null;
    }
  }, []);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Close any other open menu first
    if (globalContextMenuClose && globalContextMenuClose !== closeMenu) {
      globalContextMenuClose();
    }
    // Calculate position relative to the card
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      justOpenedRef.current = true;
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        visible: true
      });
      globalContextMenuClose = closeMenu;
      // Clear the flag after a short delay
      setTimeout(() => { justOpenedRef.current = false; }, 100);
    }
  }

  function handleHide(e: React.MouseEvent) {
    e.stopPropagation();
    onHide?.(game.appid);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }

  function handleBlacklist(e: React.MouseEvent) {
    e.stopPropagation();
    onBlacklist?.(game.appid);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }

  function handleRemoveFromCollectionClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (viewingCollection && onRemoveFromCollection) {
      onRemoveFromCollection(viewingCollection, game.appid);
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  }

  function handleAddToCollection(collectionId: string) {
    onAddToCollection?.(collectionId, game);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }

  function handleUnhideClick(e: React.MouseEvent) {
    e.stopPropagation();
    onUnhide?.(game.appid);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }

  // Get the collection name when viewing a collection
  const viewingCollectionName = viewingCollection 
    ? collections.find(c => c.id === viewingCollection)?.name 
    : null;


  return (
    <div 
      ref={cardRef}
      style={styles.card} 
      onClick={openStore}
      onContextMenu={handleContextMenu}
    >
      <div style={styles.imageWrap}>
        {showScreenshots && screenshots && screenshots.length > 0 && !screenshotsLoading ? (
          <img
            key={`screenshot-${currentScreenshotIndex}`}
            src={screenshots[currentScreenshotIndex]}
            alt={`Screenshot ${currentScreenshotIndex + 1}`}
            style={styles.image}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        ) : (
          <img
            key={`cover-${game.appid}`}
            src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/capsule_231x87.jpg`}
            alt={game.name}
            style={styles.image}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (!img.dataset.fallback) {
                img.dataset.fallback = '1';
                img.src = game.tiny_image || `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/capsule_sm_120.jpg`;
              } else {
                img.src = 'https://store.steampowered.com/public/images/v6/default_app_capsule.png';
              }
            }}
          />
        )}
        {ownership.owned && (
          <div style={styles.libraryBadge}>
            <span style={styles.badgeIcon}>≡</span>
            IN LIBRARY
          </div>
        )}
        {!ownership.owned && ownership.wishlisted && (
          <div style={styles.wishlistBadge}>
            <span style={styles.badgeIcon}>★</span>
            ON WISHLIST
          </div>
        )}
      </div>
      <div style={styles.info}>
        <div style={styles.name}>{game.name}</div>

        <div style={styles.meta}>
          {game.review_score > 0 && game.review_score_desc && (
            <span style={{ ...styles.reviewDesc, color: REVIEW_COLOR(game.review_score) }}>
              {game.review_score_desc}
            </span>
          )}
          {showReviews && (
            <span style={{
              ...styles.scoreChip,
              borderColor: score !== null ? REVIEW_COLOR(game.review_score) : 'rgba(255,255,255,0.2)',
              color: score !== null ? REVIEW_COLOR(game.review_score) : '#8f98a0',
            }}>
              {score !== null ? formatScore(score) : '—'}
            </span>
          )}
        </div>

        <div style={styles.footer}>
          {game.total_reviews > 0 && (
            <span style={styles.reviewCount}>
              {game.total_reviews.toLocaleString()} reviews
            </span>
          )}
          {showRetail || showGreyMarket ? (
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => setTooltipVisible(true)}
              onMouseLeave={() => setTooltipVisible(false)}
            >
              <span
                style={{ ...styles.price, color: bestDeal ? '#f90' : '#8f98a0', cursor: bestDeal ? 'pointer' : 'default' }}
                onClick={bestDeal ? e => openDeal(e, bestDeal.url) : undefined}
              >
                {bestDeal && <span style={{ ...styles.marketBadge, background: bestDeal.badge === 'RT' ? '#66c0f4' : '#f90' }}>{bestDeal.badge}</span>} {marketPriceLabel}{bestDeal && <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.7 }}>🔗</span>}
              </span>
              {tooltipVisible && deals && deals.length > 0 && (
                <div style={styles.tooltip} onClick={e => e.stopPropagation()}>
                  {deals.map((d, i) => (
                    <div
                      key={i}
                      style={styles.tooltipRow}
                      onClick={e => openDeal(e, d.url)}
                    >
                      <span style={{ ...styles.tooltipShop, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, borderRadius: '2px', padding: '1px 3px', background: d.badge === 'RT' ? '#66c0f4' : '#f90', color: '#1b2838' }}>{d.badge}</span>
                        {d.shop}
                      </span>
                      <span style={styles.tooltipPrice}>
                        {d.price.toLocaleString(undefined, { style: 'currency', currency: d.currency, minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span style={styles.price}>{steamPriceLabel}</span>
          )}
        </div>
      </div>
      
      {/* Context Menu with Full Screen Overlay */}
      {contextMenu.visible && (
        <>
          {/* Full screen overlay - catches clicks anywhere on screen */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 199,
              backgroundColor: 'transparent',
            }}
            onClick={() => { if (!justOpenedRef.current) closeMenu(); }}
            onContextMenu={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              if (!justOpenedRef.current) closeMenu(); 
            }}
          />
          <div 
            data-context-menu="true"
            style={{
              ...styles.contextMenu,
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Show "Remove from collection" when viewing a collection */}
            {viewingCollection && onRemoveFromCollection && (
              <div style={styles.contextMenuItem} onClick={handleRemoveFromCollectionClick}>
                <span style={styles.contextMenuIcon}>❌</span>
                Remove from collection
              </div>
            )}
            
            {/* Show collections to add to */}
            {collections.length > 0 && onAddToCollection && (
              <>
                <div style={{ ...styles.contextMenuDivider, margin: '4px 0' }} />
                <div style={{ ...styles.contextMenuItem, color: '#8f98a0', cursor: 'default' }}>
                  Add to collection:
                </div>
                {collections.map(collection => {
                  const isInCollection = collection.games.some(g => g.appid === game.appid);
                  return (
                    <div 
                      key={collection.id}
                      style={{
                        ...styles.contextMenuItem,
                        opacity: isInCollection ? 0.5 : 1,
                        pointerEvents: isInCollection ? 'none' : 'auto',
                      }}
                      onClick={() => !isInCollection && handleAddToCollection(collection.id)}
                    >
                      <span style={styles.contextMenuIcon}>
                        {isInCollection ? '✓' : '+'}
                      </span>
                      {collection.name} {isInCollection && '(already added)'}
                    </div>
                  );
                })}
              </>
            )}
            
            {isHidden && onUnhide && (
              <>
                <div style={{ ...styles.contextMenuDivider, margin: '4px 0' }} />
                <div style={styles.contextMenuItem} onClick={handleUnhideClick}>
                  <span style={styles.contextMenuIcon}>👁️</span>
                  Unhide this game
                </div>
              </>
            )}
            <div style={{ ...styles.contextMenuDivider, margin: '4px 0' }} />
            <div style={styles.contextMenuItem} onClick={handleHide}>
              <span style={styles.contextMenuIcon}>🙈</span>
              Hide this game
            </div>
            <div style={styles.contextMenuItem} onClick={handleBlacklist}>
              <span style={styles.contextMenuIcon}>🚫</span>
              Blacklist this game
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px',
    overflow: 'visible',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    position: 'relative',
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
  },
  image: {
    width: '100%',
    aspectRatio: '231/87',
    objectFit: 'cover',
    display: 'block',
  },
  wishlistBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  libraryBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#b6dbff',
    color: '#1b2838',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  badgeIcon: {
    fontSize: '11px',
    lineHeight: 1,
  },
  info: {
    padding: '8px 10px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  name: {
    color: '#c6d4df',
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  reviewDesc: {
    color: '#8f98a0',
    fontSize: '11px',
  },
  scoreChip: {
    fontSize: '11px',
    border: '1px solid',
    borderRadius: '3px',
    padding: '1px 5px',
    fontWeight: 600,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  reviewCount: {
    color: '#8f98a0',
    fontSize: '11px',
  },
  price: {
    color: '#a4d007',
    fontSize: '12px',
    fontWeight: 500,
  },
  marketBadge: {
    display: 'inline-block',
    background: '#f90',
    color: '#1b2838',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    borderRadius: '2px',
    padding: '1px 4px',
    verticalAlign: 'middle',
    marginRight: '3px',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    marginBottom: '4px',
    background: '#1b2838',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    padding: '6px 0',
    minWidth: '200px',
    zIndex: 100,
    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
  },
  tooltipRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 10px',
    cursor: 'pointer',
    gap: '12px',
  },
  tooltipShop: {
    color: '#c6d4df',
    fontSize: '11px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tooltipPrice: {
    color: '#f90',
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  contextMenu: {
    position: 'absolute',
    background: '#1b2838',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    padding: '4px 0',
    minWidth: '160px',
    zIndex: 200,
    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
  },
  contextMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#c6d4df',
    cursor: 'pointer',
    transition: 'background 0.12s',
    ':hover': {
      background: 'rgba(255,255,255,0.08)',
    },
  } as React.CSSProperties,
  contextMenuIcon: {
    fontSize: '14px',
  },
};
