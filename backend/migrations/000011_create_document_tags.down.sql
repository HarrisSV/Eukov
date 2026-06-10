DROP TABLE IF EXISTS document_tags;
ALTER TABLE documents DROP COLUMN IF EXISTS genre_id;
ALTER TABLE documents DROP COLUMN IF EXISTS updated_at;
