import app from "./app.js";
import {
    refreshDiscoveredServices,
    refreshServiceMetrics,
} from "./modules/Services/services.service.js";
import { refreshCarbonRegionFactors } from "./integrations/carbon-api.js";

const PORT = process.env.PORT || 3000;

// Intervalo de atualização: 30 segundos.
const REFRESH_INTERVAL = 30_000;

async function refreshAllData(): Promise<void> {
    // Primeiro atualiza a lista de serviços.
    await refreshDiscoveredServices();

    try {
        await refreshCarbonRegionFactors();
    } catch (error: unknown) {
        console.error("Falha ao atualizar fatores de carbono:", error);
    }

    // Depois consulta as métricas da lista atualizada.
    await refreshServiceMetrics();
}

app.listen(PORT, () => {
    console.log(
        `Servidor BackEnd está rodando http://localhost:${PORT}`
    );

    // Primeira coleta ao iniciar o servidor.
    void refreshAllData()
        .then(() => {
            console.log(
                "Serviços e métricas carregados com sucesso."
            );
        })
        .catch((error: unknown) => {
            console.error(
                "Falha ao atualizar a lista de serviços:",
                error
            );
        });

    // Atualiza a lista e as métricas a cada 30 segundos.
    setInterval(() => {
        void refreshAllData()
            .then(() => {
                console.log(
                    "Lista de serviços e métricas atualizada."
                );
            })
            .catch((error: unknown) => {
                console.error(
                    "Falha ao atualizar os dados do Agregador:",
                    error
                );
            });
    }, REFRESH_INTERVAL);
});
