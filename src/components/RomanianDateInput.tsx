'use client';

import {useId, useState} from 'react';

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function RomanianDateInput({value, onChange}: {value: string; onChange: (value: string) => void}) {
  const id = useId();
  const [draft, setDraft] = useState(() => value.split('-').reverse().join('/'));
  const [error, setError] = useState(false);
  function commit() {
    const iso = draft.split('/').reverse().join('-');
    if (!validDate(iso)) { setError(true); return; }
    setError(false);
    onChange(iso);
  }
  return <div className="romanian-date-field">
    <label htmlFor={id}>Data</label>
    <div className="romanian-date-controls">
      <input id={id} type="text" value={draft} placeholder="zz/ll/aaaa" maxLength={10}
        aria-label="Data (zi/lună/an)" aria-invalid={error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => {setDraft(event.target.value); setError(false);}}
        onBlur={commit} onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); commit();}}}/>
      <span className="romanian-date-picker">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
        <input type="date" aria-label="Alege data din calendar" value={value}
          onChange={event => {if (validDate(event.target.value)) {setDraft(event.target.value.split('-').reverse().join('/')); setError(false); onChange(event.target.value);}}}/>
      </span>
    </div>
    {error && <span id={`${id}-error`} role="alert">Introdu o dată validă: zz/ll/aaaa.</span>}
  </div>;
}
