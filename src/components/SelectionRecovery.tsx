'use client';
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
  return <section className="design-panel" aria-label="Confirmarea selecției">
    <h2>{done ? 'Selecția este confirmată' : 'Confirmarea selecției este în așteptare'}</h2>
    <p>{done ? 'Reîncarcă lucrarea pentru starea actualizată.' : 'Firma este rezervată. Poți relua confirmarea locală fără o nouă autorizare sau încasare.'}</p>
    {!done && <button type="button" className="rounded-xl bg-ink px-4 py-3 text-white disabled:opacity-50" disabled={busy} onClick={()=>void recover()}>{busy ? 'Se verifică…' : 'Finalizează confirmarea'}</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
