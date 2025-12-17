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
    return await prisma.baseDeConhecimento.findMany({
      orderBy: {
        criado_em: "desc",
      },
    });
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

