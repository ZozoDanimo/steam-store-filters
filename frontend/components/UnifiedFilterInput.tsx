import React, { useState, useRef, useEffect, useMemo } from 'react';

export type FilterKind = 'tag' | 'language' | 'platform' | 'feature' | 'vr' | 'accessibility';

export interface FilterToken {
  kind: FilterKind;
  /** Numeric for tags/features/vr/accessibility, string for language code / os slug. */
  id: string | number;
  label: string;
}

const KIND_META: Record<FilterKind, { label: string; color: string; bg: string; border: string }> = {
  tag:           { label: 'Tag',     color: '#66c0f4', bg: 'rgba(102,192,244,0.18)', border: 'rgba(102,192,244,0.40)' },
  language:      { label: 'Lang',    color: '#7fd684', bg: 'rgba(127,214,132,0.18)', border: 'rgba(127,214,132,0.40)' },
  platform:      { label: 'OS',      color: '#f0a85d', bg: 'rgba(240,168,93,0.18)',  border: 'rgba(240,168,93,0.40)'  },
  feature:       { label: 'Feature', color: '#c08bf0', bg: 'rgba(192,139,240,0.18)', border: 'rgba(192,139,240,0.40)' },
  vr:            { label: 'VR',      color: '#f08bbf', bg: 'rgba(240,139,191,0.18)', border: 'rgba(240,139,191,0.40)' },
  accessibility: { label: 'A11y',    color: '#5dd4d0', bg: 'rgba(93,212,208,0.18)',  border: 'rgba(93,212,208,0.40)'  },
};

interface Props {
  tokens: FilterToken[];
  available: FilterToken[];
  onAdd: (token: FilterToken) => void;
  onRemove: (token: FilterToken) => void;
  onClearAll: () => void;
}

function tokenKey(t: FilterToken): string {
  return `${t.kind}:${t.id}`;
}

export function UnifiedFilterInput({ tokens, available, onAdd, onRemove, onClearAll }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedKeys = useMemo(() => new Set(tokens.map(tokenKey)), [tokens]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    return available
      .filter(t => !selectedKeys.has(tokenKey(t)))
      .filter(t => t.label.toLowerCase().includes(q))
      .slice(0, 30);
  }, [query, available, selectedKeys]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function add(token: FilterToken) {
    onAdd(token);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div style={styles.container}>
      <div style={styles.inputRow}>
        <div style={styles.tagsWrap}>
          {tokens.map(token => {
            const meta = KIND_META[token.kind];
            return (
              <span key={tokenKey(token)} style={{
                ...styles.badge,
                backgroundColor: meta.bg,
                borderColor: meta.border,
                color: meta.color,
              }}>
                <span style={styles.badgeKind}>{meta.label}</span>
                {token.label}
                <button
                  style={{ ...styles.badgeRemove, color: meta.color }}
                  onClick={() => onRemove(token)}
                  title={`Remove ${token.label}`}
                >×</button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            style={styles.input}
            value={query}
            placeholder={tokens.length === 0 ? 'Search tags, languages, platforms, features…' : 'Add filter…'}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(e.target.value.length > 0);
            }}
            onFocus={() => setOpen(query.length > 0)}
          />
        </div>
        {tokens.length > 0 && (
          <button style={styles.clearAll} onClick={onClearAll}>Clear all</button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div ref={dropdownRef} style={styles.dropdown}>
          {suggestions.map(token => {
            const meta = KIND_META[token.kind];
            return (
              <div
                key={tokenKey(token)}
                style={styles.dropdownItem}
                onMouseDown={() => add(token)}
              >
                <span style={{ ...styles.dropdownKind, color: meta.color, borderColor: meta.border }}>
                  {meta.label}
                </span>
                <span style={styles.dropdownLabel}>{token.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    marginBottom: '12px',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  tagsWrap: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    padding: '6px 10px',
    minHeight: '38px',
  },
  input: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#c6d4df',
    fontSize: '13px',
    flexGrow: 1,
    minWidth: '180px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    border: '1px solid',
    borderRadius: '3px',
    padding: '2px 7px',
    fontSize: '12px',
  },
  badgeKind: {
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    opacity: 0.7,
  },
  badgeRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    lineHeight: 1,
    padding: '0',
    marginLeft: '2px',
    opacity: 0.7,
  },
  clearAll: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#8f98a0',
    borderRadius: '3px',
    padding: '5px 10px',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    alignSelf: 'stretch',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#1b2838',
    border: '1px solid rgba(102,192,244,0.3)',
    borderRadius: '4px',
    marginTop: '4px',
    maxHeight: '320px',
    overflowY: 'auto',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  dropdownKind: {
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    border: '1px solid',
    borderRadius: '2px',
    padding: '1px 5px',
    minWidth: '40px',
    textAlign: 'center',
  },
  dropdownLabel: {
    color: '#c6d4df',
    fontSize: '13px',
  },
};
