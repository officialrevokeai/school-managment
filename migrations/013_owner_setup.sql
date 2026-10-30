CREATE TABLE initial_setup_tokens (token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL, used_at timestamptz);
