-- Adiciona perfis de acesso a bancos criados antes da autenticação ADMIN/USER.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_user varchar(20) NOT NULL DEFAULT 'USER';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_users_role_user'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_role_user
      CHECK (role_user IN ('USER', 'ADMIN'));
  END IF;
END $$;
