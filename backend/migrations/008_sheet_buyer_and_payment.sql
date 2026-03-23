-- Dados adicionais do comprador e valores de venda (centavos)

ALTER TABLE sheets
  ADD COLUMN IF NOT EXISTS buyer_email TEXT,
  ADD COLUMN IF NOT EXISTS buyer_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS buyer_address TEXT,
  ADD COLUMN IF NOT EXISTS buyer_cep TEXT,
  ADD COLUMN IF NOT EXISTS seller_name TEXT,
  ADD COLUMN IF NOT EXISTS sale_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS amount_paid_cents INTEGER NOT NULL DEFAULT 0;

UPDATE sheets
SET buyer_whatsapp = buyer_contact
WHERE buyer_whatsapp IS NULL
  AND buyer_contact IS NOT NULL
  AND TRIM(buyer_contact) <> '';

ALTER TABLE sheets DROP CONSTRAINT IF EXISTS sheets_amount_paid_nonneg;
ALTER TABLE sheets
  ADD CONSTRAINT sheets_amount_paid_nonneg CHECK (amount_paid_cents >= 0);

ALTER TABLE sheets DROP CONSTRAINT IF EXISTS sheets_sale_price_nonneg;
ALTER TABLE sheets
  ADD CONSTRAINT sheets_sale_price_nonneg CHECK (sale_price_cents IS NULL OR sale_price_cents >= 0);
