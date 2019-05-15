const fs = require('fs');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const cluster = require('cluster');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');

const MODULE_NAME = "WSServer";

class WSServer extends WebSocket.Server {
  /**
   * Create a new `WSServer`.
   *
   * @param {Object} httpServer
   * @param {String} serverName
   * @param {Object} serverConfig
   * @param {Function} verifyClientCb
   * @param {Function} handleProtocolsCb
   */
  constructor(httpServer, serverName, serverConfig, verifyClientCb = () => { }, handleProtocolsCb = () => { }) {
    // Create the Web Socket Server
    super({
      server: httpServer,
      verifyClient: verifyClientCb,
      handleProtocols: handleProtocolsCb
    });
    this._httpServer = httpServer;
    this._serverName = serverName;
    this._serverConfig = serverConfig;
    this._keepAliveIntervalValue = (this._serverConfig.hasOwnProperty('keepaliveinterval') ?
      this._serverConfig.keepaliveinterval : Constants.WS_DEFAULT_KEEPALIVE) * 1000; // ms
    this.on('connection', (ws) => {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
    });
    this._keepAliveInterval = setInterval(() => {
      this.clients.forEach((ws) => {
        if (ws.isAlive === false)
          return ws.terminate();
        ws.isAlive = false;
        ws.ping(() => { });
      });
    }, this._keepAliveIntervalValue);
  }

  static createHttpServer(serverConfig) {
    // Create HTTP server
    let httpServer;
    // Secured protocol?
    if (serverConfig.protocol === "wss") {
      // Create the options
      const options = {};
      // Set the keys
      options.key = fs.readFileSync(serverConfig["ssl-key"]);
      options.cert = fs.readFileSync(serverConfig["ssl-cert"]);
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

  broadcastToClients(message) {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  start() {
    // Log
    let logMsg;
    if (cluster.isWorker) {
      logMsg = `Starting ${this._serverName} Json ${MODULE_NAME} in worker ${cluster.worker.id}...`;
    } else {
      logMsg = `Starting ${this._serverName} Json ${MODULE_NAME}...`;
    }
    // eslint-disable-next-line no-console
    console.log(logMsg);
    // Make server to listen
    this._startListening();
  }

  _startListening() {
    // Start listening
    this._httpServer.listen(this._serverConfig.port, this._serverConfig.host, () => {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "_startListening", action: "Startup",
        message: `${this._serverName} Json ${MODULE_NAME} listening on '${this._serverConfig.protocol}://${this._httpServer.address().address}:${this._httpServer.address().port}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`
      });
      // eslint-disable-next-line no-console
      console.log(`${this._serverName} Json ${MODULE_NAME} listening on '${this._serverConfig.protocol}://${this._httpServer.address().address}:${this._httpServer.address().port}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`);
    });
  }
}

module.exports = WSServer;