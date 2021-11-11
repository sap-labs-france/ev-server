import ChargingStation, { Command } from '../../../types/ChargingStation';
import { OCPPProtocol, OCPPVersion } from '../../../types/ocpp/OCPPServer';

import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import JsonChargingStationClient from '../../../client/ocpp/json/JsonChargingStationClient';
import JsonChargingStationService from './services/JsonChargingStationService';
import Logging from '../../../utils/Logging';
import OCPPError from '../../../exception/OcppError';
import { OCPPErrorType } from '../../../types/ocpp/OCPPCommon';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import OCPPUtils from '../utils/OCPPUtils';
import WSConnection from './WSConnection';
import { WebSocket } from 'uWebSockets.js';

const MODULE_NAME = 'JsonWSConnection';

export default class JsonWSConnection extends WSConnection {
  public isConnectionAlive: boolean;
  private chargingStationClient: JsonChargingStationClient;
  private chargingStationService: JsonChargingStationService;
  private headers: OCPPHeader;
  private lastSeen: Date;

  constructor(webSocket: WebSocket, url: string) {
    // Call super
    super(webSocket, url);
    // Create the Json Client
    this.chargingStationClient = new JsonChargingStationClient(this, this.getTenant(), this.getChargingStationID());
    // Create the Json Server Service
    this.chargingStationService = new JsonChargingStationService();
    // Ok
    this.isConnectionAlive = true;
  }

  public async initialize(): Promise<void> {
    // Init parent
    await super.initialize();
    // Initialize the default Headers
    this.headers = {
      chargeBoxIdentity: this.getChargingStationID(),
      ocppVersion: (this.getWSConnection().protocol.startsWith('ocpp') ? this.getWSConnection().protocol.replace('ocpp', '') : this.getWSConnection().protocol) as OCPPVersion,
      ocppProtocol: OCPPProtocol.JSON,
      chargingStationURL: Configuration.getJsonEndpointConfig().baseSecureUrl,
      tenantID: this.getTenantID(),
      tokenID: this.getTokenID(),
      From: {
        Address: this.getClientIP()
      }
    };
  }

  public async onPing(message: string): Promise<void> {
    this.isConnectionAlive = true;
    await this.updateChargingStationLastSeen();
  }

  public async onPong(message: string): Promise<void> {
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
      const { tenant, chargingStation, token } = await OCPPUtils.checkAndGetChargingStationData(OCPPUtils.buildServerActionFromOcppCommand(command),
        this.getTenantID(), this.getChargingStationID(), this.getTokenID());
      // Set the header
      this.headers.tenant = tenant;
      this.headers.chargingStation = chargingStation;
      this.headers.token = token;
      // Trace
      const performanceTracingData = await Logging.traceOcppMessageRequest(Constants.MODULE_JSON_OCPP_SERVER_16,
        this.getTenant(), this.getChargingStationID(), OCPPUtils.buildServerActionFromOcppCommand(command), commandPayload, '>>',
        { siteAreaID: this.getSiteAreaID(), siteID: this.getSiteID(), companyID: this.getCompanyID() }
      );
      let result: any;
      try {
        // Call it
        result = await this.chargingStationService[methodName](this.headers, commandPayload);
        // Send Response
        await this.sendResponse(messageId, command, result);
      } finally {
        // Clean the header
        delete this.headers.chargingStation;
        delete this.headers.tenant;
        delete this.headers.token;
        // Trace
        await Logging.traceOcppMessageResponse(Constants.MODULE_JSON_OCPP_SERVER_16, this.getTenant(), this.getChargingStationID(),
          OCPPUtils.buildServerActionFromOcppCommand(command), commandPayload, result, '<<',
          { siteAreaID: this.getSiteAreaID(), siteID: this.getSiteID(), companyID: this.getCompanyID() }, performanceTracingData
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
