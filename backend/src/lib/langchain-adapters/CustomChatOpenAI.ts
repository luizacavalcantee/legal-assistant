import { ChatOpenAI } from "@langchain/openai";
import { LLMService } from "../../services/LLMService";
import dotenv from "dotenv";

dotenv.config();

/**
 * Adaptador para usar LLMService como ChatOpenAI do LangChain
 * Cria uma instância do ChatOpenAI configurada com as mesmas opções do LLMService
 */
export function createCustomChatOpenAI(llmService: LLMService): ChatOpenAI {
  const provider = (process.env.LLM_PROVIDER || "openrouter").toLowerCase();
  const model = process.env.LLM_MODEL || "tngtech/deepseek-r1t-chimera:free";
  
  let apiKey: string | undefined;
  if (provider === "openrouter") {
    apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  } else {
    apiKey = process.env.OPENAI_API_KEY;
  }

  const baseURL =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : undefined;

  const defaultHeaders: Record<string, string> = {};
  if (provider === "openrouter") {
    defaultHeaders["HTTP-Referer"] =
      process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3000";
    defaultHeaders["X-Title"] =
      process.env.OPENROUTER_SITE_NAME || "Assistente Jurídico Inteligente";
  }

  return new ChatOpenAI({
    modelName: model,
    openAIApiKey: apiKey || "sk-or-v1-placeholder",
    configuration: {
      baseURL: baseURL,
      defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
    },
    temperature: 0.7,
  });
}

