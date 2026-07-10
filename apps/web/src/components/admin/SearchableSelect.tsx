"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Option = {
  id: string;
  label: string;
  hint?: string;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  required,
  disabled,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(q) ||
            option.hint?.toLowerCase().includes(q),
        )
      : options;
    return pool.slice(0, 100);
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(option: Option) {
    onChange(option.id);
    setQuery("");
    setOpen(false);
  }

  const inputValue = open ? query : (selected?.label ?? "");

  return (
    <div ref={rootRef} className="relative mt-1">
      <input
        className="cms-input w-full"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={inputValue}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(selected?.label ?? "");
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
      />
      {open && filtered.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border border-zinc-700 bg-zinc-900 py-1 shadow-lg"
        >
          {filtered.map((option) => (
            <li key={option.id} role="option" aria-selected={option.id === value}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
              >
                {option.label}
                {option.hint ? (
                  <span className="text-zinc-500"> — {option.hint}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && filtered.length === 0 ? (
        <p className="absolute z-20 mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-500">
          No matches
        </p>
      ) : null}
    </div>
  );
}
