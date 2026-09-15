# Actualizare mobilă către producție — 15 septembrie 2026

Bază web instalată: `3e15028759fa34442fc5897c18307b17751c523b`.

Ambele fluxuri Capacitor folosesc explicit `https://nitido.ro` și verifică adresa în configurația generată înainte de compilare. Identitatea rămâne `ro.nitido.app`; numerele buildurilor cresc prin numărul rulării workflowului existent. Se păstrează cheile de semnare existente și accesul la cameră din iOS 9. Fișierele Gradle generate reflectă pluginurile instalate: App și Push Notifications.

Distribuție: TestFlight și canalul intern Google Play. Publicarea către publicul general este distinctă. Pentru Android, dacă secretul contului de serviciu lipsește, workflowul produce AAB semnat, iar încărcarea se face în consola Play.

Verificări locale: sincronizare Capacitor iOS/Android, identitate și origine în ambele configurații generate, declarație cameră, YAML și diff. Nu s-au reluat testele de rezervare/plată și nu s-a inițiat nicio plată.

La pregătire, sesiunea browser App Store Connect era expirată. Compilarea și uploadul Apple folosesc cheia API din GitHub. Procesarea Apple și disponibilitatea în grupuri se confirmă după upload; un build reușit nu dovedește instalarea pe telefon sau livrarea push. Providerii de notificări și probele fizice nu sunt declarați validați prin această modificare.
