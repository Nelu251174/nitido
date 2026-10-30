'use client';

import {useRef} from 'react';
import {useServerInsertedHTML} from 'next/navigation';

/** Insert once in the HTML head, without repeating the URL in the RSC payload. */
export function NexusCounter() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script defer src="https://nexus.nexuscompany.ro/b.js" data-site="nitido.ro"></script>;
  });
  return null;
}
