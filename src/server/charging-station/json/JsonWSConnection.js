const Logging = require('../../../utils/Logging');
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

  constructor(socket, req, chargingStationConfig, serverURL) {
    super(socket, req);
    this._requests = {};
    this._tenantName = null;
    this._chargingStationID = null;
    this._serverURL = serverURL;
    
    // Parse URL: should like /OCPP16/TENANTNAME/CHARGEBOXID
    const splittedURL = this._url.split("/");
    // URL with 4 parts?
    if (splittedURL.length === 3) {
      // Yes: Tenant is then provided in the third part
      this._tenantName = splittedURL[1];
      // The Charger is in the 4th position
      this._chargingStationID = splittedURL[2];
    } else if (splittedURL.length === 2) {
      // 3 parts: no Tenant provided, get the Charging Station
      // Should not be supported when switched to tenant
      this._chargingStationID = splittedURL[1];
    } else {
      // Throw
      throw new Error(`The URL '${req.url }' must contain the Charging Station ID (/OCPPxx/TENANT_NAME/CHARGEBOX_ID)`);
    }
    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: this._chargingStationID,
      method: "constructor",
      action: "WSJsonConnectionOpened",
      message: `New Json connection from '${this._ip}', Protocol '${socket.protocol}', URL '${this._url}'`
    });
    // Check Protocol (required field of OCPP spec)
    switch (this._socket.protocol) {
      // OCPP 1.6?
      case 'ocpp1.6':
        // Create the Json Client
        this._chargingStationClient = new JsonChargingStationClient16(this);
        // Create the Json Server Service
        this._chargingStationService = new JsonChargingStationService16(chargingStationConfig);
        break;
      // Not Found
      default:
        throw new Error(`Protocol ${this._socket.protocol} not supported`);
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
            message: `Invalid Tenant in URL ${this._url}`
          });
          // Throw
          throw new Error(`Invalid Tenant '${this._tenantName}' in URL '${this._url}'`);
        }
      }
      // Initialize the default Headers
      this._headers = {
        chargeBoxIdentity: this._chargingStationID,
        ocppVersion: (this._socket.protocol.startsWith("ocpp") ? this._socket.protocol.replace("ocpp", "") : this._socket.protocol),
        ocppProtocol: Constants.OCPP_PROTOCOL_JSON,
        chargingStationURL: this._serverURL,
        tenant: this._tenantName,
        From: {
          Address: this._ip
        }
      }
      // Update Server URL
      let chargingStation = await ChargingStation.getChargingStation(this._chargingStationID);
      // Found?
      if (chargingStation) {
        // Update Server URL
        chargingStation.setChargingStationURL(this._serverURL);
        // Save it
        await chargingStation.save();
      }
      // Ok
      this._initialized = true;
    }
  }

  async handleRequest(messageId, commandName, commandPayload) {
    try {
      // Check if method exist in the service
      if (typeof this._chargingStationService["handle" + commandName] === 'function') {
        // Log
        Logging.logReceivedAction(MODULE_NAME, this.getChargingStationID(), commandName, commandPayload);
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
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(commandName, error);
      // Send error
      await this.sendError(messageId, error);
    }
  }

  getWSClient() {
    if (this._socket.readyState === WebSocket.OPEN) // only return client if WS is open
      return this._chargingStationClient;
  }
}

module.exports = JsonWSConnection;