import { defineConfig, env } from "prisma/config";
import dotenv from "dotenv";

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
});

