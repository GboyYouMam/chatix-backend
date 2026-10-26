# R2-BE-SHOP Aura Shop Backend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Shop catalog, inventory, atomic purchases (incl. mystery soap), equip slots, public cosmetics on profiles and message authors.

**Spec/Contract:** `docs/superpowers/specs/2026-10-26-chatix-round2-design.md` §3; `docs/superpowers/plans/2026-10-27-chatix-round2/00-overview.md` (Catalog + Shop contract — follow exactly).

### Task 1: Schema + catalog (`feat(shop): catalog and inventory schema`)
- `src/database/scheme.ts`: `user_inventory(user_id fk cascade, item_key varchar(48), quantity int not null default 1, acquired_at timestamptz default now(), PK(user_id,item_key))`; `user_equipped(user_id fk cascade, slot varchar(16), item_key varchar(48), PK(user_id,slot))`; `shop_purchases(id uuid pk, user_id fk cascade, item_key, price int, created_at)` index `(user_id, created_at)`. Generate migration `0015_shop` (`npx drizzle-kit generate --name shop`).
- `src/shop/catalog.ts`: `SHOP_ITEMS: readonly ShopItem[]` exactly per the overview Catalog table (`{ key, name, description, category: 'profile'|'chat'|'troll'|'economy'|'theme', kind: 'permanent'|'consumable', price, requires?: 'found_the_basement' }`), `ACCENT_PALETTE: Record<string, string>` (6 keys → HEX), `MYSTERY_SOAP_POOLS` + odds 70/25/5. Names/descriptions in roflo voice (e.g. nyan_cat "nyan cat" / "a cat made of pop-tart orbits your name. peak.").
- `src/shop/shop.module.ts`, register in `AppModule`.

### Task 2: Purchase (`feat(shop): atomic purchases and mystery soap`)
- `ShopService.purchase(userId, itemKey)`: one transaction — permanent already owned → 409 `ALREADY_OWNED`; `requires` not unlocked (check `user_achievements`) → 403 `LOCKED`; `UPDATE users SET aura = aura - price WHERE id=$1 AND aura >= price RETURNING aura` → no row → 400 `BROKE` `'u broke. go farm.'`; upsert inventory (consumables `quantity + 1`); insert `shop_purchases`. Mystery soap: inside the same tx roll `crypto.randomInt` → pool → random item; if already owned and permanent → refund 50% of the soap price; return `granted`/`refunded`.
- Controller: `GET /shop/catalog`, `GET /shop/me`, `POST /shop/purchase` (JwtAuthGuard, DTO `{ itemKey: string }` validated against catalog keys).
- Tests (e2e `test/shop.e2e-spec.ts`): exact-aura purchase succeeds and leaves 0; 1 short → 400 BROKE and aura unchanged; two concurrent purchases of the same permanent item → one 201 + one 409, charged once (Review Focus #1, #2); consumable twice → quantity 2; fight_club theme without the achievement → 403.

### Task 3: Equip + cosmetics (`feat(shop): equip slots and public cosmetics`)
- `PATCH /shop/equip { slot, itemKey|null }` per contract; validates ownership and slot↔category (e.g. `accent` only `accent_*`; `sticker1..3` only `sticker_*`); `null` unequips.
- `CosmeticsService.forUsers(userIds[]) → Map<userId, Cosmetics>` (one query) used by profile and message serialization (`author.cosmetics`); title precedence admin > fight > shop.
- Extend `GET /users/profile/:username` with `cosmetics`; extend public message author with `cosmetics` (keep BE-A whitelist style — add fields explicitly).
- Tests: equipping unowned → 403; profile shows equipped accent HEX; message history includes author cosmetics without N+1 (assert one cosmetics query per page via a spy or by checking the service is called once per page).
- Run build + jest + e2e; commit.
