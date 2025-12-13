import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";

// Carregar variáveis de ambiente antes de inicializar o PrismaClient
dotenv.config();

// Verificar se DATABASE_URL está definida
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL não está definida no arquivo .env. Por favor, configure a variável de ambiente."
  );
}

// Criar pool de conexões do PostgreSQL
const pool = new Pool({ connectionString: databaseUrl });

// Criar adaptador do Prisma para PostgreSQL
const adapter = new PrismaPg(pool);

// Inicializar PrismaClient com o adaptador (requerido no Prisma 7)
const prisma = new PrismaClient({ adapter });

export default prisma;
