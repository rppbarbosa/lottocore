-- Modelo visual para PDF das folhas (imagens e textos opcionais)
ALTER TABLE events ADD COLUMN IF NOT EXISTS print_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN events.print_settings IS 'JSON: headerImageDataUrl?, subtitle?, footerNote? para personalizar PDF';
