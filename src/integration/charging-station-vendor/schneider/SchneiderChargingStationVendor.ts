
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import BackendError from '../../../exception/BackendError';
import OCPPUtils from '../../../server/ocpp/utils/OCPPUtils';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import { Action } from '../../../types/Authorization';
import { ChargingProfile } from '../../../types/ChargingProfile';
import ChargingStation, { ConnectorCurrentLimit } from '../../../types/ChargingStation';
import { OCPPChangeConfigurationCommandResult, OCPPConfigurationStatus, OCPPSetChargingProfileCommandResult, OCPPSetCompositeScheduleStatus, OCPPClearChargingProfileCommandResult } from '../../../types/ocpp/OCPPClient';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import ChargingStationVendor from '../ChargingStationVendor';

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

  public async setPowerLimitation(tenantID: string, chargingStation: ChargingStation, connectorID?: number, maxAmps?: number): Promise<OCPPChangeConfigurationCommandResult> {
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
        module: 'SchneiderChargingStationVendor', method: 'setPowerLimitation',
        message: 'The Charging Station has no connector',
        detailedMessages: { maxAmps }
      });
    }
    // Fixed the max amp per connector
    const maxAmpsPerConnector = maxAmps / chargingStation.connectors.length;
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        module: 'SchneiderChargingStationVendor', method: 'setPowerLimitation',
        message: 'Charging Station is not connected to the backend',
      });
    }
    let result: OCPPChangeConfigurationCommandResult;
    try {
      // Change the config
      result = await chargingStationClient.changeConfiguration({
        key: SchneiderChargingStationVendor.OCPP_PARAM_FOR_CHARGE_LIMITATION,
        value: maxAmpsPerConnector + ''
      });
    } catch (error) {
      if (!error.status) {
        throw error;
      }
      result = {
        status: error.status
      };
    }
    // Update the DB OCPP configuration
    if (result.status === OCPPConfigurationStatus.ACCEPTED) {
      // Refresh Configuration
      await OCPPUtils.requestAndSaveChargingStationOcppConfiguration(tenantID, chargingStation);
      // Update the charger's connectors
      for (const connector of chargingStation.connectors) {
        connector.amperageLimit = maxAmpsPerConnector;
      }
      // Save it
      await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
    }
    return result;
  }

  public async setChargingProfile(tenantID: string, chargingStation: ChargingStation, chargingProfile: ChargingProfile): Promise<OCPPSetChargingProfileCommandResult> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        module: 'SchneiderChargingStationVendor', method: 'setChargingProfile',
        message: 'Charging Station is not connected to the backend',
      });
    }
    let result: OCPPSetChargingProfileCommandResult;
    try {
      // Set the Profile
      result = await chargingStationClient.setChargingProfile({
        connectorId: chargingProfile.connectorID,
        csChargingProfiles: chargingProfile.profile
      });
    } catch (error) {
      if (!error.status) {
        throw error;
      }
      result = {
        status: error.status
      };
    }
    return result;
  }

  public async clearChargingProfile(tenantID: string, chargingStation: ChargingStation, chargingProfile: ChargingProfile): Promise<OCPPClearChargingProfileCommandResult> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        module: 'SchneiderChargingStationVendor', method: 'clearChargingProfile',
        message: 'Charging Station is not connected to the backend',
      });
    }
    let result: OCPPClearChargingProfileCommandResult;
    try {
      // Set the Profile
      result = await chargingStationClient.clearChargingProfile({
        connectorId: chargingProfile.connectorID
      });
    } catch (error) {
      if (!error.status) {
        throw error;
      }
      result = {
        status: error.status
      };
    }
    return result;
  }

  public async getConnectorLimit(tenantID: string, chargingStation: ChargingStation, connectorID: number): Promise<ConnectorCurrentLimit> {
    throw new Error('Not yet implemented');
  }
}
