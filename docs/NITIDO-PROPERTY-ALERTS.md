# Proprietăți, verificări și alerte — 14 septembrie 2026

- Proprietățile salvează codul poștal și etajul și le transmit în formularul rezervării. Migrarea adaugă două coloane cu valori goale pentru proprietățile existente; datele lipsă trebuie completate o singură dată. Actualizările vechi care omit câmpurile le păstrează.
- În Execuție, zona de confirmare a salvării are spațiu rezervat, iar bara de derulare păstrează lățimea paginii. Bifarea nu mai introduce/elimină un banner deasupra lucrării.
- Popup web pentru mesaje noi și finalizare. Feed autentificat, numai destinatarul și clientul lucrării, respectând preferințele; nu expune corpul mesajelor în notificările desktop. Finalizarea nu afirmă că plata a fost capturată.
- Prima conectare stabilește reperul, fără avalanșă de alerte istorice. Identificatorii văzuți sunt păstrați separat pe cont; Web Locks și localStorage împiedică alertele repetate între file în browserele care le acceptă. Verificare la 10 secunde și la revenirea în pagină. Stocarea blocată limitează deduplicarea la fila curentă.
- Popupul din pagină nu cere permisiuni. Butonul Activează sunetul și alertele desktop deblochează audio și cere permisiunea browserului. Notificările sistemului se folosesc când fila este în fundal; NITIDO trebuie să rămână deschis. Nu este implementat Web Push cu browserul complet închis.
- iOS: payload APNs cu sunet implicit; Android: canale messages-v1 și activity-v1 cu sunet, vibrație și prioritate ridicată. Testele verifică sunetul și deschiderea lucrării finalizate pentru ambele platforme.
- Activarea push pe telefon depinde de APNs/FCM, permisiuni, dispozitiv înregistrat și distribuirea buildului mobil. Modul silențios și setările sistemului sunt respectate. Verificarea automată nu înlocuiește proba pe telefon.
