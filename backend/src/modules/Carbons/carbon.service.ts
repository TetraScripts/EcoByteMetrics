import{
    Carbon,
    CreateCarbonInput,
    getCarbonByIdRepository,
    listCarbonsByLocationIdRepository,
    listCarbonsRepository,
    createCarbonRepository,
    getCarbonByExistRepository
}   from "./carbon.repository";
//classe de erro personalizada para o módulo de carbono
export class CarbonError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.name = "CarbonError";
    }
};

//função para validar o ID do registro de carbono
function validateCarbonId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new CarbonError("ID do carbono inválido", 400);
    }
}
function validateLocationId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new CarbonError("ID da localização inválido", 400);
    }
}
//função para validar os dados de entrada do registro de carbono
function validateCarbonInput(carbonInput: CreateCarbonInput): CreateCarbonInput  {
    if (!carbonInput.id_location || !Number.isSafeInteger(carbonInput.id_location) || carbonInput.id_location <= 0) {
        throw new CarbonError("ID da localização inválido", 400);
    }
    if (carbonInput.intesity_co2e_kwh_carbon < 0) {
        throw new CarbonError("Valor de intensidade de carbono inválido", 400);
    }
    if (carbonInput.renewable_percent_carbon < 0 || carbonInput.renewable_percent_carbon > 100) {
        throw new CarbonError("Valor de porcentagem de energia renovável inválido", 400);
    }
    return carbonInput;
}
//função para lidar com erros do repositório
function handleRepositoryError(error: unknown): never {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new CarbonError("Já existe um registro de carbono com esse ID.", 409);
    }
    throw error;
}

//funão para criar um novo registro de carbono
export async function createCarbonService(carbonInput: CreateCarbonInput): Promise<Carbon> {
    const data = validateCarbonInput(carbonInput);
    try{
        const carbon = await createCarbonRepository(data);
        return carbon;
    }catch (error) {
        handleRepositoryError(error);
    }
}
//função para obter um registro de carbono pelo ID
export async function getCarbonByIdService(id_carbon: number): Promise<Carbon | null> {
    validateCarbonId(id_carbon);
    try{
        const carbon = await getCarbonByIdRepository(id_carbon);
        return carbon;
    }catch (error) {
        handleRepositoryError(error);
    }
}

export async function getCarbonByExitsService(id_location:number, renewable_percent_carbon:number, intesity_co2e_kwh_carbon:number): Promise<boolean> {
    try{
        const carbon = await getCarbonByExistRepository(id_location, renewable_percent_carbon, intesity_co2e_kwh_carbon);
        if(carbon)
            return true;
        return false;
    }catch (error) {
        handleRepositoryError(error);
    }
}
//lista todos os registros de carbono de uma determinada localização
export async function listCarbonsByLocationIdService(id_location: number): Promise<Carbon[]> {
    validateLocationId(id_location);
    try{
        const carbons = await listCarbonsByLocationIdRepository(id_location);
        return carbons;
    }catch (error) {     
        handleRepositoryError(error);
    }   
}
//lista todos os registros de carbono
export async function listCarbonsService(): Promise<Carbon[]> {
    try{
        const carbons = await listCarbonsRepository();
        if(carbons.length===0){
            throw new CarbonError("Não existe meticas para Carbons", 404)
        }
        return carbons;
    }catch (error) {     
        handleRepositoryError(error);
    }   
}


