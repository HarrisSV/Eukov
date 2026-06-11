CREATE TABLE IF NOT EXISTS reader_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reader_activity_reader_id ON reader_activity(reader_id);
CREATE INDEX IF NOT EXISTS idx_reader_activity_document_id ON reader_activity(document_id);
CREATE INDEX IF NOT EXISTS idx_reader_activity_type ON reader_activity(activity_type);
