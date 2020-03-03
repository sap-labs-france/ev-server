/* eslint-disable @typescript-eslint/member-ordering */
import ChargingStationClientFactory from '../../client/ocpp/ChargingStationClientFactory';
import BackendError from '../../exception/BackendError';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { Action } from '../../types/Authorization';
import { ChargingProfile } from '../../types/ChargingProfile';
import ChargingStation, { ConnectorCurrentLimit } from '../../types/ChargingStation';
import { OCPPChangeConfigurationCommandResult, OCPPClearChargingProfileCommandResult, OCPPConfigurationStatus, OCPPGetCompositeScheduleCommandResult, OCPPGetCompositeScheduleStatus, OCPPSetChargingProfileCommandResult, OCPPClearChargingProfileStatus, OCPPChargingProfileStatus } from '../../types/ocpp/OCPPClient';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';

export default abstract class ChargingStationVendor {
  protected chargingStation: ChargingStation;

  constructor(chargingStation: ChargingStation) {
    this.chargingStation = chargingStation;
  }

  public abstract getOCPPParamNameForChargingLimitation(): string;

  public async setPowerLimitation(tenantID: string, chargingStation: ChargingStation,
    connectorID?: number, maxAmps?: number): Promise<OCPPChangeConfigurationCommandResult> {
    if (connectorID > 0) {
      throw new BackendError({
        source: chargingStation.id,
        module: 'ChargingStationVendor', method: 'setPowerLimitation',
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

  public async checkUpdateOfOCPPParams(tenantID: string, chargingStation: ChargingStation,
    ocppParamName: string, ocppParamValue: string) {
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

  public async setChargingProfile(tenantID: string, chargingStation: ChargingStation,
    chargingProfile: ChargingProfile): Promise<OCPPSetChargingProfileCommandResult | OCPPSetChargingProfileCommandResult[]> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.SET_CHARGING_PROFILE,
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
    try {
      // Check if we have to load all connectors in case connector 0 fails
      if (chargingProfile.connectorID === 0) {
        // Set the Profile
        const result = await chargingStationClient.setChargingProfile({
          connectorId: schneiderChargingProfile.connectorID,
          csChargingProfiles: schneiderChargingProfile.profile
        });
        // Call each connector?
        if (result.status !== OCPPChargingProfileStatus.ACCEPTED) {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.CLEAR_CHARGING_PROFILE,
            message: 'Set Charging Profile on Connector ID 0 has been rejected, will try connector per connector',
            module: 'ChargingStationVendor', method: 'clearChargingProfile',
            detailedMessages: { result }
          });
          let results = [] as OCPPSetChargingProfileCommandResult[];
          for (const connector of chargingStation.connectors) {
            const result = await chargingStationClient.setChargingProfile({
              connectorId: connector.connectorId,
              csChargingProfiles: schneiderChargingProfile.profile
            });
            results.push(result);
          }
          return results;
        }
        return result;
        // Connector ID > 0
      } else {
        return chargingStationClient.setChargingProfile({
          connectorId: schneiderChargingProfile.connectorID,
          csChargingProfiles: schneiderChargingProfile.profile
        });
      }
    } catch (error) {
      if (!error.status) {
        throw error;
      }
      return {
        status: error.status
      };
    }
  }

  public async clearChargingProfile(tenantID: string, chargingStation: ChargingStation,
    chargingProfile: ChargingProfile): Promise<OCPPClearChargingProfileCommandResult | OCPPClearChargingProfileCommandResult[]> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.CLEAR_CHARGING_PROFILE,
        module: 'ChargingStationVendor', method: 'clearChargingProfile',
        message: 'Charging Station is not connected to the backend',
      });
    }
    try {
      // Check if we have to load all connectors in case connector 0 fails
      if (chargingProfile.connectorID === 0) {
        // Clear the Profile
        const result = await chargingStationClient.clearChargingProfile({
          connectorId: chargingProfile.connectorID
        });
        // Call each connector?
        if (result.status !== OCPPClearChargingProfileStatus.ACCEPTED) {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.CLEAR_CHARGING_PROFILE,
            message: 'Clear Charging Profile on Connector ID 0 has been rejected, will try connector per connector',
            module: 'ChargingStationVendor', method: 'clearChargingProfile',
            detailedMessages: { result }
          });
          let results = [] as OCPPClearChargingProfileCommandResult[];
          for (const connector of chargingStation.connectors) {
            // Clear the Profile
            const result = await chargingStationClient.clearChargingProfile({
              connectorId: connector.connectorId
            });
            results.push(result);
          }
          return results;
        }
        return result;
        // Connector ID > 0
      } else {
        // Clear the Profile
        return chargingStationClient.clearChargingProfile({
          connectorId: chargingProfile.connectorID
        });
      }
    } catch (error) {
      if (!error.status) {
        throw error;
      }
      return {
        status: error.status
      };
    }
  }

  public async getCompositeSchedule(tenantID: string, chargingStation: ChargingStation,
    connectorID: number, durationSecs: number): Promise<OCPPGetCompositeScheduleCommandResult | OCPPGetCompositeScheduleCommandResult[]> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.GET_COMPOSITE_SCHEDULE,
        module: 'ChargingStationVendor', method: 'getCompositeSchedule',
        message: 'Charging Station is not connected to the backend',
      });
    }
    try {
      // Check if we have to load all connectors in case connector 0 fails
      if (connectorID === 0) {
        // Get the Composite Schedule
        const result = await chargingStationClient.getCompositeSchedule({
          connectorId: connectorID,
          duration: durationSecs,
          chargingRateUnit: chargingStation.powerLimitUnit
        });
        // Call each connector?
        if (result.status !== OCPPGetCompositeScheduleStatus.ACCEPTED) {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.GET_COMPOSITE_SCHEDULE,
            message: 'Get Composite Schedule on Connector ID 0 has been rejected, will try connector per connector',
            module: 'ChargingStationVendor', method: 'getCompositeSchedule',
            detailedMessages: { result }
          });
          let results = [] as OCPPGetCompositeScheduleCommandResult[];
          for (const connector of chargingStation.connectors) {
            // Get the Composite Schedule
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
      } else {
        // Get the Composite Schedule
        return chargingStationClient.getCompositeSchedule({
          connectorId: connectorID,
          duration: durationSecs,
          chargingRateUnit: chargingStation.powerLimitUnit
        });
      }
    } catch (error) {
      if (!error.status) {
        throw error;
      }
      return {
        status: error.status
      };
    }
    // Execute it
    return chargingStationClient.getCompositeSchedule({
      connectorId: connectorID,
      duration: durationSecs,
      chargingRateUnit: chargingStation.powerLimitUnit
    });

  }

  public async getCurrentConnectorLimit(tenantID: string, chargingStation: ChargingStation,
    connectorID: number): Promise<ConnectorCurrentLimit> {
    const compositeSchedule = await this.getCompositeSchedule(tenantID, chargingStation, connectorID, 60);
    if (compositeSchedule[0].chargingSchedule) {
      return {
        limitAmps: compositeSchedule[0].chargingSchedule.chargingSchedulePeriod[0].limit,
        limitWatts: Utils.convertAmpToPowerWatts(chargingStation, compositeSchedule[0].chargingSchedule.chargingSchedulePeriod[0].limit)
      };
    }
    const staticLimit = await OCPPUtils.requestChargingStationConfiguration(tenantID, chargingStation, { key: [this.getOCPPParamNameForChargingLimitation()] });
    if (staticLimit.configurationKey) {
      return {
        limitAmps: staticLimit.configurationKey[0].value as unknown as number,
        limitWatts: Utils.convertAmpToPowerWatts(chargingStation, staticLimit.configurationKey[0].value as unknown as number)
      };
    }
    return {
      limitAmps: chargingStation.connectors[connectorID - 1].amperageLimit,
      limitWatts: chargingStation.connectors[connectorID - 1].power
    };
  }
}
