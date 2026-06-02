CREATE TABLE genres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO genres (name) VALUES
    ('philosophy'),
    ('history'),
    ('politics'),
    ('literature'),
    ('economics'),
    ('psychology'),
    ('technology'),
    ('science');
