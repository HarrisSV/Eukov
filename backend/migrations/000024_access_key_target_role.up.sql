ALTER TABLE access_keys ADD COLUMN target_role VARCHAR(50) NOT NULL DEFAULT 'ADMIN';
ALTER TABLE access_keys ADD COLUMN application_id UUID REFERENCES author_applications(id);
