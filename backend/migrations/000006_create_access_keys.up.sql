CREATE TABLE access_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    consumed_by UUID REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_keys_status ON access_keys(status);
CREATE INDEX idx_access_keys_created_by ON access_keys(created_by);
