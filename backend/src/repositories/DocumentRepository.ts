import prisma from "../lib/prisma";
import { BaseDeConhecimento, StatusIndexacao } from "@prisma/client";

export class DocumentRepository {
  async create(data: {
    titulo: string;
    caminho_arquivo: string;
    status_indexacao?: StatusIndexacao;
    google_drive_file_id?: string;
    google_drive_view_link?: string;
  }): Promise<BaseDeConhecimento> {
    return await prisma.baseDeConhecimento.create({
      data: {
        titulo: data.titulo,
        caminho_arquivo: data.caminho_arquivo,
        status_indexacao: data.status_indexacao || StatusIndexacao.PENDENTE,
        google_drive_file_id: data.google_drive_file_id || null,
        google_drive_view_link: data.google_drive_view_link || null,
      },
    });
  }

  async findAll(): Promise<BaseDeConhecimento[]> {
    try {
      const documents = await prisma.baseDeConhecimento.findMany({
        orderBy: {
          criado_em: "desc",
        },
      });
      
      // Garantir que os campos do Google Drive existam (mesmo que null)
      return documents.map((doc: any) => ({
        ...doc,
        google_drive_file_id: doc.google_drive_file_id || null,
        google_drive_view_link: doc.google_drive_view_link || null,
      })) as BaseDeConhecimento[];
    } catch (error: any) {
      // Se o erro for relacionado a colunas que não existem, tentar query alternativa
      if (error.code === 'P2022' || error.message?.includes('does not exist') || error.meta?.column) {
        console.warn("⚠️  Colunas do Google Drive não existem ainda. Usando query alternativa...");
        try {
          // Tentar query raw que funciona mesmo sem as colunas
          const result = await prisma.$queryRaw<any[]>`
            SELECT 
              id,
              titulo,
              caminho_arquivo,
              status_indexacao,
              criado_em
            FROM base_de_conhecimento
            ORDER BY criado_em DESC
          `;
          // Adicionar campos do Google Drive como null
          return result.map((doc: any) => ({
            ...doc,
            google_drive_file_id: null,
            google_drive_view_link: null,
          })) as BaseDeConhecimento[];
        } catch (rawError: any) {
          console.error("❌ Erro na query alternativa:", rawError);
          throw error; // Re-lançar erro original
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<BaseDeConhecimento | null> {
    return await prisma.baseDeConhecimento.findUnique({
      where: { id },
    });
  }

  async update(
    id: string,
    data: {
      titulo?: string;
      caminho_arquivo?: string;
      status_indexacao?: StatusIndexacao;
      google_drive_file_id?: string;
      google_drive_view_link?: string;
    }
  ): Promise<BaseDeConhecimento> {
    return await prisma.baseDeConhecimento.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<BaseDeConhecimento> {
    return await prisma.baseDeConhecimento.delete({
      where: { id },
    });
  }
}

