-- Stats Perform Rugby Union SDAPI credentials (docs login + outlet auth key).
-- Secrets are stored in config JSON via CMS / admin seed — never commit passwords.

INSERT INTO integration_settings (slug, label, config)
VALUES ('stats_perform_sdapi', 'Stats Perform SDAPI', '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
