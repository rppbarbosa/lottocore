-- Endereço do comprador em campos separados (além de buyer_address composto para compatibilidade)

ALTER TABLE sheets
  ADD COLUMN IF NOT EXISTS buyer_street TEXT,
  ADD COLUMN IF NOT EXISTS buyer_street_number TEXT,
  ADD COLUMN IF NOT EXISTS buyer_address_complement TEXT,
  ADD COLUMN IF NOT EXISTS buyer_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS buyer_city TEXT,
  ADD COLUMN IF NOT EXISTS buyer_state TEXT;
