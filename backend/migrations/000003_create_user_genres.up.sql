CREATE TABLE user_genres (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, genre_id)
);

CREATE INDEX idx_user_genres_user_id ON user_genres(user_id);
