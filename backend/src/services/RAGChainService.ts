import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Document } from "@langchain/core/documents";
import { QdrantClient } from "../lib/qdrant";
import { EmbeddingService } from "./EmbeddingService";
import { LLMService } from "./LLMService";
import { QdrantVectorStore } from "../lib/langchain-adapters/QdrantVectorStore";
import { CustomEmbeddings } from "../lib/langchain-adapters/CustomEmbeddings";
import { CustomRetriever } from "../lib/langchain-adapters/CustomRetriever";
import { createCustomChatOpenAI } from "../lib/langchain-adapters/CustomChatOpenAI";

/**
 * Formata documentos como string (substitui formatDocumentsAsString)
 */
function formatDocumentsAsString(docs: Document[]): string {
  return docs.map((doc) => doc.pageContent).join("\n\n");
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    document_id: string;
    titulo: string;
    chunk_index: number;
    score: number;
    text: string;
  }>;
}

/**
 * Serviço que orquestra o RAG usando LangChain
 */
export class RAGChainService {
  private vectorStore: QdrantVectorStore;
  private llm: ChatOpenAI;
  private chain: any; // Chain do LangChain
  private qdrantClient: QdrantClient;
  private embeddingService: EmbeddingService;

  constructor(
    qdrantClient: QdrantClient,
    embeddingService: EmbeddingService,
    llmService: LLMService
  ) {
    this.qdrantClient = qdrantClient;
    this.embeddingService = embeddingService;

    // Criar embeddings customizado
    const embeddings = new CustomEmbeddings(embeddingService);

    // Criar vector store customizado
    this.vectorStore = new QdrantVectorStore(
      qdrantClient,
      embeddingService,
      embeddings
    );

    // Criar LLM customizado
    this.llm = createCustomChatOpenAI(llmService);

    // Inicializar chain de forma assíncrona (não bloqueia)
    this.initializeChain().catch((error) => {
      console.error("Erro ao inicializar chain (será inicializado na primeira query):", error);
    });
  }

  /**
   * Inicializa o chain de RAG (assíncrono)
   */
  private async initializeChain(): Promise<void> {
    try {
      // Usar asRetriever do VectorStore diretamente (se disponível)
      // Senão, usar CustomRetriever
      let retriever: any;
      
      try {
        // Tentar usar o método asRetriever do VectorStore
        retriever = this.vectorStore.asRetriever({
          k: 5,
        });
      } catch (error) {
        // Se não funcionar, usar CustomRetriever
        console.log("⚠️  Usando CustomRetriever (asRetriever não disponível)");
        retriever = new CustomRetriever(this.vectorStore, 5);
      }

      // Template do prompt para RAG
      const promptTemplate = PromptTemplate.fromTemplate(`
Você é um assistente jurídico inteligente e especializado. Use APENAS as informações fornecidas no contexto abaixo para responder à pergunta do usuário.

Se a resposta não estiver no contexto fornecido, diga honestamente que não possui informações suficientes para responder e recomende consultar um advogado para orientação específica.

Contexto:
{context}

Pergunta: {question}

Resposta (seja conciso, preciso e baseado apenas no contexto fornecido):
`);

      // Criar chain de RAG usando RunnableSequence
      // O retriever retorna Document[], então precisamos formatá-los
      this.chain = RunnableSequence.from([
        {
          context: async (input: string) => {
            // Usar getRelevantDocuments se for BaseRetriever, senão invocar diretamente
            const docs = retriever.getRelevantDocuments 
              ? await retriever.getRelevantDocuments(input)
              : await retriever.invoke(input);
            return formatDocumentsAsString(docs);
          },
          question: new RunnablePassthrough(),
        },
        promptTemplate,
        this.llm,
        new StringOutputParser(),
      ]);

      console.log("✅ RAG Chain inicializado com sucesso");
    } catch (error: any) {
      console.error("❌ Erro ao inicializar RAG Chain:", error);
      console.error("   Stack:", error.stack);
      throw error;
    }
  }

  /**
   * Executa o RAG: busca contexto e gera resposta
   */
  async query(question: string): Promise<RAGResponse> {
    try {
      console.log(`🔍 Processando pergunta com RAG: "${question}"`);

      // Aguardar inicialização do chain se ainda não estiver pronto
      if (!this.chain) {
        await this.initializeChain();
      }

      // Buscar documentos relevantes primeiro (para obter as fontes)
      const relevantDocs = await this.vectorStore.similaritySearch(question, 5);

      // Executar chain
      const answer = await this.chain.invoke(question);

      // Extrair documentos fonte dos documentos relevantes
      const sources = relevantDocs.map((doc: any) => ({
        document_id: doc.metadata?.document_id || "",
        titulo: doc.metadata?.titulo || "Documento desconhecido",
        chunk_index: doc.metadata?.chunk_index || 0,
        score: doc.metadata?.score || 0,
        text: doc.pageContent || "",
      }));

      // Remover duplicatas por document_id
      const uniqueSources = sources.reduce(
        (acc: any[], source: any) => {
          const exists = acc.find(
            (s) => s.document_id === source.document_id
          );
          if (!exists) {
            acc.push(source);
          }
          return acc;
        },
        []
      );

      console.log(
        `✅ RAG concluído. Resposta gerada com ${uniqueSources.length} fonte(s)`
      );

      return {
        answer,
        sources: uniqueSources,
      };
    } catch (error: any) {
      console.error("Erro ao executar RAG:", error);
      throw new Error(`Falha ao executar RAG: ${error.message}`);
    }
  }

  /**
   * Verifica se o RAG está disponível (Qdrant tem documentos indexados)
   */
  async isAvailable(): Promise<boolean> {
    try {
      const collectionInfo = await this.qdrantClient.getCollectionInfo();
      const pointsCount = collectionInfo.points_count || 0;
      return pointsCount > 0;
    } catch (error) {
      console.error("Erro ao verificar disponibilidade do RAG:", error);
      return false;
    }
  }
}

