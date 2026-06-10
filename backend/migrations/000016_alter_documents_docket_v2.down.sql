ALTER TABLE unpublish_requests DROP COLUMN IF EXISTS actioned_at;
ALTER TABLE documents DROP COLUMN IF EXISTS published_at;
ALTER TABLE documents DROP COLUMN IF EXISTS author_id;
