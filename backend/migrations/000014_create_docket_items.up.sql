CREATE TABLE docket_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    item_id UUID NOT NULL,
    saved_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX idx_docket_items_user_id ON docket_items(user_id);
CREATE INDEX idx_docket_items_type ON docket_items(item_type);
