-- Token público por folha (um QR por folha → conferência de todas as rodadas)

ALTER TABLE sheets ADD COLUMN IF NOT EXISTS public_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sheets_public_token ON sheets (public_token);

DO $$
DECLARE
  rec RECORD;
  t TEXT;
  alphabet TEXT := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  i INT;
  taken INT;
BEGIN
  FOR rec IN SELECT id FROM sheets WHERE public_token IS NULL LOOP
    LOOP
      t := '';
      FOR i IN 1..21 LOOP
        t := t || substr(alphabet, (floor(random() * 62)::int + 1), 1);
      END LOOP;
      SELECT COUNT(*) INTO taken FROM sheets WHERE public_token = t;
      EXIT WHEN taken = 0;
    END LOOP;
    UPDATE sheets SET public_token = t WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE sheets ALTER COLUMN public_token SET NOT NULL;
