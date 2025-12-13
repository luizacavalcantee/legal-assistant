# Backend - Assistente Jurídico

API REST com Node.js, Express, TypeScript e Prisma 7.

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

## 📡 Endpoints

**GET /health** - Status do servidor

## 🗄️ Prisma

```bash
npm run prisma:generate    # Gerar cliente
npm run prisma:migrate      # Criar migração
npm run prisma:studio       # Interface visual
npm run prisma:reset        # Resetar banco
```

## 📝 Scripts

- `npm run dev` - Desenvolvimento
- `npm run build` - Compilar
- `npm start` - Produção
- `npm run prisma:*` - Comandos Prisma
