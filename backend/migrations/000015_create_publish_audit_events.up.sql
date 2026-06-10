CREATE TABLE IF NOT EXISTS publish_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publish_audit_events_document_id ON publish_audit_events(document_id);
CREATE INDEX IF NOT EXISTS idx_publish_audit_events_actor_id ON publish_audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_publish_audit_events_created_at ON publish_audit_events(created_at DESC);

-- Migrate legacy rows if audit_events exists from earlier Phase 3 builds.
INSERT INTO publish_audit_events (id, document_id, actor_id, event_type, metadata, created_at)
SELECT id, document_id, actor_id, event_type, metadata, created_at
FROM audit_events
WHERE NOT EXISTS (SELECT 1 FROM publish_audit_events LIMIT 1)
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_events');
