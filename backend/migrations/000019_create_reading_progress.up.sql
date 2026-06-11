CREATE TABLE IF NOT EXISTS reading_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    current_page INTEGER NOT NULL DEFAULT 1,
    completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    last_read_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (reader_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_reader_id ON reading_progress(reader_id);
