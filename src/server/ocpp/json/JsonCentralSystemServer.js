const uuid = require('uuid/v4');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const WSServer = require('./WSServer');
const JsonWSConnection = require('./JsonWSConnection');
const JsonRestWSConnection = require('./JsonRestWSConnection');
const CentralSystemServer = require('../CentralSystemServer');

class JsonCentralSystemServer extends CentralSystemServer {

  constructor(centralSystemConfig, chargingStationConfig) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    this._serverName = "OCPP";
    this._MODULE_NAME = "JsonCentralSystemServer";
    this._jsonChargingStationClients = [];
    this._jsonRestClients = [];
  }

  get MODULE_NAME() {
    return this._MODULE_NAME;
  }

  get serverName() {
    return this._serverName;
  }

  _createWSServer() {
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
        module: this._MODULE_NAME,
        method: "verifyClient",
        action: "WSVerifyClient",
        message: `Invalid connection URL ${info.req.url}`
      });
      return false;
    };

    // eslint-disable-next-line no-unused-vars
    const handleProtocols = (protocols, request) => {
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
    };

    // Create the WS server
    this._wsServer = new WSServer(WSServer.createHttpServer(this._centralSystemConfig), this._serverName, this._centralSystemConfig, verifyClient, handleProtocols);
    this._wsServer.on('connection', async (ws, req) => {
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
          error, "WSConnection", "", this._MODULE_NAME, "connection", Constants.DEFAULT_TENANT);
        // Respond
        ws.close(Constants.WS_UNSUPPORTED_DATA, error.message);
      }
    });
  }

  start() {
    // Keep it global
    global.centralSystemJson = this;
    // Make server to listen
    this._startListening();
  }

  _startListening() {
    // Create the WS server
    this._createWSServer();
    // Make server to listen
    this._wsServer._startListening();
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