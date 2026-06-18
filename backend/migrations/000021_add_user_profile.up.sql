ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);

UPDATE users
SET
    first_name = 'Suyash',
    middle_name = '',
    last_name = 'Verma',
    nickname = 'Harris'
WHERE email = 'suyashverma.6701@gmail.com';
