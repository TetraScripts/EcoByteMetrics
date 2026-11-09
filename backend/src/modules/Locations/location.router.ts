/* Roteador para gerenciar rotas relacionadas a localizações.
   Este módulo define as rotas para criar, buscar por ID e listar todas as localizações.
   Ele também lida com métodos HTTP não permitidos, enviando respostas apropriadas.
*/
import{Router} from "express";

import{
    createLocationController,
    getLocationByIdController,
    listLocationController
}from "./location.controller";
import { authMiddleware } from "../Auth/auth.middleware";

/* Criação do roteador de localizações usando o Router do Express.
   Define as rotas para criar, buscar por ID e listar todas as localizações.
   Também lida com métodos HTTP não permitidos, enviando respostas apropriadas.
*/
const locationRouter = Router();
// Rota para listar todas as localizações.
locationRouter.get("/all", listLocationController);
locationRouter.post("/", authMiddleware, createLocationController);
locationRouter.get("/:id_location", getLocationByIdController);
/* Rota para lidar com métodos HTTP não permitidos para a rota "/all".
   Envia uma resposta HTTP com o status 405 (Método não permitido) e uma mensagem de erro.
*/
locationRouter.post("/all", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS").status(204).end();
});

locationRouter.get("/", (req, res) => {
    res.set("Allow", "GET, HEAD, POST, OPTIONS").status(204).end();
});

locationRouter.post("/:id", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS").status(204).end();
});

/* Rota para lidar com métodos HTTP não permitidos para a rota "/".
   Envia uma resposta HTTP com o status 405 (Método não permitido) e uma mensagem de erro.
*/
locationRouter.all("/all", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
});

locationRouter.all("/", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
});

locationRouter.all("/:id", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
});



export default locationRouter;