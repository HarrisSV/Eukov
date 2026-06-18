DROP TABLE IF EXISTS inbox_messages;
DROP TABLE IF EXISTS author_application_attachments;

ALTER TABLE author_applications
    DROP COLUMN IF EXISTS subject,
    DROP COLUMN IF EXISTS message_body,
    DROP COLUMN IF EXISTS admin_reply,
    DROP COLUMN IF EXISTS admin_reply_by,
    DROP COLUMN IF EXISTS admin_reply_at,
    DROP COLUMN IF EXISTS replied_access_key;
