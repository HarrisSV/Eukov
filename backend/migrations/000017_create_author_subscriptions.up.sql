CREATE TABLE IF NOT EXISTS author_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (reader_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_author_subscriptions_reader_id ON author_subscriptions(reader_id);
CREATE INDEX IF NOT EXISTS idx_author_subscriptions_author_id ON author_subscriptions(author_id);
