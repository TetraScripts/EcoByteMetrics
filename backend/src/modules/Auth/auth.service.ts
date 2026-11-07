/* Valida as credenciais, compara a senha com o hash e gera o JWT. */
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { AuthUser, AuthUserRepository, LoginInput } from "./auth.repository";

export class AuthError extends Error {
  constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.name = "AuthError";
    }
}

export type LoginResult = {
  token: string;
  tokenType: "Bearer";
  expiresIn: string;
};
export class AuthUserService{
   private authUser = new AuthUserRepository();
   async loginService(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    throw new AuthError("E-mail e senha são obrigatórios.", 400);
  }

  const user = await this.authUser.getUserByEmailRepository(email);

  if (!user) {
    throw new AuthError("E-mail ou senha inválidos.", 401);
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.password_user
  );

  if (!passwordMatches) {
    throw new AuthError("E-mail ou senha inválidos.", 401);
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET não foi configurada.");
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || "1h";

  const options: SignOptions = {
    subject: String(user.id_user),
    expiresIn: expiresIn as SignOptions["expiresIn"],
  };

  const token = jwt.sign(
    { email: user.email_user },
    secret,
    options
  );

  return {
    token,
    tokenType: "Bearer",
    expiresIn,
  };
  }
}

