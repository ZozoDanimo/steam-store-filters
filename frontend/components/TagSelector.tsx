import React, { useState, useRef, useEffect } from 'react';
import { SteamTag, searchTags } from '../utils/tags';

interface TagSelectorProps {
  selected: SteamTag[];
  onChange: (tags: SteamTag[]) => void;
}

export function TagSelector({ selected, onChange }: TagSelectorProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SteamTag[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const results = searchTags(query).filter(
      (t) => !selected.some((s) => s.id === t.id)
    );
    setSuggestions(results.slice(0, 15));
  }, [query, selected]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function addTag(tag: SteamTag) {
    if (!selected.some((s) => s.id === tag.id)) {
      onChange([...selected, tag]);
    }
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function removeTag(tagId: number) {
    onChange(selected.filter((s) => s.id !== tagId));
  }

  return (
    <div style={styles.container}>
      <div style={styles.inputRow}>
        <div style={styles.tagsWrap}>
          {selected.map((tag) => (
            <span key={tag.id} style={styles.badge}>
              {tag.label}
              <button
                style={styles.badgeRemove}
                onClick={() => removeTag(tag.id)}
                title={`Remove ${tag.label}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            style={styles.input}
            value={query}
            placeholder={selected.length === 0 ? 'Search tags…' : 'Add tag…'}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(e.target.value.length > 0);
            }}
            onFocus={() => setOpen(query.length > 0)}
          />
        </div>
        {selected.length > 0 && (
          <button style={styles.clearAll} onClick={() => onChange([])}>
            Clear all
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div ref={dropdownRef} style={styles.dropdown}>
          {suggestions.map((tag) => (
            <div
              key={tag.id}
              style={styles.dropdownItem}
              onMouseDown={() => addTag(tag)}
            >
              <span style={styles.tagLabel}>{tag.label}</span>
            </div>
          ))}
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
    minWidth: '120px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: 'rgba(102,192,244,0.2)',
    border: '1px solid rgba(102,192,244,0.4)',
    color: '#66c0f4',
    borderRadius: '3px',
    padding: '2px 7px',
    fontSize: '12px',
  },
  badgeRemove: {
    background: 'none',
    border: 'none',
    color: '#66c0f4',
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
    maxHeight: '240px',
    overflowY: 'auto',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  dropdownItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    transition: 'background 0.1s',
  },
  tagLabel: {
    color: '#c6d4df',
    fontSize: '13px',
  },
  tagCategory: {
    color: '#8f98a0',
    fontSize: '11px',
  },
};
