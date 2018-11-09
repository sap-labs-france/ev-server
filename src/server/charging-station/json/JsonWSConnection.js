const Logging = require('../../../utils/Logging');
const Configuration = require('../../../utils/Configuration');
const WebSocket = require('ws');
const Tenant = require('../../../entity/Tenant');
const ChargingStation = require('../../../entity/ChargingStation');
const Constants = require('../../../utils/Constants');
const OCPPError = require('../../../exception/OcppError');
const JsonChargingStationClient16 = require('../../../client/json/JsonChargingStationClient16');
const JsonChargingStationService16 = require('./services/JsonChargingStationService16');
const WSConnection = require('./WSConnection');
const BackendError = require('../../../exception/BackendError');

const MODULE_NAME = "JsonWSConnection";

class JsonWSConnection extends WSConnection {

  constructor(wsConnection, req, chargingStationConfig, wsServer) {
    // Call super
    super(wsConnection, req, wsServer);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      module: MODULE_NAME, method: "constructor",
      source: this.getChargingStationID(),
      action: "WSJsonConnectionOpened",
      message: `New Json connection from '${this.getIP()}', Protocol '${wsConnection.protocol}', URL '${this.getURL()}'`
    });
    // Check Protocol (required field of OCPP spec)
    switch (wsConnection.protocol) {
      // OCPP 1.6?
      case 'ocpp1.6':
        // Create the Json Client
        this._chargingStationClient = new JsonChargingStationClient16(this);
        // Create the Json Server Service
        this._chargingStationService = new JsonChargingStationService16(chargingStationConfig);
        break;
      // Not Found
      default:
        // Error
        throw new BackendError(null, `Protocol ${wsConnection.protocol} not supported`,
          "JsonWSConnection", "constructor");
    }
  }

  async initialize() {
    // Already initialized?
    if (!this._initialized) {
      // Check Tenant?
      if (this.getTenantID()) {
        // Check if the Tenant exists
        const tenant = await Tenant.getTenant(this.getTenantID());
        // Found?
        if (!tenant) {
          // No: It is not allowed to connect with an unknown tenant
          Logging.logError({
            tenantID: this.getTenantID(),
            source: this.getURL(),
            module: MODULE_NAME, method: "initialize",
            action: "WSJsonRegiterJsonConnection",
            message: `Invalid Tenant in URL ${this.getURL()}`
          });
          // Error
          throw new BackendError(this.getChargingStationID(), `Invalid Tenant '${this.getTenantID()}' in URL '${this.getURL()}'`,
            "JsonWSConnection", "initialize");
        }
      } else {
          // Error
          throw new BackendError(this.getChargingStationID(), `Tenant is not provided in URL '${this.getURL()}'`,
            "JsonWSConnection", "initialize");
      }
      // Cloud Foundry?
      if (Configuration.isCloudFoundry()) {
        // Yes: Update the CF App and Instance ID to call the charger from the Rest server
        const chargingStation = await ChargingStation.getChargingStation(this.getTenantID(), this.getChargingStationID());
      // Found?
      if (chargingStation) {
        // Update CF Instance
          chargingStation.setCFApplicationIDAndInstanceIndex(Configuration.getCFApplicationIDAndInstanceIndex());
          // Save it
          let cs = await chargingStation.save();
        }
      }
      // Initialize the default Headers
      this._headers = {
        chargeBoxIdentity: this.getChargingStationID(),
        ocppVersion: (this.getWSConnection().protocol.startsWith("ocpp") ? this.getWSConnection().protocol.replace("ocpp", "") : this.getWSConnection().protocol),
        ocppProtocol: Constants.OCPP_PROTOCOL_JSON,
        chargingStationURL: this._serverURL,
        tenantID: this.getTenantID(),
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
      tenantID: this.getTenantID(),
      module: MODULE_NAME, method: "onError",
      action: "WSJsonErrorReceived",
      message: error
    });
  }
  
  onClose(code, reason) {
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      module: MODULE_NAME,
      source: (this.getChargingStationID() ? this.getChargingStationID() : ""),
      method: "onClose", action: "WSJsonConnectionClose",
      message: `Connection has been closed, Reason '${reason}', Code '${code}'`
    });
    // Remove the connection
    this._wsServer.removeJsonConnection(this);
  }

  async handleRequest(messageId, commandName, commandPayload) {
    // Log
    Logging.logReceivedAction(MODULE_NAME, this.getTenantID(), this.getChargingStationID(), commandName, commandPayload);
    // Check if method exist in the service
    if (typeof this._chargingStationService["handle" + commandName] === 'function') {
      // Call it
      let result = await this._chargingStationService["handle" + commandName](Object.assign({}, commandPayload, this._headers));
      // Log
      Logging.logReturnedAction(MODULE_NAME, this.getTenantID(), this.getChargingStationID(), commandName, result);
      // Send Response
      await this.sendMessage(messageId, result, Constants.OCPP_JSON_CALL_RESULT_MESSAGE);
    } else {
      // Throw Exception
      throw new OCPPError(Constants.OCPP_ERROR_NOT_IMPLEMENTED, `The OCPP method 'handle${commandName}' has not been implemented`);
    }
  }

  getChargingStationClient() {
    if (this.getWSConnection().readyState === WebSocket.OPEN) {
      return this._chargingStationClient;
    } // only return client if WS is open
  }
}

module.exports = JsonWSConnection;