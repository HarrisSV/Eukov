CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id UUID NOT NULL REFERENCES dockets(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_docket_id ON documents(docket_id);
