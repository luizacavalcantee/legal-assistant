// Declarações globais para TypeScript
declare global {
  // Para código executado no contexto do navegador via Puppeteer
  var window: any;
  var document: any;
}

// Declarações de módulos sem tipos
declare module 'swagger-jsdoc' {
  const swaggerJsdoc: any;
  export = swaggerJsdoc;
}

declare module 'swagger-ui-express' {
  const swaggerUi: any;
  export default swaggerUi;
}

export {};
