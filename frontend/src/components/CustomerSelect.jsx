import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCustomers } from '../context/CustomersContext';

const labelFor = (c) => `${c.name} — ${c.id}`;

// Searchable customer picker: type a name or ID to filter, arrows + Enter to pick.
export default function CustomerSelect({ value, onChange, id, emptyLabel }) {
  const { customers } = useCustomers();
  const listId = useId();
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = customers.find(c => String(c.id) === String(value));
  const term = query.trim().toLowerCase();
  const matches = customers.filter(c => !term || (c.name || '').toLowerCase().includes(term) || String(c.id).includes(term));
  const options = emptyLabel ? [{ id: '', name: emptyLabel, empty: true }, ...matches] : matches;

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    setQuery('');
    const idx = options.findIndex(o => String(o.id) === String(value ?? ''));
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const choose = (option) => {
    if (!option) return;
    onChange(option.empty ? '' : option.id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(options.at(active));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const shown = open ? query : selected ? labelFor(selected) : (emptyLabel || '');

  return (
    <div className="combo">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={open && selected ? labelFor(selected) : 'Search name or ID'}
        value={shown}
        onFocus={openList}
        onClick={() => { if (!open) openList(); }}
        onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKeyDown}
        onBlur={() => { setOpen(false); setQuery(''); }}
      />
      <ChevronDown size={16} className="combo-chevron" aria-hidden="true" />
      {open && (
        <ul className="combo-list" id={listId} role="listbox" ref={listRef}>
          {options.length === 0 ? (
            <li className="combo-empty">No customer matches “{query}”</li>
          ) : options.map((c, i) => (
            <li
              key={c.id || 'none'}
              data-index={i}
              role="option"
              aria-selected={String(c.id) === String(value ?? '')}
              className={`combo-option${i === active ? ' active' : ''}${String(c.id) === String(value ?? '') ? ' selected' : ''}`}
              onMouseDown={e => { e.preventDefault(); choose(c); }}
              onMouseEnter={() => setActive(i)}
            >
              {c.empty ? <span className="combo-muted">{c.name}</span> : <>{c.name} <span className="combo-muted mono">{c.id}</span></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
