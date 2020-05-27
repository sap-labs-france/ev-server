import WebSocket from 'ws';

export default interface WSClientConfiguration {
  autoReconnectMaxRetries: number;
  autoReconnectTimeout: number;
}

export interface JsonWSClientConfiguration extends WSClientConfiguration {
  WSOptions?: WebSocket.ClientOptions;
  logTenantID?: string;
  protocols?: string;
}
