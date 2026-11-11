import React, { useEffect, useRef } from 'react';

const REPORT_EVERY_MS = 10_000;

interface PlayerApi {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number | string>;
      events?: { onStateChange?: (event: { data: number }) => void };
    },
  ) => PlayerApi;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YouTubeApi> | null = null;

/** YouTube's own player script, loaded once and only on a page that plays a video. */
function loadYouTube(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error('YouTube could not be reached.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  /** Called while it plays, at most every 10 seconds, and when it pauses or ends. */
  onWatched: (watchedSeconds: number, durationSeconds: number) => void;
  onUnavailable: () => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, title, onWatched, onUnavailable }) => {
  const holder = useRef<HTMLDivElement>(null);
  const report = useRef(onWatched);
  report.current = onWatched;

  useEffect(() => {
    let player: PlayerApi | null = null;
    let timer = 0;
    let lastSent = 0;
    let isGone = false;

    const send = (force: boolean) => {
      if (!player) return;
      const now = Date.now();
      if (!force && now - lastSent < REPORT_EVERY_MS) return;
      const duration = player.getDuration();
      if (!duration) return;
      lastSent = now;
      report.current(Math.min(player.getCurrentTime(), duration), duration);
    };

    loadYouTube().then(
      (yt) => {
        if (isGone || !holder.current) return;
        const element = document.createElement('div');
        holder.current.replaceChildren(element);
        player = new yt.Player(element, {
          videoId,
          // No tracking cookies until someone presses play.
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0, modestbranding: 1 },
          events: {
            onStateChange: ({ data }) => {
              window.clearInterval(timer);
              if (data === yt.PlayerState.PLAYING) {
                timer = window.setInterval(() => send(false), REPORT_EVERY_MS);
              } else if (data === yt.PlayerState.PAUSED || data === yt.PlayerState.ENDED) {
                send(true);
              }
            },
          },
        });
      },
      () => !isGone && onUnavailable(),
    );

    return () => {
      isGone = true;
      window.clearInterval(timer);
      send(true);
      player?.destroy();
    };
    // A new video means a new player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className="youtube-frame" aria-label={`Video: ${title}`} role="region">
      <div ref={holder} className="youtube-holder" />
    </div>
  );
};
