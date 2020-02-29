import ChargingStationClientFactory from '../../client/ocpp/ChargingStationClientFactory';
import BackendError from '../../exception/BackendError';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { Action } from '../../types/Authorization';
import { ChargingProfile } from '../../types/ChargingProfile';
import ChargingStation, { ConnectorCurrentLimit } from '../../types/ChargingStation';
import { OCPPChangeConfigurationCommandResult, OCPPClearChargingProfileCommandResult, OCPPConfigurationStatus, OCPPGetCompositeScheduleCommandResult, OCPPGetCompositeScheduleStatus, OCPPSetChargingProfileCommandResult } from '../../types/ocpp/OCPPClient';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';

export default abstract class ChargingStationVendor {
  protected chargingStation: ChargingStation;

  constructor(chargingStation: ChargingStation) {
    this.chargingStation = chargingStation;
  }

  public abstract getOCPPParamNameForChargingLimitation(): string;

  public async setPowerLimitation(tenantID: string, chargingStation: ChargingStation, connectorID?: number, maxAmps?: number): Promise<OCPPChangeConfigurationCommandResult> {
    if (connectorID > 0) {
      throw new BackendError({
        source: chargingStation.id,
        module: 'ChargingStationVendor',
        method: 'setPowerLimitation',
        message: `Cannot limit the power for connector '${connectorID}', only for the whole Charging Station`,
      });
    }
    if (Utils.isEmptyArray(chargingStation.connectors)) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        module: 'ChargingStationVendor', method: 'setPowerLimitation',
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
        module: 'ChargingStationVendor', method: 'setPowerLimitation',
        message: 'Charging Station is not connected to the backend',
      });
    }
    let result: OCPPChangeConfigurationCommandResult;
    try {
      // Change the config
      result = await chargingStationClient.changeConfiguration({
        key: this.getOCPPParamNameForChargingLimitation(),
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
      await ChargingStationStorage.saveChargingStation(Action.POWER_LIMITATION, tenantID, chargingStation);
    }
    return result;
  }

  public async checkUpdateOfOCPPParams(tenantID: string, chargingStation: ChargingStation, ocppParamName: string, ocppParamValue: string) {
    if (ocppParamName === this.getOCPPParamNameForChargingLimitation()) {
      // Update the charger
      for (const connector of chargingStation.connectors) {
        connector.amperageLimit = Utils.convertToInt(ocppParamValue);
      }
      // Save it
      await ChargingStationStorage.saveChargingStation(Action.POWER_LIMITATION, tenantID, chargingStation);
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        message: 'Charging Station power limit has been updated following an OCPP parameter update',
        module: 'ChargingStationVendor', method: 'checkUpdateOfOCPPParams',
        detailedMessages: { ocppParamName, ocppParamValue, chargingStation }
      });
    }
  }

  public async setChargingProfile(tenantID: string, chargingStation: ChargingStation, chargingProfile: ChargingProfile): Promise<OCPPSetChargingProfileCommandResult> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        module: 'ChargingStationVendor', method: 'setChargingProfile',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Clone
    const schneiderChargingProfile = JSON.parse(JSON.stringify(chargingProfile));
    // Check connector
    if (schneiderChargingProfile.connectorID === 0 && schneiderChargingProfile.profile && schneiderChargingProfile.profile.chargingSchedule && chargingStation.connectors) {
      // Divide the power by the number of connectors
      for (const schedulePeriod of schneiderChargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
        schedulePeriod.limit /= chargingStation.connectors.length;
      }
    }
    let result: OCPPSetChargingProfileCommandResult;
    try {
      // Set the Profile
      result = await chargingStationClient.setChargingProfile({
        connectorId: schneiderChargingProfile.connectorID,
        csChargingProfiles: schneiderChargingProfile.profile
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
        module: 'ChargingStationVendor', method: 'clearChargingProfile',
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

  public async getCompositeSchedule(tenantID: string, chargingStation: ChargingStation, connectorID: number, durationSecs: number): Promise<OCPPGetCompositeScheduleCommandResult|OCPPGetCompositeScheduleCommandResult[]> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        module: 'ChargingStationVendor', method: 'getCompositeSchedule',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Check if we have to load all connectors in case connector 0 fails
    if (connectorID === 0) {
      // Test call for connector 0
      const result = await chargingStationClient.getCompositeSchedule({
        connectorId: connectorID,
        duration: durationSecs,
        chargingRateUnit: chargingStation.powerLimitUnit
      });
      // Call each connector?
      if (result.status !== OCPPGetCompositeScheduleStatus.ACCEPTED) {
        const results = [] as OCPPGetCompositeScheduleCommandResult[];
        for (const connector of chargingStation.connectors) {
          const result = await chargingStationClient.getCompositeSchedule({
            connectorId: connector.connectorId,
            duration: durationSecs,
            chargingRateUnit: chargingStation.powerLimitUnit
          });
          results.push(result);
        }
        return results;
      }
      return result;
    // Connector ID > 0
    }
    // Execute it
    return chargingStationClient.getCompositeSchedule({
      connectorId: connectorID,
      duration: durationSecs,
      chargingRateUnit: chargingStation.powerLimitUnit
    });

  }

  public async getCurrentConnectorLimit(tenantID: string, chargingStation: ChargingStation, connectorID: number): Promise<ConnectorCurrentLimit> {
    return {
      limitAmps: chargingStation.connectors[connectorID - 1].amperageLimit,
      limitWatts: chargingStation.connectors[connectorID - 1].power
    };
  }
}
