import BackendError from '../../../exception/BackendError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import { Command } from '../../../types/ChargingStation';
import OCPPUtils from '../utils/OCPPUtils';
import WSConnection from './WSConnection';
import { WebSocket } from 'uWebSockets.js';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'JsonRestWSConnection';

export default class JsonRestWSConnection extends WSConnection {
  constructor(webSocket: WebSocket, url: string) {
    super(webSocket, url);
  }

  public async initialize(): Promise<void> {
    // Init parent
    await super.initialize();
  }

  public async handleRequest(messageId: string, command: Command, commandPayload: Record<string, unknown> | string): Promise<void> {
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenant(), this.getChargingStationID());
    if (!chargingStation) {
      throw new BackendError({
        chargingStationID: this.getChargingStationID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: 'Charging Station not found',
        action: OCPPUtils.buildServerActionFromOcppCommand(command)
      });
    }
    // Get the client from JSON Server
    const chargingStationClient = global.centralSystemJsonServer.getChargingStationClient(this.getTenantID(), this.getChargingStationID(), {
      siteAreaID: this.getSiteAreaID(),
      siteID: this.getSiteID(),
      companyID: this.getCompanyID()
    });
    if (!chargingStationClient) {
      throw new BackendError({
        chargingStationID: this.getChargingStationID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: 'Charging Station is not connected to the backend',
        action: OCPPUtils.buildServerActionFromOcppCommand(command)
      });
    }
    // Call the client
    const actionMethod = command[0].toLowerCase() + command.substring(1);
    // Call
    if (typeof chargingStationClient[actionMethod] === 'function') {
      // Call the method
      const result = await chargingStationClient[actionMethod](commandPayload);
      // Send Response
      await this.sendResponse(messageId, command, result);
    } else {
      // Error
      throw new BackendError({
        chargingStationID: this.getChargingStationID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: `'${actionMethod}' is not implemented`,
        action: OCPPUtils.buildServerActionFromOcppCommand(command)
      });
    }
  }

  public async onPing(message: string): Promise<void> {
  }

  public async onPong(message: string): Promise<void> {
  }
}

