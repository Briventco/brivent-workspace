import { useEffect } from 'react';

const APP_NAME = 'Brivent Workspace';

let routeTitle = APP_NAME;
let detailTitle: string | null = null;

const apply = () => {
  const title = detailTitle ?? routeTitle;
  document.title = title === APP_NAME ? APP_NAME : `${title} · ${APP_NAME}`;
};

/** The page's own name, such as "My Tasks". Set by the app for every route. */
export function useRouteTitle(title: string) {
  useEffect(() => {
    routeTitle = title;
    apply();
  }, [title]);
}

/**
 * Names the tab after what's open, such as a task's title, once it has loaded. It wins over the
 * route's name however the effects happen to be ordered, and gives way again on leaving.
 */
export function useDetailTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    detailTitle = title;
    apply();
    return () => {
      detailTitle = null;
      apply();
    };
  }, [title]);
}
