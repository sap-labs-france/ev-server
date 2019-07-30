import BackendError from '../../../exception/BackendError';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import JsonChargingStationClient from '../../../client/ocpp/json/JsonChargingStationClient';
import JsonChargingStationService from './services/JsonChargingStationService';
import Logging from '../../../utils/Logging';
import OCPPError from '../../../exception/OcppError';
import WSConnection from './WSConnection';

const MODULE_NAME = 'JsonWSConnection';
export default class JsonWSConnection extends WSConnection {

  private chargingStationClient: any;
  private chargingStationService: any;
  private headers: any;

  constructor(wsConnection, req, chargingStationConfig, wsServer) {
    // Call super
    super(wsConnection, req, wsServer);
    // Check Protocol (required field of OCPP spec)
    switch (wsConnection.protocol) {
      // OCPP 1.6?
      case 'ocpp1.6':
        // Create the Json Client
        this.chargingStationClient = new JsonChargingStationClient(this);
        // Create the Json Server Service
        this.chargingStationService = new JsonChargingStationService(chargingStationConfig);
        break;
      // Not Found
      default:
        // Error
        throw new BackendError(null, `Protocol ${wsConnection.protocol} not supported`,
          'JsonWSConnection', 'constructor');
    }
  }

  async initialize() {
    // Already initialized?
    if (!this.initialized) {
      // Call super class
      await super.initialize();
      // Initialize the default Headers
      this.headers = {
        chargeBoxIdentity: this.getChargingStationID(),
        ocppVersion: (this.getWSConnection().protocol.startsWith('ocpp') ? this.getWSConnection().protocol.replace('ocpp', '') : this.getWSConnection().protocol),
        ocppProtocol: Constants.OCPP_PROTOCOL_JSON,
        chargingStationURL: Configuration.getJsonEndpointConfig().baseUrl,
        tenantID: this.getTenantID(),
        From: {
          Address: this.getIP()
        }
      };
      // Ok
      this.initialized = true;
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'initialize',
        source: this.getChargingStationID(),
        action: 'WSJsonConnectionOpened',
        message: `New Json connection from '${this.getIP()}', Protocol '${this.getWSConnection().protocol}', URL '${this.getURL()}'`
      });
    }
  }

  onError(error) {
    // Log
    Logging.logError({
      tenantID: this.getTenantID(),
      module: MODULE_NAME, method: 'onError',
      action: 'WSJsonErrorReceived',
      message: error
    });
  }

  onClose(code, reason) {
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      module: MODULE_NAME,
      source: (this.getChargingStationID() ? this.getChargingStationID() : ''),
      method: 'onClose', action: 'WSJsonConnectionClose',
      message: `Connection has been closed, Reason '${reason}', Code '${code}'`
    });
    // Remove the connection
    this.wsServer.removeJsonConnection(this);
  }

  async handleRequest(messageId, commandName, commandPayload) {
    // Log
    Logging.logReceivedAction(MODULE_NAME, this.getTenantID(), this.getChargingStationID(), commandName, commandPayload);
    // Check if method exist in the service
    if (typeof this.chargingStationService['handle' + commandName] === 'function') {
      if ((commandName === 'BootNotification') || (commandName === 'Heartbeat')) {
        this.headers.currentIPAddress = this.getIP();
      }
      // Call it
      const result = await this.chargingStationService['handle' + commandName](this.headers, commandPayload);
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
    // Only return client if WS is open
    if (this.isWSConnectionOpen()) {
      return this.chargingStationClient;
    }
  }
}

