/// <reference types="node" />

declare module "pg" {
  export class Pool {
    constructor(config?: { connectionString?: string; [key: string]: any });
    query(text: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
  }
}

