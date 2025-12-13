import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Diretório para armazenar documentos
const documentsDir = process.env.DOCUMENTS_BASE_PATH || "./documents";

// Criar diretório se não existir
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Configuração de armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único: timestamp-originalname
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const filename = `${name}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// Filtro de tipos de arquivo permitidos
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Permitir PDF, TXT, MD, DOCX
  const allowedMimes = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Tipo de arquivo não permitido. Permitidos: PDF, TXT, MD, DOCX. Recebido: ${file.mimetype}`
      )
    );
  }
};

// Configuração do multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
});

// Middleware para upload de um único arquivo
export const uploadSingle = upload.single("arquivo");

