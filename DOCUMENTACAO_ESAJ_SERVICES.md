# Documentação - Serviços e-SAJ

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura Modular](#arquitetura-modular)
3. [Estrutura de Arquivos](#estrutura-de-arquivos)
4. [Módulos Detalhados](#módulos-detalhados)
5. [Fluxo de Execução](#fluxo-de-execução)
6. [Uso e Exemplos](#uso-e-exemplos)
7. [Otimizações](#otimizações)

---

## 🎯 Visão Geral

O sistema de serviços e-SAJ é responsável por interagir com o portal público de consulta processual do Tribunal de Justiça de São Paulo (e-SAJ), permitindo:

- **Buscar processos** pelo número de protocolo
- **Encontrar documentos** na lista de movimentações
- **Extrair URLs de PDFs** de documentos específicos
- **Extrair movimentações** e informações do processo
- **Extrair texto** de documentos PDF

### Características Principais

- ✅ **Arquitetura Modular**: Cada funcionalidade em um módulo separado
- ✅ **Reutilização de Recursos**: Navegador Puppeteer compartilhado entre módulos
- ✅ **Otimização de Performance**: Reutilização de páginas já abertas
- ✅ **Tratamento de Erros**: Tratamento robusto de erros em cada etapa
- ✅ **Separação de Responsabilidades**: Cada módulo tem uma função específica

---

## 🏗️ Arquitetura Modular

A arquitetura foi projetada seguindo o princípio de **Separação de Responsabilidades (SRP)**, onde cada módulo é responsável por uma etapa específica do web scraping:

```
eSAJService (Orquestrador Principal)
    │
    ├── eSAJBase (Classe Base)
    │   └── Gerencia navegador e configurações compartilhadas
    │
    ├── eSAJProcessSearcher
    │   └── Busca processos no e-SAJ
    │
    ├── eSAJDocumentFinder
    │   └── Encontra documentos na lista de movimentações
    │
    ├── eSAJDocumentDownloader
    │   └── Extrai URLs de PDFs
    │
    ├── eSAJMovementsExtractor
    │   └── Extrai movimentações do processo
    │
    └── eSAJDocumentTextExtractor
        └── Extrai texto de documentos PDF
```

---

## 📁 Estrutura de Arquivos

```
backend/src/services/
├── eSAJService.ts                    # Serviço principal (orquestrador)
└── esaj/
    ├── eSAJBase.ts                   # Classe base com navegador e configurações
    ├── eSAJProcessSearcher.ts        # Busca de processos
    ├── eSAJDocumentFinder.ts         # Encontrar documentos na lista
    ├── eSAJDocumentDownloader.ts     # Download/extração de URLs de PDFs
    ├── eSAJMovementsExtractor.ts     # Extração de movimentações
    └── eSAJDocumentTextExtractor.ts  # Extração de texto de PDFs
```

---

## 🔧 Módulos Detalhados

### 1. `eSAJBase.ts` - Classe Base

**Responsabilidade**: Gerenciar o navegador Puppeteer e configurações compartilhadas.

**Características**:
- Gerencia uma única instância do navegador Puppeteer
- Compartilha configurações (URL do e-SAJ, modo headless, diretório de downloads)
- Fornece métodos utilitários para inicialização e limpeza

**Métodos Principais**:
```typescript
protected async initBrowser(): Promise<Browser>
async closeBrowser(): Promise<void>
protected async setupPageForDownloads(page: Page): Promise<void>
async cleanup(): Promise<void>
```

**Configurações**:
- `eSAJUrl`: URL do portal e-SAJ (padrão: `https://esaj.tjsp.jus.br/cpopg/open.do`)
- `headless`: Modo headless do Puppeteer (padrão: `true`)
- `downloadsDir`: Diretório para downloads temporários

**Otimização**: Todos os módulos que estendem `eSAJBase` compartilham a mesma instância do navegador, evitando múltiplas instâncias do Puppeteer.

---

### 2. `eSAJProcessSearcher.ts` - Busca de Processos

**Responsabilidade**: Buscar processos no e-SAJ pelo número de protocolo.

**Interface de Retorno**:
```typescript
interface ProcessSearchResult {
  found: boolean;
  protocolNumber: string;
  processPageUrl?: string;  // URL da página de detalhes
  page?: Page;              // Página já aberta (para reutilização)
  error?: string;
}
```

**Fluxo de Execução**:
1. Navega para a página de consulta pública do e-SAJ
2. Seleciona o radio button "Outros"
3. Preenche o número do protocolo
4. Submete o formulário
5. Verifica se o processo foi encontrado
6. Retorna a URL da página de detalhes e a página aberta

**Método Principal**:
```typescript
async findProcess(protocolNumber: string): Promise<ProcessSearchResult>
```

**Otimização**: Retorna a página já aberta (`page`) para evitar navegação duplicada quando o próximo passo é buscar documentos.

---

### 3. `eSAJDocumentFinder.ts` - Encontrar Documentos

**Responsabilidade**: Encontrar documentos na lista de movimentações do processo.

**Interface de Retorno**:
```typescript
interface DocumentCandidate {
  movimentoText: string;
  linkHref: string;
  linkId: string;
  hasDocument: boolean;
  requiresPassword: boolean;
}
```

**Funcionalidades**:
- Expande a seção de movimentações se necessário
- Busca documentos que correspondem ao tipo solicitado
- Identifica documentos que requerem senha
- Prioriza documentos sem senha

**Métodos Principais**:
```typescript
async expandMovementsSection(page: Page): Promise<void>
async findDocuments(page: Page, documentType: string): Promise<DocumentCandidate[]>
selectBestDocument(candidates: DocumentCandidate[]): DocumentCandidate | null
```

**Estratégias de Busca**:
1. Busca por ícone de documento na linha
2. Busca por links com classe específica de documento
3. Busca por qualquer link na linha que seja de documento

---

### 4. `eSAJDocumentDownloader.ts` - Download de Documentos

**Responsabilidade**: Extrair a URL do PDF de um documento específico.

**Interface de Retorno**:
```typescript
interface DocumentDownloadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  pdfUrl?: string;          // URL direta do PDF extraída
  protocolNumber: string;
  documentType?: string;
  error?: string;
}
```

**Funcionalidades**:
- Extrai URL do PDF a partir do link do documento
- Lida com diferentes formatos de link (direto, iframe, parâmetros)
- Constrói URL do PDF a partir de parâmetros quando possível
- Extrai URL do iframe quando necessário

**Métodos Principais**:
```typescript
async extractPDFUrl(
  page: Page,
  documentCandidate: DocumentCandidate,
  protocolNumber: string,
  documentType: string
): Promise<string | null>

async downloadDocument(
  page: Page,
  documentCandidate: DocumentCandidate,
  protocolNumber: string,
  documentType: string
): Promise<DocumentDownloadResult>
```

**Estratégias de Extração**:
1. **Link direto**: Se o link contém `getPDF.do`, usa diretamente
2. **Parâmetros**: Constrói URL a partir de `cdDocumento` e `processo.codigo`
3. **Iframe**: Navega para a página do documento e extrai URL do iframe
4. **Fallback**: Usa a URL do link como está

**⚠️ Nota Importante**: Este método **NÃO realiza download direto** do arquivo. Ele apenas extrai e retorna a URL do PDF, que pode expirar devido a limitações de sessão do e-SAJ.

---

### 5. `eSAJMovementsExtractor.ts` - Extração de Movimentações

**Responsabilidade**: Extrair todas as movimentações e informações do processo.

**Interface de Retorno**:
```typescript
interface ProcessMovementsResult {
  success: boolean;
  protocolNumber: string;
  movements?: string;  // Texto completo das movimentações formatado
  error?: string;
}
```

**Funcionalidades**:
- Extrai informações básicas do processo (número, classe, assunto, foro, vara, juiz)
- Extrai partes envolvidas (requerente, requerido, advogados)
- Extrai todas as movimentações com data e descrição
- Formata tudo em um texto estruturado

**Método Principal**:
```typescript
async extractMovements(
  protocolNumber: string,
  processPageUrl?: string
): Promise<ProcessMovementsResult>
```

**Formato de Saída**:
```
=== INFORMAÇÕES DO PROCESSO ===

Número: 1234567-89.2023.8.26.0100
Classe: Ação de Cobrança
Assunto: Cobrança
Foro: Foro Central
Vara: 1ª Vara Cível
Juiz: Dr. João Silva

Partes:
Requerente: Empresa XYZ
Requerido: João da Silva

=== MOVIMENTAÇÕES ===

01/01/2024 - Distribuição
15/01/2024 - Citação do requerido
...
```

---

### 6. `eSAJDocumentTextExtractor.ts` - Extração de Texto

**Responsabilidade**: Baixar um documento PDF e extrair seu texto.

**Interface de Retorno**:
```typescript
interface DocumentTextResult {
  success: boolean;
  protocolNumber: string;
  documentType?: string;
  text?: string;  // Texto extraído do PDF
  error?: string;
}
```

**Funcionalidades**:
- Integra com `DocumentFinder` para encontrar o documento
- Integra com `DocumentDownloader` para obter a URL do PDF
- Baixa o PDF usando `axios` com cookies da sessão
- Extrai texto usando `pdf-parse`

**Método Principal**:
```typescript
async extractText(
  page: Page,
  protocolNumber: string,
  documentType: string
): Promise<DocumentTextResult>
```

**Fluxo de Execução**:
1. Encontra documento usando `DocumentFinder`
2. Seleciona melhor candidato (sem senha)
3. Obtém URL do PDF usando `DocumentDownloader`
4. Baixa PDF com cookies da sessão
5. Extrai texto usando `pdf-parse`

---

### 7. `eSAJService.ts` - Serviço Principal

**Responsabilidade**: Orquestrar todos os módulos e fornecer uma interface unificada.

**Métodos Públicos**:
```typescript
async findProcess(protocolNumber: string): Promise<ProcessSearchResult>
async downloadDocument(
  protocolNumber: string,
  documentType: string,
  processPageUrl?: string,
  existingPage?: Page
): Promise<DocumentDownloadResult>
async extractMovements(
  protocolNumber: string,
  processPageUrl?: string
): Promise<ProcessMovementsResult>
async extractDocumentText(
  protocolNumber: string,
  documentType: string,
  processPageUrl?: string
): Promise<DocumentTextResult>
```

**Características**:
- Instancia todos os módulos especializados
- Compartilha a mesma instância base (navegador) com todos os módulos
- Fornece métodos de alto nível que orquestram múltiplos módulos
- Re-exporta interfaces para manter compatibilidade

---

## 🔄 Fluxo de Execução

### Fluxo 1: Download de Documento

```
1. ChatController recebe requisição
   ↓
2. IntentDetectionService detecta DOWNLOAD_DOCUMENT
   ↓
3. eSAJService.findProcess(protocolNumber)
   ├─> eSAJProcessSearcher.findProcess()
   ├─> Navega para e-SAJ
   ├─> Busca processo
   └─> Retorna: { found: true, processPageUrl, page }
   ↓
4. eSAJService.downloadDocument(protocolNumber, documentType, processPageUrl, page)
   ├─> Reutiliza página já aberta (otimização)
   ├─> eSAJDocumentFinder.findDocuments(page, documentType)
   │   └─> Encontra documentos na lista
   ├─> eSAJDocumentFinder.selectBestDocument(candidates)
   │   └─> Prioriza documentos sem senha
   └─> eSAJDocumentDownloader.downloadDocument(page, candidate, ...)
       └─> Extrai URL do PDF
   ↓
5. Retorna URL do PDF para o usuário
```

### Fluxo 2: Resumo de Processo

```
1. ChatController recebe requisição
   ↓
2. IntentDetectionService detecta SUMMARIZE_PROCESS
   ↓
3. eSAJService.findProcess(protocolNumber)
   └─> Retorna: { found: true, processPageUrl, page }
   ↓
4. eSAJService.extractMovements(protocolNumber, processPageUrl)
   ├─> eSAJMovementsExtractor.extractMovements()
   ├─> Navega para página de detalhes (ou reutiliza)
   ├─> Expande seção de movimentações
   └─> Extrai informações e movimentações
   ↓
5. LLMService.summarizeProcess(movementsText)
   └─> Gera resumo estruturado
   ↓
6. Retorna resumo para o usuário
```

### Fluxo 3: Pergunta sobre Documento

```
1. ChatController recebe requisição
   ↓
2. IntentDetectionService detecta QUERY_DOCUMENT
   ↓
3. eSAJService.findProcess(protocolNumber)
   └─> Retorna: { found: true, processPageUrl, page }
   ↓
4. eSAJService.extractDocumentText(protocolNumber, documentType, processPageUrl)
   ├─> eSAJDocumentTextExtractor.extractText()
   ├─> DocumentFinder encontra documento
   ├─> DocumentDownloader obtém URL do PDF
   ├─> Baixa PDF com cookies da sessão
   └─> Extrai texto usando pdf-parse
   ↓
5. LLMService.answerDocumentQuestion(question, documentText)
   └─> Responde pergunta baseada no texto
   ↓
6. Retorna resposta para o usuário
```

---

## 💻 Uso e Exemplos

### Exemplo 1: Buscar Processo

```typescript
import { eSAJService } from './services/eSAJService';

const eSAJ = new eSAJService();

const result = await eSAJ.findProcess('1234567-89.2023.8.26.0100');

if (result.found) {
  console.log(`Processo encontrado: ${result.processPageUrl}`);
  // A página já está aberta em result.page (para reutilização)
} else {
  console.error(`Erro: ${result.error}`);
}
```

### Exemplo 2: Baixar Documento

```typescript
// Opção 1: Com página já aberta (otimizado)
const processResult = await eSAJ.findProcess('1234567-89.2023.8.26.0100');
if (processResult.found) {
  const downloadResult = await eSAJ.downloadDocument(
    '1234567-89.2023.8.26.0100',
    'petição inicial',
    processResult.processPageUrl,
    processResult.page  // Reutiliza página já aberta
  );
  
  if (downloadResult.success) {
    console.log(`PDF URL: ${downloadResult.pdfUrl}`);
  }
}

// Opção 2: Com URL apenas
const downloadResult = await eSAJ.downloadDocument(
  '1234567-89.2023.8.26.0100',
  'sentença',
  'https://esaj.tjsp.jus.br/cpopg/show.do?processo.codigo=...'
);
```

### Exemplo 3: Extrair Movimentações

```typescript
const movementsResult = await eSAJ.extractMovements(
  '1234567-89.2023.8.26.0100',
  'https://esaj.tjsp.jus.br/cpopg/show.do?processo.codigo=...'
);

if (movementsResult.success) {
  console.log(movementsResult.movements);
  // Texto formatado com informações e movimentações
}
```

### Exemplo 4: Extrair Texto de Documento

```typescript
const textResult = await eSAJ.extractDocumentText(
  '1234567-89.2023.8.26.0100',
  'petição inicial',
  'https://esaj.tjsp.jus.br/cpopg/show.do?processo.codigo=...'
);

if (textResult.success) {
  console.log(`Texto extraído: ${textResult.text}`);
}
```

---

## ⚡ Otimizações

### 1. Compartilhamento de Navegador

Todos os módulos compartilham a mesma instância do navegador Puppeteer através da classe base `eSAJBase`. Isso evita criar múltiplas instâncias do navegador, economizando memória e recursos.

```typescript
// eSAJService.ts
constructor() {
  super();
  // Todos compartilham a mesma instância base (mesmo navegador)
  this.processSearcher = new eSAJProcessSearcher(this);
  this.documentFinder = new eSAJDocumentFinder(this);
  // ...
}
```

### 2. Reutilização de Páginas

Quando `findProcess` encontra um processo, ele retorna a página já aberta. O próximo método (`downloadDocument`, `extractMovements`, etc.) pode reutilizar essa página, evitando navegação duplicada.

```typescript
// findProcess retorna a página
const result = await eSAJ.findProcess(protocolNumber);
// { found: true, processPageUrl: '...', page: Page }

// downloadDocument reutiliza a página
await eSAJ.downloadDocument(protocolNumber, docType, result.processPageUrl, result.page);
// Não precisa navegar novamente!
```

### 3. Flag de Controle de Fechamento

A flag `shouldClosePage` controla se a página deve ser fechada no `finally`. Páginas reutilizadas não são fechadas, evitando erros.

```typescript
let shouldClosePage = true;

if (existingPage && !existingPage.isClosed()) {
  page = existingPage;
  shouldClosePage = false; // Não fechar página reutilizada
}

// ...

finally {
  if (page && shouldClosePage && !page.isClosed()) {
    await page.close();
  }
}
```

---

## 🔍 Tratamento de Erros

Cada módulo implementa tratamento robusto de erros:

1. **Validação de Parâmetros**: Verifica se parâmetros obrigatórios foram fornecidos
2. **Try-Catch**: Captura erros em cada etapa
3. **Mensagens Descritivas**: Retorna mensagens de erro claras
4. **Limpeza de Recursos**: Garante que páginas sejam fechadas mesmo em caso de erro

**Exemplo**:
```typescript
try {
  // Operação
} catch (error: any) {
  return {
    success: false,
    error: `Erro ao realizar operação: ${error.message}`,
  };
} finally {
  // Limpeza de recursos
  if (page && !page.isClosed()) {
    await page.close();
  }
}
```

---

## 📝 Variáveis de Ambiente

Configure as seguintes variáveis no arquivo `.env`:

```env
# URL do portal e-SAJ
ESAJ_URL=https://esaj.tjsp.jus.br/cpopg/open.do

# Modo headless do Puppeteer (true/false)
PUPPETEER_HEADLESS=true

# Diretório para downloads temporários
DOWNLOADS_DIR=./downloads_esaj
```

---

## 🚀 Melhores Práticas

1. **Sempre reutilize páginas**: Passe `processResult.page` para métodos subsequentes
2. **Trate erros**: Sempre verifique `success` antes de usar resultados
3. **Feche recursos**: Use `cleanup()` quando terminar de usar o serviço
4. **Use URLs quando possível**: Passe `processPageUrl` para evitar buscar novamente
5. **Valide parâmetros**: Sempre valide números de protocolo antes de usar

---

## 📚 Referências

- [Puppeteer Documentation](https://pptr.dev/)
- [e-SAJ Portal](https://esaj.tjsp.jus.br/)
- [pdf-parse Documentation](https://www.npmjs.com/package/pdf-parse)

---

## 🔄 Histórico de Versões

### v2.0.0 - Refatoração Modular
- Separação em módulos especializados
- Compartilhamento de navegador
- Reutilização de páginas
- Otimização de performance

### v1.0.0 - Versão Inicial
- Implementação monolítica
- Funcionalidades básicas

---

**Última atualização**: Dezembro 2024

