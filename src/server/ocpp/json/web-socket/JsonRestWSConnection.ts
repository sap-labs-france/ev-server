import BackendError from '../../../../exception/BackendError';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import { Command } from '../../../../types/ChargingStation';
import LoggingHelper from '../../../../utils/LoggingHelper';
import OCPPUtils from '../../utils/OCPPUtils';
import WSConnection from './WSConnection';
import WSWrapper from './WSWrapper';
import global from '../../../../types/GlobalType';

const MODULE_NAME = 'JsonRestWSConnection';

export default class JsonRestWSConnection extends WSConnection {
  public constructor(ws: WSWrapper) {
    super(ws);
  }

  public async initialize(): Promise<void> {
    // Init parent
    await super.initialize();
  }

  public async handleRequest(command: Command, commandPayload: Record<string, unknown> | string): Promise<any> {
    let result: any;
    // Check Command
    if (!this.isValidOcppClientCommand(command)) {
      throw new BackendError({
        ...LoggingHelper.getWSConnectionProperties(this),
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
        ...LoggingHelper.getWSConnectionProperties(this),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: 'Charging Station not found',
        action: OCPPUtils.buildServerActionFromOcppCommand(command)
      });
    }
    // Get the client from JSON Server
    const chargingStationClient = global.centralSystemJsonServer.getChargingStationClient(this.getTenant(), chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        ...LoggingHelper.getWSConnectionProperties(this),
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
        ...LoggingHelper.getWSConnectionProperties(this),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: `'${actionMethod}' is not implemented`,
        action: OCPPUtils.buildServerActionFromOcppCommand(command)
      });
    }
    return result;
  }

  public onPing(message: string): void {
  }

  public onPong(message: string): void {
  }

  private isValidOcppClientCommand(command: Command): boolean {
    // Only client request is allowed
    return [
      Command.CANCEL_RESERVATION,
      Command.CHANGE_AVAILABILITY,
      Command.CHANGE_CONFIGURATION,
      Command.CLEAR_CACHE,
      Command.CLEAR_CHARGING_PROFILE,
      Command.DATA_TRANSFER,
      Command.GET_COMPOSITE_SCHEDULE,
      Command.GET_CONFIGURATION,
      Command.GET_DIAGNOSTICS,
      Command.REMOTE_START_TRANSACTION,
      Command.REMOTE_STOP_TRANSACTION,
      Command.RESERVE_NOW,
      Command.RESET,
      Command.SET_CHARGING_PROFILE,
      Command.UNLOCK_CONNECTOR,
      Command.UPDATE_FIRMWARE,
    ].includes(command);
  }
}
