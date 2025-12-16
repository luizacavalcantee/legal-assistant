# Guia de Deploy na Vercel

Este guia explica como fazer o deploy do frontend Vite/React na Vercel.

## Pré-requisitos

1. Conta na [Vercel](https://vercel.com)
2. Repositório Git (GitHub, GitLab ou Bitbucket)
3. Backend já deployado (ou URL do backend)

## Passo a Passo

### 1. Preparar o Repositório

Certifique-se de que seu código está no Git e no repositório remoto:

```bash
git add .
git commit -m "Preparar para deploy na Vercel"
git push origin main
```

### 2. Configurar Variáveis de Ambiente

Antes de fazer o deploy, você precisa configurar a URL da API do backend:

1. Acesse o projeto na Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione a variável:
   - **Name**: `VITE_API_URL`
   - **Value**: URL do seu backend (ex: `https://seu-backend.vercel.app` ou `https://api.seudominio.com`)
   - **Environments**: Production, Preview, Development

### 3. Deploy via Dashboard da Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **Add New Project**
3. Importe seu repositório Git
4. Configure o projeto:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend` (se o frontend estiver em uma subpasta)
   - **Build Command**: `npm run build` (já configurado no `vercel.json`)
   - **Output Directory**: `dist` (já configurado no `vercel.json`)
5. Adicione a variável de ambiente `VITE_API_URL`
6. Clique em **Deploy**

### 4. Deploy via CLI (Alternativa)

Se preferir usar a CLI:

```bash
# Instalar Vercel CLI
npm i -g vercel

# No diretório do frontend
cd frontend

# Fazer login
vercel login

# Deploy
vercel

# Para produção
vercel --prod
```

### 5. Configurar Domínio (Opcional)

1. No dashboard da Vercel, vá em **Settings** → **Domains**
2. Adicione seu domínio personalizado
3. Siga as instruções para configurar o DNS

## Estrutura de Arquivos

Os seguintes arquivos foram criados para facilitar o deploy:

- `vercel.json`: Configuração do Vercel
- `.env.example`: Exemplo de variáveis de ambiente
- `README_DEPLOY.md`: Este guia

## Configurações Importantes

### Roteamento SPA

O arquivo `vercel.json` já está configurado para redirecionar todas as rotas para `index.html`, permitindo que o React Router funcione corretamente.

### Cache de Assets

Os assets estáticos (CSS, JS, imagens) são configurados com cache longo para melhor performance.

### Variáveis de Ambiente

- **Desenvolvimento**: Use `.env.local` (não commitado)
- **Produção**: Configure na Vercel Dashboard

## Troubleshooting

### Erro: "Cannot find module"

- Verifique se todas as dependências estão no `package.json`
- Execute `npm install` localmente para testar

### Erro: "API URL not found"

- Verifique se a variável `VITE_API_URL` está configurada na Vercel
- Certifique-se de que o backend está acessível publicamente

### Erro: "404 on refresh"

- O `vercel.json` já está configurado para resolver isso
- Verifique se o arquivo está na raiz do projeto frontend

### Build falha

- Verifique os logs de build na Vercel
- Teste o build localmente: `npm run build`

## Próximos Passos

1. Configure CORS no backend para aceitar requisições do domínio da Vercel
2. Configure HTTPS no backend (se ainda não tiver)
3. Configure variáveis de ambiente no backend também

## Suporte

Para mais informações, consulte:
- [Documentação da Vercel](https://vercel.com/docs)
- [Documentação do Vite](https://vitejs.dev/guide/static-deploy.html)

