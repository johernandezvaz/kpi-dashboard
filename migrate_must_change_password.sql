ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE app_user SET must_change_password = TRUE;
