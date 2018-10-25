const fs = require('fs');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const Logging = require('../../../utils/Logging');
const JsonWSConnection = require('./JsonWSConnection');
const CentralSystemServer = require('../CentralSystemServer');

class JsonCentralSystemServer extends CentralSystemServer {

  constructor(centralSystemConfig, chargingStationConfig) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    this._jsonClients = [];
  }

  start() {
    let server;
    // Keep it global
    global.centralSystemJson = this;
    // Create HTTP server
    // Secured protocol?
    if (this._centralSystemConfig.protocol === "wss") {
      // Create the options
      const options = {};
      // Set the keys
      options.key = fs.readFileSync(this._centralSystemConfig["ssl-key"]);
      options.cert = fs.readFileSync(this._centralSystemConfig["ssl-cert"]);
      Logging.logDebug({
        module: "JsonCentralSystemServer",
        method: "start",
        action: "",
        message: `Starting JSON HTTPS Server`
      });
      // Https server
      server = https.createServer(options, (req, res) => {
        res.writeHead(200);
        res.end('No support\n');
      });
    } else {
      Logging.logDebug({
        module: "JsonCentralSystemServer",
        method: "start",
        action: "",
        message: `Starting JSON HTTP Server`
      });
      // Http server
      server = http.createServer((req, res) => {
        res.writeHead(200);
        res.end('No support\n');
      });
    }

    const verifyClient = (info) => {
      if (info.req.url.startsWith("/OCPP16/") === false) {
        Logging.logError({
          module: "JsonCentralSystemServer",
          method: "verifyClient",
          action: "Connection",
          message: `Invalid connection URL ${info.req} from ${info.origin}`
        });
        return false;
      }
      return true;
    }
    // Create the Web Socket Server
    this._wss = new WebSocket.Server({
      server: server,
      verifyClient: verifyClient,
      handleProtocols: (protocols, request) => {
        // Ensure protocol used as ocpp1.6 or nothing (should create an error)
        if (Array.isArray(protocols)) {
          return (protocols.indexOf("ocpp1.6") >= 0 ? protocols[protocols.indexOf("ocpp1.6")] : false);
        } else if (protocols === "ocpp1.6") {
          return protocols;
        } else {
          return false;
        }
      }
    });
    // Listen to new connections
    this._wss.on('connection', (ws, req) => {
      try {
        // Create a Web Socket connection object
        const wsConnection = new JsonWSConnection(ws, req, this._chargingStationConfig);
        // Initialize        
        wsConnection.initialize();
        // Store the WS manager linked to its ChargeBoxId
        if (wsConnection.getChargeBoxId()) {
          // Keep the connection
          this._jsonClients[wsConnection.getChargeBoxId()] = wsConnection;
        }
      } catch (error) {
        Logging.logError({
          module: "JsonCentralSystemServer",
          method: "onConnection",
          action: "socketError",
          message: `Connection Error ${error}`
        });
        ws.close(1007, error.message);
      }
    });

    server.listen(this._centralSystemConfig.port, this._centralSystemConfig.host, () => {
      // Log
      Logging.logInfo({
        module: "JsonCentralSystemServer",
        method: "start",
        action: "Startup",
        message: `JSON Central System Server (Charging Stations) listening on '${this._centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`
      });
    });
  }

  closeConnection(chargeBoxId) {
    // Charging Station exists?
    if (this._jsonClients[chargeBoxId]) {
      // Remove from cache
      delete this._jsonClients[chargeBoxId];
    }
  }

  getChargingStationClient(chargeBoxId) {
    // Charging Station exists?
    if (this._jsonClients[chargeBoxId]) {
      // Return from the cache
      return this._jsonClients[chargeBoxId].getWSClient();
    }
    // Not found!
    return null;
  }
}

module.exports = JsonCentralSystemServer;