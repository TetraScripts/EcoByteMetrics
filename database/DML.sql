CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO Users (
    name_user,
    email_user,
    password_user,
    role_user
)
VALUES (
    'Administrador',
    'admin@ecobytemetrics.com',
    crypt('ecobytemetricsADM@14', gen_salt('bf', 12)),
    'ADMIN'
)
ON CONFLICT (email_user) DO NOTHING;

INSERT INTO Users (
    name_user,
    email_user,
    password_user
)
VALUES (
    'Cauan',
    'cauan@ecobytemetrics.com',
    crypt('ecobytemetricsCAU@14', gen_salt('bf', 12))
)
ON CONFLICT (email_user) DO NOTHING;