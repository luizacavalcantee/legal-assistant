# Assistente Jurídico Inteligente

Projeto Full Stack TypeScript para um Assistente Jurídico Inteligente.

## 🚀 Início Rápido

### 1. Configurar Backend

```bash
cd backend
Copy-Item env.example.txt .env  # Windows
# cp env.example.txt .env      # Linux/Mac
```

### 2. Subir PostgreSQL com Docker

```bash
# Na raiz do projeto
docker-compose up -d postgres
```

### 3. Configurar Banco de Dados

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 4. Iniciar Servidores

```bash
# Backend
cd backend
npm run dev

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

## 📡 Endpoints

- **Backend:** http://localhost:3000
- **Frontend:** http://localhost:5173
- **Health Check:** http://localhost:3000/health

## 🗄️ Banco de Dados

**Credenciais Docker:**

- Host: `localhost:5432`
- Usuário: `postgres`
- Senha: `postgres`
- Banco: `assistente-db`

**Arquivo `.env` no backend:**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/assistente-db?schema=public"
PORT=3000
```

## 🔧 Comandos Úteis

```bash
# Docker
docker-compose up -d          # Subir serviços
docker-compose down            # Parar serviços
docker-compose logs -f         # Ver logs

# Prisma
npm run prisma:generate        # Gerar cliente
npm run prisma:migrate         # Criar migração
npm run prisma:studio          # Interface visual
```

## 🐛 Troubleshooting

**Container não inicia:**

```bash
docker-compose down -v
docker-compose up -d
```

**Erro de conexão:**

- Verifique se PostgreSQL está rodando: `docker ps`
- Confirme o `.env` está correto

## 🔧 Tecnologias

**Backend:** Node.js, TypeScript, Express, Prisma 7, PostgreSQL  
**Frontend:** React, TypeScript, Vite
