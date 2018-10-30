const Logging = require('../../../utils/Logging');
const Configuration = require('../../../utils/Configuration');
const WebSocket = require('ws');
const Tenant = require('../../../model/Tenant');
const ChargingStation = require('../../../model/ChargingStation');
const Constants = require('../../../utils/Constants');
const OCPPError = require('../../../exception/OcppError');
const JsonChargingStationClient16 = require('../../../client/json/JsonChargingStationClient16');
const JsonChargingStationService16 = require('./services/JsonChargingStationService16');
const WSConnection = require('./WSConnection');

const MODULE_NAME = "JsonWSConnection";

class JsonWSConnection extends WSConnection {

  constructor(wsConnection, req, chargingStationConfig, serverURL, wsServer) {
    // Call super
    super(wsConnection, req, wsServer);
    // Init
    this._requests = {};
    this._tenantName = null;
    this._serverURL = serverURL;
    // Parse URL: should like /OCPP16/TENANTNAME/CHARGEBOXID
    const splittedURL = this.getURL().split("/");
    // URL with 4 parts?
    if (splittedURL.length === 3) {
      // Yes: Tenant is then provided in the third part
      this._tenantName = splittedURL[1];
      // The Charger is in the 4th position
      this.setChargingStationID(splittedURL[2]);
    } else if (splittedURL.length === 2) {
      // 3 parts: no Tenant provided, get the Charging Station
      // Should not be supported when switched to tenant
      this.setChargingStationID(splittedURL[1]);
    } else {
      // Throw
      throw new Error(`The URL '${req.url }' must contain the Charging Station ID (/OCPPxx/TENANT_NAME/CHARGEBOX_ID)`);
    }
    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: this.getChargingStationID(),
      method: "constructor",
      action: "WSJsonConnectionOpened",
      message: `New Json connection from '${this.getIP()}', Protocol '${wsConnection.protocol}', URL '${this.getURL()}'`
    });
    // Check Protocol (required field of OCPP spec)
    switch (this.getWSConnection().protocol) {
      // OCPP 1.6?
      case 'ocpp1.6':
        // Create the Json Client
        this._chargingStationClient = new JsonChargingStationClient16(this);
        // Create the Json Server Service
        this._chargingStationService = new JsonChargingStationService16(chargingStationConfig);
        break;
      // Not Found
      default:
        throw new Error(`Protocol ${this.getWSConnection().protocol} not supported`);
    }
  }

  async initialize() {
    // Already initialized?
    if (!this._initialized) {
      // Check Tenant?
      if (this._tenantName) {
        // Check if the Tenant exists
        const tenant = await Tenant.getTenantByName(this._tenantName);
        // Found?
        if (!tenant) {
          // No: It is not allowed to connect with an unknown tenant
          Logging.logError({
            source: splittedURL[3],
            module: MODULE_NAME,
            method: "initialize",
            action: "WSJsonRegiterJsonConnection",
            message: `Invalid Tenant in URL ${this.getURL()}`
          });
          // Throw
          throw new Error(`Invalid Tenant '${this._tenantName}' in URL '${this.getURL()}'`);
        }
      }
      // Cloud Foundry?
      if (Configuration.isCloudFoundry()) {
        // Yes: Update the CF App and Instance ID to call the charger from the Rest server
        let chargingStation = await ChargingStation.getChargingStation(this.getChargingStationID());
        // Found?
        if (chargingStation) {
          // Update CF Instance
          chargingStation.setCFApplicationIDAndInstanceIndex(Configuration.getCFApplicationIDAndInstanceIndex());
          // Save it
          let cs = await chargingStation.save();
          console.log(cs.getModel());          
        }
      }
      // Initialize the default Headers
      this._headers = {
        chargeBoxIdentity: this.getChargingStationID(),
        ocppVersion: (this.getWSConnection().protocol.startsWith("ocpp") ? this.getWSConnection().protocol.replace("ocpp", "") : this.getWSConnection().protocol),
        ocppProtocol: Constants.OCPP_PROTOCOL_JSON,
        chargingStationURL: this._serverURL,
        tenant: this._tenantName,
        From: {
          Address: this.getIP()
        }
      }
      // Ok
      this._initialized = true;
    }
  }

  onError(error) {
    // Log
    Logging.logError({
      module: MODULE_NAME,
      method: "onError",
      action: "WSJsonErrorReceived",
      message: error
    });
  }
  
  onClose(code, reason) {
    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: (this.getChargingStationID() ? this.getChargingStationID() : ""),
      method: "onClose",
      action: "WSJsonConnectionClose",
      message: `Connection has been closed, Reason '${reason}', Code '${code}'`
    });
    // Close the connection
    this._wsServer.removeConnection(this.getChargingStationID());
  }

  async handleRequest(messageId, commandName, commandPayload) {
    // Log
    Logging.logReceivedAction(MODULE_NAME, this.getChargingStationID(), commandName, commandPayload);
    // Check if method exist in the service
    if (typeof this._chargingStationService["handle" + commandName] === 'function') {
      // Call it
      let result = await this._chargingStationService["handle" + commandName](Object.assign({}, commandPayload, this._headers));
      // Log
      Logging.logReturnedAction(MODULE_NAME, this.getChargingStationID(), commandName, result);
      // Send Response
      await this.sendMessage(messageId, result, Constants.OCPP_JSON_CALL_RESULT_MESSAGE);
    } else {
      // Throw Exception
      throw new OCPPError(Constants.OCPP_ERROR_NOT_IMPLEMENTED, `The OCPP method 'handle${commandName}' has not been implemented`);
    }
  }

  getChargingStationClient() {
    if (this.getWSConnection().readyState === WebSocket.OPEN) // only return client if WS is open
      return this._chargingStationClient;
  }
}

module.exports = JsonWSConnection;