
import type {
  Location,
  createLocationInput,
} from "./location.repository";
import { LocationRepository } from "./location.repository";

/**
 * Erro específico do módulo de localizações.
 */
export class LocationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "LocationError";
  }

  /**
   * Valida o identificador de uma localização.
   */
  static validateLocationId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new LocationError("ID da localização inválido", 400);
    }
  }

  /**
   * Valida os dados recebidos para criar uma localização.
   */
  static validateLocationInput(
    localInput: createLocationInput
  ): createLocationInput {
    if (
      !localInput ||
      typeof localInput !== "object"
    ) {
      throw new LocationError("Dados da localização inválidos", 400);
    }

    if (
      typeof localInput.name_location !== "string" ||
      localInput.name_location.trim() === ""
    ) {
      throw new LocationError("Nome da localização inválido", 400);
    }

    if (
      typeof localInput.region_location !== "string" ||
      localInput.region_location.trim() === ""
    ) {
      throw new LocationError("Região da localização inválida", 400);
    }

    if (
      typeof localInput.country_location !== "string" ||
      localInput.country_location.trim() === ""
    ) {
      throw new LocationError("País da localização inválido", 400);
    }

    if (
      typeof localInput.city_location !== "string" ||
      localInput.city_location.trim() === ""
    ) {
      throw new LocationError("Cidade da localização inválida", 400);
    }

    const latitude = localInput.latitude_location;
    const longitude = localInput.longitude_location;

    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new LocationError("Latitude inválida", 400);
    }

    if (
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new LocationError("Longitude inválida", 400);
    }

    return localInput;
  }

  /**
   * Converte erros conhecidos do banco de dados.
   */
  static handleRepositoryError(error: unknown): never {
    if (error instanceof LocationError) {
      throw error;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      switch (error.code) {
        case "23505":
          throw new LocationError("Registro duplicado.", 409);

        case "23503":
          throw new LocationError("Localização não encontrada.", 400);

        case "23502":
          throw new LocationError("Campo obrigatório não informado.", 400);

        case "23514":
          throw new LocationError(
            "Valor fora das restrições permitidas.",
            400
          );
      }
    }

    throw error;
  }
}

export class LocationService {
  private locationRepository = new LocationRepository();

  /**
   * Cria uma localização.
   */
  async createLocation(
    local: createLocationInput
  ): Promise<Location> {
    const data = LocationError.validateLocationInput(local);

    try {
      const location =
        await this.locationRepository.createLocationRepository(data);

      if (!location) {
        throw new LocationError(
          "Não foi possível cadastrar a localização.",
          500
        );
      }

      return location;
    } catch (error) {
      LocationError.handleRepositoryError(error);
    }
  }

  /**
   * Busca uma localização pelo ID.
   */
  async getLocationById(id_location: number): Promise<Location> {
    try {
      LocationError.validateLocationId(id_location);

      const location =
        await this.locationRepository.getLocationByIdRepository(
          id_location
        );

      if (!location) {
        throw new LocationError("Localização não encontrada.", 404);
      }

      return location;
    } catch (error) {
      LocationError.handleRepositoryError(error);
    }
  }

  /**
   * Busca uma localização pelas coordenadas.
   */
  async getLocationByName(
    longitude_location: number,
    latitude_location: number
  ): Promise<Location | null> {
    try {
      const location =
        await this.locationRepository.getLocationByExistRepository(
          longitude_location,
          latitude_location
        );

      return location;
    } catch (error) {
      LocationError.handleRepositoryError(error);
    }
  }

  /**
   * Lista todas as localizações.
   */
  async listLocationALl(): Promise<Location[]> {
    try {
      const locations =
        await this.locationRepository.listLocationsRepository();

      if (locations.length === 0) {
        throw new LocationError(
          "Não existem localizações cadastradas.",
          404
        );
      }

      return locations;
    } catch (error) {
      LocationError.handleRepositoryError(error);
    }
  }
}
