import React, { useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import { DirectoryUser, PersonRef } from '../../api/types';
import { searchDirectory } from '../../api/users';
import { Icon } from '../ui/Icon';
import { useApiQuery } from '../../lib/useApiQuery';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { personTitle } from '../../lib/people';

interface AssigneePickerProps {
  value: PersonRef | null;
  onChange: (person: PersonRef | null) => void;
  error?: string;
  /** Bumped by the parent to re-read the list, such as after ASSIGNEE_DEACTIVATED. */
  refreshKey?: number;
  label?: string;
  /** Offers "Unassigned". Turn it off where someone has to be chosen. */
  allowNone?: boolean;
  /** What "nobody" is called, where that isn't "Unassigned". */
  noneLabel?: string;
  /** Shown when nobody is chosen and "Unassigned" isn't an option. */
  placeholder?: string;
  /** People who can't be picked, such as those already on a project. */
  excludeIds?: string[];
  /** Leaves the list open after a pick, for choosing several people in a row. */
  keepOpen?: boolean;
}

const UNASSIGNED_ID = '__unassigned__';

export const AssigneePicker: React.FC<AssigneePickerProps> = ({
  value,
  onChange,
  error,
  refreshKey = 0,
  label = 'Assignee',
  allowNone = true,
  noneLabel = 'Unassigned',
  placeholder = 'Search by name',
  excludeIds = [],
  keepOpen = false,
}) => {
  const id = useId();
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useApiQuery<{ users: DirectoryUser[] }>(
    (signal) =>
      isOpen ? searchDirectory(debouncedSearch, signal) : Promise.resolve({ users: [] }),
    [isOpen, debouncedSearch, refreshKey],
  );

  const people = (query.data?.users ?? []).filter((person) => !excludeIds.includes(person.id));
  const options: (DirectoryUser | null)[] = allowNone ? [null, ...people] : people;

  useEffect(() => setActiveIndex(0), [debouncedSearch]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      // composedPath, because picking someone can remove the clicked row before this runs.
      if (containerRef.current && !e.composedPath().includes(containerRef.current)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const choose = (person: DirectoryUser | null) => {
    onChange(person);
    setSearch('');
    setActiveIndex(0);
    if (!keepOpen) setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      else setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && isOpen) {
      // Inside a form, Enter here picks a person rather than submitting.
      e.preventDefault();
      if (activeIndex < options.length) choose(options[activeIndex]);
    } else if (e.key === 'Escape' && isOpen) {
      // Closes the list without also closing the dialog around it.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      setIsOpen(false);
    }
  };

  const optionId = (index: number) => `${id}-option-${index}`;
  const describedBy = error ? errorId : undefined;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="field">
        <label htmlFor={`${id}-input`} className="label">
          {label}
        </label>
        <div className="relative">
          <input
            id={`${id}-input`}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={isOpen ? optionId(activeIndex) : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            autoComplete="off"
            value={isOpen ? search : (value?.name ?? (allowNone ? noneLabel : ''))}
            placeholder={isOpen ? 'Search by name' : placeholder}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className={`input pr-9 ${error ? 'is-error' : ''}`}
          />
          <Icon
            name="expand_more"
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none"
          />
        </div>
      </div>

      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="popover absolute z-10 mt-1 w-full max-h-52 overflow-y-auto py-1"
        >
          {options.map((person, index) => (
            <li
              key={person?.id ?? UNASSIGNED_ID}
              id={optionId(index)}
              role="option"
              aria-selected={(person?.id ?? null) === (value?.id ?? null)}
              onMouseEnter={() => setActiveIndex(index)}
              // mousedown, so the choice lands before the input loses focus.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(person);
              }}
              className={`px-3 py-2 cursor-pointer ${index === activeIndex ? 'bg-brand-50' : ''}`}
            >
              {person ? (
                <>
                  <span className="font-semibold">{person.name}</span>
                  <span className="block text-small text-text-2">{personTitle(person)}</span>
                </>
              ) : (
                <span>{noneLabel}</span>
              )}
            </li>
          ))}
          {query.error != null && (
            <li className="px-3 py-2 text-danger">{errorMessage(query.error)}</li>
          )}
          {query.data === undefined && query.error == null && (
            <li className="px-3 py-2 text-text-2">Searching…</li>
          )}
          {query.data?.users.length === 0 && debouncedSearch !== '' && (
            <li className="px-3 py-2 text-text-2">Nobody matches that name.</li>
          )}
        </ul>
      )}

      {error && (
        <p id={errorId} className="err mt-1.5">
          <Icon name="error" size="sm" />
          {error}
        </p>
      )}
    </div>
  );
};
