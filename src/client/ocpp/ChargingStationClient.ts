import BackendError from '../../exception/BackendError';
import TSGlobal from '../../types/GlobalType';
let var global: TSGlobal;

export default abstract class ChargingStationClient {

  reset(params) {
  }

  clearCache() {
  }

  getConfiguration(params) {
  }

  changeConfiguration(params) {
  }

  remoteStartTransaction(params) {
  }

  remoteStopTransaction(params) {
  }

  unlockConnector(params) {
  }

  setChargingProfile(params) {
  }

  getCompositeSchedule(params) {
  }

  clearChargingProfile(params) {
  }

  changeAvailability(params) {
  }

  getDiagnostics(params) {
  }

  updateFirmware(params) {
  }

  /**
   * Default handling of OCPP command. It can be refine with some special methods in case of needs
   *
   * @param {*} commandName: OCPP command name
   * @param {*} params: OCPP parameters for the command
   * @returns
   * @memberof ChargingStationClient
   */
  sendCommand(commandName, params) {
    try {
      // Handle Requests
      switch (commandName) {
        // Reset
        case 'Reset':
          return this.reset(params);
        // Clear cache
        case 'ClearCache':
          return this.clearCache();
        // Get Configuration
        case 'GetConfiguration':
          return this.getConfiguration(params);
        // Set Configuration
        case 'ChangeConfiguration':
          // Change the config
          return this.changeConfiguration(params);
        // Unlock Connector
        case 'UnlockConnector':
          return this.unlockConnector(params);
        // Start Transaction
        case 'RemoteStartTransaction':
          return this.remoteStartTransaction(params);
        // Stop Transaction
        case 'RemoteStopTransaction':
          return this.remoteStopTransaction(params);
        // Set Charging Profile
        case 'SetChargingProfile':
          return this.setChargingProfile(params);
        // Get Composite Schedule (power limits)
        case 'GetCompositeSchedule':
          return this.getCompositeSchedule(params);
        // Clear charging profiles
        case 'ClearChargingProfile':
          return this.clearChargingProfile(params);
        // Change availibility
        case 'ChangeAvailability':
          return this.changeAvailability(params);
        // Get diagnostic
        case 'GetDiagnostics':
          return this.getDiagnostics(params);
        // Update Firmware
        case 'UpdateFirmware':
          return this.updateFirmware(params);
        default:
          // throw error
          throw new BackendError('', `OCPP Command ${commandName} not supported in backend`,
            "ChargingStationClient", "sendCommand");
      }
    } catch (error) {
      throw new BackendError('', `OCPP Command ${commandName} error ${JSON.stringify(error, null, " ")}`,
        "ChargingStationClient", "sendCommand");
    }
  }
}
