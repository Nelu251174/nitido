# Deploy pe Coolify (server Hetzner)

Acest proiect e pregătit pentru deploy ca aplicație Docker Compose în Coolify.

## 1. Cod pe GitHub

Coolify are nevoie de un repository de unde să tragă codul. Pași:

1. Creează un repository nou pe GitHub (public sau privat — Coolify suportă ambele,
   pentru privat ai nevoie de un token sau de integrarea GitHub App din Coolify).
2. Codul din acest workspace se împinge acolo (`git remote add origin <url> && git push`).

## 2. Resursă nouă în Coolify

În panoul Coolify (`http://<ip-server>:8000`):

1. **New Resource → Application → Docker Compose** (nu "Public Repository" simplu —
   avem nevoie de volumele definite în `docker-compose.yml` pentru ca baza de date și
   pozele să supraviețuiască la fiecare redeploy).
2. Conectezi repository-ul de la pasul 1 (prin GitHub App, dacă e privat, sau direct
   prin URL, dacă e public).
3. Coolify detectează automat `docker-compose.yml` din rădăcina proiectului.
4. **Environment Variables** — adaugi:
   - `STRIPE_SECRET_KEY` = cheia ta Stripe (test sau live)
   - `NEXT_PUBLIC_SITE_URL` = `https://nitido.ro`
5. **Domains** — legi `nitido.ro` de acest serviciu (Coolify generează automat
   certificatul SSL via Let's Encrypt).
6. **Deploy**.

## 3. DNS

La registratorul unde ai cumpărat `nitido.ro`, adaugi un record **A** care punctează
către IP-ul serverului Hetzner (`23.88.61.27`, sau IP-ul curent al serverului):

```
Type: A
Name: @ (sau nitido.ro direct, în funcție de interfața registratorului)
Value: <IP-ul serverului Hetzner>
TTL: implicit (de obicei 3600 sau "auto")
```

Opțional, pentru `www.nitido.ro`, un record CNAME către `nitido.ro`.

## 4. Redeploy-uri ulterioare

Orice push nou pe branch-ul conectat declanșează un build automat în Coolify (dacă ai
activat "Auto Deploy" pe resursă). Baza de date SQLite și pozele rămân neatinse — sunt
pe volume Docker separate (`nitido_data`, `nitido_uploads`), nu în imaginea aplicației.

## 5. Backup

Volumele Docker (`nitido_data`, `nitido_uploads`) nu se fac backup automat. Pentru
siguranță, din când în când:

```bash
docker run --rm -v nitido_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/nitido-data-backup.tar.gz -C /data .
```

rulat direct pe server, salvează un `.tar.gz` cu baza de date curentă.
