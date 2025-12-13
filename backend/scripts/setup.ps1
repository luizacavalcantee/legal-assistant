# Script de setup para Windows PowerShell
Write-Host "🚀 Configurando o backend do Assistente Jurídico..." -ForegroundColor Cyan

# Verificar se o .env existe
if (-not (Test-Path .env)) {
    Write-Host "📝 Criando arquivo .env..." -ForegroundColor Yellow
    Copy-Item env.example.txt .env
    Write-Host "✅ Arquivo .env criado. Por favor, verifique as configurações." -ForegroundColor Green
} else {
    Write-Host "✅ Arquivo .env já existe." -ForegroundColor Green
}

# Instalar dependências
Write-Host "📦 Instalando dependências..." -ForegroundColor Cyan
npm install

# Gerar cliente Prisma
Write-Host "🔧 Gerando cliente Prisma..." -ForegroundColor Cyan
npm run prisma:generate

# Aguardar PostgreSQL estar pronto
Write-Host "⏳ Aguardando PostgreSQL estar pronto..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Executar migrações
Write-Host "🗄️ Executando migrações do banco de dados..." -ForegroundColor Cyan
npm run prisma:migrate

Write-Host "✅ Setup concluído!" -ForegroundColor Green
Write-Host "🚀 Execute 'npm run dev' para iniciar o servidor." -ForegroundColor Cyan

