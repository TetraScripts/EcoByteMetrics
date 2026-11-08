import{
    Carbon,
    CarbonRepository,
    CreateCarbonInput
}   from "./carbon.repository";
//classe de erro personalizada para o módulo de carbono
export class CarbonError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.name = "CarbonError";
    }
    //validação do ID de carbono
    static validateCarbonId(id: number) {
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new CarbonError("ID do carbono inválido", 401);
        }
    }
    //validação do ID da localização
    static  validateLocationId(id: number) {
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new CarbonError("ID da localização inválido", 401);
        }
    }
    //validação dos dados de entrada para criar um novo registro de carbono
    static validateCarbonInput(carbonInput: CreateCarbonInput): CreateCarbonInput {
        //validação do ID da localização
        CarbonError.validateLocationId(carbonInput.id_location);
        //validação da data e hora
        if (!carbonInput.date_houry || isNaN(Date.parse(carbonInput.date_houry))) {
            throw new CarbonError("Data e hora inválidas", 401);
        }
        //validação da intensidade de carbono e da porcentagem de energia renovável
        if (carbonInput.intesity_co2e_kwh_carbon < 0) {
            throw new CarbonError("Valor de intensidade de carbono inválido", 401);
        }
        //validação da porcentagem de energia renovável
        if (carbonInput.renewable_percent_carbon < 0 || carbonInput.renewable_percent_carbon > 100) {
            throw new CarbonError("Valor de porcentagem de energia renovável inválido", 401);
        }
        return carbonInput;
    }
    //validação dos dados de entrada para criar um novo registro de carbono
    static handleRepositoryError(error: unknown): Promise<never> {
        if (error instanceof CarbonError) {
            throw error;
        }
        if (typeof error === "object" && error !== null &&"code" in error &&typeof error.code === "string") {
            switch (error.code) {
                case "23505":
                    throw new CarbonError("Registro duplicado.", 409);

                case "23503":
                    throw new CarbonError("Localização não encontrada.", 400);

                case "23502":
                    throw new CarbonError("Campo obrigatório não informado.", 400);

                case "23514":
                    throw new CarbonError("Valor fora das restrições permitidas.", 400);
            }
        }
        throw error;
    }
};

//classe de serviço para o módulo de carbono
export class CarbonService {
    private carbonRepository: CarbonRepository;
    constructor() {
        this.carbonRepository = new CarbonRepository();
    }
    //função para criar um novo registro de carbono
    async createCarbon(carbonInput: CreateCarbonInput): Promise<Carbon | null> {
        const data =  CarbonError.validateCarbonInput(carbonInput);
        let carbon: Carbon | null = null;
        try {   
            carbon = await this.carbonRepository.createCarbon(data);
            if (!carbon) {
                throw new CarbonError("Não foi possível criar o registro de carbono", 500);
            }  
            
        } catch (error) {   
             CarbonError.handleRepositoryError(error);
        }
        return carbon;
    }
    //função para obter um registro de carbono pelo ID
    async getCarbonById(id_carbon: number): Promise<Carbon | null> {
        CarbonError.validateCarbonId(id_carbon);
        let carbon: Carbon | null = null;
        try {
            carbon = await this.carbonRepository.getCarbonById(id_carbon); 
            if (!carbon) {
                throw new CarbonError("Não existe metricas para Carbons", 404);
            }
        }
        catch (error) {
            CarbonError.handleRepositoryError(error);
        }
        return carbon;
    }   
    //lista todos os registros de carbono de uma determinada localização
    async listCarbonsByLocationId(id_location: number): Promise<Location | null> {
        CarbonError.validateLocationId(id_location);
        let carbons: Location | null = null;
        try {
            carbons = await this.carbonRepository.getCarbonByLocationId(id_location);
            if (!carbons) {
                throw new CarbonError("Não existe metricas para Carbons", 404);
            }
        }
        catch (error) {
            CarbonError.handleRepositoryError(error);
        }
        return carbons;
    }
    //lista todos os registros de carbono
    async listCarbons(): Promise<Location[]> {
        let carbons: Location[] = [];
        try {
            carbons = await this.carbonRepository.listCarbons();  
            
            if (carbons.length === 0) {
                throw new CarbonError("Não existe metricas para Carbons", 404);
            }
        }
        catch (error) {
            CarbonError.handleRepositoryError(error);
        }
        return carbons;
    }
    //função para verificar se um registro de carbono com os mesmos valores de intensidade e porcentagem de energia renovável já existe
    async getCarbonByExits(renewable_percent_carbon:number, intesity_co2e_kwh_carbon:number): Promise<boolean> {
        try {
            let carbon = await this.carbonRepository.getCarbonByExist(renewable_percent_carbon, intesity_co2e_kwh_carbon);
            
            return carbon !== null;
            
        }
        catch (error) {
            CarbonError.handleRepositoryError(error);
        }
        return false;
    }

}


