import bcrypt from "bcryptjs";

import {type User, type CreateUserInput, UserRepository} from "./user.repository";

export class UserError extends Error {
  constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.name = "UserError";
  }

  static validateUserId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new UserError("ID do usuário inválido", 400);
    }
  }
  static validateUserInput(input:unknown):CreateUserInput{
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new UserError("O corpo da requisição deve ser um objeto com nome, e-mail e senha", 400);
    }
    const candidate = input as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(candidate, "role_user") ||
        Object.prototype.hasOwnProperty.call(candidate, "role")) {
      throw new UserError("O perfil do usuário é definido exclusivamente por um administrador.", 400);
    }
    const user = candidate as unknown as CreateUserInput;
    
    const trimmedName = typeof user.name_user === "string" ? user.name_user.trim() : "";
    if (!trimmedName || Array.from(trimmedName).length > 50) {
        throw new UserError("Nome inválido", 400);
    }

    const trimmedEmail = typeof user.email_user === "string" ? user.email_user.trim().toLowerCase() : "";
    if (!trimmedEmail || trimmedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new UserError("E-mail inválido", 400);
    }

    if (typeof user.password_user !== "string" || user.password_user.length < 8 ||
       new TextEncoder().encode(user.password_user).length > 72) {
        throw new UserError("Senha inválida", 400);
    }
    return {
      name_user: trimmedName,
      email_user: trimmedEmail,
      password_user: user.password_user,
    };
  }
  static handleRepositoryError(error: unknown): never {
    if (error instanceof UserError) {
        throw error;
    }
    if (typeof error === "object" && error !== null &&"code" in error &&typeof error.code === "string") {
          switch (error.code) {
              case "23505":
                throw new UserError("e-mail já cadastrado.", 409);

              case "23503":
                throw new UserError("Localização não encontrada.", 400);

              case "23502":
                throw new UserError("Campo obrigatório não informado.", 400);

              case "23514":
                throw new UserError("Valor fora das restrições permitidas.", 400);
          }
      }
      throw error;
  }
}

export class UserService{
  private userRepository = new UserRepository();

  async createUserService(user: unknown): Promise<User> {
    const data = UserError.validateUserInput(user);
    try {
      const passwordHash = await bcrypt.hash(data.password_user, 10);

      const result=  await this.userRepository.createUser({...data,password_user: passwordHash,});
      if(!result){
        throw new UserError("Não foi possível cadastrar usuario", 500);
      }
      return result;
      
    } catch (error) {
      UserError.handleRepositoryError(error);
    }
  }
  async getUserByIdService(id_user: number): Promise<User | null> {
    UserError.validateUserId(id_user);
    try{
      const user = await this.userRepository.getUserByIdRepository(id_user);

      if (!user) {
        throw new UserError("Usuário não encontrado", 404);
      }
      return user;
    }catch(error){
      UserError.handleRepositoryError(error);
    }
  }
  async updateUserService(id_user: number,input: unknown): Promise<User> {
    UserError.validateUserId(id_user);

    const data = UserError.validateUserInput(input);

    try {
      const passwordHash = await bcrypt.hash(data.password_user, 10);

      const updatedUser = await this.userRepository.upadateUserRepository({id_user: id_user,...data,password_user: passwordHash,});

      if (!updatedUser) {
        throw new UserError("Usuário não encontrado", 404);
      }

      return updatedUser;
    } catch (error) {
      UserError.handleRepositoryError(error);
    }
  }
  async deleteUserService(id_user: number): Promise<User | null> {
    UserError.validateUserId(id_user);
    try{
      const user = await this.userRepository.deleteUserRepository(id_user);

      if (!user) {
        throw new UserError("Usuário não encontrado", 404);
      }
      return user;
    }catch(error){
      UserError.handleRepositoryError(error);
    }
  }
}