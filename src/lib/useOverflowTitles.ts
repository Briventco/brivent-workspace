import { useEffect } from 'react';

const MAX_DEPTH = 4;

function isClipped(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  if (style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1) return true;
  return (
    style.webkitLineClamp !== '' &&
    style.webkitLineClamp !== 'none' &&
    element.scrollHeight > element.clientHeight + 1
  );
}

/**
 * Anything cut short with an ellipsis shows its full text as a tooltip, on hover or keyboard
 * focus. One listener covers every list in the app, so new screens get it without remembering.
 * Screen readers already hear the full text: the cut is only visual.
 */
export function useOverflowTitles() {
  useEffect(() => {
    const reveal = (event: Event) => {
      let element = event.target instanceof HTMLElement ? event.target : null;
      for (let depth = 0; element && depth < MAX_DEPTH; depth += 1) {
        const isOurs = element.dataset.overflowTitle !== undefined;
        if (element.title && !isOurs) return;
        if (isClipped(element)) {
          element.title = element.innerText.trim();
          element.dataset.overflowTitle = '';
          return;
        }
        if (isOurs) {
          // It fits now, after a resize or a change of text.
          element.removeAttribute('title');
          delete element.dataset.overflowTitle;
        }
        element = element.parentElement;
      }
    };
    document.addEventListener('mouseover', reveal);
    document.addEventListener('focusin', reveal);
    return () => {
      document.removeEventListener('mouseover', reveal);
      document.removeEventListener('focusin', reveal);
    };
  }, []);
}
