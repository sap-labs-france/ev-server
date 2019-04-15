const fs = require('fs');
const uuid = require('uuid/v4');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const JsonWSConnection = require('./JsonWSConnection');
const JsonRestWSConnection = require('./JsonRestWSConnection');
const CentralSystemServer = require('../CentralSystemServer');

const MODULE_NAME = "JsonCentralSystemServer";
class JsonCentralSystemServer extends CentralSystemServer {

  constructor(centralSystemConfig, chargingStationConfig) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    this._jsonChargingStationClients = [];
    this._jsonRestClients = [];
  }

  start() {
    let server;
    // Log
    console.log(`Starting OCPP JSon Server...`); // eslint-disable-line
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
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "verifyClient",
        action: "WSVerifyClient",
        message: `Invalid connection URL ${info.req.url}`
      });
      return false;
    };
    // Create the Web Socket Server
    this._wss = new WebSocket.Server({
      server: server,
      verifyClient: verifyClient,
      handleProtocols: (protocols, request) => { // eslint-disable-line
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
        // Set an ID
        ws.id = uuid();
        // Check Rest calls
        if (req.url.startsWith('/REST')) {
          // Create a Rest Web Socket connection object
          const wsConnection = new JsonRestWSConnection(ws, req, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addRestConnection(wsConnection);
        } else {
          // Create a Json Web Socket connection object
          const wsConnection = new JsonWSConnection(ws, req, this._chargingStationConfig, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addJsonConnection(wsConnection);
        } 
      } catch (error) {
        // Log
        Logging.logException(
          error, "WSConnection", "", MODULE_NAME, "connection", Constants.DEFAULT_TENANT);
        // Respond
        ws.close(Constants.WS_UNSUPPORTED_DATA, error.message);
      }
    });
    // Start listening
    server.listen(this._centralSystemConfig.port, this._centralSystemConfig.host, () => {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "start", action: "Startup",
        message: `OCPP Json Server listening on '${this._centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`
      });
      console.log(`OCPP Json Server listening on '${this._centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`); // eslint-disable-line
    });
  }

  addJsonConnection(wsConnection) {
    // Keep the connection
    this._jsonChargingStationClients[wsConnection.getID()] = wsConnection;
  }

  removeJsonConnection(wsConnection) {
    // Check first
    if (this._jsonChargingStationClients[wsConnection.getID()] && 
        this._jsonChargingStationClients[wsConnection.getID()].getWSConnection().id === wsConnection.getWSConnection().id) {
      // Remove from cache    
      delete this._jsonChargingStationClients[wsConnection.getID()];
    }
  }

  addRestConnection(wsConnection) {
    // Keep the connection
    this._jsonRestClients[wsConnection.getID()] = wsConnection;
  }

  removeRestConnection(wsConnection) {
    // Check first
    if (this._jsonRestClients[wsConnection.getID()] &&
        this._jsonRestClients[wsConnection.getID()].getWSConnection().id === wsConnection.getWSConnection().id) {
      // Remove from cache
      delete this._jsonRestClients[wsConnection.getID()];
    }
  }

  getChargingStationClient(tenantID, chargingStationID) {
    // Build ID
    const id = `${tenantID}~${chargingStationID}}`;
    // Charging Station exists?
    if (this._jsonChargingStationClients[id]) {
      // Return from the cache
      return this._jsonChargingStationClients[id].getChargingStationClient();
    }
    // Not found!
    return null;
  }
}

module.exports = JsonCentralSystemServer;