import swaggerJsdoc from "swagger-jsdoc";
import { SwaggerDefinition } from "swagger-jsdoc";

const swaggerDefinition: SwaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Assistente Jurídico API",
    version: "1.0.0",
    description:
      "API REST para Assistente Jurídico Inteligente com RAG, integração e-SAJ, resumo de processos e download de documentos",
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
    {
      name: "Chat",
      description: "Endpoints para comunicação com o assistente jurídico (LLM, RAG, e-SAJ)",
    },
    {
      name: "Downloads",
      description: "Endpoints para download de arquivos baixados do e-SAJ",
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
        required: [
          "id",
          "titulo",
          "caminho_arquivo",
          "status_indexacao",
          "criado_em",
        ],
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
      ChatMessageRequest: {
        type: "object",
        required: ["message"],
        properties: {
          message: {
            type: "string",
            description: "Mensagem do usuário para o assistente jurídico",
            example: "Qual é a definição de Habeas Corpus?",
            maxLength: 2000,
          },
        },
      },
      ChatMessageResponse: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Mensagem original do usuário",
            example: "Qual é a definição de Habeas Corpus?",
          },
          response: {
            type: "string",
            description: "Resposta gerada pelo modelo de linguagem ou resultado da operação",
            example:
              "Habeas Corpus é um remédio constitucional que garante o direito de liberdade...",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            description: "Data e hora da resposta",
            example: "2025-12-13T10:30:00.000Z",
          },
          intention: {
            type: "string",
            enum: ["RAG_QUERY", "DOWNLOAD_DOCUMENT", "SUMMARIZE_PROCESS", "SUMMARIZE_DOCUMENT", "QUERY_DOCUMENT", "GENERAL_QUERY"],
            description: "Intenção detectada do usuário",
            example: "RAG_QUERY",
          },
          protocolNumber: {
            type: "string",
            description: "Número do protocolo do processo (se relevante)",
            example: "1000822-06.2025.8.26.0451",
          },
          documentType: {
            type: "string",
            description: "Tipo de documento solicitado (se relevante)",
            example: "sentença",
          },
          downloadUrl: {
            type: "string",
            format: "uri",
            description: "URL para download do arquivo (se aplicável)",
            example: "http://localhost:3000/download/file/documento.pdf",
          },
          fileName: {
            type: "string",
            description: "Nome do arquivo baixado (se aplicável)",
            example: "sentenca_10008220620258260451_1765818630994.pdf",
          },
          sources: {
            type: "array",
            description: "Fontes dos documentos utilizados na resposta (RAG)",
            items: {
              type: "object",
              properties: {
                document_id: {
                  type: "string",
                  description: "ID do documento",
                },
                titulo: {
                  type: "string",
                  description: "Título do documento",
                },
                chunk_index: {
                  type: "number",
                  description: "Índice do chunk utilizado",
                },
                score: {
                  type: "number",
                  description: "Score de similaridade",
                },
                text: {
                  type: "string",
                  description: "Trecho do documento utilizado",
                },
              },
            },
          },
        },
        required: ["message", "response", "timestamp"],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Mensagem de erro",
            example: "Erro interno do servidor",
          },
          message: {
            type: "string",
            description: "Detalhes adicionais do erro (opcional)",
            example: "Erro ao comunicar com o modelo de linguagem",
          },
        },
        required: ["error"],
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/server.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
