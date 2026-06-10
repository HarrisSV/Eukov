ALTER TABLE documents ADD COLUMN IF NOT EXISTS genre_id UUID REFERENCES genres(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

CREATE TABLE document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, tag)
);

CREATE INDEX idx_document_tags_document_id ON document_tags(document_id);
