'use client';

import {useId, useRef, useState} from 'react';

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function RomanianDateInput({value, onChange, label="Data", allowEmpty=false}: {value: string; onChange: (value: string) => void; label?:string; allowEmpty?:boolean}) {
  const id = useId();
  const textInput=useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => value.split('-').reverse().join('/'));
  const [error, setError] = useState(false);
  function commit() {
    if(allowEmpty&&!draft.trim()){setError(false);textInput.current?.setCustomValidity("");onChange("");return;}
    const iso = draft.split('/').reverse().join('-');
    if (!validDate(iso)) { setError(true); textInput.current?.setCustomValidity("Introdu o dată validă: zz/ll/aaaa."); return; }
    setError(false);
    textInput.current?.setCustomValidity("");
    onChange(iso);
  }
  return <div className="romanian-date-field">
    <label htmlFor={id}>{label}</label>
    <div className="romanian-date-controls">
      <input ref={textInput} id={id} type="text" value={draft} placeholder="zz/ll/aaaa" maxLength={10}
        aria-label="Data (zi/lună/an)" aria-invalid={error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => {const next=event.target.value;setDraft(next);setError(false);const iso=next.split("/").reverse().join("-");const valid=validDate(iso)||(allowEmpty&&!next.trim());event.target.setCustomValidity(valid?"":"Introdu o dată validă: zz/ll/aaaa.");if(valid)onChange(next.trim()?iso:"");}}
        onBlur={commit} onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); commit();}}}/>
      <span className="romanian-date-picker">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
        <input type="date" aria-label="Alege data din calendar" value={value}
          onChange={event => {if (validDate(event.target.value)) {setDraft(event.target.value.split('-').reverse().join('/')); setError(false); textInput.current?.setCustomValidity(''); onChange(event.target.value);}}}/>
      </span>
    </div>
    {error && <span id={`${id}-error`} role="alert">Introdu o dată validă: zz/ll/aaaa.</span>}
  </div>;
}
