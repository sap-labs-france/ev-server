import uuid from 'uuid/v4';
import { OPEN } from 'ws';
import BackendError from '../../../exception/BackendError';
import ChargingStation from '../../../entity/ChargingStation';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import OCPPError from '../../../exception/OcppError';
import Tenant from '../../../entity/Tenant';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'WSConnection';
export default class WSConnection {
  public tenantIsValid: boolean;
  public code: any;
  public message: any;
  public details: any;
  protected initialized: any;
  protected wsServer: any;
  private url: any;
  private ip: any;
  private wsConnection: any;
  private req: any;
  private _requests: any = {};
  private chargingStationID: any;
  private tenantID: any;

  constructor(wsConnection, req, wsServer) {
    // Init
    this.url = req.url.trim().replace(/\b(\?|&).*/, ''); // Filter trailing URL parameters
    this.ip = req && ((req.connection && req.connection.remoteAddress) || req.headers['x-forwarded-for']);
    this.wsConnection = wsConnection;
    this.req = req;
    this.chargingStationID = null;
    this.tenantID = null;
    this.initialized = false;
    this.wsServer = wsServer;

    // Default
    this.setTenantValid(false);
    // Check URL: remove starting and trailing '/'
    if (this.url.endsWith('/')) {
      // Remove '/'
      this.url = this.url.substring(0, this.url.length - 1);
    }
    if (this.url.startsWith('/')) {
      // Remove '/'
      this.url = this.url.substring(1, this.url.length);
    }
    // Parse URL: should like /OCPP16/TENANTID/CHARGEBOXID
    const splittedURL = this.getURL().split('/');
    // URL with 4 parts?
    if (splittedURL.length === 3) {
      // Yes: Tenant is then provided in the third part
      this.setTenantID(splittedURL[1]);
      // The Charger is in the 4th position
      this.setChargingStationID(splittedURL[2]);
    } else {
      // Error
      throw new BackendError(null, `The URL '${req.url}' is invalid (/OCPPxx/TENANT_ID/CHARGEBOX_ID)`,
        'WSConnection', 'constructor');
    }
    // Handle incoming messages
    this.wsConnection.on('message', this.onMessage.bind(this));
    // Handle Error on Socket
    this.wsConnection.on('error', this.onError.bind(this));
    // Handle Socket close
    this.wsConnection.on('close', this.onClose.bind(this));
  }

  async initialize() {
    try {
      // Check Tenant?
      await Utils.checkTenant(this.tenantID);
      // Ok
      this.setTenantValid(true);
      // Cloud Foundry?
      if (Configuration.isCloudFoundry()) {
        // Yes: Save the CF App and Instance ID to call the charger from the Rest server
        const chargingStation = await ChargingStation.getChargingStation(this.getTenantID(), this.getChargingStationID());
        // Found?
        if (chargingStation) {
          // Update CF Instance
          chargingStation.setCFApplicationIDAndInstanceIndex(Configuration.getCFApplicationIDAndInstanceIndex());
          // Save it
          await chargingStation.save();
        }
      }
    } catch (error) {
      // Custom Error
      Logging.logException(error, 'WSConnection', this.getChargingStationID(), 'WSConnection', 'initialize', this.tenantID);
      throw new BackendError(this.getChargingStationID(), `Invalid Tenant '${this.tenantID}' in URL '${this.getURL()}'`,
        'WSConnection', 'initialize');
    }
  }

  onError(error) {
  }

  onClose(code, reason?) {
  }

  public async onMessage(message): Promise<void> {
    // Parse the message
    const [messageType, messageId, commandName, commandPayload, errorDetails] = JSON.parse(message);

    try {
      // Initialize: done in the message as init could be lengthy and first message may be lost
      await this.initialize();

      // Check the Type of message
      switch (messageType) {
        // Incoming Message
        case Constants.OCPP_JSON_CALL_MESSAGE:
          // Process the call
          await this.handleRequest(messageId, commandName, commandPayload);
          break;
        // Outcome Message
        case Constants.OCPP_JSON_CALL_RESULT_MESSAGE:
          // Respond
          // eslint-disable-next-line no-case-declarations
          let responseCallback: Function;
          if (Utils.isIterable(this._requests[messageId])) {
            [responseCallback] = this._requests[messageId];
          } else {
            throw new BackendError(this.getChargingStationID(), `Response request for unknown message id ${messageId} is not iterable`,
              'WSConnection', 'onMessage', commandName);
          }
          if (!responseCallback) {
            // Error
            throw new BackendError(this.getChargingStationID(), `Response for unknown message id ${messageId}`,
              'WSConnection', 'onMessage', commandName);
          }
          delete this._requests[messageId];
          responseCallback(commandName);
          break;
        // Error Message
        case Constants.OCPP_JSON_CALL_ERROR_MESSAGE:
          // Log
          Logging.logError({
            tenantID: this.getTenantID(),
            module: MODULE_NAME,
            method: 'sendMessage',
            action: 'WSError',
            message: {
              messageID: messageId,
              error: JSON.stringify(message, null, ' ')
            }
          });
          if (!this._requests[messageId]) {
            // Error
            throw new BackendError(this.getChargingStationID(), `Error for unknown message id ${messageId}`,
              'WSConnection', 'onMessage', commandName);
          }
          // eslint-disable-next-line no-case-declarations
          let rejectCallback: Function;
          if (Utils.isIterable(this._requests[messageId])) {
            [, rejectCallback] = this._requests[messageId];
          } else {
            throw new BackendError(this.getChargingStationID(), `Error request for unknown message id ${messageId} is not iterable`,
              'WSConnection', 'onMessage', commandName);
          }
          delete this._requests[messageId];
          rejectCallback(new OCPPError(commandName, commandPayload, errorDetails));
          break;
        // Error
        default:
          // Error
          throw new BackendError(this.getChargingStationID(), `Wrong message type ${messageType}`,
            'WSConnection', 'onMessage', commandName);
      }
    } catch (error) {
      // Log
      Logging.logException(error, commandName, this.getChargingStationID(), MODULE_NAME, 'onMessage', this.getTenantID());
      // Send error
      await this.sendError(messageId, error);
    }
  }

  async handleRequest(messageId, commandName, commandPayload) {
    // To implement in sub-class
  }

  getWSConnection() {
    return this.wsConnection;
  }

  getWSServer() {
    return this.wsServer;
  }

  getURL() {
    return this.url;
  }

  getIP() {
    return this.ip;
  }

  send(command, messageType = Constants.OCPP_JSON_CALL_MESSAGE) {
    // Send Message
    return this.sendMessage(uuid(), command, messageType);
  }

  sendError(messageId, err) {
    // Check exception: only OCPP error are accepted
    const error = (err instanceof OCPPError ? err : new OCPPError(Constants.OCPP_ERROR_INTERNAL_ERROR, err.message));
    // Send error
    return this.sendMessage(messageId, error, Constants.OCPP_JSON_CALL_ERROR_MESSAGE);
  }

  async sendMessage(messageId, command, messageType = Constants.OCPP_JSON_CALL_RESULT_MESSAGE, commandName = '') {
    // Send a message through WSConnection
    const self = this;
    // Create a promise
    // eslint-disable-next-line no-undef
    return await new Promise((resolve, reject) => {
      let messageToSend;
      // Type of message
      switch (messageType) {
        // Request
        case Constants.OCPP_JSON_CALL_MESSAGE:
          // Build request
          this._requests[messageId] = [responseCallback, rejectCallback];
          messageToSend = JSON.stringify([messageType, messageId, commandName, command]);
          break;
        // Response
        case Constants.OCPP_JSON_CALL_RESULT_MESSAGE:
          // Build response
          messageToSend = JSON.stringify([messageType, messageId, command]);
          break;
        // Error Message
        case Constants.OCPP_JSON_CALL_ERROR_MESSAGE:
          // Build Message
          // eslint-disable-next-line no-case-declarations
          const {
            code,
            message,
            details
          } = command;
          messageToSend = JSON.stringify([messageType, messageId, code, message, details]);
          break;
      }
      // Check if wsConnection in ready
      if (this.isWSConnectionOpen()) {
        // Yes: Send Message
        this.wsConnection.send(messageToSend);
      } else {
        // Reject it
        return rejectCallback(`Web socket closed for Message ID '${messageId}' with content '${messageToSend}' (${Tenant.getTenant(this.tenantID)})`);
      }
      // Request?
      if (messageType !== Constants.OCPP_JSON_CALL_MESSAGE) {
        // Yes: send Ok
        resolve();
      } else {
        // Send timeout
        setTimeout(() => {
          return rejectCallback(`Timeout for Message ID '${messageId}' with content '${messageToSend} (${Tenant.getTenant(this.tenantID)})'`);
        }, Constants.OCPP_SOCKET_TIMEOUT);
      }

      // Function that will receive the request's response
      function responseCallback(payload) {
        // Send the response
        resolve(payload);
      }

      // Function that will receive the request's rejection
      function rejectCallback(reason) {
        // Build Exception
        self._requests[messageId] = [() => { }, () => { }];
        const error = reason instanceof OCPPError ? reason : new Error(reason);
        // Send error
        reject(error);
      }
    });
  }

  getChargingStationID() {
    return this.chargingStationID;
  }

  setChargingStationID(chargingStationID) {
    this.chargingStationID = chargingStationID;
  }

  getTenantID() {
    // Check
    if (this.isTenantValid()) {
      // Ok verified
      return this.tenantID;
    }
    // No go to the master tenant
    return Constants.DEFAULT_TENANT;
  }

  setTenantID(tenantID) {
    this.tenantID = tenantID;
  }

  getID() {
    return `${this.getTenantID()}~${this.getChargingStationID()}}`;
  }

  setTenantValid(valid) {
    this.tenantIsValid = valid;
  }

  isTenantValid(): boolean {
    return this.tenantIsValid;
  }

  isWSConnectionOpen() {
    return this.wsConnection.readyState === OPEN;
  }
}

