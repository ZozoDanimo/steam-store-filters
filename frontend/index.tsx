import React from 'react';
import {
  Millennium,
  definePlugin,
  routerHook,
  Navigation,
  Field,
  Toggle,
} from '@steambrew/client';

import { SearchPage } from './components/SearchPage';
import { patchUrlBar } from './utils/urlBarPatch';
import './styles.css';

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ width: '16px', height: '16px' }}>
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// Inject keyframe animation for the loading spinner (inline styles can't define @keyframes)
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes ssf-spin { to { transform: rotate(360deg); } }`;
document.head?.appendChild(styleTag);

// ─── Settings state (persisted via localStorage) ──────────────────────────
const STORAGE_KEY = 'steam-store-filters-settings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveSettings(settings: object) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ─── Route registration ──────────────────────────────────────────────────
const ROUTE_PATH = '/filters';

// ─── Popup creation callback for URL bar injection ─────────────────────────
async function onPopupCreation(popup: any): Promise<void> {
  if (!popup) return;

  console.log('[steam-store-filters] Popup created:', popup.m_strName);

  // Patch URL bar for main window and tabbed popups
  if (popup.m_strName === 'SP Desktop_uid0' ||
      popup.m_strName.includes('TabbedPopupBrowser')) {
    console.log('[steam-store-filters] Patching popup:', popup.m_strName);
    await patchUrlBar(popup.m_popup.document);
  }
}

// ─── Plugin settings panel ────────────────────────────────────────────────

function SettingsContent() {
  const settings = loadSettings();
  const [showScores, setShowScores] = React.useState(settings.showScores ?? true);
  const [formula, setFormula] = React.useState(settings.formula ?? 'steamdb');

  function toggleShowScores(val: boolean) {
    setShowScores(val);
    saveSettings({ ...loadSettings(), showScores: val });
  }

  function toggleFormula(useSteamdb: boolean) {
    const f = useSteamdb ? 'steamdb' : 'wilson';
    setFormula(f);
    saveSettings({ ...loadSettings(), formula: f });
  }

  function openFiltersPage() {
    Navigation.Navigate(ROUTE_PATH);
  }

  const SafeField = Field ?? (({ label, description, children }: any) => (
    <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ color: '#c6d4df', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontWeight: 500 }}>{label}</div><div style={{ color: '#8f98a0', fontSize: '11px', marginTop: '2px' }}>{description}</div></div>
        {children}
      </div>
    </div>
  ));
  const SafeToggle = Toggle ?? (({ value, onChange }: any) => (
    <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
  ));

  return (
    <>
      <SafeField
        label="Open Filters Page"
        description="Click to open the Steam Store Filters search page"
        bottomSeparator="standard"
        focusable
      >
        <button
          onClick={openFiltersPage}
          style={{
            background: '#2a475e',
            color: '#c6d4df',
            border: '1px solid #66c0f4',
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Open
        </button>
      </SafeField>

      <SafeField
        label="Show score chips on game cards"
        description="Fetches review counts per game to display Wilson/SteamDB score"
        bottomSeparator="standard"
        focusable
      >
        <SafeToggle value={showScores} onChange={toggleShowScores} />
      </SafeField>

      <SafeField
        label="Use SteamDB rating formula"
        description={
          formula === 'steamdb'
            ? 'SteamDB: score − (score − 0.5) × 2^(−log₁₀(n+1)). More readable.'
            : 'Wilson: 95% CI lower bound (Evan Miller). Statistically rigorous.'
        }
        bottomSeparator="standard"
        focusable
      >
        <SafeToggle value={formula === 'steamdb'} onChange={toggleFormula} />
      </SafeField>

      <SafeField
        label="Attribution"
        description="Inspired by lorenzostanco.com/lab/steam/store/ — Wilson score formula by Evan Miller (2009), SteamDB rating (2017)"
        bottomSeparator="none"
        focusable={false}
      >
        <></>
      </SafeField>
    </>
  );
}

// ─── Plugin entry point ───────────────────────────────────────────────────

export default definePlugin(() => {
  // Register the route in Millennium's desktop router
  routerHook.addRoute(ROUTE_PATH, () => <SearchPage />);
  console.log('[steam-store-filters] route registered:', ROUTE_PATH);

  // Register popup creation callback for URL bar injection
  // @ts-expect-error g_PopupManager is a global Steam object
  if (typeof g_PopupManager !== 'undefined') {
    // @ts-expect-error AddPopupCreatedCallback is a Steam method
    g_PopupManager.AddPopupCreatedCallback(onPopupCreation);
    console.log('[steam-store-filters] popup callback registered');
  }

  return {
    title: 'Steam Store Filters',
    icon: <SearchIcon />,
    content: <SettingsContent />,
    onDismount() {
      routerHook.removeRoute(ROUTE_PATH);
      // @ts-expect-error g_PopupManager is a global Steam object
      if (typeof g_PopupManager !== 'undefined') {
        // @ts-expect-error RemovePopupCreatedCallback is a Steam method
        g_PopupManager.RemovePopupCreatedCallback(onPopupCreation);
      }
      console.log('[steam-store-filters] cleaned up');
    },
  };
});
