UPDATE users SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email));
