# R2-FE-SHOP Aura Shop UI Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** "the soap market" shop page, inventory/equip in edit profile, cosmetics rendering on profiles and in chat.

**Spec/Contract:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-round2-design.md` §3; `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\plans\2026-10-27-chatix-round2\00-overview.md` (Catalog + Shop contract). Backend lands in parallel — code against the contract.

### Task 1: Shop page (`feat(shop): soap market page`)
- Route `/shop` (protected), link from the profile top actions ("the soap market") and the rooms header.
- `src/api/shop/*` (typed service), `src/hooks/shop/useShop.ts` (react-query: catalog, me, purchase with `setQueryData` from response; BROKE → toast `u broke. go farm.`; ALREADY_OWNED/LOCKED → in-voice toasts).
- Layout: serif "THE SOAP MARKET" header with aura balance in big Courier, category tabs (profile / chat / troll / economy / themes), item cards (preview swatch/sticker/emoji, name, description, price, owned/equipped badge, buy button → confirm via the shared `Modal`), mystery soap reveal animation showing `granted` (reduced-motion: no animation). Mobile: 2-column grid at ≤ 600 px.
- Pure helper `src/components/shop/shopFormat.ts`: `formatPrice(n)` (`"2,500 aura"`), `canAfford(aura, price)`; tests in `tests/shopFormat.test.ts`.

### Task 2: Equip in edit profile (`feat(shop): equip cosmetics in edit profile`)
- Edit profile "drip" section: pick accent (palette swatches; unowned locked with price + link to shop), background, title, chat name colour/icon, quote style, nyan cat toggle, verified toggle, 3 sticker slots → `PATCH /shop/equip`.

### Task 3: Render cosmetics (`feat(shop): render profile and chat cosmetics`)
- Profile: accent colour sets a CSS var on the profile root (`--profile-accent`) used by borders/glows/headings; background = CSS pattern layer tinted by the accent (scanlines/starfield/matrix/static/grid — pure CSS, no images); nyan cat above the nickname (CSS sprite made with gradients or an inline SVG, rainbow trail via gradient; static under reduced motion); verified pink check with tooltip "verified by nobody"; title under name; stickers absolutely positioned on the upper banner (3 slots, emoji/SVG, slight rotation); vine boom button (Web Audio short "boom" synthesized with an oscillator + noise — no audio file; click only).
- Chat: author name colour, icon before name, quote style for `>>id` (neon glow / greentext / redacted black bar).
- Check at 375 px; lint/build/test; commit.
