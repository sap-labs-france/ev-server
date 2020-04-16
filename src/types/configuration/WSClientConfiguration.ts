export default interface WSClientConfiguration {
  autoReconnectMaxRetries: number;
  autoReconnectTimeout: number;
}

export interface JsonWSClientConfiguration extends WSClientConfiguration {
  WSOptions?: any;
  logTenantID?: string;
  protocols?: string;
}
