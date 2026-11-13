-- Inserção do usuário administrador padrão para o ambiente de desenvolvimento e testes.
-- Credenciais padrão:
-- E-mail: admin@exemplo.com
-- Senha:  admin1234

INSERT INTO Users (name_user, email_user, password_user, role_user)
VALUES ('Administrador', 'admin@exemplo.com', '$2b$10$6QIsPmMmFrpY4d16r5f5teLhf.dAyV9mMZTe0byEYhjLoTrY9BjY6', 'ADMIN')
ON CONFLICT (email_user) DO NOTHING;
