import React, { useEffect, useRef, useState } from 'react';
import { formatDuration } from '../../../lib/voicePlayback';
import {
  MAX_VOICE_SECONDS,
  Recording,
  useVoiceRecorder,
  WARN_AT_SECONDS,
} from '../../../lib/useVoiceRecorder';
import { Button, IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

const SLIDE_TO_CANCEL = 80;
const SLIDE_TO_LOCK = 60;

interface VoiceRecorderProps {
  onSend: (recording: Recording) => void;
  /** Tells the composer to step aside while recording, and come back after. */
  onActiveChange: (isActive: boolean) => void;
}

/**
 * The mic button and everything behind it. On a laptop a click starts recording, with Cancel and
 * Stop, then a listen-back before sending. On a phone it's hold to talk: slide left to cancel,
 * slide up to lock and carry on hands-free.
 */
export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, onActiveChange }) => {
  const voice = useVoiceRecorder();
  const [isHolding, setIsHolding] = useState(false);
  const [slide, setSlide] = useState({ x: 0, y: 0 });
  const hold = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const preview = useRef<HTMLAudioElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isActive = voice.phase !== 'idle';

  useEffect(() => onActiveChange(isActive), [isActive, onActiveChange]);

  useEffect(() => {
    if (!voice.recording) return;
    const url = URL.createObjectURL(voice.recording.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [voice.recording]);

  const send = (recording: Recording | null) => {
    if (recording) onSend(recording);
    voice.reset();
  };

  const endHold = async (cancelled: boolean) => {
    hold.current = null;
    setIsHolding(false);
    setSlide({ x: 0, y: 0 });
    if (cancelled) voice.cancel();
    else send(await voice.stop());
  };

  const isRecording = voice.phase === 'recording' || voice.phase === 'starting';
  const isWarning = voice.elapsed >= WARN_AT_SECONDS;

  // Children keep their places, so the mic button is the same element for the whole of a hold
  // and never loses the finger it's tracking.
  return (
    <div className={`voice-recorder ${isActive ? 'is-active' : ''}`}>
      {voice.error && !isActive ? (
        <p role="alert" className="voice-error">
          {voice.error}
        </p>
      ) : null}

      {voice.phase === 'review' && voice.recording ? (
        <div className="flex items-center gap-2 grow min-w-0" role="group" aria-label="Voice note ready to send">
          <IconButton icon="delete" size="sm" label="Delete recording" onClick={voice.reset} />
          {previewUrl && (
            <audio ref={preview} src={previewUrl} controls className="voice-preview grow min-w-0" aria-label="Listen back" />
          )}
          <span className="text-caption text-text-2 tabular-nums">
            {formatDuration(voice.recording.durationSeconds)}
          </span>
          <Button size="sm" icon="send" onClick={() => send(voice.recording)}>
            Send
          </Button>
        </div>
      ) : null}

      {isRecording ? (
        <div className="flex items-center gap-3 grow min-w-0" role="group" aria-label="Recording a voice note">
          {voice.phase === 'starting' ? (
            // Some browsers take a few seconds to hand over the microphone. It isn't recording yet.
            <span role="status" className="text-small text-text-2 whitespace-nowrap">
              Starting microphone…
            </span>
          ) : (
            <>
              <span className="recording-dot" aria-hidden="true" />
              <span className="tabular-nums font-semibold" role="timer">
                {formatDuration(voice.elapsed)}
              </span>
            </>
          )}
          <span className="voice-level" aria-hidden="true">
            <i style={{ transform: `scaleX(${Math.max(0.04, voice.level)})` }} />
          </span>
          {isWarning && (
            <span role="status" className="text-caption text-warning whitespace-nowrap">
              {formatDuration(MAX_VOICE_SECONDS - voice.elapsed)} left
            </span>
          )}
          {isHolding ? (
            <span className="text-caption text-text-2 whitespace-nowrap">
              {slide.x < -SLIDE_TO_CANCEL / 2 ? 'Release to cancel' : '◀ Slide to cancel · ▲ lock'}
            </span>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={voice.cancel}>
                Cancel
              </Button>
              <IconButton
                icon="stop"
                size="sm"
                variant="secondary"
                label="Stop recording"
                disabled={voice.phase !== 'recording'}
                onClick={() => voice.stop()}
              />
            </>
          )}
        </div>
      ) : null}

      {voice.phase === 'idle' || isHolding ? (
        <button
          type="button"
          className={`btn btn-icon btn-ghost btn-sm voice-mic ${isHolding ? 'is-holding' : ''}`}
          aria-label="Record a voice note"
          title="Record a voice note"
          style={isHolding ? { transform: `translate(${Math.min(0, slide.x)}px, ${Math.min(0, slide.y)}px)` } : undefined}
          onClick={(e) => {
            // A mouse or keyboard press records hands-free. Touch is handled as hold to talk.
            if ((e.nativeEvent as PointerEvent).pointerType !== 'touch') voice.start();
          }}
          onPointerDown={(e) => {
            if (e.pointerType !== 'touch') return;
            e.currentTarget.setPointerCapture(e.pointerId);
            hold.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
            setIsHolding(true);
            voice.start();
          }}
          onPointerMove={(e) => {
            const start = hold.current;
            if (!start || e.pointerId !== start.pointerId) return;
            const next = { x: e.clientX - start.x, y: e.clientY - start.y };
            setSlide(next);
            if (next.x < -SLIDE_TO_CANCEL) endHold(true);
            else if (next.y < -SLIDE_TO_LOCK) {
              // Locked: it keeps recording, and the laptop controls take over.
              hold.current = null;
              setIsHolding(false);
              setSlide({ x: 0, y: 0 });
            }
          }}
          onPointerUp={() => hold.current && endHold(false)}
          onPointerCancel={() => hold.current && endHold(true)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Icon name="mic" />
        </button>
      ) : null}
    </div>
  );
};
