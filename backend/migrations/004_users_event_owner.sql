-- Utilizadores e propriedade de eventos (SaaS: login em vez de chave API)

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email_lower ON users (LOWER(email));

ALTER TABLE events ADD COLUMN owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

COMMENT ON COLUMN events.owner_user_id IS 'Dono do evento; eventos antigos podem ficar NULL até migração manual';
