import pool from "../../db/connection";

// Dados completos armazenados no banco de dados.
export type User = {
  id_user: number;
  email_user: string;
  name_user: string;
};

export type CreateUserInput = {
  email_user: string;
  name_user: string;
  password_user: string;
  token_user: string;
};

// Dados que podem ser retornados pela API.
export type SafeUser = {
  id_user: number;
  email_user: string;
  name_user: string;
};

// Dados necessários para cadastrar um usuário.
export type CreateUserInput = {
  email_user: string;
  name_user: string;
  password_user: string;
};

// Atualizar o usuário.
export type UpdateUserInput = {
  id_user: number;
  email_user: string;
  name_user: string;
  password_user?: string;
};

export type UpdateUser = {
  id_user: number;
  email_user: string;
  name_user: string;
  password_user: string;
};

// Cadastrar usuário.
export async function createUserRepository({
  email_user,
  name_user,
  password_user
}: CreateUserInput): Promise<SafeUser> {
  const result = await pool.query(
    `INSERT INTO users (email_user, name_user, password_user)
     VALUES ($1, $2, $3)
     RETURNING id_user, name_user, email_user`,
    [email_user, name_user, password_user]
  );

  return result.rows[0];
}

// Buscar usuário por ID, sem retornar senha ou token.
export async function getUserByIdRepository(
  id: number
): Promise<SafeUser | null> {
  const result = await pool.query(
    `SELECT id_user, name_user, email_user
     FROM users
     WHERE id_user = $1`,
    [id]
  );

  return result.rows[0] || null;
}

// Buscar usuário internamente para consultar a senha criptografada.
// Esta função não deve ser utilizada para responder diretamente à API.
export async function getUserPasswordHashRepository(
  id: number
): Promise<{ id_user: number; password_user: string } | null> {
  const result = await pool.query(
    `SELECT id_user, password_user
     FROM users
     WHERE id_user = $1`,
    [id]

// Atualizar usuário.
export async function upadateUserRepository({
  id_user,
  email_user,
  name_user,
  password_user
}: UpdateUser): Promise<SafeUser | null> {
  const result = await pool.query(
    `UPDATE users
     SET email_user = $2,
         name_user = $3,
         password_user = $4
     WHERE id_user = $1
     RETURNING id_user, name_user, email_user`,
    [id_user, email_user, name_user, password_user]
  );

  return result.rows[0] || null;
}

// Excluir usuário.
export async function deleteUserRepository(
  id: number
): Promise<SafeUser | null> {
  const result = await pool.query(
    `DELETE FROM users
     WHERE id_user = $1
     RETURNING id_user, name_user, email_user`,
    [id]
  );

  return result.rows[0] || null;
}
