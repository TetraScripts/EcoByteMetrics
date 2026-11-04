import bcrypt from "bcryptjs";
import { Buffer } from "node:buffer";

import {
  createUserRepository,
  getUserByIdRepository,
  upadateUserRepository,
  deleteUserRepository,
  type User,
  type CreateUserInput,
} from "./user.repository";

export class UserError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "UserError";
  }
}

function validateUserId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new UserError("ID do usuário inválido", 400);
  }
}

function validateUserInput(input: unknown): CreateUserInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new UserError("Informe nome, e-mail e senha", 400);
  }

  const user = input as Record<string, unknown>;
  const name = typeof user.name_user === "string" ? user.name_user.trim() : "";
  const email = typeof user.email_user === "string" ? user.email_user.trim().toLowerCase() : "";
  const password = user.password_user;

  if (!name || Array.from(name).length > 50) {
    throw new UserError("Nome inválido", 400);
  }

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new UserError("E-mail inválido", 400);
  }

  if (
    typeof password !== "string" ||
    password.trim().length === 0 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    Array.from(password).length < 8
  ) {
    throw new UserError(
      "A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes",
      400
    );
  }

  return {
    name_user: name,
    email_user: email,
    password_user: password,
  };
}

function handleRepositoryError(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    throw new UserError("Já existe um usuário com esse e-mail.", 409);
  }

  throw error;
}

export async function createUserService(
  user: unknown
): Promise<User> {
  const data = validateUserInput(user);

  try {
    const passwordHash = await bcrypt.hash(data.password_user, 10);

    return await createUserRepository({
      ...data,
      password_user: passwordHash,
    });
  } catch (error) {
    handleRepositoryError(error);
  }
}

export async function getUserByIdService(
  id: number
): Promise<User | null> {
  validateUserId(id);

  const user = await getUserByIdRepository(id);

  if (!user) {
    throw new UserError("Usuário não encontrado", 404);
  }

  return user;
}

export async function updateUserService(
  id: number,
  input: unknown
): Promise<User> {
  validateUserId(id);

  const data = validateUserInput(input);

  try {
    const passwordHash = await bcrypt.hash(data.password_user, 10);

    const updatedUser = await upadateUserRepository({
      id_user: id,
      ...data,
      password_user: passwordHash,
    });

    if (!updatedUser) {
      throw new UserError("Usuário não encontrado", 404);
    }

    return updatedUser;
  } catch (error) {
    handleRepositoryError(error);
  }
}

export async function deleteUserService(
  id: number
): Promise<User | null> {
  validateUserId(id);

  const user = await deleteUserRepository(id);

  if (!user) {
    throw new UserError("Usuário não encontrado", 404);
  }

  return user;
}
