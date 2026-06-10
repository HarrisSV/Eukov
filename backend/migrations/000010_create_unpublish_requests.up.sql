CREATE TABLE unpublish_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    justification TEXT NOT NULL,
    actioned_by UUID REFERENCES users(id),
    actioned_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unpublish_requests_status ON unpublish_requests(status);
CREATE INDEX idx_unpublish_requests_document_id ON unpublish_requests(document_id);
