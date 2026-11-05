import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { DirectoryUser, PersonRef, ROLE_LABELS } from '../../api/types';
import { searchDirectory } from '../../api/users';
import { useApiQuery } from '../../lib/useApiQuery';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

interface AssigneePickerProps {
  value: PersonRef | null;
  onChange: (person: PersonRef | null) => void;
  error?: string;
  /** Bumped by the parent to re-read the list, such as after ASSIGNEE_DEACTIVATED. */
  refreshKey?: number;
}

const UNASSIGNED_ID = '__unassigned__';

export const AssigneePicker: React.FC<AssigneePickerProps> = ({
  value,
  onChange,
  error,
  refreshKey = 0,
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

  const options: (DirectoryUser | null)[] = [null, ...(query.data?.users ?? [])];

  useEffect(() => setActiveIndex(0), [debouncedSearch]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const choose = (person: DirectoryUser | null) => {
    onChange(person && { id: person.id, name: person.name });
    setSearch('');
    setIsOpen(false);
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
      choose(options[activeIndex]);
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
      <label htmlFor={`${id}-input`} className="block text-sm font-medium text-slate-700 mb-1.5">
        Assignee
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
          value={isOpen ? search : (value?.name ?? 'Unassigned')}
          placeholder="Search by name"
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className={`block w-full rounded-lg border bg-white text-sm pl-3.5 pr-9 py-2 ${
            error ? 'border-rose-400 text-rose-900' : 'border-slate-300 text-slate-900'
          }`}
        />
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Assignee"
          className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl py-1"
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
              className={`px-3.5 py-2 text-sm cursor-pointer ${
                index === activeIndex ? 'bg-brivent-50' : ''
              }`}
            >
              {person ? (
                <>
                  <span className="text-slate-900">{person.name}</span>
                  <span className="block text-slate-600">{ROLE_LABELS[person.role]}</span>
                </>
              ) : (
                <span className="text-slate-700">Unassigned</span>
              )}
            </li>
          ))}
          {query.error != null && (
            <li className="px-3.5 py-2 text-sm text-rose-700">{errorMessage(query.error)}</li>
          )}
          {query.data === undefined && query.error == null && (
            <li className="px-3.5 py-2 text-sm text-slate-600">Searching…</li>
          )}
          {query.data?.users.length === 0 && debouncedSearch !== '' && (
            <li className="px-3.5 py-2 text-sm text-slate-600">Nobody matches that name.</li>
          )}
        </ul>
      )}

      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
};
