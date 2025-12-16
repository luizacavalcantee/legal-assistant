import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import documentRoutes from "./routes/documentRoutes";
import chatRoutes from "./routes/chatRoutes";
import downloadRoutes from "./routes/downloadRoutes";

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
    // Lista de origens permitidas
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
      : process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL]
      : ["http://localhost:5173", "http://localhost:3000"];

    // Em desenvolvimento, permitir requisições sem origin (Postman, curl, etc.)
    if (!origin && process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    // Verificar se a origem está na lista permitida
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS bloqueado para origem: ${origin}`);
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
