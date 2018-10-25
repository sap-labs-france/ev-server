const fs = require('fs');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const Logging = require('../../../utils/Logging');
const JsonWSHandler = require('./JsonWSHandler');
const CentralSystemServer = require('../CentralSystemServer');

let _centralSystemConfig;
let _chargingStationConfig;

class JsonWSSystemServer extends CentralSystemServer {

  constructor(centralSystemConfig, chargingStationConfig) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    _centralSystemConfig = centralSystemConfig;
    _chargingStationConfig = chargingStationConfig;
    this._jsonClients = [];
  }

  start() {
    let server;
    global.centralWSServer = this;
    if (_centralSystemConfig.protocol === "wss") {
      // Create the options
      const options = {};
      // Set the keys
      options.key = fs.readFileSync(_centralSystemConfig["ssl-key"]);
      options.cert = fs.readFileSync(_centralSystemConfig["ssl-cert"]);
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

    const verifyClient = function (info) {
      if (info.req.url.startsWith("/OCPP16/") === false) {
        Logging.logError({
          module: "JsonCentralSystemServer",
          method: "verifyClient",
          action: "connection",
          message: `Invalid connection URL ${info.req} from ${info.origin}`
        });
        return false;
      }
      return true;
    }

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

    this._wss.on('connection', (ws, req) => {

      try {
        // construct the WS manager
        const connection = new JsonWSHandler(ws, req, _chargingStationConfig);
        connection.initialize();
        // Store the WS manager linked to its ChargeBoxId
        if (connection.getChargeBoxId())
          this._jsonClients[connection.getChargeBoxId()] = connection;
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

    server.listen(_centralSystemConfig.port, _centralSystemConfig.host, () => {
      // Log
      Logging.logInfo({
        module: "JsonCentralSystemServer",
        method: "start",
        action: "Startup",
        message: `JSON Central System Server (Charging Stations) listening on '${_centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`
      });
    });

  }

  closeConnection(chargeBoxId) {
    if (this._jsonClients[chargeBoxId])
      delete this._jsonClients[chargeBoxId];
  }

  getChargingStationClient(chargeBoxId) {
    if (this._jsonClients[chargeBoxId])
      return this._jsonClients[chargeBoxId].getWSClient();
    return null;
  }

}
module.exports = JsonWSSystemServer;