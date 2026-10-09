-- +goose Up
-- A nugget's optional project name: a creative name for what it would be
-- called if built, kept alongside its title (CONTEXT.md "Project name").
-- kimi-no-name-wa suggests values; blank means none. Spices never sets it
-- (docs/superpowers/specs/2026-10-09-kimi-project-name-design.md §6).
ALTER TABLE ideas ADD COLUMN project_name TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE ideas DROP COLUMN project_name;
