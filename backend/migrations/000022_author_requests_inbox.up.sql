ALTER TABLE author_applications
    ADD COLUMN IF NOT EXISTS subject VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS message_body TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS admin_reply TEXT,
    ADD COLUMN IF NOT EXISTS admin_reply_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS admin_reply_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS replied_access_key TEXT;

ALTER TABLE author_applications
    ALTER COLUMN qualifications SET DEFAULT '',
    ALTER COLUMN experience SET DEFAULT '';

CREATE TABLE IF NOT EXISTS author_application_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES author_applications(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_author_application_attachments_app
    ON author_application_attachments(application_id);

CREATE TABLE IF NOT EXISTS inbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    message_type VARCHAR(50) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    related_id UUID,
    read_at TIMESTAMP,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_user_created
    ON inbox_messages(user_id, created_at DESC);
