# 🤖 Assistente Jurídico Inteligente

Assistente jurídico com IA que utiliza RAG (Retrieval-Augmented Generation) para responder perguntas baseadas em documentos jurídicos indexados. Inclui integração com portal e-SAJ para busca e resumo de processos judiciais.

## 📋 Pré-requisitos

- **Docker** e **Docker Compose** (recomendado para rodar tudo)
- **Node.js** 18+ e npm (opcional, apenas para desenvolvimento local)
- **API Key** do LLM (OpenRouter gratuito ou OpenAI)

## 🚀 Instalação Rápida com Docker

### 1. Clonar o Repositório

```bash
git clone <url-do-repositorio>
cd asistente-juridico
```

### 2. Configurar Variáveis de Ambiente

Crie o arquivo `backend/.env` baseado no exemplo:

```bash
# Windows PowerShell
Copy-Item backend/env.example backend/.env

# Linux/Mac
cp backend/env.example backend/.env
```

Edite `backend/.env` e configure as variáveis obrigatórias (veja seção [Configuração](#-configuração-de-variáveis-de-ambiente) abaixo).

### 3. Rodar com Docker Compose

```bash
# Subir todos os serviços (PostgreSQL, Qdrant, Backend, Frontend)
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar todos os serviços
docker-compose down
```

A aplicação estará disponível em:

- **Frontend:** http://localhost
- **Backend API:** http://localhost:3000
- **Swagger Docs:** http://localhost:3000/api-docs
- **Qdrant Dashboard:** http://localhost:6333/dashboard

## 🛠️ Desenvolvimento Local (sem Docker)

### 1. Instalar Dependências

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Subir Serviços com Docker

```bash
# Na raiz do projeto, subir apenas PostgreSQL e Qdrant
docker-compose up -d postgres qdrant
```

### 3. Configurar Banco de Dados

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### 4. Rodar Backend e Frontend

**Terminal 1 - Backend:**

```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

URLs:

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3000

## ⚙️ Configuração de Variáveis de Ambiente

### Variáveis Obrigatórias

Crie `backend/.env` com:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/assistente-db?schema=public"
# Para desenvolvimento local: postgresql://postgres:postgres@localhost:5432/assistente-db?schema=public

# Server
PORT=3000
NODE_ENV=development

# LLM Provider (escolha uma opção)
LLM_PROVIDER="openrouter"  # ou "openai"
OPENROUTER_API_KEY="sk-or-v1-..."  # Obtenha em: https://openrouter.ai/keys
LLM_MODEL="tngtech/deepseek-r1t-chimera:free"

# RAG - Banco Vetorial
QDRANT_URL="http://qdrant:6333"  # Para Docker: http://qdrant:6333 | Local: http://localhost:6333
QDRANT_COLLECTION_NAME="knowledge_base"
EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_DIMENSION="1536"
```

### Variáveis Opcionais

```env
# Google Drive (opcional - para armazenamento na nuvem)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'  # JSON como string
GOOGLE_DRIVE_FOLDER_ID="seu-folder-id"

# e-SAJ (opcional - para funcionalidades de processo)
ESAJ_URL="https://esaj.tjsp.jus.br/cpopg/open.do"
PUPPETEER_HEADLESS="true"

# Chunking (opcional)
CHUNK_SIZE="1000"
CHUNK_OVERLAP="200"
```

> 💡 **Dica:** Veja `backend/env.example` para todas as opções disponíveis.

## 📖 Principais Fluxos

### 1. Indexar Documentos na Base de Conhecimento

1. Acesse **"Gestão da Base de Conhecimento"** no menu
2. Clique em **"Novo Documento"**
3. Faça upload de um arquivo (PDF, TXT, MD)
4. Aguarde o status mudar para **"Indexado"** (atualização automática)
5. O documento estará disponível para consultas via RAG

### 2. Chat com RAG

1. Acesse a página de **Chat**
2. Faça perguntas sobre os documentos indexados
3. A IA buscará informações relevantes e responderá com base nos documentos
4. As fontes utilizadas aparecem abaixo da resposta

### 3. Buscar e Resumir Processo no e-SAJ

1. No chat, digite: **"Resuma o processo 10008220620258260451"**
2. O sistema irá:
   - Buscar o processo no portal e-SAJ
   - Extrair movimentações
   - Gerar resumo estruturado com LLM
3. O resumo inclui: Status, Fase, Decisões Relevantes, Partes Envolvidas

### 4. Download de Documento do e-SAJ

1. No chat, digite: **"Baixe a sentença do processo 10008220620258260451"**
2. O sistema buscará o processo e baixará o documento solicitado
3. O link de download aparecerá na resposta

## 🏗️ Arquitetura

### Stack Tecnológica

**Backend:**

- Node.js + TypeScript + Express
- Prisma ORM + PostgreSQL
- Qdrant (banco vetorial)
- LangChain.js (RAG orchestration)
- Puppeteer (web scraping e-SAJ)
- OpenAI SDK (compatível com OpenRouter)

**Frontend:**

- React 18 + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- React Router
- React-Toastify

### Decisões Técnicas

1. **RAG com Qdrant:** Busca semântica eficiente para grandes volumes de documentos
2. **Chunking Inteligente:** Divisão de documentos em chunks com sobreposição para manter contexto
3. **Arquitetura Modular e-SAJ:** Serviços especializados (busca, download, extração) para facilitar manutenção
4. **Progresso em Tempo Real:** Sistema de callbacks para feedback ao usuário durante operações longas
5. **Containerização:** Docker Compose para facilitar deploy e desenvolvimento

### Estrutura de Pastas

```
asistente-juridico/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Controladores HTTP
│   │   ├── services/         # Lógica de negócio
│   │   │   └── esaj/         # Módulos e-SAJ especializados
│   │   ├── repositories/     # Acesso a dados
│   │   ├── routes/          # Rotas da API
│   │   └── lib/             # Bibliotecas (Qdrant, LangChain)
│   ├── prisma/              # Schema e migrações
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── pages/           # Páginas
│   │   └── services/        # Cliente API
│   └── Dockerfile
└── docker-compose.yml       # Orquestração de serviços
```

## 🔧 Comandos Úteis

### Docker

```bash
# Subir todos os serviços
docker-compose up -d

# Subir apenas serviços de infra (PostgreSQL + Qdrant)
docker-compose up -d postgres qdrant

# Ver logs
docker-compose logs -f [serviço]

# Parar serviços
docker-compose down

# Rebuild e subir
docker-compose up -d --build
```

### Prisma

```bash
cd backend

# Gerar cliente Prisma
npm run prisma:generate

# Criar migração
npm run prisma:migrate

# Aplicar migrações (produção)
npm run prisma:migrate:deploy

# Prisma Studio (interface visual)
npm run prisma:studio
```

### Desenvolvimento

```bash
# Backend com hot-reload
cd backend && npm run dev

# Frontend com hot-reload
cd frontend && npm run dev

# Build de produção
cd backend && npm run build
cd frontend && npm run build
```

## 🐛 Troubleshooting

### Porta já em uso

```bash
# Parar containers Docker
docker-compose down

# Ou matar processo na porta (Linux/Mac)
lsof -ti:3000 | xargs kill -9
```

### Qdrant não conecta

Verifique `QDRANT_URL` no `.env`:

- **Docker:** `http://qdrant:6333`
- **Local:** `http://localhost:6333`

### Erro de API Key

- **OpenRouter:** Chave deve começar com `sk-or-v1-`
- **OpenAI:** Chave deve começar com `sk-`
- Verifique se não há espaços extras

### Chat não usa RAG

1. Verifique se há documentos indexados (status "Indexado")
2. Verifique se Qdrant está rodando: `docker ps --filter name=qdrant`
3. Verifique logs do backend para mensagens de erro

## 📚 Documentação Adicional

- **Swagger/API Docs:** http://localhost:3000/api-docs
- **Qdrant Dashboard:** http://localhost:6333/dashboard
- **Prisma Studio:** `npm run prisma:studio` (porta 5555)

## 📄 Licença

ISC

---