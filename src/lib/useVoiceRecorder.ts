import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_VOICE_SECONDS = 300;
export const WARN_AT_SECONDS = 270;

/** Whatever this browser records: WebM/Opus on Chrome, MP4/AAC on Safari. The server converts it. */
function pickMimeType(): string | undefined {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return options.find((type) => MediaRecorder.isTypeSupported?.(type));
}

export const canRecordVoice = () =>
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia);

export interface Recording {
  blob: Blob;
  durationSeconds: number;
  fileName: string;
}

type Phase = 'idle' | 'starting' | 'recording' | 'review';

const BLOCKED =
  "Microphone access is blocked. Allow it in your browser's site settings (the icon next to the address), then try again.";

/**
 * Asks for the microphone only when recording first starts, and lets go of it as soon as it stops,
 * so the browser's recording light never stays on.
 */
interface Session {
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  /** Cancelled: whatever it recorded is thrown away. */
  discard: boolean;
  finished: ((recording: Recording | null) => void) | null;
}

export function useVoiceRecorder() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);

  // Each recording owns its chunks and flags. A cancelled recorder still delivers its last chunk
  // after stopping, and that must never land in the next recording's file.
  const session = useRef<Session | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const ticker = useRef(0);
  /** Set when cancel or stop lands while the microphone is still being opened. */
  const abortStart = useRef(false);

  const release = useCallback(() => {
    window.clearInterval(ticker.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    context.current?.close().catch(() => {});
    context.current = null;
    setLevel(0);
  }, []);

  useEffect(
    () => () => {
      const current = session.current;
      if (current) {
        current.discard = true;
        if (current.recorder.state === 'recording') current.recorder.stop();
      }
      release();
    },
    [release],
  );

  const stop = useCallback((): Promise<Recording | null> => {
    const current = session.current;
    if (!current || current.recorder.state !== 'recording') {
      abortStart.current = true;
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      current.finished = resolve;
      current.recorder.stop();
    });
  }, []);

  const start = useCallback(async () => {
    if (phase === 'starting' || phase === 'recording') return;
    setError(null);
    setRecording(null);
    setPhase('starting');
    abortStart.current = false;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (failure) {
      setPhase('idle');
      const name = failure instanceof DOMException ? failure.name : '';
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? BLOCKED
          : 'No microphone was found. Plug one in, or check your sound settings.',
      );
      return;
    }

    // A quick tap, release or swipe can finish before the browser hands over the microphone. That
    // means don't record: let go of it at once rather than start recording unattended.
    if (abortStart.current) {
      release();
      setPhase('idle');
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    // Date rather than performance.now, so the 5-minute limit can be checked with a fake clock.
    const current: Session = { recorder, chunks: [], startedAt: Date.now(), discard: false, finished: null };
    session.current = current;

    recorder.ondataavailable = (event) => {
      if (event.data.size) current.chunks.push(event.data);
    };
    recorder.onstop = () => {
      const durationSeconds = (Date.now() - current.startedAt) / 1000;
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const result = current.discard
        ? null
        : {
            blob: new Blob(current.chunks, { type }),
            durationSeconds,
            fileName: type.includes('mp4') ? 'voice.m4a' : type.includes('ogg') ? 'voice.ogg' : 'voice.webm',
          };
      current.finished?.(result);
      current.finished = null;
      // An old recorder finishing late leaves the newer one's screen alone.
      if (session.current !== current) return;
      release();
      setRecording(result);
      setPhase(result ? 'review' : 'idle');
    };

    // A live level, so people can see it's hearing them.
    const audioContext = new AudioContext();
    context.current = audioContext;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    audioContext.createMediaStreamSource(stream.current).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    // An interval rather than animation frames: frames stop in a background tab, and the timer and
    // the 5-minute limit have to keep counting there.
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
      setElapsed((Date.now() - current.startedAt) / 1000);
    };

    setElapsed(0);
    recorder.start(250);
    setPhase('recording');
    ticker.current = window.setInterval(tick, 100);
  }, [phase, release]);

  // Five minutes is the limit, so it stops there by itself, kept for review.
  useEffect(() => {
    if (phase === 'recording' && elapsed >= MAX_VOICE_SECONDS) stop();
  }, [phase, elapsed, stop]);

  const cancel = useCallback(() => {
    abortStart.current = true;
    const current = session.current;
    if (current?.recorder.state === 'recording') {
      current.discard = true;
      current.recorder.stop();
    } else {
      release();
    }
    setRecording(null);
    setPhase('idle');
  }, [release]);

  const reset = useCallback(() => {
    setRecording(null);
    setPhase('idle');
  }, []);

  return { phase, elapsed, level, error, recording, start, stop, cancel, reset, clearError: () => setError(null) };
}
