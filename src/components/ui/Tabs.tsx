import React, { useRef } from 'react';
import { Icon, IconName } from './Icon';

interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  /** Named for screen readers. */
  label: string;
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Arrow keys move between tabs, and Tab moves on to the content. */
export function Tabs<T extends string>({ label, tabs, value, onChange }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const nextIndex = (index + step + tabs.length) % tabs.length;
    onChange(tabs[nextIndex].value);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <div ref={listRef} role="tablist" aria-label={label} className="tabs">
      {tabs.map((tab, index) => {
        const isOn = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isOn}
            tabIndex={isOn ? 0 : -1}
            className={`tab ${isOn ? 'on' : ''}`}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
}

/** The view switch: List or Board. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={option.value === value ? 'on' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <Icon name={option.icon} size="sm" />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
