import ChargingStation, { Command } from '../../../types/ChargingStation';
import { OCPPErrorType, OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import { OCPPProtocol, OCPPVersion } from '../../../types/ocpp/OCPPServer';
import { ServerAction, WSServerProtocol } from '../../../types/Server';

import BackendError from '../../../exception/BackendError';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import JsonCentralSystemServer from './JsonCentralSystemServer';
import JsonChargingStationClient from '../../../client/ocpp/json/JsonChargingStationClient';
import JsonChargingStationService from './services/JsonChargingStationService';
import LockingManager from '../../../locking/LockingManager';
import Logging from '../../../utils/Logging';
import OCPPError from '../../../exception/OcppError';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import OCPPUtils from '../utils/OCPPUtils';
import Utils from '../../../utils/Utils';
import WSConnection from './WSConnection';
import WebSocket from 'ws';
import http from 'http';

const MODULE_NAME = 'JsonWSConnection';

export default class JsonWSConnection extends WSConnection {
  public isConnectionAlive: boolean;
  private chargingStationClient: JsonChargingStationClient;
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
        this.chargingStationClient = new JsonChargingStationClient(this, this.getTenant(), this.getChargingStationID());
        // Create the Json Server Service
        this.chargingStationService = new JsonChargingStationService();
        break;
      // Not Found
      default:
        backendError = new BackendError({
          chargingStationID: this.getChargingStationID(),
          siteID: this.getSiteID(),
          siteAreaID: this.getSiteAreaID(),
          companyID: this.getCompanyID(),
          module: MODULE_NAME,
          method: 'constructor',
          message: wsConnection.protocol ?
            `Web Socket Protocol '${wsConnection.protocol}' not supported` : 'Web Socket Protocol is mandatory'
        });
        // Log in the right Tenants
        void Logging.logException(backendError, ServerAction.WS_JSON_CONNECTION_ERROR, MODULE_NAME, 'constructor', this.getTenantID());
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
      // Init parent
      await super.initialize();
      // Initialize the default Headers
      this.headers = {
        chargeBoxIdentity: this.getChargingStationID(),
        ocppVersion: (this.getWSConnection().protocol.startsWith('ocpp') ? this.getWSConnection().protocol.replace('ocpp', '') : this.getWSConnection().protocol) as OCPPVersion,
        ocppProtocol: OCPPProtocol.JSON,
        chargingStationURL: Configuration.getJsonEndpointConfig().baseSecureUrl ?? Configuration.getJsonEndpointConfig().baseUrl,
        tenantID: this.getTenantID(),
        tokenID: this.getTokenID(),
        From: {
          Address: this.getClientIP()
        }
      };
      this.initialized = true;
      await Logging.logInfo({
        tenantID: this.getTenantID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        chargingStationID: this.getChargingStationID(),
        action: ServerAction.WS_JSON_CONNECTION_OPENED,
        module: MODULE_NAME, method: 'initialize',
        message: `New Json connection from '${this.getClientIP().toString()}', Protocol '${this.getWSConnection().protocol}', URL '${this.getURL()}'`,
        detailedMessages: { ocppHeaders: this.headers }
      });
    }
  }

  public onError(error: Error): void {
    void Logging.logError({
      tenantID: this.getTenantID(),
      siteID: this.getSiteID(),
      siteAreaID: this.getSiteAreaID(),
      companyID: this.getCompanyID(),
      chargingStationID: this.getChargingStationID(),
      action: ServerAction.WS_JSON_CONNECTION_ERROR,
      module: MODULE_NAME, method: 'onError',
      message: `Error occurred: ${error?.message}`,
      detailedMessages: { error: error.stack }
    });
  }

  public onClose(code: number, reason: Buffer): void {
    // Remove the connection
    this.wsServer.removeJsonConnection(this);
    void Logging.logInfo({
      tenantID: this.getTenantID(),
      siteID: this.getSiteID(),
      siteAreaID: this.getSiteAreaID(),
      companyID: this.getCompanyID(),
      chargingStationID: this.getChargingStationID(),
      action: ServerAction.WS_JSON_CONNECTION_CLOSED,
      module: MODULE_NAME, method: 'onClose',
      message: `Connection has been closed, Reason: '${reason?.toString()}', Message: '${Utils.getWebSocketCloseEventStatusString(Utils.convertToInt(code))}', Code: '${code}'`,
      detailedMessages: { code, reason }
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
    // Set
    const methodName = `handle${command}`;
    // Check if method exist in the service
    if (typeof this.chargingStationService[methodName] === 'function') {
      this.headers.currentIPAddress = this.getClientIP();
      // Check the Charging Station
      const { tenant, chargingStation, token, lock } = await OCPPUtils.checkAndGetChargingStationData(OCPPUtils.buildServerActionFromOcppCommand(command),
        this.getTenantID(), this.getChargingStationID(), this.getTokenID(), true);
      // Set the header
      this.headers.tenant = tenant;
      this.headers.chargingStation = chargingStation;
      this.headers.token = token;
      this.headers.lock = lock;
      // Trace
      const performanceTracingData = await Logging.traceOcppMessageRequest(Constants.MODULE_JSON_OCPP_SERVER_16,
        this.getTenant(), this.getChargingStationID(),
        OCPPUtils.buildServerActionFromOcppCommand(command), commandPayload, '>>', {
          siteAreaID: this.getSiteAreaID(),
          siteID: this.getSiteID(),
          companyID: this.getCompanyID(),
        }
      );
      let result: any;
      try {
        // Call it
        result = await this.chargingStationService[methodName](this.headers, commandPayload);
        // Send Response
        await this.sendMessage(messageId, OCPPMessageType.CALL_RESULT_MESSAGE, command, result);
      } finally {
        // Clean the header
        delete this.headers.chargingStation;
        delete this.headers.tenant;
        delete this.headers.token;
        delete this.headers.lock;
        // Release lock
        await LockingManager.release(lock);
        // Trace
        await Logging.traceOcppMessageResponse(Constants.MODULE_JSON_OCPP_SERVER_16, this.getTenant(), this.getChargingStationID(),
          OCPPUtils.buildServerActionFromOcppCommand(command), commandPayload, result, '<<', {
            siteAreaID: this.getSiteAreaID(),
            siteID: this.getSiteID(),
            companyID: this.getCompanyID(),
          }, performanceTracingData
        );
      }
    } else {
      // Throw Exception
      throw new OCPPError({
        chargingStationID: this.getChargingStationID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
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
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_CONNECTION,
        message: `Cannot retrieve WS client from WS connection with status '${this.getConnectionStatusString()}'`,
      });
      return null;
    }
    return this.chargingStationClient;
  }

  public setChargingStation(chargingStation: ChargingStation): void {
    super.setChargingStation(chargingStation);
    this.chargingStationClient.setChargingStationDetails(chargingStation);
  }

  private async updateChargingStationLastSeen(): Promise<void> {
    // Update once every 60s
    if (!this.lastSeen || (Date.now() - this.lastSeen.getTime()) > Constants.LAST_SEEN_UPDATE_INTERVAL_MILLIS) {
      // Update last seen
      this.lastSeen = new Date();
      const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenant(),
        this.getChargingStationID(), { issuer: true }, ['id']);
      if (chargingStation) {
        await ChargingStationStorage.saveChargingStationRuntimeData(this.getTenant(), this.getChargingStationID(),
          { lastSeen: this.lastSeen });
      }
    }
  }
}
