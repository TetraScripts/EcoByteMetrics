/* Consulta o usuário no PostgreSQL por meio de SQL parametrizado. */
import pool from "../../db/connection";

export type AuthUser = {
  id_user: number;
  name_user: string;
  email_user: string;
  password_user: string;
  role_user: "ADMIN" | "USER";
};

export type LoginInput = {
  email: string;
  password: string;
};
export class AuthUserRepository{
   async getUserByEmailRepository(email: string): Promise<AuthUser | null> {
    const result = await pool.query(
      `SELECT id_user, name_user, email_user, password_user, role_user
      FROM users
      WHERE email_user = $1
      LIMIT 1`,
      [email]
    );

    return result.rows[0] ?? null;
  }
  // Buscar usuário pelo ID
    async findUserById(id: number): Promise<AuthUser | null> {
        const result = await pool.query<AuthUser>(
            `
            SELECT
                id_user,
                name_user,
                email_user,
                password_user,
                role_user
            FROM Users
            WHERE id_user = $1
            `,
            [id]
        );

        return result.rows[0] ?? null;
    }
}