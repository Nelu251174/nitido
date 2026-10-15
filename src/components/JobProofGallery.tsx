'use client';
import {useId, useRef, useState} from 'react';
import Image from 'next/image';
import type {JobRow} from '@/lib/types';
import {UiText, UiElement, useUiText} from './UiText';
import {DesignIcon} from './DesignIcon';

type Proof = NonNullable<JobRow['proofs']>[number];

/** Uses only the authenticated proof URLs returned for this reservation. */
export function JobProofGallery({proofs, date}: {proofs: Proof[]; date: (value: string) => string}) {
  const ui = useUiText(), titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Proof | null>(null);
  function open(proof: Proof) {
    setSelected(proof);
    dialog.current?.showModal();
  }
  return <section className="design-panel execution-proof-panel">
    <h2><UiText text="Fotografii și raport"/></h2>
    {(['ARRIVAL', 'COMPLETION'] as const).map(type => {
      const photos = proofs.filter(proof => proof.type === type);
      return <section key={type}>
        <h3><UiText text={type === 'ARRIVAL' ? 'Fotografii la sosire' : 'Fotografii la finalizare'}/><small>{photos.length}<UiText text=" fotografii"/></small></h3>
        <div className="execution-proof-grid">{photos.map(proof => <button type="button" key={proof.id} onClick={() => open(proof)}>
          <Image unoptimized src={proof.url} alt={ui('{p0} — dovadă foto', [ui(type === 'ARRIVAL' ? 'Sosire' : 'Finalizare')])} width={400} height={320}/>
          <small>{date(proof.createdAt)}</small>
        </button>)}</div>
        {!photos.length && <p className="execution-photo-empty"><DesignIcon name="photo" size={28}/><UiText text="Fotografiile vor apărea după încărcarea și validarea lor."/></p>}
      </section>;
    })}
    <dialog ref={dialog} className="execution-photo-dialog" aria-labelledby={titleId} onClose={() => setSelected(null)}>
      <header><h2 id={titleId}><UiText text={selected?.type === 'ARRIVAL' ? 'Fotografii la sosire' : 'Fotografii la finalizare'}/></h2>
        <UiElement as="button" type="button" aria-label="Închide" onClick={() => dialog.current?.close()}><DesignIcon name="close"/></UiElement>
      </header>
      {selected && <><Image unoptimized src={selected.url} alt={ui('{p0} — dovadă foto', [ui(selected.type === 'ARRIVAL' ? 'Sosire' : 'Finalizare')])} width={1200} height={900}/><p>{date(selected.createdAt)}</p></>}
    </dialog>
  </section>;
}
