-- Folhas canceladas (anuladas antes ou após venda) + compatibilidade com CHECK existente

ALTER TABLE sheets DROP CONSTRAINT IF EXISTS sheets_sale_status_check;

ALTER TABLE sheets
  ADD CONSTRAINT sheets_sale_status_check
  CHECK (sale_status IN ('available', 'sold', 'cancelled'));
