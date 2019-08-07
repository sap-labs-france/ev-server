import cluster from 'cluster';
import fs from 'fs';
import http from 'http';
import https from 'https';
import WebSocket from 'ws';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'WSServer';
export default class WSServer extends WebSocket.Server {
  public clients: any;
  private httpServer: any;
  private serverName: string;
  private serverConfig: any;
  private keepAliveIntervalValue: number;
  private keepAliveInterval: any;

  /**
   * Create a new `WSServer`.
   *
   * @param {Object} httpServer
   * @param {String} serverName
   * @param {Object} serverConfig
   * @param {Function} verifyClientCb
   * @param {Function} handleProtocolsCb
   */
  public constructor(httpServer, serverName, serverConfig, verifyClientCb: WebSocket.VerifyClientCallbackAsync | WebSocket.VerifyClientCallbackSync = (): void => { }, handleProtocolsCb: Function = (): void => { }) {
    // Create the Web Socket Server
    super({
      server: httpServer,
      verifyClient: verifyClientCb,
      handleProtocols: handleProtocolsCb
    });
    this.httpServer = httpServer;
    this.serverName = serverName;
    this.serverConfig = serverConfig;
    this.keepAliveIntervalValue = (this.serverConfig.keepaliveinterval ?
      this.serverConfig.keepaliveinterval : Constants.WS_DEFAULT_KEEPALIVE) * 1000; // Ms
    this.on('connection', (ws: any, req: any): void => {
      ws.isAlive = true;
      ws.ip = Utils.getRequestIP(req);
      ws.on('pong', (): void => {
        ws.isAlive = true;
      });
    });
    if (!this.keepAliveInterval) {
      this.keepAliveInterval = setInterval((): void => {
        this.clients.forEach((ws): boolean => {
          if (ws.isAlive === false) {
            // Log
            Logging.logError({
              tenantID: Constants.DEFAULT_TENANT,
              module: MODULE_NAME,
              method: 'constructor',
              message: `Web Socket from ${ws.ip} do not respond to ping, terminating`
            });
            return ws.terminate();
          }
          ws.isAlive = false;
          ws.ping((): void => { });
        });
      }, this.keepAliveIntervalValue);
    }
  }

  public static createHttpServer(serverConfig): http.Server {
    // Create HTTP server
    let httpServer: http.Server;
    // Secured protocol?
    if (serverConfig.protocol === 'wss') {
      // Create the options
      const options: any = {};
      // Set the keys
      options.key = fs.readFileSync(serverConfig['ssl-key']);
      options.cert = fs.readFileSync(serverConfig['ssl-cert']);
      // Https server
      httpServer = https.createServer(options, (req, res) => {
        res.writeHead(200);
        res.end('No support\n');
      });
    } else {
      // Http server
      httpServer = http.createServer((req, res) => {
        res.writeHead(200);
        res.end('No support\n');
      });
    }
    return httpServer;
  }

  public broadcastToClients(message): void {
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
    this.httpServer.listen(this.serverConfig.port, this.serverConfig.host, (): void => {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: 'startListening', action: 'Startup',
        message: `${this.serverName} Json ${MODULE_NAME} listening on '${this.serverConfig.protocol}://${this.httpServer.address().address}:${this.httpServer.address().port}'`
      });
      // eslint-disable-next-line no-console
      console.log(`${this.serverName} Json ${MODULE_NAME} listening on '${this.serverConfig.protocol}://${this.httpServer.address().address}:${this.httpServer.address().port}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`);
    });
  }
}

