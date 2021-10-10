import { OCPPErrorType, OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import { OCPPProtocol, OCPPVersion } from '../../../types/ocpp/OCPPServer';
import { ServerAction, WSServerProtocol } from '../../../types/Server';
import WebSocket, { CloseEvent, ErrorEvent } from 'ws';

import BackendError from '../../../exception/BackendError';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import { Command } from '../../../types/ChargingStation';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import JsonCentralSystemServer from './JsonCentralSystemServer';
import JsonChargingStationClient from '../../../client/ocpp/json/JsonChargingStationClient';
import JsonChargingStationService from './services/JsonChargingStationService';
import Logging from '../../../utils/Logging';
import OCPPError from '../../../exception/OcppError';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import OCPPUtils from '../utils/OCPPUtils';
import Utils from '../../../utils/Utils';
import WSConnection from './WSConnection';
import http from 'http';

const MODULE_NAME = 'JsonWSConnection';

export default class JsonWSConnection extends WSConnection {
  public isConnectionAlive: boolean;
  private chargingStationClient: ChargingStationClient;
  private chargingStationService: JsonChargingStationService;
  private headers: OCPPHeader;
  private lastSeen: Date;

  constructor(wsConnection: WebSocket, req: http.IncomingMessage, wsServer: JsonCentralSystemServer) {
    // Call super
    super(wsConnection, req, wsServer);
    let backendError: BackendError;
    // Check Protocol (required field of OCPP spec)
    switch (wsConnection.protocol) {
      // OCPP 1.6?
      case WSServerProtocol.OCPP16:
        // Create the Json Client
        this.chargingStationClient = new JsonChargingStationClient(this, this.getTenantID(), this.getChargingStationID(), {
          siteID: this.getSiteID(),
          siteAreaID: this.getSiteAreaID(),
          companyID: this.getCompanyID(),
        });
        // Create the Json Server Service
        this.chargingStationService = new JsonChargingStationService();
        break;
      // Not Found
      default:
        backendError = new BackendError({
          source: this.getChargingStationID(),
          module: MODULE_NAME,
          method: 'constructor',
          message: wsConnection.protocol ?
            `Web Socket Protocol '${wsConnection.protocol}' not supported` : 'Web Socket Protocol is mandatory'
        });
        // Log in the right Tenants
        void Logging.logException(
          backendError,
          ServerAction.WS_JSON_CONNECTION_ERROR,
          this.getChargingStationID(),
          MODULE_NAME, 'constructor',
          this.getTenantID()
        );
        throw backendError;
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
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        ocppVersion: (this.getWSConnection().protocol.startsWith('ocpp') ? this.getWSConnection().protocol.replace('ocpp', '') : this.getWSConnection().protocol) as OCPPVersion,
        ocppProtocol: OCPPProtocol.JSON,
        chargingStationURL: Configuration.getJsonEndpointConfig().baseSecureUrl ?? Configuration.getJsonEndpointConfig().baseUrl,
        tenantID: this.getTenantID(),
        token: this.getToken(),
        From: {
          Address: this.getClientIP()
        }
      };
      // Update the Charging Station
      const chargingStation = await ChargingStationStorage.getChargingStation(
        this.getTenant(), this.getChargingStationID(), { issuer: true }, ['id']);
      if (chargingStation) {
        // Update charging station details
        this.setChargingStationDetails(chargingStation);
        // Update Last Seen
        await ChargingStationStorage.saveChargingStationLastSeen(this.getTenant(),
          chargingStation.id, { lastSeen: new Date() });
        // Update CF Instance
        if (Configuration.isCloudFoundry()) {
          await ChargingStationStorage.saveChargingStationCFApplicationIDAndInstanceIndex(
            this.getTenant(), chargingStation.id, Configuration.getCFApplicationIDAndInstanceIndex());
        }
      // Must have a valid Token
      } else {
        // Check connection Token
        await OCPPUtils.checkChargingStationConnectionToken(
          ServerAction.OCPP_BOOT_NOTIFICATION, this.getTenant(), this.getChargingStationID(), this.getToken(), { headers: this.headers });
      }
      this.initialized = true;
      await Logging.logInfo({
        tenantID: this.getTenantID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        chargingStationID: this.getChargingStationID(),
        source: this.getChargingStationID(),
        action: ServerAction.WS_JSON_CONNECTION_OPENED,
        module: MODULE_NAME, method: 'initialize',
        message: `New Json connection from '${this.getClientIP().toString()}', Protocol '${this.getWSConnection().protocol}', URL '${this.getURL()}'`
      });
    }
  }

  public onError(errorEvent: ErrorEvent): void {
    void Logging.logError({
      tenantID: this.getTenantID(),
      siteID: this.getSiteID(),
      siteAreaID: this.getSiteAreaID(),
      companyID: this.getCompanyID(),
      chargingStationID: this.getChargingStationID(),
      source: this.getChargingStationID(),
      action: ServerAction.WS_JSON_CONNECTION_ERROR,
      module: MODULE_NAME, method: 'onError',
      message: `Error ${errorEvent?.error} ${errorEvent?.message}`,
      detailedMessages: { errorEvent: errorEvent }
    });
  }

  public onClose(closeEvent: CloseEvent): void {
    void Logging.logInfo({
      tenantID: this.getTenantID(),
      siteID: this.getSiteID(),
      siteAreaID: this.getSiteAreaID(),
      companyID: this.getCompanyID(),
      chargingStationID: this.getChargingStationID(),
      source: this.getChargingStationID(),
      action: ServerAction.WS_JSON_CONNECTION_CLOSED,
      module: MODULE_NAME, method: 'onClose',
      message: `Connection has been closed, Reason: '${closeEvent.reason ? closeEvent.reason : 'No reason given'}', Message: '${Utils.getWebSocketCloseEventStatusString(Utils.convertToInt(closeEvent))}', Code: '${closeEvent.toString()}'`,
      detailedMessages: { closeEvent }
    });
  }

  public async onPing(): Promise<void> {
    this.isConnectionAlive = true;
    await this.updateChargingStationLastSeen();
  }

  public async onPong(): Promise<void> {
    this.isConnectionAlive = true;
    await this.updateChargingStationLastSeen();
  }

  public async handleRequest(messageId: string, command: Command, commandPayload: Record<string, unknown> | string): Promise<void> {
    // Trace
    const startTimestamp = await Logging.traceChargingStationActionStart(Constants.MODULE_JSON_OCPP_SERVER_16, this.getTenantID(), this.getChargingStationID(),
      OCPPUtils.getServerActionFromOcppCommand(command), commandPayload, '>>', {
        siteAreaID: this.getSiteAreaID(),
        siteID: this.getSiteID(),
        companyID: this.getCompanyID(),
      }
    );
    const methodName = `handle${command}`;
    // Check if method exist in the service
    if (typeof this.chargingStationService[methodName] === 'function') {
      if ((command === Command.BOOT_NOTIFICATION) || (command === Command.HEARTBEAT)) {
        this.headers.currentIPAddress = this.getClientIP();
      }
      // Call it
      const result = await this.chargingStationService[methodName](this.headers, commandPayload);
      // Trace
      await Logging.traceChargingStationActionEnd(Constants.MODULE_JSON_OCPP_SERVER_16, this.getTenantID(), this.getChargingStationID(),
        OCPPUtils.getServerActionFromOcppCommand(command), result, '<<', {
          siteAreaID: this.getSiteAreaID(),
          siteID: this.getSiteID(),
          companyID: this.getCompanyID(),
        }, startTimestamp
      );
      // Send Response
      await this.sendMessage(messageId, result, OCPPMessageType.CALL_RESULT_MESSAGE, command);
    } else {
      // Throw Exception
      throw new OCPPError({
        source: this.getChargingStationID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        code: OCPPErrorType.NOT_IMPLEMENTED,
        message: (typeof command === 'string') ? `OCPP method 'handle${command}()' has not been implemented` : `Unknown OCPP command: ${JSON.stringify(command)}`
      });
    }
  }

  public getChargingStationClient(): ChargingStationClient {
    if (!this.isWSConnectionOpen()) {
      void Logging.logError({
        tenantID: this.getTenantID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        chargingStationID: this.getChargingStationID(),
        source: this.getChargingStationID(),
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_CONNECTION,
        message: `Cannot retrieve WS client from WS connection with status '${this.getConnectionStatusString()}'`,
      });
      return null;
    }
    return this.chargingStationClient;
  }

  private async updateChargingStationLastSeen(): Promise<void> {
    // Update once every 60s
    if (!this.lastSeen || (Date.now() - this.lastSeen.getTime()) > Constants.LAST_SEEN_UPDATE_INTERVAL_MILLIS) {
      // Update last seen
      this.lastSeen = new Date();
      const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenant(),
        this.getChargingStationID(), { issuer: true }, ['id']);
      if (chargingStation) {
        await ChargingStationStorage.saveChargingStationLastSeen(this.getTenant(), this.getChargingStationID(),
          { lastSeen: this.lastSeen });
      }
    }
  }
}
