# A3 — Alegerea și retragerea ofertei

Rutele POST/DELETE ale ofertei folosesc politica comună hasTrustedMutationOrigin după autentificarea rolului. Retragerea transmite și id-ul lucrării către tranzacția existentă; o ofertă care nu aparține lucrării din URL este respinsă fără modificări. Proprietarul ofertei și starea waiting/pending rămân obligatorii.

Parametrul de lucrare este opțional pentru compatibilitatea apelurilor interne existente, dar ruta HTTP îl transmite obligatoriu. Alegerea clientului păstrează acceptJobAtomic și toate verificările existente, fără schimbări Stripe sau de scoring.

Validare: 44 teste în assistedAllocation, offers și acceptJobRecovery; TypeScript și git diff --check trecute. Două scenarii noi verifică URL greșit, alt proprietar, origine străină, retragere validă și absența plății/rezervării la selecția respinsă.

Tema crem și pachetele precedente sunt incluse. A3 nu este declarat închis: validarea sandbox pe roluri și dispozitive și restul auditului rămân deschise. Nu s-a publicat LIVE.
