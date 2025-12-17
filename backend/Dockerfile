FROM node:20-alpine

WORKDIR /app

# Instalar dependências do sistema para Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Configurar Puppeteer para usar Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

# Instalar dependências
RUN npm ci --only=production=false

# Copiar o resto dos arquivos
COPY . .

# Criar diretórios necessários
RUN mkdir -p documents downloads_esaj .cache/puppeteer

# Gerar Prisma Client com DATABASE_URL dummy
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npm run prisma:generate

# Build da aplicação
RUN npm run build

# Expor a porta
EXPOSE 3000

# Comando padrão
CMD ["npm", "start"]

