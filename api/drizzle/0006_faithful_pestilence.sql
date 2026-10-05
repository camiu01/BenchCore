-- @file 0006_faithful_pestilence.sql
-- @brief Adds reader-only audiences while retaining public visibility for existing posts.
ALTER TABLE "posts" ADD COLUMN "audience" text DEFAULT 'public' NOT NULL;