import http, { IncomingMessage } from 'http';

import CentralSystemServerConfiguration from '../../../types/configuration/CentralSystemServerConfiguration';
import { ServerUtils } from '../../ServerUtils';
import WebSocket from 'ws';

const MODULE_NAME = 'WSServer';

export default class WSServer extends WebSocket.Server {
  private serverConfig: CentralSystemServerConfiguration;
  private serverName: string;
  private httpServer: http.Server;

  public constructor(serverConfig: CentralSystemServerConfiguration, serverName: string,
      verifyClientCb: WebSocket.VerifyClientCallbackAsync | WebSocket.VerifyClientCallbackSync = (): void => { },
      handleProtocolsCb: (protocols: Set<string>, request: IncomingMessage) => string | false = (protocols, request) => '') {
    const httpServer = ServerUtils.createHttpServer(serverConfig);
    // Create the WebSocket Server
    super({
      server: httpServer,
      verifyClient: verifyClientCb,
      handleProtocols: handleProtocolsCb
    });
    this.serverConfig = serverConfig;
    this.serverName = serverName;
    this.httpServer = httpServer;
  }

  public broadcastToClients(message: any): void {
    for (const client of this.clients) {
      if (client?.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  public start(): void {
    // Make the server listen
    ServerUtils.startHttpServer(this.serverConfig, this.httpServer, MODULE_NAME, this.serverName);
  }
}

