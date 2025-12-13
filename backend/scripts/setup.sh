#!/bin/bash

echo "🚀 Configurando o backend do Assistente Jurídico..."

# Verificar se o .env existe
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp env.example.txt .env
    echo "✅ Arquivo .env criado. Por favor, verifique as configurações."
else
    echo "✅ Arquivo .env já existe."
fi

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Gerar cliente Prisma
echo "🔧 Gerando cliente Prisma..."
npm run prisma:generate

# Aguardar PostgreSQL estar pronto
echo "⏳ Aguardando PostgreSQL estar pronto..."
sleep 5

# Executar migrações
echo "🗄️ Executando migrações do banco de dados..."
npm run prisma:migrate

echo "✅ Setup concluído!"
echo "🚀 Execute 'npm run dev' para iniciar o servidor."

