FROM node:20-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o resto dos arquivos
COPY . .

# Expor a porta
EXPOSE 3000

# Comando padrão (pode ser sobrescrito no docker-compose)
CMD ["npm", "run", "dev"]

