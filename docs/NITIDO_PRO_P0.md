# NITIDO Pro P0

Baza: `Nelu251174/nitido` `main` @ `8125536145063c6f5ad655d8a62edae2d4e92be3`

## Decizii
- Fara upload foto
- Deviz: aproba/refuza clientul
- Override admin: motiv + actor + timestamp + audit; nu se sterge decizia initiala
- Roluri: `pro_memberships` (`owner_client`, `partner`, `nitido_admin`)
- Nu se modifica `users.role`
- Nu se foloseste `public/uploads`

## Bootstrap admin (local/staging)
```sql
INSERT INTO pro_memberships (id, user_id, role)
VALUES ('mem_admin_1', '<existing_user_id>', 'nitido_admin');
```

## Teste
```bash
npx vitest run src/lib/pro
```

## Rollback
Sterge branch-ul / revert PR. Date: DROP doar tabele `pro_*`.
