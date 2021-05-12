import CentralSystemServerConfiguration from '../../../types/configuration/CentralSystemServerConfiguration';
import { ServerUtils } from '../../ServerUtils';
import { WSServerProtocol } from '../../../types/Server';
import WebSocket from 'ws';
import http from 'http';

const MODULE_NAME = 'WSServer';

export default class WSServer extends WebSocket.Server {
  private serverConfig: CentralSystemServerConfiguration;
  private serverName: string;
  private httpServer: http.Server;

  public constructor(serverConfig: CentralSystemServerConfiguration, serverName: string,
      verifyClientCb: WebSocket.VerifyClientCallbackAsync | WebSocket.VerifyClientCallbackSync = (): void => { },
      handleProtocolsCb: (protocols: WSServerProtocol | WSServerProtocol[], request: http.IncomingMessage) => boolean | string = (protocols, request) => '') {
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

