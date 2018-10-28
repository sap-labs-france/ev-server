const fs = require('fs');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const JsonWSConnection = require('./JsonWSConnection');
const RestWSConnection = require('./RestWSConnection');
const CentralSystemServer = require('../CentralSystemServer');

const MODULE_NAME = "JsonCentralSystemServer";
class JsonCentralSystemServer extends CentralSystemServer {

  constructor(centralSystemConfig, chargingStationConfig) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    this._jsonClients = [];
  }

  start() {
    const serverURL = `${this._centralSystemConfig.protocol}://${this._centralSystemConfig.host}:${this._centralSystemConfig.port}`
    let server;
    // Log
    console.log(`Starting JSon Central System Server (Charging Stations)...`);
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
      // Https server
      server = https.createServer(options, (req, res) => {
        res.writeHead(200);
        res.end('No support\n');
      });
    } else {
      // Http server
      server = http.createServer((req, res) => {
        res.writeHead(200);
        res.end('No support\n');
      });
    }

    const verifyClient = (info) => {
      // Check the URI
      if (info.req.url.startsWith("/OCPP16")) {
        return true;
      } 
      if (info.req.url.startsWith("/REST")) {
        return true;
      }
      Logging.logError({
        module: MODULE_NAME,
        method: "verifyClient",
        action: "Connection",
        message: `Invalid connection URL ${info.req} from ${info.origin}`
      });
      return false;
    }
    // Create the Web Socket Server
    this._wss = new WebSocket.Server({
      server: server,
      verifyClient: verifyClient,
      handleProtocols: (protocols, request) => {
        // Check the protocols
        // Ensure protocol used as ocpp1.6 or nothing (should create an error)
        if (Array.isArray(protocols)) {
          if (protocols.indexOf("ocpp1.6") >= 0) {
            return "ocpp1.6"; 
          } 
          if (protocols.indexOf("rest") >= 0) {
            return "rest"; 
          } 
          return false;
        } else if (protocols === "ocpp1.6") {
          return protocols;
        } else if (protocols === "rest") {
          return protocols;
        } else {
          return false;
        }
      }
    });
    // Listen to new connections
    this._wss.on('connection', async (ws, req) => {
      try {
        // Check Rest calls
        if (req.url.startsWith('/REST')) {
          // Create a Rest Web Socket connection object
          const wsConnection = new RestWSConnection(ws, req, this);

        } else {
          // Create a Json Web Socket connection object
          const wsConnection = new JsonWSConnection(ws, req, this._chargingStationConfig, serverURL);
          // Initialize        
          await wsConnection.initialize();
          // Store the WS manager linked to its ChargeBoxId
          if (wsConnection.getChargingStationID()) {
            // Keep the connection
            this._jsonClients[wsConnection.getChargingStationID()] = wsConnection;
          }
        } 
      } catch (error) {
        // Log
        Logging.logException(error, "WSConnection", "", MODULE_NAME, "connection");
        // Respond
        ws.close(Constants.WS_UNSUPPORTED_DATA, error.message);
      }
    });

    // Start listening
    server.listen(this._centralSystemConfig.port, this._centralSystemConfig.host, () => {
      // Log
      Logging.logInfo({
        module: MODULE_NAME,
        method: "start",
        action: "Startup",
        message: `Json Central System Server (Charging Stations) listening on '${this._centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`
      });
      console.log(`Json Central System Server (Charging Stations) listening on '${this._centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`);
    });
  }

  removeConnection(chargingStationID) {
    // Charging Station exists?
    if (this._jsonClients[chargingStationID]) {
      // Remove from cache
      delete this._jsonClients[chargingStationID];
    }
  }

  getChargingStationClient(chargingStationID) {
    // Charging Station exists?
    if (this._jsonClients[chargingStationID]) {
      // Return from the cache
      return this._jsonClients[chargingStationID].getWSClient();
    }
    // Not found!
    return null;
  }
}

module.exports = JsonCentralSystemServer;