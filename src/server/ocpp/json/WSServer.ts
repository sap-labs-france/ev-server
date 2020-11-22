import WebSocket, { AddressInfo } from 'ws';

import CentralSystemServerConfiguration from '../../../types/configuration/CentralSystemServer';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import cluster from 'cluster';
import fs from 'fs';
import http from 'http';
import https from 'https';

const MODULE_NAME = 'WSServer';

export default class WSServer extends WebSocket.Server {
  private port: number;
  private hostname: string;
  private serverName: string;
  private httpServer: http.Server;
  private hasWebSocketSecure: boolean;

  public constructor(port: number, hostname: string, serverName: string, httpServer: http.Server,
    verifyClientCb: WebSocket.VerifyClientCallbackAsync | WebSocket.VerifyClientCallbackSync = ():
    void => { }, handleProtocolsCb: (protocols: string | string[], request: http.IncomingMessage) => boolean | string = (protocols, request) => '') {
    // Create the WebSocket Server
    super({
      server: httpServer,
      verifyClient: verifyClientCb,
      handleProtocols: handleProtocolsCb
    });
    this.port = port;
    this.hostname = hostname;
    this.serverName = serverName;
    this.httpServer = httpServer;
    this.hasWebSocketSecure = false;
  }

  public static createHttpServer(serverConfig: CentralSystemServerConfiguration): http.Server {
    // Create HTTP server
    let httpServer: http.Server;
    // Secured protocol?
    if (serverConfig.protocol === 'wss') {
      // Create the options
      const options: https.ServerOptions = {};
      // Set the keys
      options.key = fs.readFileSync(serverConfig['ssl-key']);
      options.cert = fs.readFileSync(serverConfig['ssl-cert']);
      // Https server
      httpServer = https.createServer(options, (req, res) => {
        res.writeHead(StatusCodes.OK);
        res.end('No support\n');
      });
    } else {
      // Http server
      httpServer = http.createServer((req, res) => {
        res.writeHead(StatusCodes.OK);
        res.end('No support\n');
      });
    }
    return httpServer;
  }

  public broadcastToClients(message: any): void {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public start(): void {
    // Log
    let logMsg: string;
    if (cluster.isWorker) {
      logMsg = `Starting ${this.serverName} Json ${MODULE_NAME} in worker ${cluster.worker.id}...`;
    } else {
      logMsg = `Starting ${this.serverName} Json ${MODULE_NAME} in master...`;
    }
    // eslint-disable-next-line no-console
    console.log(logMsg);
    // Make server to listen
    this.startListening();
  }

  public startListening(): void {
    // Start listening
    this.httpServer.listen(this.port, this.hostname, (): void => {
      // Log
      const logMsg = `${this.serverName} Json ${MODULE_NAME} listening on '${this.hasWebSocketSecure ? 'wss' : 'ws'}://${(this.httpServer.address() as AddressInfo).address}:${(this.httpServer.address() as AddressInfo).port}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        action: ServerAction.STARTUP,
        method: 'startListening',
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
    });
  }
}

