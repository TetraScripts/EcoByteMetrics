import { promises } from "node:dns";
import pool from "../../db/connection";

// Dados completos armazenados no banco de dados.
export type User = {
  id_user: number;
  email_user: string;
  name_user: string;
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
export class UserRepository{
   
  async createUser(user:CreateUserInput):Promise<User>{
      const result = await pool.query(
        `INSERT INTO users (email_user, name_user, password_user)
        VALUES ($1, $2, $3)
        RETURNING id_user, name_user, email_user`,
        [user.email_user, user.name_user, user.password_user]);

      return result.rows[0];
  }

  async getUserByIdRepository(id_user:number):Promise<SafeUser | null>{
    const result = await pool.query(
    `SELECT id_user, name_user, email_user
     FROM users
     WHERE id_user = $1`,
    [id_user]);

    return result.rows[0] || null;
  }

  async upadateUserRepository(user:UpdateUser): Promise<User|null>{
    const result = await pool.query(
    `UPDATE users
     SET email_user = $2,
         name_user = $3,
         password_user = $4
     WHERE id_user = $1
     RETURNING id_user, name_user, email_user`,
    [user.id_user, user.email_user, user.name_user, user.password_user]);
    return result.rows[0] || null
  }

  async deleteUserRepository(id_user:number){
    const result = await pool.query(
      `DELETE FROM users
      WHERE id_user = $1
      RETURNING id_user, name_user, email_user`,[id_user]);

    return result.rows[0] || null;
  }
}
