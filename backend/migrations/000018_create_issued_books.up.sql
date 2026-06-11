CREATE TABLE IF NOT EXISTS issued_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_opened_at TIMESTAMP,
    UNIQUE (reader_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_issued_books_reader_id ON issued_books(reader_id);
CREATE INDEX IF NOT EXISTS idx_issued_books_document_id ON issued_books(document_id);
