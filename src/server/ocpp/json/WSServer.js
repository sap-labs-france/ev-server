const fs = require('fs');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');

const MODULE_NAME = "WSServer";

class WSServer extends WebSocket.Server {
  constructor(httpServer, serverName, serverConfig, verifyClientCb, handleProtocolsCb) {
    // Create the Web Socket Server
    super({
      server: httpServer,
      verifyClient: verifyClientCb,
      handleProtocols: handleProtocolsCb
    });
    this._httpServer = httpServer;
    this._serverName = serverName;
    this._serverConfig = serverConfig;
    this._keepAliveIntervalValue = (this._serverConfig.hasOwnProperty('keepaliveinterval') ? this._serverConfig.keepaliveinterval : 30) * 1000; // ms
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
      options.key = fs.readFileSync(this._serverConfig["ssl-key"]);
      options.cert = fs.readFileSync(this._serverConfig["ssl-cert"]);
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
    // eslint-disable-next-line no-console
    console.log(`Starting ${this._serverName} JSon ${MODULE_NAME}...`);
    // Start listening
    this._httpServer.listen(this._serverConfig.port, this._serverConfig.host, () => {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "start", action: "Startup",
        message: `${this._serverName} Json ${MODULE_NAME} listening on '${this._serverConfig.protocol}://${this._httpServer.address().address}:${this._httpServer.address().port}'`
      });
      // eslint-disable-next-line no-console
      console.log(`${this._serverName} Json ${MODULE_NAME} listening on '${this._serverConfig.protocol}://${this._httpServer.address().address}:${this._httpServer.address().port}'`);
    });
  }
}

module.exports = WSServer;