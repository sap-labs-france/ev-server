declare module 'mongo-uri-builder' {
  export interface MongoUriConfig {
    username?: string;
    password?: string;
    host?: string;
    port?: number;
    replicas?: { host: string; port?: number }[];
    database?: string;
    options?: any;
  }
  export default function mongoUriBuilder(cfg: MongoUriConfig): string;
}
