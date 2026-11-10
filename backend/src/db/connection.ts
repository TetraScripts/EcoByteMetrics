import { Pool, type QueryResultRow } from "pg";

const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: String(process.env.POSTGRES_PASSWORD),
    database: process.env.POSTGRES_DATABASE,
    port: Number(process.env.POSTGRES_PORT)
});
pool.on("error", (error) => {
  console.error("Erro na conexão com o PostgreSQL:", error);
});

export default pool;