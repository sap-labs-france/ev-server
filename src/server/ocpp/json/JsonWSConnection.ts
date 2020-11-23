import { MessageType, OcppErrorType } from '../../../types/WebSocket';
import { OCPPProtocol, OCPPVersion } from '../../../types/ocpp/OCPPServer';
import WebSocket, { CloseEvent, ErrorEvent } from 'ws';

import BackendError from '../../../exception/BackendError';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../../utils/Configuration';
import JsonCentralSystemServer from './JsonCentralSystemServer';
import JsonChargingStationClient from '../../../client/ocpp/json/JsonChargingStationClient';
import JsonChargingStationService from './services/JsonChargingStationService';
import Logging from '../../../utils/Logging';
import OCPPError from '../../../exception/OcppError';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import { ServerAction } from '../../../types/Server';
import WSConnection from './WSConnection';
import http from 'http';

const MODULE_NAME = 'JsonWSConnection';

export default class JsonWSConnection extends WSConnection {
  public isConnectionAlive: boolean;
  private chargingStationClient: ChargingStationClient;
  private chargingStationService: JsonChargingStationService;
  private headers: OCPPHeader;

  constructor(wsConnection: WebSocket, req: http.IncomingMessage, chargingStationConfig: ChargingStationConfiguration, wsServer: JsonCentralSystemServer) {
    // Call super
    super(wsConnection, req, wsServer);
    // Check Protocol (required field of OCPP spec)
    switch (wsConnection.protocol) {
      // OCPP 1.6?
      case 'ocpp1.6':
        // Create the Json Client
        this.chargingStationClient = new JsonChargingStationClient(this, this.tenantID, this.chargingStationID);
        // Create the Json Server Service
        this.chargingStationService = new JsonChargingStationService(chargingStationConfig);
        break;
      // Not Found
      default:
        // Error
        throw new BackendError({
          source: this.getChargingStationID(),
          module: MODULE_NAME,
          method: 'constructor',
          message: `Protocol ${wsConnection.protocol} not supported`
        });
    }
    this.isConnectionAlive = true;
    // Handle Socket ping
    this.getWSConnection().on('ping', this.onPing.bind(this));
    // Handle Socket pong
    this.getWSConnection().on('pong', this.onPong.bind(this));
  }

  public async initialize(): Promise<void> {
    // Already initialized?
    if (!this.initialized) {
      // Call super class
      await super.initialize();
      // Initialize the default Headers
      this.headers = {
        chargeBoxIdentity: this.getChargingStationID(),
        ocppVersion: (this.getWSConnection().protocol.startsWith('ocpp') ? this.getWSConnection().protocol.replace('ocpp', '') : this.getWSConnection().protocol) as OCPPVersion,
        ocppProtocol: OCPPProtocol.JSON,
        chargingStationURL: Configuration.getJsonEndpointConfig().baseUrl,
        tenantID: this.getTenantID(),
        token: this.getToken(),
        From: {
          Address: this.getClientIP()
        }
      };
      // Ok
      this.initialized = true;
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getChargingStationID(),
        action: ServerAction.WS_JSON_CONNECTION_OPENED,
        module: MODULE_NAME, method: 'initialize',
        message: `New Json connection from '${this.getClientIP().toString()}', Protocol '${this.getWSConnection().protocol}', URL '${this.getURL()}'`
      });
    }
  }

  public onError(errorEvent: ErrorEvent): void {
    // Log
    Logging.logError({
      tenantID: this.getTenantID(),
      source: (this.getChargingStationID() ? this.getChargingStationID() : ''),
      action: ServerAction.WS_JSON_CONNECTION_ERROR,
      module: MODULE_NAME, method: 'onError',
      message: `Error ${errorEvent?.error} ${errorEvent?.message}`,
      detailedMessages: `${JSON.stringify(errorEvent)}`
    });
  }

  public onClose(closeEvent: CloseEvent): void {
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: (this.getChargingStationID() ? this.getChargingStationID() : ''),
      action: ServerAction.WS_JSON_CONNECTION_CLOSED,
      module: MODULE_NAME, method: 'onClose',
      message: `Connection has been closed, Reason '${closeEvent.reason ? closeEvent.reason : 'No reason given'}', Code '${closeEvent.code}'`
    });
    // Remove the connection
    this.wsServer.removeJsonConnection(this);
  }

  public async onPing(): Promise<void> {
    await ChargingStationStorage.saveChargingStationLastSeen(this.getTenantID(), this.getChargingStationID(), {
      lastSeen: new Date()
    });
  }

  public async onPong(): Promise<void> {
    this.isConnectionAlive = true;
    await ChargingStationStorage.saveChargingStationLastSeen(this.getTenantID(), this.getChargingStationID(), {
      lastSeen: new Date()
    });
  }

  public async handleRequest(messageId: string, commandName: ServerAction, commandPayload: any): Promise<void> {
    // Log
    Logging.logChargingStationServerReceiveAction(MODULE_NAME, this.getTenantID(), this.getChargingStationID(), commandName, commandPayload);
    // Check if method exist in the service
    if (typeof this.chargingStationService['handle' + commandName] === 'function') {
      if ((commandName === 'BootNotification') || (commandName === 'Heartbeat')) {
        this.headers.currentIPAddress = this.getClientIP();
      }
      // Call it
      const result = await this.chargingStationService['handle' + commandName](this.headers, commandPayload);
      // Log
      Logging.logChargingStationServerRespondAction(MODULE_NAME, this.getTenantID(), this.getChargingStationID(), commandName, result);
      // Send Response
      await this.sendMessage(messageId, result, MessageType.CALL_RESULT_MESSAGE, commandName);
    } else {
      // Throw Exception
      throw new OCPPError({
        source: this.getChargingStationID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        code: OcppErrorType.NOT_IMPLEMENTED,
        message: `The OCPP method 'handle${typeof commandName === 'string' ? commandName : JSON.stringify(commandName)}' has not been implemented`
      });
    }
  }

  public getChargingStationClient(): ChargingStationClient {
    // Only return client if WS is open
    if (this.isWSConnectionOpen()) {
      return this.chargingStationClient;
    }
    return null;
  }
}

