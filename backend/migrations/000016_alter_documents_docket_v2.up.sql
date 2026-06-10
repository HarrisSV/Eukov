ALTER TABLE documents ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

UPDATE documents d
SET author_id = dk.user_id
FROM dockets dk
WHERE d.docket_id = dk.id AND d.author_id IS NULL;

ALTER TABLE unpublish_requests ADD COLUMN IF NOT EXISTS actioned_at TIMESTAMP;

UPDATE unpublish_requests
SET actioned_at = updated_at
WHERE actioned_at IS NULL AND status IN ('APPROVED', 'REJECTED');
