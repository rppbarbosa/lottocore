-- Estado de vitória por cartela (cartela cheia + confirmação manual)

ALTER TABLE cards
  ADD COLUMN win_status TEXT NOT NULL DEFAULT 'none'
    CHECK (win_status IN ('none', 'suggested', 'confirmed', 'dismissed'));

ALTER TABLE cards
  ADD COLUMN win_suggested_at TIMESTAMPTZ,
  ADD COLUMN win_confirmed_at TIMESTAMPTZ,
  ADD COLUMN win_dismissed_at TIMESTAMPTZ;

CREATE INDEX idx_cards_round_win ON cards (round_id, win_status);
