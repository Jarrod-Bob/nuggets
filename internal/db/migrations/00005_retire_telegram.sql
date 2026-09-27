-- +goose Up
-- nuggets' own Telegram capture was retired on 2026-09-27; ideas now arrive
-- only through the spices pull. Drop whatever state the Telegram integration
-- left behind — bot token, username, paired chat, update offset, pairing
-- code, last error and last sync time. Every one of its keys was prefixed
-- `telegram_` (internal/telegram/pairing.go before removal); spices keys are
-- prefixed `spices_`, so they are untouched. The settings table and the
-- ideas.source/source_ref columns stay: spices uses them.
DELETE FROM settings WHERE key LIKE 'telegram\_%' ESCAPE '\';

-- +goose Down
-- Nothing to restore: the deleted rows belonged to a feature that no longer
-- exists, and a stored bot token is exactly what we don't want back.
SELECT 1;
