import BackendError from '../../../exception/BackendError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import { Command } from '../../../types/ChargingStation';
import OCPPUtils from '../utils/OCPPUtils';
import WSConnection from './WSConnection';
import WSWrapper from './WSWrapper';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'JsonRestWSConnection';

export default class JsonRestWSConnection extends WSConnection {
  constructor(ws: WSWrapper) {
    super(ws);
  }

  public async initialize(): Promise<void> {
    // Init parent
    await super.initialize();
  }

  public async handleRequest(command: Command, commandPayload: Record<string, unknown> | string): Promise<any> {
    let result: any;
    // Check Command
    if (!this.isValidOcppCommandFromRest(command)) {
      throw new BackendError({
        chargingStationID: this.getChargingStationID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: `Command '${command}' is not allowed from REST server`,
        action: OCPPUtils.buildServerActionFromOcppCommand(command)
      });
    }
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
    const chargingStationClient = await global.centralSystemJsonServer.getChargingStationClient(this.getTenant(), chargingStation);
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
      result = await chargingStationClient[actionMethod](commandPayload);
    } else {
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
    return result;
  }

  public async onPing(message: string): Promise<void> {
  }

  public async onPong(message: string): Promise<void> {
  }

  private isValidOcppCommandFromRest(command: Command): boolean {
    // Only client request is allowed
    return [
      Command.RESET,
      Command.CLEAR_CACHE,
      Command.GET_CONFIGURATION,
      Command.CHANGE_CONFIGURATION,
      Command.REMOTE_START_TRANSACTION,
      Command.REMOTE_STOP_TRANSACTION,
      Command.UNLOCK_CONNECTOR,
      Command.SET_CHARGING_PROFILE,
      Command.GET_COMPOSITE_SCHEDULE,
      Command.CLEAR_CHARGING_PROFILE,
      Command.CHANGE_AVAILABILITY,
      Command.GET_DIAGNOSTICS,
      Command.UPDATE_FIRMWARE,
      Command.RESERVE_NOW,
      Command.CANCEL_RESERVATION
    ].includes(command);
  }
}
