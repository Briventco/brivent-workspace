/** Only one voice note plays at a time: starting one pauses whichever was playing. */
let playing: HTMLAudioElement | null = null;

export function claimPlayback(audio: HTMLAudioElement) {
  if (playing && playing !== audio) playing.pause();
  playing = audio;
}

export function releasePlayback(audio: HTMLAudioElement) {
  if (playing === audio) playing = null;
}

export const PLAY_NEXT_EVENT = 'brivent:play-voice';

/** m:ss, as the design writes durations. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
