export default interface StorageConfiguration {
  implementation: string;
  uri: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolSize?: number;
  minPoolSize?: number;
  maxPoolSize?: number;
  replicaSet: string;
  monitorDBChange: boolean;
  debug: boolean;
  readPreference: string;
}

