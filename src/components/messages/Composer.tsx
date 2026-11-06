import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Conversation, MAX_MESSAGE_LENGTH, Named } from '../../api/types';
import { searchDirectory } from '../../api/users';
import { useSession } from '../../context/AuthContext';
import { conversationTitle, Draft, toBody } from '../../lib/messages';
import { nameAndTitle } from '../../lib/people';
import { useApiQuery } from '../../lib/useApiQuery';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { Avatar } from '../ui/Avatar';
import { Button, IconButton } from '../ui/Button';

const MAX_SUGGESTIONS = 6;
const MAX_HEIGHT = 160;

/** The @word being typed at the caret, if there is one. */
function mentionAt(text: string, caret: number) {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  return match ? { query: match[1], start: caret - match[1].length - 1 } : null;
}

type Suggestion = Named & { title: string };

/**
 * The API has no way to list a channel's members, so channels search the directory, narrowed to
 * the department on a department's channel. Someone outside the channel can be picked, and then
 * stays plain text, because the server doesn't record it as a mention.
 */
function useSuggestions(conversation: Conversation, query: string | null): Suggestion[] {
  const { user } = useSession();
  const debounced = useDebouncedValue(query ?? '');
  const isChannel = conversation.kind === 'CHANNEL';
  const isOpen = query !== null;

  const directory = useApiQuery(
    (signal) =>
      isOpen && isChannel
        ? searchDirectory(debounced, signal, 1, conversation.department?.id).then((r) => r.users)
        : Promise.resolve([]),
    [isOpen, isChannel, debounced, conversation.department?.id],
  );

  if (query === null) return [];
  const matches = ({ name }: Named) => name.toLowerCase().includes(query.toLowerCase());

  if (conversation.otherUser) {
    const { id, name, position } = conversation.otherUser;
    return matches({ id, name }) ? [{ id, name, title: position?.name ?? '' }] : [];
  }
  // Filtered again here: the search is debounced, so Enter can land before its results do, and
  // it must never pick someone from the previous list.
  return (directory.data ?? [])
    .filter((person) => person.id !== user.id && matches(person))
    .slice(0, MAX_SUGGESTIONS)
    .map((person) => ({
      id: person.id,
      name: person.name,
      title: nameAndTitle(person).slice(person.name.length + 3),
    }));
}

interface ComposerProps {
  conversation: Conversation;
  initialDraft: Draft;
  onDraftChange: (draft: Draft) => void;
  onSend: (body: string) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  conversation,
  initialDraft,
  onDraftChange,
  onSend,
}) => {
  const listId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(initialDraft.text);
  const mentions = useRef(initialDraft.mentions);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingCaret = useRef<number | null>(null);

  const suggestions = useSuggestions(conversation, mention?.query ?? null);
  const isPicking = mention !== null && suggestions.length > 0;
  const label = conversationTitle(conversation);
  const body = toBody({ text: text.trim(), mentions: mentions.current });
  const isTooLong = body.length > MAX_MESSAGE_LENGTH;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`;
    if (pendingCaret.current !== null) {
      textarea.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [text]);

  // A frame later, so it lands after the app shell moves focus to the new page. Phones are left
  // alone, because focus there opens the keyboard over the conversation.
  useEffect(() => {
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => setActiveIndex(0), [mention?.query]);

  const update = (next: string, caret: number) => {
    setText(next);
    setMention(mentionAt(next, caret));
    onDraftChange({ text: next, mentions: mentions.current });
  };

  const choose = (person: Named) => {
    if (!mention) return;
    const inserted = `@${person.name} `;
    const end = mention.start + mention.query.length + 1;
    const next = text.slice(0, mention.start) + inserted + text.slice(end);

    mentions.current = [...mentions.current.filter(({ id }) => id !== person.id), person];
    pendingCaret.current = mention.start + inserted.length;
    setText(next);
    setMention(null);
    onDraftChange({ text: next, mentions: mentions.current });
    textareaRef.current?.focus();
  };

  const startMention = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const before = text.slice(0, caret);
    const prefix = before && !/\s$/.test(before) ? ' @' : '@';
    pendingCaret.current = caret + prefix.length;
    update(before + prefix + text.slice(caret), caret + prefix.length);
    textarea.focus();
  };

  const submit = () => {
    if (!text.trim() || isTooLong) return;
    onSend(body);
    mentions.current = [];
    setText('');
    setMention(null);
    onDraftChange({ text: '', mentions: [] });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;

    if (isPicking) {
      const count = suggestions.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((index) => (index + (e.key === 'ArrowDown' ? 1 : count - 1)) % count);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        choose(suggestions[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative px-3 md:px-6 pt-1 pb-[max(12px,env(safe-area-inset-bottom))]">
      {isPicking && (
        <ul
          id={listId}
          role="listbox"
          aria-label="People to mention"
          className="popover absolute left-3 md:left-6 bottom-full mb-1 w-72 max-w-[calc(100%-24px)] p-1.5 z-20"
        >
          {suggestions.map((person, index) => (
            <li
              key={person.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // Before the textarea loses focus, so the caret stays where it was.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(person);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`menu-item h-auto py-1.5 ${index === activeIndex ? 'hl' : ''}`}
            >
              <Avatar name={person.name} id={person.id} size="sm" />
              <span className="min-w-0">
                <span className="block truncate">{person.name}</span>
                {person.title && (
                  <span className="block text-caption text-text-2 truncate">{person.title}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-border-strong bg-surface focus-within:border-brand">
        <textarea
          ref={textareaRef}
          value={text}
          rows={1}
          role="combobox"
          aria-expanded={isPicking}
          aria-controls={isPicking ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={isPicking ? `${listId}-${activeIndex}` : undefined}
          aria-label={`Message ${label}`}
          placeholder={`Message ${label}`}
          onChange={(e) => update(e.target.value, e.target.selectionStart)}
          onSelect={(e) => setMention(mentionAt(text, e.currentTarget.selectionStart))}
          onKeyDown={handleKeyDown}
          className="composer-input block w-full resize-none bg-transparent border-0 px-3 pt-2.5 pb-1 text-body text-text placeholder:text-text-3"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <IconButton icon="alternate_email" size="sm" label="Mention someone" onClick={startMention} />
          <span className="grow" />
          {isTooLong ? (
            <span role="alert" className="text-caption text-danger">
              That's over the {MAX_MESSAGE_LENGTH.toLocaleString('en-US')} character limit.
            </span>
          ) : (
            <span className="hidden md:inline text-caption text-text-2">
              Enter to send · Shift Enter for a new line
            </span>
          )}
          <Button size="sm" icon="send" onClick={submit} disabled={!text.trim() || isTooLong}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
