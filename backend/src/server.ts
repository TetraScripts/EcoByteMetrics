import "dotenv/config";
import app from "./app";
import { migrateMonitoring } from "./db/migrate";

async function main() {
  await migrateMonitoring();
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Servidor BackEnd est? rodando http://localhost:${port}`);
  });
}
void main().catch(() => {
  console.error("Não foi possível preparar o banco de monitoramento. Verifique a conexão e as migrações.");
  process.exitCode = 1;
});
