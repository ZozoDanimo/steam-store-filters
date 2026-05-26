import React from 'react';
import { Navigation } from '@steambrew/client';

const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ width: '16px', height: '16px' }}>
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

export function FilterButton() {
  const handleClick = () => {
    Navigation.Navigate('/filters');
  };

  return (
    <button
      onClick={handleClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: '#c6d4df',
        cursor: 'pointer',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        opacity: 0.8,
        transition: 'opacity 0.2s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
      title="Steam Store Filters"
    >
      <FilterIcon />
      <span>Steam Store Filters</span>
    </button>
  );
}
