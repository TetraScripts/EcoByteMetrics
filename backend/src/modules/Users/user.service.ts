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

export class UserError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.name = "UserError";
    }
}

function validateUserId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new UserError("ID do usuário inválido", 400);
    }
}

function validateUserInput(user: CreateUserInput): CreateUserInput {
    if (
        !user.name_user ||
        !user.name_user.trim() ||
        Array.from(user.name_user.trim()).length > 50
    ) {
        throw new UserError("Nome inválido", 400);
    }

    if (
        !user.email_user ||
        !user.email_user.trim() ||
        Array.from(user.email_user.trim()).length > 254
    ) {
        throw new UserError("Email inválido", 400);
    }

    if (
        !user.password_user ||
        !user.password_user.trim() ||
        Array.from(user.password_user).length > 25
    ) {
        throw new UserError("Senha inválida", 400);
    }

    return user;
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

// Cadastrar usuário.
export async function createUserService(
    user: CreateUserInput
): Promise<SafeUser> {
    const data = validateUserInput(user);

    try {
        const hashedPassword = await bcrypt.hash(data.password_user, 10);

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
): Promise<SafeUser | null> {
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
        !input.name_user ||
        !input.name_user.trim() ||
        Array.from(input.name_user.trim()).length > 50
    ) {
        throw new UserError("Nome inválido", 400);
    }

    if (
        !input.email_user ||
        !input.email_user.trim() ||
        Array.from(input.email_user.trim()).length > 254
    ) {
        throw new UserError("Email inválido", 400);
    }

    if (
        input.password_user !== undefined &&
        (
            !input.password_user.trim() ||
            Array.from(input.password_user).length > 25
        )
    ) {
        throw new UserError("Senha inválida", 400);
    }

    try {
        // Busca somente o hash da senha atual.
        const currentUser = await getUserPasswordHashRepository(id_user);

        if (!currentUser) {
            throw new UserError("Usuário não encontrado", 404);
        }

        // Se uma nova senha foi informada, gera outro hash.
        // Caso contrário, preserva o hash atual.
        const passwordToSave = input.password_user
            ? await bcrypt.hash(input.password_user, 10)
            : currentUser.password_user;

        const updateData: UpdateUser = {
            id_user,
            name_user: input.name_user.trim(),
            email_user: input.email_user.trim(),
            password_user: passwordToSave
        };

        const updatedUser = await upadateUserRepository(updateData);

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
): Promise<SafeUser | null> {
    validateUserId(id);

    const user = await deleteUserRepository(id);

    if (!user) {
        throw new UserError("Usuário não encontrado", 404);
    }

    return user;
}
