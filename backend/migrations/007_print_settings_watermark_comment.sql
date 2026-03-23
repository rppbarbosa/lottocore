-- Documentação: marca d'água e opacidade no modelo de impressão
COMMENT ON COLUMN events.print_settings IS
  'JSON: backgroundImageDataUrl, backgroundOpacity, headerImageDataUrl, footerImageDataUrl, subtitle, footerNote (PDF)';
