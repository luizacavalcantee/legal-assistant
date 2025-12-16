import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import documentRoutes from "./routes/documentRoutes";
import chatRoutes from "./routes/chatRoutes";
import downloadRoutes from "./routes/downloadRoutes";
import prisma from "./lib/prisma";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
// Configurar CORS - aceitar múltiplas origens se necessário
const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Função para normalizar URLs (remover barra final e espaços)
    const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, "");
    
    // Lista de origens permitidas (normalizadas)
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((o) => normalizeUrl(o))
      : process.env.FRONTEND_URL
      ? [normalizeUrl(process.env.FRONTEND_URL)]
      : ["http://localhost:5173", "http://localhost:3000"];

    // Em desenvolvimento, permitir requisições sem origin (Postman, curl, etc.)
    if (!origin && process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    // Normalizar a origem recebida antes de comparar
    const normalizedOrigin = origin ? normalizeUrl(origin) : origin;

    // Verificar se a origem está na lista permitida
    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`CORS bloqueado para origem: ${normalizedOrigin}`);
      console.warn(`Origens permitidas: ${allowedOrigins.join(", ")}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Disposition"],
};

app.use(cors(corsOptions));
app.use(express.json());

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verifica o status do servidor
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servidor está funcionando
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: Servidor do Assistente Jurídico está funcionando
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    message: "Servidor do Assistente Jurídico está funcionando",
    timestamp: new Date().toISOString(),
  });
});

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rotas da API
app.use("/documents", documentRoutes);
app.use("/chat", chatRoutes);
app.use("/download", downloadRoutes);

// Middleware de tratamento de erros global
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("Erro não tratado:", err);
  console.error("Stack:", err?.stack);
  
  res.status(err.status || 500).json({
    error: err.message || "Erro interno do servidor",
    details: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
  });
});

// Testar conexão com o banco de dados antes de iniciar o servidor
async function startServer() {
  try {
    // Testar conexão com o banco de dados
    await prisma.$connect();
    console.log("✅ Conexão com o banco de dados estabelecida");
    
    // Testar query simples
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Banco de dados está acessível");
    
    // Verificar se a tabela existe
    try {
      await prisma.$queryRaw`SELECT 1 FROM base_de_conhecimento LIMIT 1`;
      console.log("✅ Tabela base_de_conhecimento existe");
    } catch (tableError: any) {
      console.error("❌ Tabela base_de_conhecimento não encontrada!");
      console.error("   Execute: npm run prisma:migrate:deploy");
      console.error("   Ou use: npx prisma migrate deploy");
      throw new Error("Tabela base_de_conhecimento não existe. Execute as migrations primeiro.");
    }
  } catch (error: any) {
    console.error("❌ Erro ao conectar com o banco de dados:", error.message);
    console.error("   Verifique se DATABASE_URL está configurada corretamente");
    console.error("   Stack:", error.stack);
    process.exit(1);
  }

  // Iniciar servidor
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 Health check disponível em http://localhost:${PORT}/health`);
    console.log(
      `📄 Documentos API disponível em http://localhost:${PORT}/documents`
    );
    console.log(
      `💬 Chat API disponível em http://localhost:${PORT}/chat/message`
    );
    console.log(
      `📥 Download API disponível em http://localhost:${PORT}/download/file/:filename`
    );
    console.log(`📚 Swagger UI disponível em http://localhost:${PORT}/api-docs`);
    console.log(
      `🔍 RAG: Indexação vetorial ${
        process.env.QDRANT_URL ? "habilitada" : "desabilitada"
      }`
    );
  });
}

// Iniciar servidor com teste de conexão
startServer().catch((error) => {
  console.error("❌ Erro fatal ao iniciar servidor:", error);
  process.exit(1);
});
