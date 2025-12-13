# 🤖 Assistente Jurídico Inteligente

Projeto Full Stack TypeScript para um Assistente Jurídico Inteligente com RAG (Retrieval-Augmented Generation), utilizando banco vetorial Qdrant para busca semântica em documentos jurídicos.

## 📋 Pré-requisitos

- **Node.js** 18+ e npm
- **Docker** e Docker Compose (para PostgreSQL e Qdrant)
- **API Key** do LLM (OpenRouter recomendado - gratuito) ou OpenAI

## 🚀 Instalação e Configuração

### 1. Clonar o Repositório

```bash
git clone <url-do-repositorio>
cd asistente-juridico
```

### 2. Configurar Backend

```bash
cd backend

# Copiar arquivo de exemplo de variáveis de ambiente
# Windows PowerShell:
Copy-Item env.example.txt .env

# Linux/Mac:
# cp env.example.txt .env
```

### 3. Configurar Variáveis de Ambiente

Edite o arquivo `backend/.env` e configure:

#### **Configuração Básica (Obrigatória)**

```env
# Database - Para desenvolvimento local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/assistente-db?schema=public"

# Server
PORT=3000
NODE_ENV=development
```

#### **Configuração de LLM (Obrigatória para Chat e Embeddings)**

**Opção 1: OpenRouter (Recomendado - Gratuito)**

```env
LLM_PROVIDER="openrouter"
OPENROUTER_API_KEY="sk-or-v1-sua-chave-aqui"  # Obtenha em: https://openrouter.ai/keys
LLM_MODEL="tngtech/deepseek-r1t-chimera:free"
```

**Opção 2: OpenAI (Pago)**

```env
LLM_PROVIDER="openai"
OPENAI_API_KEY="sk-sua-chave-aqui"  # Obtenha em: https://platform.openai.com/api-keys
LLM_MODEL="gpt-3.5-turbo"
```

#### **Configuração de RAG (Obrigatória para Indexação de Documentos)**

```env
# Qdrant - Banco Vetorial
QDRANT_URL="http://localhost:6333"
QDRANT_COLLECTION_NAME="knowledge_base"

# Embeddings
EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_DIMENSION="1536"

# Chunking
CHUNK_SIZE="1000"
CHUNK_OVERLAP="200"
```

> 💡 **Dica:** Veja o arquivo `backend/env.example.txt` para todas as opções disponíveis.

### 4. Instalar Dependências

```bash
# Backend
cd backend
npm install

# Frontend (em outro terminal)
cd frontend
npm install
```

### 5. Subir Serviços com Docker

```bash
# Na raiz do projeto
docker-compose up -d postgres qdrant
```

Isso iniciará:

- **PostgreSQL** na porta `5432`
- **Qdrant** nas portas `6333` (HTTP) e `6334` (gRPC)

### 6. Configurar Banco de Dados

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### 7. Iniciar Servidores

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

## 🌐 Endpoints e URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Swagger/API Docs:** http://localhost:3000/api-docs
- **Health Check:** http://localhost:3000/health
- **Qdrant Dashboard:** http://localhost:6333/dashboard

## 🗄️ Banco de Dados

### PostgreSQL (Docker)

**Credenciais:**

- Host: `localhost:5432`
- Usuário: `postgres`
- Senha: `postgres`
- Banco: `assistente-db`

**Comandos úteis:**

```bash
# Acessar Prisma Studio (interface visual)
cd backend
npm run prisma:studio

# Resetar banco (cuidado: apaga todos os dados)
npm run prisma:reset
```

### Qdrant (Banco Vetorial)

**URL:** `http://localhost:6333`

**Verificar se está rodando:**

```bash
curl http://localhost:6333/
# Deve retornar: {"title":"qdrant - vector search engine","version":"..."}
```

## 📚 Funcionalidades

### ✅ Implementado

- **CRUD de Documentos:** Gerenciamento de metadados de documentos jurídicos
- **Upload de Arquivos:** Suporte para PDF, TXT, MD, DOCX
- **Visualização de Documentos:** Abertura de documentos no navegador
- **Chat com LLM:** Interface de chat com modelos de linguagem
- **RAG (Retrieval-Augmented Generation):** ✅ **FUNCIONANDO**
  - ✅ Indexação vetorial de documentos (Qdrant)
  - ✅ Chunking automático de textos (PDF, TXT, MD)
  - ✅ Geração de embeddings (OpenAI/OpenRouter)
  - ✅ Processamento otimizado para grandes documentos
  - ✅ Status de indexação em tempo real (PENDENTE → INDEXADO/ERRO)
  - 🚧 Busca semântica no chat (próxima etapa)

### 🚧 Em Desenvolvimento

- Integração do RAG no chat (busca de contexto antes de responder)
- Histórico de conversas persistente
- Autenticação e autorização
- Reindexação automática de documentos atualizados

## 🔧 Comandos Úteis

### Docker

```bash
# Subir todos os serviços
docker-compose up -d

# Subir apenas PostgreSQL e Qdrant
docker-compose up -d postgres qdrant

# Parar serviços
docker-compose down

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f qdrant
docker-compose logs -f postgres

# Parar e remover volumes (apaga dados)
docker-compose down -v
```

### Prisma

```bash
cd backend

# Gerar cliente Prisma
npm run prisma:generate

# Criar nova migração
npm run prisma:migrate

# Aplicar migrações (produção)
npm run prisma:migrate:deploy

# Abrir Prisma Studio
npm run prisma:studio

# Resetar banco (desenvolvimento)
npm run prisma:reset
```

### Desenvolvimento

```bash
# Backend com hot-reload
cd backend
npm run dev

# Frontend com hot-reload
cd frontend
npm run dev

# Build de produção
cd backend && npm run build
cd frontend && npm run build
```

## 🐛 Troubleshooting

### Problema: Porta 3000 já está em uso

```bash
# Windows PowerShell - Encontrar e encerrar processo
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Stop-Process -Id <PID> -Force

# Ou parar container Docker
docker stop assistente-backend
```

### Problema: Qdrant não conecta

1. Verificar se o container está rodando:

   ```bash
   docker ps --filter name=assistente-qdrant
   ```

2. Verificar URL no `.env`:

   - **Local:** `QDRANT_URL=http://localhost:6333`
   - **Docker:** `QDRANT_URL=http://qdrant:6333`

3. Reiniciar Qdrant:
   ```bash
   docker-compose restart qdrant
   ```

### Problema: Erro de API Key do LLM

- **OpenRouter:** Verifique se a chave começa com `sk-or-v1-`
- **OpenAI:** Verifique se a chave começa com `sk-`
- Certifique-se de que não há espaços extras na chave
- Verifique se a variável está no arquivo `backend/.env` (não na raiz)

### Problema: Erro de memória ao processar documentos

O sistema já está otimizado com:

- Processamento em lotes (20 chunks por vez)
- Limite de 1000 chunks por documento
- Limite de 30MB por arquivo PDF
- Garbage collection automático

Se ainda ocorrer, aumente a memória do Node.js:

```bash
# No backend/package.json, o script dev já inclui:
NODE_OPTIONS=--max-old-space-size=8192
```

### Problema: Banco de dados não conecta

1. Verificar se PostgreSQL está rodando:

   ```bash
   docker ps --filter name=assistente-postgres
   ```

2. Verificar `DATABASE_URL` no `.env`:

   - **Docker:** `postgresql://postgres:postgres@postgres:5432/...`
   - **Local:** `postgresql://postgres:postgres@localhost:5432/...`

3. Recriar banco:
   ```bash
   docker-compose down -v
   docker-compose up -d postgres
   cd backend && npm run prisma:migrate
   ```

## 📖 Documentação Adicional

- **Etapa 6 - RAG e Banco Vetorial:** [`DOCUMENTACAO_ETAPA_6_RAG.md`](./DOCUMENTACAO_ETAPA_6_RAG.md) - Documentação completa da implementação RAG
- **Swagger/API Docs:** http://localhost:3000/api-docs - Documentação interativa da API

## 🛠️ Tecnologias

### Backend

- **Runtime:** Node.js 18+
- **Linguagem:** TypeScript
- **Framework:** Express.js
- **ORM:** Prisma 7
- **Banco de Dados:** PostgreSQL 15
- **Banco Vetorial:** Qdrant
- **LLM:** OpenAI SDK (compatível com OpenRouter)
- **Upload:** Multer
- **PDF:** pdf-parse
- **Documentação:** Swagger/OpenAPI

### Frontend

- **Framework:** React 18
- **Linguagem:** TypeScript
- **Build Tool:** Vite
- **Roteamento:** React Router
- **HTTP Client:** Axios
- **UI Components:** shadcn/ui (Radix UI + Tailwind CSS)
- **Ícones:** Lucide React

### DevOps

- **Containerização:** Docker & Docker Compose
- **Versionamento:** Git

## 📝 Estrutura do Projeto

```
asistente-juridico/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Controladores HTTP
│   │   ├── services/        # Lógica de negócio
│   │   ├── repositories/    # Acesso a dados
│   │   ├── routes/          # Rotas da API
│   │   ├── lib/             # Bibliotecas (Prisma, Qdrant)
│   │   ├── middleware/      # Middlewares (upload, etc.)
│   │   └── server.ts        # Servidor Express
│   ├── prisma/
│   │   └── schema.prisma    # Schema do banco
│   ├── .env                 # Variáveis de ambiente
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── pages/           # Páginas
│   │   ├── services/        # Serviços API
│   │   └── App.tsx          # App principal
│   └── package.json
├── docker-compose.yml       # Configuração Docker
└── README.md
```

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC.

---

**Desenvolvido com ❤️ para auxiliar profissionais do direito**
