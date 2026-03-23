-- Bingo híbrido: evento, rodadas, folhas, cartelas, números sorteados

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round_number INT NOT NULL CHECK (round_number >= 1 AND round_number <= 5),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, round_number)
);

CREATE TABLE sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sheet_number INT NOT NULL,
  sale_status TEXT NOT NULL DEFAULT 'available' CHECK (sale_status IN ('available', 'sold')),
  buyer_name TEXT,
  buyer_contact TEXT,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, sheet_number)
);

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  grid JSONB NOT NULL,
  grid_fingerprint TEXT NOT NULL,
  public_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (public_token),
  UNIQUE (round_id, grid_fingerprint),
  UNIQUE (sheet_id, round_id)
);

CREATE INDEX idx_cards_sheet_id ON cards (sheet_id);
CREATE INDEX idx_cards_round_id ON cards (round_id);
CREATE INDEX idx_sheets_event_id ON sheets (event_id);

CREATE TABLE drawn_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  number INT NOT NULL CHECK (number >= 1 AND number <= 75),
  draw_order INT NOT NULL,
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, number),
  UNIQUE (round_id, draw_order)
);

CREATE INDEX idx_drawn_numbers_round_id ON drawn_numbers (round_id);
