ALTER TABLE users
    DROP COLUMN IF EXISTS first_name,
    DROP COLUMN IF EXISTS middle_name,
    DROP COLUMN IF EXISTS last_name,
    DROP COLUMN IF EXISTS nickname;
