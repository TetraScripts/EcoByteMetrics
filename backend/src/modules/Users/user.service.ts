import {
    createUserRepository,
    getUserByIdRepository,
    getUserPasswordHashRepository,
    upadateUserRepository,
    deleteUserRepository,
    type SafeUser,
    type CreateUserInput,
    type UpdateUserInput,
    type UpdateUser
} from "./user.repository";

import bcrypt from "bcryptjs";
import { Buffer } from "node:buffer";

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
    if (
        typeof input !== "object" ||
        input === null ||
        Array.isArray(input)
    ) {
        throw new UserError("Informe nome, e-mail e senha", 400);
    }

    const user = input as Record<string, unknown>;

    const name =
        typeof user.name_user === "string"
            ? user.name_user.trim()
            : "";

    const email =
        typeof user.email_user === "string"
            ? user.email_user.trim().toLowerCase()
            : "";

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
        Array.from(password).length < 8 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        throw new UserError(
            "A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes",
            400
        );
    }

    return {
        name_user: name,
        email_user: email,
        password_user: password
    };
}

function handleRepositoryError(error: unknown): never {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
    ) {
        throw new UserError(
            "Já existe um usuário com esse e-mail.",
            409
        );
    }

    throw error;
}

// Cadastrar usuário.
export async function createUserService(
    user: CreateUserInput
): Promise<SafeUser> {
    const data = validateUserInput(user);

    try {
        const hashedPassword = await bcrypt.hash(
            data.password_user,
            10
        );

        return await createUserRepository({
            ...data,
            password_user: hashedPassword
        });
    } catch (error) {
        handleRepositoryError(error);
    }
}

// Buscar usuário por ID.
export async function getUserByIdService(
    id: number
): Promise<SafeUser> {
    validateUserId(id);

    const user = await getUserByIdRepository(id);

    if (!user) {
        throw new UserError("Usuário não encontrado", 404);
    }

    return user;
}

// Atualizar usuário.
export async function updateUserService(
    user: UpdateUserInput
): Promise<SafeUser> {
    validateUserId(user.id_user);

    const { id_user, ...input } = user;

    if (
        typeof input.name_user !== "string" ||
        !input.name_user.trim() ||
        Array.from(input.name_user.trim()).length > 50
    ) {
        throw new UserError("Nome inválido", 400);
    }

    if (
        typeof input.email_user !== "string" ||
        !input.email_user.trim() ||
        input.email_user.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            input.email_user.trim()
        )
    ) {
        throw new UserError("E-mail inválido", 400);
    }

    if (
        input.password_user !== undefined &&
        (
            typeof input.password_user !== "string" ||
            !input.password_user.trim() ||
            Array.from(input.password_user).length < 8 ||
            Buffer.byteLength(input.password_user, "utf8") > 72
        )
    ) {
        throw new UserError(
            "A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes",
            400
        );
    }

    try {
        // Busca somente o hash da senha atual.
        const currentUser =
            await getUserPasswordHashRepository(id_user);

        if (!currentUser) {
            throw new UserError("Usuário não encontrado", 404);
        }

        // Criptografa a nova senha, se ela foi informada.
        // Caso contrário, preserva o hash atual.
        const passwordToSave = input.password_user !== undefined
            ? await bcrypt.hash(input.password_user, 10)
            : currentUser.password_user;

        const updateData: UpdateUser = {
            id_user,
            name_user: input.name_user.trim(),
            email_user: input.email_user.trim().toLowerCase(),
            password_user: passwordToSave
        };

        const updatedUser =
            await upadateUserRepository(updateData);

        if (!updatedUser) {
            throw new UserError("Usuário não encontrado", 404);
        }

        return updatedUser;
    } catch (error) {
        handleRepositoryError(error);
    }
}

// Excluir usuário.
export async function deleteUserService(
    id: number
): Promise<SafeUser> {
    validateUserId(id);

    const user = await deleteUserRepository(id);

    if (!user) {
        throw new UserError("Usuário não encontrado", 404);
    }

    return user;
}