const API_URL = "http://localhost:3000/"

export default async function mensagemHome() {
    const response = await fetch(API_URL);
    if(!response.ok){
        throw new Error("Erro no backend")
    }
    return response.json();
}