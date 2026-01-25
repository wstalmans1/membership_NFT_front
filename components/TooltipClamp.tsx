'use client';

import { useEffect } from 'react';

export function TooltipClamp() {
  useEffect(() => {
    const clampTooltip = (anchor: HTMLElement) => {
      const tooltip = anchor.querySelector<HTMLElement>('[data-tooltip]');
      if (!tooltip) return;

      tooltip.style.transform = '';

      const rect = tooltip.getBoundingClientRect();
      if (!rect.width) return;

      const padding = 8;
      let shift = 0;

      if (rect.left < padding) {
        shift = padding - rect.left;
      } else if (rect.right > window.innerWidth - padding) {
        shift = -(rect.right - (window.innerWidth - padding));
      }

      if (shift !== 0) {
        tooltip.style.transform = `translateX(${shift}px)`;
      }
    };

    const handler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('[data-tooltip-anchor]') as HTMLElement | null;
      if (!anchor) return;
      requestAnimationFrame(() => clampTooltip(anchor));
    };

    document.addEventListener('pointerenter', handler, true);
    document.addEventListener('focusin', handler, true);

    return () => {
      document.removeEventListener('pointerenter', handler, true);
      document.removeEventListener('focusin', handler, true);
    };
  }, []);

  return null;
}
