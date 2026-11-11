import React, { useEffect, useRef, useState } from 'react';
import { Attachment } from '../../../api/types';
import {
  claimPlayback,
  formatDuration,
  PLAY_NEXT_EVENT,
  releasePlayback,
} from '../../../lib/voicePlayback';
import { Icon } from '../../ui/Icon';

const SPEEDS = [1, 1.5, 2];
const SEEK_STEP = 5;

interface VoicePlayerProps {
  voice: Attachment;
  onExpired: () => void;
}

/**
 * Play and pause, a waveform that fills as it plays and can be tapped or dragged to seek, the
 * duration, and 1x, 1.5x or 2x. Space plays and pauses when it has focus, and when it finishes,
 * a voice note in the very next message starts on its own.
 */
export const VoicePlayer: React.FC<VoicePlayerProps> = ({ voice, onExpired }) => {
  const audio = useRef<HTMLAudioElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const wave = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const duration = voice.durationSeconds ?? 0;
  const levels = voice.waveform ?? Array.from({ length: 48 }, () => 0.3);
  const played = duration ? time / duration : 0;

  const play = () => {
    const element = audio.current;
    if (!element) return;
    claimPlayback(element);
    element.play().catch(() => setIsPlaying(false));
  };
  const toggle = () => (isPlaying ? audio.current?.pause() : play());

  // The previous voice note in a row asks this one to start when it ends.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const start = () => play();
    element.addEventListener(PLAY_NEXT_EVENT, start);
    return () => element.removeEventListener(PLAY_NEXT_EVENT, start);
  });

  useEffect(() => {
    const element = audio.current;
    return () => {
      if (element) {
        element.pause();
        releasePlayback(element);
      }
    };
  }, []);

  const seekTo = (seconds: number) => {
    const element = audio.current;
    if (!element || !duration) return;
    element.currentTime = Math.min(duration, Math.max(0, seconds));
    setTime(element.currentTime);
  };

  const seekFromPointer = (clientX: number) => {
    const box = wave.current?.getBoundingClientRect();
    if (box) seekTo(((clientX - box.left) / box.width) * duration);
  };

  const playNextInRow = () => {
    const row = root.current?.closest('li');
    let next = row?.nextElementSibling;
    while (next && next.getAttribute('role') === 'separator') next = next.nextElementSibling;
    next?.querySelector('[data-voice-player]')?.dispatchEvent(new Event(PLAY_NEXT_EVENT));
  };

  return (
    <div
      ref={root}
      data-voice-player
      role="group"
      aria-label={`Voice note, ${formatDuration(duration)}`}
      tabIndex={0}
      className="voice-player"
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <button
        type="button"
        className="voice-play"
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
        onClick={toggle}
      >
        <Icon name={isPlaying ? 'pause' : 'play_arrow'} filled />
      </button>

      <div
        ref={wave}
        role="slider"
        tabIndex={0}
        aria-label="Position in voice note"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
        className="voice-wave"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => e.buttons === 1 && seekFromPointer(e.clientX)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seekTo(time + SEEK_STEP);
          else if (e.key === 'ArrowLeft') seekTo(time - SEEK_STEP);
          else if (e.key === ' ') {
            e.preventDefault();
            toggle();
          } else return;
          e.preventDefault();
        }}
      >
        {levels.map((level, index) => (
          <i
            key={index}
            className={index / levels.length < played ? 'is-played' : ''}
            style={{ height: `${Math.max(12, level * 100)}%` }}
          />
        ))}
      </div>

      <span className="voice-time tabular-nums">
        {formatDuration(isPlaying || time > 0 ? time : duration)}
      </span>
      <button
        type="button"
        className="voice-speed"
        aria-label={`Playback speed ${speed}x`}
        onClick={() => {
          const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
          setSpeed(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
      >
        {speed}x
      </button>

      <audio
        ref={audio}
        src={voice.url}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onRateChange={(e) => setSpeed(e.currentTarget.playbackRate)}
        onEnded={() => {
          setIsPlaying(false);
          setTime(0);
          if (audio.current) releasePlayback(audio.current);
          playNextInRow();
        }}
        onError={onExpired}
      />
    </div>
  );
};
