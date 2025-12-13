# Backend - Assistente Jurídico Inteligente

API REST com Node.js, Express, TypeScript e Prisma 7, seguindo o padrão Controller-Service-Repository.

## 🚀 Quick Start

```bash
# 1. Criar .env a partir do exemplo
Copy-Item env.example.txt .env
# Edite o .env e configure as variáveis necessárias

# 2. Subir PostgreSQL (Docker)
docker-compose up -d postgres

# 3. Instalar dependências e configurar banco
npm install
npm run prisma:generate
npm run prisma:migrate

# 4. Iniciar servidor de desenvolvimento
npm run dev
```

O servidor estará disponível em: http://localhost:3000

## 📁 Estrutura do Projeto

```
backend/
├── src/
│   ├── config/              # Configurações
│   │   └── swagger.ts       # Documentação Swagger/OpenAPI
│   ├── controllers/         # Controladores HTTP
│   │   ├── DocumentController.ts
│   │   └── ChatController.ts
│   ├── services/            # Lógica de negócio
│   │   ├── DocumentService.ts
│   │   └── LLMService.ts    # Integração com LLM (OpenRouter/OpenAI)
│   ├── repositories/        # Acesso a dados
│   │   └── DocumentRepository.ts
│   ├── routes/              # Definição de rotas
│   │   ├── documentRoutes.ts
│   │   └── chatRoutes.ts
│   ├── types/               # Tipos TypeScript
│   │   ├── document.types.ts
│   │   └── chat.types.ts
│   ├── lib/                 # Bibliotecas/configurações
│   │   └── prisma.ts        # Cliente Prisma
│   ├── global.d.ts          # Declarações de tipos globais
│   └── server.ts            # Servidor principal
├── prisma/
│   ├── schema.prisma        # Schema do banco de dados
│   └── migrations/          # Migrações do banco
├── env.example.txt          # Exemplo de variáveis de ambiente
├── README.md                # Este arquivo
├── SETUP_OPENROUTER.md      # Guia de configuração do OpenRouter
└── TROUBLESHOOTING_LLM.md   # Solução de problemas com LLM
```

## 📚 Documentação da API

A documentação interativa da API está disponível via Swagger UI:

**Swagger UI:** http://localhost:3000/api-docs

Acesse para ver todos os endpoints, testar requisições e ver exemplos de request/response.

## 📡 Endpoints da API

### Health Check

**GET /health** - Status do servidor

```json
{
  "status": "OK",
  "message": "Servidor do Assistente Jurídico está funcionando",
  "timestamp": "2025-12-12T20:00:00.000Z"
}
```

### Documentos (CRUD)

#### POST /documents

Criar novo documento (US-BC-01)

**Request:**
```json
{
  "titulo": "Lei 13.105/2015",
  "caminho_arquivo": "/documentos/lei-13105-2015.pdf"
}
```

**Response (201):**
```json
{
  "message": "Documento criado com sucesso",
  "data": {
    "id": "uuid",
    "titulo": "Lei 13.105/2015",
    "caminho_arquivo": "/documentos/lei-13105-2015.pdf",
    "status_indexacao": "PENDENTE",
    "criado_em": "2025-12-12T20:00:00.000Z"
  }
}
```

#### GET /documents

Listar todos os documentos (US-BC-02)

**Response (200):**
```json
{
  "message": "Documentos listados com sucesso",
  "data": [...],
  "total": 10
}
```

#### GET /documents/:id

Buscar documento por ID

**Response (200):**
```json
{
  "message": "Documento encontrado",
  "data": { ... }
}
```

#### PUT /documents/:id

Atualizar documento (US-BC-03)

**Request:**
```json
{
  "titulo": "Lei 13.105/2015 - Atualizada",
  "status_indexacao": "INDEXADO"
}
```

**Response (200):**
```json
{
  "message": "Documento atualizado com sucesso",
  "data": { ... }
}
```

#### DELETE /documents/:id

Remover documento (US-BC-04)

**Response (200):**
```json
{
  "message": "Documento removido com sucesso"
}
```

### Chat com LLM

#### POST /chat/message

Enviar mensagem para o assistente jurídico (LLM)

**Request:**
```json
{
  "message": "Qual é a definição de Habeas Corpus?"
}
```

**Response (200):**
```json
{
  "message": "Qual é a definição de Habeas Corpus?",
  "response": "Habeas Corpus é um remédio constitucional que garante o direito de liberdade...",
  "timestamp": "2025-12-13T10:30:00.000Z"
}
```

**Erros:**
- **400:** Mensagem não fornecida ou inválida
- **401:** Falha na autenticação (API key inválida)
- **429:** Rate limit ou quota excedida
- **502:** Erro na comunicação com o serviço de IA
- **500:** Erro interno do servidor

## 🗄️ Banco de Dados

### Modelo BaseDeConhecimento

- `id`: UUID (gerado automaticamente)
- `titulo`: String
- `caminho_arquivo`: String
- `status_indexacao`: Enum (PENDENTE, INDEXADO, ERRO)
- `criado_em`: DateTime

### Comandos Prisma

```bash
npm run prisma:generate      # Gerar cliente Prisma
npm run prisma:migrate       # Criar e aplicar migração
npm run prisma:migrate:deploy  # Aplicar migrações (produção)
npm run prisma:studio        # Interface visual (porta 5555)
npm run prisma:reset         # Resetar banco (cuidado!)
```

## ⚙️ Configuração do .env

### Variáveis Obrigatórias

```env
# Banco de Dados
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/assistente-db?schema=public"

# Servidor
PORT=3000
NODE_ENV=development
```

### Configuração do LLM

O projeto suporta dois provedores de LLM:

#### Opção 1: OpenRouter (GRATUITO - Recomendado) ⭐

```env
LLM_PROVIDER="openrouter"
LLM_MODEL="tngtech/deepseek-r1t-chimera:free"

# API Key (opcional, mas recomendado para melhor rate limiting)
OPENROUTER_API_KEY="sk-or-v1-..."
# ou use OPENAI_API_KEY (ambos funcionam)
OPENAI_API_KEY="sk-or-v1-..."

# Headers opcionais (recomendados para rankings)
OPENROUTER_HTTP_REFERER="http://localhost:3000"
OPENROUTER_SITE_NAME="Assistente Jurídico Inteligente"
```

**Vantagens:**
- ✅ 100% Gratuito (muitos modelos)
- ✅ Funciona sem API key (com rate limits menores)
- ✅ Múltiplos modelos disponíveis (Llama, Gemini, DeepSeek, etc.)
- ✅ API key gratuita disponível

**Modelos gratuitos recomendados:**
- `tngtech/deepseek-r1t-chimera:free` - DeepSeek R1T Chimera
- `meta-llama/llama-3.3-70b-instruct:free` - Llama 3.3 70B
- `google/gemini-flash-1.5:free` - Gemini Flash 1.5
- `microsoft/phi-3.5-mini-128k-instruct:free` - Phi-3.5 Mini

**📖 Documentação completa:** Veja `SETUP_OPENROUTER.md`

#### Opção 2: OpenAI (Pago)

```env
LLM_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
LLM_MODEL="gpt-3.5-turbo"  # ou "gpt-4", "gpt-4-turbo", etc.
```

**Nota:** Requer API key válida com créditos. Obtenha em: https://platform.openai.com/api-keys

## 🔧 Tecnologias

- **Node.js** + **TypeScript** - Runtime e linguagem
- **Express** - Framework web
- **Prisma 7** - ORM com adaptador PostgreSQL
- **PostgreSQL** - Banco de dados relacional
- **@prisma/adapter-pg** - Adaptador Prisma para PostgreSQL
- **OpenAI SDK** - Integração com modelos de linguagem (compatível com OpenRouter)
- **Swagger/OpenAPI** - Documentação interativa da API
- **CORS** - Cross-Origin Resource Sharing

## 📝 Scripts NPM

```bash
npm run dev              # Desenvolvimento com hot reload
npm run build            # Compilar TypeScript para JavaScript
npm start                # Executar versão compilada (produção)
npm run setup            # Setup completo (install + generate + migrate)
npm run prisma:generate  # Gerar cliente Prisma
npm run prisma:migrate   # Criar e aplicar migração
npm run prisma:studio    # Abrir Prisma Studio (porta 5555)
npm run prisma:reset     # Resetar banco de dados
```

## 🧪 Testando a API

### Com curl

```bash
# Health Check
curl http://localhost:3000/health

# Criar documento
curl -X POST http://localhost:3000/documents \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Teste","caminho_arquivo":"/teste.pdf"}'

# Listar documentos
curl http://localhost:3000/documents

# Buscar por ID
curl http://localhost:3000/documents/{id}

# Atualizar documento
curl -X PUT http://localhost:3000/documents/{id} \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Atualizado","status_indexacao":"INDEXADO"}'

# Deletar documento
curl -X DELETE http://localhost:3000/documents/{id}

# Chat com LLM
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message":"Qual é a definição de Habeas Corpus?"}'
```

### Com Swagger UI

1. Acesse: http://localhost:3000/api-docs
2. Clique em qualquer endpoint
3. Clique em "Try it out"
4. Preencha os dados e clique em "Execute"

## 🏗️ Arquitetura

O projeto segue o padrão **Controller-Service-Repository**:

```
Request → Controller → Service → Repository → Database
                ↓
            Response
```

- **Controller**: Recebe requisições HTTP, valida entrada, chama Service, retorna resposta
- **Service**: Contém a lógica de negócio, validações e transformações
- **Repository**: Abstrai o acesso ao banco de dados (Prisma)

### Fluxo de uma Requisição

1. **Route** → Define o endpoint e método HTTP
2. **Controller** → Recebe a requisição, extrai dados, valida
3. **Service** → Processa a lógica de negócio
4. **Repository** → Interage com o banco via Prisma
5. **Response** → Retorna JSON formatado

## 📖 Documentação Adicional

- **SETUP_OPENROUTER.md** - Guia completo de configuração do OpenRouter (modelos gratuitos)
- **TROUBLESHOOTING_LLM.md** - Solução de problemas comuns do LLM
- **env.example.txt** - Exemplo completo de variáveis de ambiente

## ⚠️ Observações Importantes

### Banco de Dados
- O `status_indexacao` é automaticamente definido como `PENDENTE` ao criar um documento
- Todos os endpoints retornam erros apropriados (400, 404, 500)
- A API está configurada com CORS habilitado

### LLM (Chat)
- **Recomendado:** Use OpenRouter com modelos gratuitos para desenvolvimento
- **API Key:** OpenRouter aceita `OPENROUTER_API_KEY` ou `OPENAI_API_KEY` quando `LLM_PROVIDER="openrouter"`
- **Modelo padrão:** `tngtech/deepseek-r1t-chimera:free` (OpenRouter)
- **System Prompt:** Configurado no `LLMService.ts` como "assistente jurídico inteligente"
- **Rate Limits:** Sem API key tem limites menores, com API key tem limites maiores

### Segurança
- **NUNCA** commite o arquivo `.env` no Git
- Use variáveis de ambiente diferentes para desenvolvimento e produção
- Mantenha suas API keys seguras

## 🐛 Troubleshooting

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "DATABASE_URL não está definida"
Verifique se o arquivo `.env` existe e tem a variável `DATABASE_URL` configurada.

### Erro: "401 User not found" (OpenRouter)
Certifique-se de usar uma API key válida do OpenRouter (começa com `sk-or-v1-`).
Obtenha em: https://openrouter.ai/keys

### Erro: "429 Quota exceeded"
- **OpenRouter:** Aguarde alguns minutos ou obtenha uma API key gratuita
- **OpenAI:** Adicione créditos em: https://platform.openai.com/account/billing

Veja mais em: `TROUBLESHOOTING_LLM.md`

## 📊 Status dos Endpoints

| Endpoint | Método | Status | Descrição |
|----------|--------|--------|-----------|
| `/health` | GET | ✅ | Health check |
| `/documents` | POST | ✅ | Criar documento |
| `/documents` | GET | ✅ | Listar documentos |
| `/documents/:id` | GET | ✅ | Buscar documento |
| `/documents/:id` | PUT | ✅ | Atualizar documento |
| `/documents/:id` | DELETE | ✅ | Remover documento |
| `/chat/message` | POST | ✅ | Chat com LLM |
| `/api-docs` | GET | ✅ | Swagger UI |

## 🔗 Links Úteis

- **OpenRouter:** https://openrouter.ai
- **OpenRouter Models:** https://openrouter.ai/models
- **OpenRouter API Keys:** https://openrouter.ai/keys
- **OpenAI API:** https://platform.openai.com
- **Prisma Docs:** https://www.prisma.io/docs
- **Swagger UI:** http://localhost:3000/api-docs

---

**Versão:** 1.0.0  
**Última atualização:** Dezembro 2025
