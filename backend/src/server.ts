

import "dotenv/config";
import app from "./app";
import { migrateMonitoring } from "./db/migrate";

import {
  refreshAllData,
  start
} from "./modules/Worker/worker.job";

async function main() {
  // Prepara o banco antes de iniciar o servidor.
  await migrateMonitoring();

  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(
      `Servidor BackEnd está rodando http://localhost:${port}`
    );

    // Executa a primeira coleta imediatamente.
    void refreshAllData().catch((error: unknown) => {
      console.error(
        "Falha na coleta inicial de dados:",
        error
      );
    });

    // Agenda as próximas coletas a cada 30 segundos.
    start();
  });
}

void main().catch((error: unknown) => {
  console.error(
    "Não foi possível preparar o banco de monitoramento. Verifique a conexão e as migrações.",
    error
  );

  process.exitCode = 1;
});
