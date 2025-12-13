import swaggerJsdoc from "swagger-jsdoc";
import { SwaggerDefinition } from "swagger-jsdoc";

const swaggerDefinition: SwaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Assistente Jurídico API",
    version: "1.0.0",
    description: "API REST para gerenciamento de documentos da Base de Conhecimento",
    contact: {
      name: "Assistente Jurídico",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Servidor de desenvolvimento",
    },
  ],
  tags: [
    {
      name: "Health",
      description: "Endpoints de verificação de saúde do servidor",
    },
    {
      name: "Documents",
      description: "Endpoints para gerenciamento de documentos (CRUD)",
    },
  ],
  components: {
    schemas: {
      Document: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "ID único do documento",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          titulo: {
            type: "string",
            description: "Título do documento",
            example: "Lei 13.105/2015",
          },
          caminho_arquivo: {
            type: "string",
            description: "Caminho ou referência ao arquivo",
            example: "/documentos/lei-13105-2015.pdf",
          },
          status_indexacao: {
            type: "string",
            enum: ["PENDENTE", "INDEXADO", "ERRO"],
            description: "Status da indexação no sistema RAG",
            example: "PENDENTE",
          },
          criado_em: {
            type: "string",
            format: "date-time",
            description: "Data de criação do documento",
            example: "2025-12-12T20:00:00.000Z",
          },
        },
        required: ["id", "titulo", "caminho_arquivo", "status_indexacao", "criado_em"],
      },
      CreateDocumentDto: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Título do documento",
            example: "Lei 13.105/2015",
          },
          caminho_arquivo: {
            type: "string",
            description: "Caminho ou referência ao arquivo",
            example: "/documentos/lei-13105-2015.pdf",
          },
        },
        required: ["titulo", "caminho_arquivo"],
      },
      UpdateDocumentDto: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Título do documento",
            example: "Lei 13.105/2015 - Atualizada",
          },
          caminho_arquivo: {
            type: "string",
            description: "Caminho ou referência ao arquivo",
            example: "/documentos/lei-13105-2015-v2.pdf",
          },
          status_indexacao: {
            type: "string",
            enum: ["PENDENTE", "INDEXADO", "ERRO"],
            description: "Status da indexação no sistema RAG",
            example: "INDEXADO",
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Mensagem de erro",
            example: "Documento não encontrado",
          },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Mensagem de sucesso",
          },
          data: {
            $ref: "#/components/schemas/Document",
          },
        },
      },
      ListResponse: {
        type: "object",
        properties: {
          message: {
            type: "string",
            example: "Documentos listados com sucesso",
          },
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Document",
            },
          },
          total: {
            type: "number",
            example: 10,
          },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/server.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);

