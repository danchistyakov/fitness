import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import s from './Combobox.module.scss';

export interface ComboboxOption {
  value: string | number;
  label: string;
  hint?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Выберите…',
  emptyText = 'Нет совпадений',
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find(o => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Derive a safe active index without storing out-of-range state.
  const safeActive = filtered.length === 0 ? 0 : Math.min(active, filtered.length - 1);

  const choose = (opt: ComboboxOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const onKey: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(filtered.length - 1, safeActive + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(0, safeActive - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[safeActive]) choose(filtered[safeActive]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onQuery = (value: string) => {
    setQuery(value);
    setActive(0);
  };

  return (
    <div ref={rootRef} className={s.combobox}>
      <button
        type="button"
        className={`${s.trigger} ${open ? s.triggerOpen : ''}`}
        disabled={disabled}
        onClick={() => {
          setOpen(o => {
            if (o) setQuery('');
            return !o;
          });
        }}
      >
        <span className={selected ? s.triggerValue : s.triggerPlaceholder}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className={s.chevron} />
      </button>
      {open && (
        <div className={s.popover} role="listbox">
          <div className={s.searchRow}>
            <Search size={14} className={s.searchIcon} />
            <input
              ref={inputRef}
              className={s.search}
              value={query}
              onChange={e => onQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="Поиск…"
            />
          </div>
          {filtered.length === 0 ? (
            <div className={s.empty}>{emptyText}</div>
          ) : (
            <div className={s.list}>
              {filtered.map((opt, i) => (
                <button
                  type="button"
                  key={opt.value}
                  className={`${s.option} ${i === safeActive ? s.optionActive : ''} ${opt.value === value ? s.optionSelected : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(opt)}
                >
                  <span className={s.optionLabel}>{opt.label}</span>
                  {opt.hint && <span className={s.optionHint}>{opt.hint}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
