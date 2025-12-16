/**
 * Script para garantir que as migrations foram aplicadas
 * Executa antes do servidor iniciar
 */
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não está definida");
  process.exit(1);
}

console.log("🔄 Verificando e aplicando migrations...");

try {
  // Aplicar migrations
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
  console.log("✅ Migrations aplicadas com sucesso");
} catch (error: any) {
  console.error("❌ Erro ao aplicar migrations:", error.message);
  process.exit(1);
}

