import ChargingStation, { ChargingProfile } from '../../../types/ChargingStation';
import { Action } from '../../../types/Authorization';
import ChargingStationVendor from '../ChargingStationVendor';
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import BackendError from '../../../exception/BackendError';
import OCPPUtils from '../../../server/ocpp/utils/OCPPUtils';
import { OCPPConfigurationStatus } from '../../../types/ocpp/OCPPClient';
import Constants from '../../../utils/Constants';
import Utils from '../../../utils/Utils';
import Logging from '../../../utils/Logging';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';

export default class SchneiderChargingStationVendor extends ChargingStationVendor {
  private static OCPP_PARAM_FOR_CHARGE_LIMITATION = 'maxintensitysocket';

  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  public async checkUpdateOfOCPPParams(tenantID: string, chargingStation: ChargingStation, ocppParamName: string, ocppParamValue: string) {
    if (ocppParamName === SchneiderChargingStationVendor.OCPP_PARAM_FOR_CHARGE_LIMITATION) {
      // Update the charger
      for (const connector of chargingStation.connectors) {
        connector.amperageLimit = Utils.convertToInt(ocppParamValue);
      }
      // Save it
      await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        message: 'Charging Station power limit has been updated following an OCPP parameter update',
        module: 'SchneiderChargingStationVendor', method: 'checkUpdateOfOCPPParams',
        detailedMessages: { ocppParamName, ocppParamValue, chargingStation }
      });
    }
  }

  public async setPowerLimitation(tenantID: string, chargingStation: ChargingStation, connectorID?: number, maxAmps?: number) {
    if (connectorID > 0) {
      throw new BackendError({
        source: chargingStation.id,
        module: 'SchneiderChargingStationVendor',
        method: 'setPowerLimitation',
        message: `Cannot limit the power for connector '${connectorID}', only for the whole Charging Station`,
      });
    }
    if (Utils.isEmptyArray(chargingStation.connectors)) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        module: 'SchneiderChargingStationVendor',
        method: 'setPowerLimitation',
        message: 'The Charging Station has not connector',
        detailedMessages: { maxAmps }
      });
    }
    // Fixed the max amp per connector
    const maxAmpsPerConnector = maxAmps / chargingStation.connectors.length;
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    // Change the config
    const result = await chargingStationClient.changeConfiguration({
      key: SchneiderChargingStationVendor.OCPP_PARAM_FOR_CHARGE_LIMITATION,
      value: maxAmpsPerConnector + ''
    });
    // Check
    if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        module: 'SchneiderChargingStationVendor',
        method: 'setPowerLimitation',
        message: `Failed to limit the power to '${maxAmps}' Amps ('${maxAmpsPerConnector}' Amps per connector): ${result.status}`,
        detailedMessages: result,
      });
    }
    Logging.logInfo({
      tenantID: tenantID,
      source: chargingStation.id,
      action: Action.POWER_LIMITATION,
      message: `The power limitation has been successfully set to '${maxAmps}' Amps ('${maxAmpsPerConnector}' Amps per connector)`,
      module: 'SchneiderChargingStationVendor', method: 'setPowerLimitation',
      detailedMessages: result,
    });
    // Refresh Configuration
    await OCPPUtils.requestAndSaveChargingStationOcppConfiguration(tenantID, chargingStation);
    // Update the charger's connectors
    for (const connector of chargingStation.connectors) {
      connector.amperageLimit = maxAmpsPerConnector;
    }
    // Save it
    await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
  }

  public async setChargingProfile(tenantID: string, chargingStation: ChargingStation, chargingProfile: ChargingProfile) {
    throw new Error('Method not implemented.');
  }
}
