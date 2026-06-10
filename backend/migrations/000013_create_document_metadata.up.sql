CREATE TABLE document_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES genres(id),
    summary TEXT NOT NULL DEFAULT '',
    reading_time INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_metadata_genre_id ON document_metadata(genre_id);
