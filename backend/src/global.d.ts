// Declarações globais para TypeScript
declare global {
  // Para código executado no contexto do navegador via Puppeteer
  var window: any;
  var document: any;
  
  // Namespace Express para tipos do Multer
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
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
