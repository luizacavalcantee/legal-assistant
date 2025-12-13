# Backend - Assistente Jurídico

API REST com Node.js, Express, TypeScript e Prisma 7, seguindo o padrão Controller-Service-Repository.

## 🚀 Setup

```bash
# 1. Criar .env
Copy-Item env.example.txt .env

# 2. Subir PostgreSQL
docker-compose up -d postgres

# 3. Instalar e configurar
npm install
npm run prisma:generate
npm run prisma:migrate

# 4. Iniciar servidor
npm run dev
```

## 📁 Estrutura do Projeto

```
src/
├── controllers/      # Controladores HTTP
│   └── DocumentController.ts
├── services/         # Lógica de negócio
│   └── DocumentService.ts
├── repositories/     # Acesso a dados
│   └── DocumentRepository.ts
├── routes/           # Definição de rotas
│   └── documentRoutes.ts
├── types/            # Tipos TypeScript
│   └── document.types.ts
├── lib/              # Bibliotecas/configurações
│   └── prisma.ts
└── server.ts         # Servidor principal
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

## 🗄️ Banco de Dados

### Modelo BaseDeConhecimento

- `id`: UUID (gerado automaticamente)
- `titulo`: String
- `caminho_arquivo`: String
- `status_indexacao`: Enum (PENDENTE, INDEXADO, ERRO)
- `criado_em`: DateTime

### Comandos Prisma

```bash
npm run prisma:generate    # Gerar cliente
npm run prisma:migrate      # Criar migração
npm run prisma:migrate:deploy  # Aplicar migrações (produção)
npm run prisma:studio       # Interface visual (porta 5555)
npm run prisma:reset        # Resetar banco
```

### Configuração do .env

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/assistente-db?schema=public"
PORT=3000
NODE_ENV=development
```

## 🔧 Tecnologias

- **Node.js** + **TypeScript**
- **Express** - Framework web
- **Prisma 7** - ORM com adaptador PostgreSQL
- **PostgreSQL** - Banco de dados
- **@prisma/adapter-pg** - Adaptador Prisma para PostgreSQL

## 📝 Scripts

- `npm run dev` - Desenvolvimento (hot reload)
- `npm run build` - Compilar TypeScript
- `npm start` - Produção
- `npm run setup` - Setup completo (instalar + gerar + migrar)
- `npm run prisma:*` - Comandos Prisma

## 🧪 Testando a API

### Com curl

```bash
# Criar documento
curl -X POST http://localhost:3000/documents \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Teste","caminho_arquivo":"/teste.pdf"}'

# Listar documentos
curl http://localhost:3000/documents

# Buscar por ID
curl http://localhost:3000/documents/{id}

# Atualizar
curl -X PUT http://localhost:3000/documents/{id} \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Atualizado"}'

# Deletar
curl -X DELETE http://localhost:3000/documents/{id}
```

## 🏗️ Arquitetura

O projeto segue o padrão **Controller-Service-Repository**:

- **Controller**: Recebe requisições HTTP e retorna respostas
- **Service**: Contém a lógica de negócio e validações
- **Repository**: Abstrai o acesso ao banco de dados (Prisma)

## ⚠️ Observações

- O `status_indexacao` é automaticamente definido como `PENDENTE` ao criar um documento
- Todos os endpoints retornam erros apropriados (400, 404, 500)
- A API está configurada com CORS habilitado
