DELETE FROM "user_inventory" WHERE "item_key" = 'nyan_cat' OR "item_key" LIKE 'sticker\_%';--> statement-breakpoint
DELETE FROM "user_equipped" WHERE "item_key" = 'nyan_cat' OR "item_key" LIKE 'sticker\_%' OR "slot" IN ('nyanCat', 'sticker1', 'sticker2', 'sticker3');--> statement-breakpoint
UPDATE "users" SET "widget_layout" = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements("widget_layout") e WHERE e <> '"sticker_board"'::jsonb) WHERE "widget_layout" @> '["sticker_board"]'::jsonb;
