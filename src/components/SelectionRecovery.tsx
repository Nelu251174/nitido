'use client';
import {UiText,UiElement} from '@/components/UiText';
import { useRef, useState } from 'react';
export function SelectionRecovery({ jobId }: { jobId: string }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function recover() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/selection-recovery`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw Error(data.error ?? 'Confirmarea nu a putut fi finalizată.');
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Conexiune întreruptă. Reîncarcă lucrarea.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <UiElement as="section" className="design-panel" aria-label="Confirmarea selecției">
    <h2>{done ? <UiText text={'Selecția este confirmată'}/> : <UiText text={'Confirmarea selecției este în așteptare'}/>}</h2>
    <p>{done ? <UiText text={'Reîncarcă lucrarea pentru starea actualizată.'}/> : <UiText text={'Firma este rezervată. Poți relua confirmarea locală fără o nouă autorizare sau încasare.'}/>}</p>
    {!done && <button type="button" className="rounded-xl bg-ink px-4 py-3 text-white disabled:opacity-50" disabled={busy} onClick={()=>void recover()}>{busy ? <UiText text={'Se verifică…'}/> : <UiText text={'Finalizează confirmarea'}/>}</button>}
    {error && <p role="alert">{<UiText text={error}/>}</p>}
  </UiElement>;
}
