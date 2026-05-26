import { findModule } from '@steambrew/client';
import React from 'react';
import { FilterButton } from '../components/FilterButton';

export async function patchUrlBar(document: Document): Promise<void> {
  const classes = {
    steamdesktop: findModule(e => e.FocusBar) as Record<string, string>,
    steamPopupTab: findModule(e => e.BrowserTabIcon) as Record<string, string>,
  };

  const urlBar = await WaitForElement(
    `.${classes.steamdesktop.URLBar}, .${classes.steamPopupTab.URLBar}`,
    document,
  );

  if (!urlBar) {
    return;
  }

  if (document.querySelector('.filter-button-container') !== null) {
    return;
  }

  const filterButtonContainer = document.createElement('div');
  filterButtonContainer.classList.add('filter-button-container');
  filterButtonContainer.style.position = 'absolute';
  filterButtonContainer.style.right = '120px';
  filterButtonContainer.style.top = '50%';
  filterButtonContainer.style.transform = 'translateY(-50%)';
  urlBar.style.position = 'relative';
  urlBar.appendChild(filterButtonContainer);

  const reactRoot = (window as any).SP_REACTDOM.createRoot(filterButtonContainer);
  reactRoot.render(<FilterButton />);

  // Periodically check if button still exists and re-inject if needed
  setInterval(() => {
    if (!document.querySelector('.filter-button-container')) {
      patchUrlBar(document);
    }
  }, 2000);
}

function WaitForElement(selector: string, document: Document): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element as HTMLElement);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element as HTMLElement);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}
