import React from 'react';
import { SortBy } from '../utils/steamApi';
import { ScoreFormula } from '../utils/wilson';

interface SortBarProps {
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  formula: ScoreFormula;
  onFormulaChange: (f: ScoreFormula) => void;
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'Score', label: 'Best Rated' },
  { value: 'Reviews', label: 'Most Reviewed' },
  { value: 'Release_Date', label: 'Release Date' },
  { value: 'Price', label: 'Price' },
  { value: '_ASC', label: 'Name (A–Z)' },
];

export function SortBar({ sortBy, onSortChange, formula, onFormulaChange }: SortBarProps) {
  return (
    <div style={styles.container}>
      <div style={styles.group}>
        <span style={styles.label}>Sort by</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            style={sortBy === opt.value ? styles.btnActive : styles.btn}
            onClick={() => onSortChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={styles.group}>
        <span style={styles.label}>Formula</span>
        <button
          style={formula === 'steamdb' ? styles.btnActive : styles.btn}
          onClick={() => onFormulaChange('steamdb')}
          title="SteamDB rating: logarithmic confidence formula"
        >
          SteamDB
        </button>
        <button
          style={formula === 'wilson' ? styles.btnActive : styles.btn}
          onClick={() => onFormulaChange('wilson')}
          title="Wilson score: 95% confidence lower bound"
        >
          Wilson
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '14px',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  label: {
    color: '#8f98a0',
    fontSize: '12px',
    marginRight: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  btn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#8f98a0',
    borderRadius: '3px',
    padding: '4px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  btnActive: {
    background: 'rgba(102,192,244,0.15)',
    border: '1px solid rgba(102,192,244,0.5)',
    color: '#66c0f4',
    borderRadius: '3px',
    padding: '4px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
};
