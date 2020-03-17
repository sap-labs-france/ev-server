/* eslint-disable @typescript-eslint/member-ordering */
import ChargingStationClientFactory from '../../client/ocpp/ChargingStationClientFactory';
import BackendError from '../../exception/BackendError';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { Action } from '../../types/Authorization';
import { ChargingProfile } from '../../types/ChargingProfile';
import ChargingStation, { ConnectorCurrentLimit, StaticLimitAmps } from '../../types/ChargingStation';
import { OCPPChangeConfigurationCommandResult, OCPPChargingProfileStatus, OCPPClearChargingProfileCommandResult, OCPPClearChargingProfileStatus, OCPPConfigurationStatus, OCPPGetCompositeScheduleCommandResult, OCPPGetCompositeScheduleStatus, OCPPSetChargingProfileCommandResult } from '../../types/ocpp/OCPPClient';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import AppError from '../../exception/AppError';
import { HTTPError } from '../../types/HTTPError';

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
        message: `Not allowed to limit the power on Connector ID '${connectorID}' but only on the whole Charging Station (Connector ID '0')`,
      });
    }
    if (maxAmps < StaticLimitAmps.MIN_LIMIT) {
      throw new BackendError({
        source: chargingStation.id,
        module: 'ChargingStationVendor', method: 'setPowerLimitation',
        message: `Cannot set the minimum power limit to ${maxAmps}A, minimum expected ${StaticLimitAmps.MIN_LIMIT}A`,
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
        action: Action.CHARGING_PROFILE_UPDATE,
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
      let result;
      // Check if we have to load all connectors in case connector 0 fails
      if (chargingProfile.connectorID === 0) {
        // Set the Profile
        result = await chargingStationClient.setChargingProfile({
          connectorId: schneiderChargingProfile.connectorID,
          csChargingProfiles: schneiderChargingProfile.profile
        });
        // Call each connector?
        if (result.status !== OCPPChargingProfileStatus.ACCEPTED) {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.CHARGING_PROFILE_DELETE,
            message: 'Set Charging Profile on Connector ID 0 has been rejected, will try connector per connector',
            module: 'ChargingStationVendor', method: 'clearChargingProfile',
            detailedMessages: { result }
          });
          result = [] as OCPPSetChargingProfileCommandResult[];
          for (const connector of chargingStation.connectors) {
            result.push(await chargingStationClient.setChargingProfile({
              connectorId: connector.connectorId,
              csChargingProfiles: schneiderChargingProfile.profile
            }));
          }
        }
        // Connector ID > 0
      } else {
        result = chargingStationClient.setChargingProfile({
          connectorId: schneiderChargingProfile.connectorID,
          csChargingProfiles: schneiderChargingProfile.profile
        });
      }

      // Check for Array
      let resultStatus = OCPPChargingProfileStatus.ACCEPTED;
      if (Array.isArray(result)) {
        for (const oneResult of result as OCPPSetChargingProfileCommandResult[]) {
          if (oneResult.status !== OCPPChargingProfileStatus.ACCEPTED) {
            resultStatus = oneResult.status;
            break;
          }
        }
      } else {
        resultStatus = (result as OCPPSetChargingProfileCommandResult).status;
      }
      if (resultStatus !== OCPPChargingProfileStatus.ACCEPTED) {
        throw new AppError({
          source: chargingStation.id,
          action: Action.CHARGING_PROFILE_UPDATE,
          errorCode: HTTPError.SET_CHARGING_PROFILE_ERROR,
          module: 'ChargingStationVendor', method: 'setChargingProfile',
          message: `Cannot set the Charging Profile!`,
          detailedMessages: { result, chargingProfile },
        });
      }
      // Save
      await ChargingStationStorage.saveChargingProfile(tenantID, chargingProfile);
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.CHARGING_PROFILE_UPDATE,
        module: 'ChargingStationVendor', method: 'setChargingProfile',
        message: 'Charging Profile has been successfully pushed and saved',
        detailedMessages: { chargingProfile }
      });
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
        action: Action.CHARGING_PROFILE_DELETE,
        module: 'ChargingStationVendor', method: 'clearChargingProfile',
        message: 'Charging Station is not connected to the backend',
      });
    }
    try {
      let result;
      // Check if we have to load all connectors in case connector 0 fails
      if (chargingProfile.connectorID === 0) {
        // Clear the Profile
        result = await chargingStationClient.clearChargingProfile({
          connectorId: chargingProfile.connectorID
        });
        // Call each connector?
        if (result.status !== OCPPClearChargingProfileStatus.ACCEPTED) {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.CHARGING_PROFILE_DELETE,
            module: 'ChargingStationVendor', method: 'clearChargingProfile',
            message: 'Clear Charging Profile on Connector ID 0 has been rejected, will try connector per connector',
            detailedMessages: { result }
          });
          result = [] as OCPPClearChargingProfileCommandResult[];
          for (const connector of chargingStation.connectors) {
            // Clear the Profile
            result.push(await chargingStationClient.clearChargingProfile({
              connectorId: connector.connectorId
            }));
          }
          // Reapply the current limitation
          result = await this.setPowerLimitation(tenantID, chargingStation, 0,
            Utils.getTotalAmpsOfChargingStation(chargingStation));
        }
        // Reapply the current limitation
        if (result.status === OCPPClearChargingProfileStatus.ACCEPTED) {
          await this.setPowerLimitation(tenantID, chargingStation, 0,
            Utils.getTotalAmpsOfChargingStation(chargingStation));
        }
        // Connector ID > 0
      } else {
        // Clear the Profile
        result = await chargingStationClient.clearChargingProfile({
          connectorId: chargingProfile.connectorID
        });
        if (result.status === OCPPClearChargingProfileStatus.ACCEPTED) {
          // Reapply the current limitation
          await this.setPowerLimitation(tenantID, chargingStation, 0,
            Utils.getTotalAmpsOfChargingStation(chargingStation));
        }
      }

      // Delete
      await ChargingStationStorage.deleteChargingProfile(tenantID, chargingProfile.id);
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.CHARGING_PROFILE_DELETE,
        module: 'ChargingStationVendor', method: 'clearChargingProfile',
        message: 'Charging Profile has been deleted successfully',
      });
    } catch (error) {
      if (!error.status) {
        throw error;
      }
      return {
        status: error.status
      };
    }
  }

  public async clearAllChargingProfiles(tenantID: string, chargingStation: ChargingStation,
    chargingProfiles: ChargingProfile[]) {
    if (chargingProfiles) {
      for (const chargingProfile of chargingProfiles) {
        await this.clearChargingProfile(tenantID, chargingStation, chargingProfile);
      }
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
  }

  public async getCurrentConnectorLimit(tenantID: string,
    chargingStation: ChargingStation, connectorID: number): Promise<ConnectorCurrentLimit> {
    // Default
    const limitDefaultMaxAmps = chargingStation.connectors[connectorID - 1].amperageLimit;
    // Should fail safe!
    try {
      if (connectorID === 0) {
        throw new BackendError({
          source: chargingStation.id,
          action: Action.GET_CONNECTOR_CURRENT_LIMIT,
          module: 'ChargingStationVendor', method: 'getCurrentConnectorLimit',
          message: 'Cannot get the current connector limit on Connector ID 0',
        });
      }
      // Get the current Charging Plan
      const compositeSchedule = await this.getCompositeSchedule(
        tenantID, chargingStation, connectorID, 60) as OCPPGetCompositeScheduleCommandResult;
      // Get the current connector limitation from the charging plan
      // When startPeriod of first schedule is 0 meaning that the charging plan is in progress
      if (compositeSchedule && compositeSchedule.chargingSchedule && compositeSchedule.chargingSchedule.chargingSchedulePeriod &&
        compositeSchedule.chargingSchedule.chargingSchedulePeriod.length > 0 &&
        compositeSchedule.chargingSchedule.chargingSchedulePeriod[0].startPeriod === 0) {
        let connectorLimitAmps = Utils.convertToInt(compositeSchedule.chargingSchedule.chargingSchedulePeriod[0].limit);
        // Check
        if (connectorLimitAmps > limitDefaultMaxAmps) {
          connectorLimitAmps = limitDefaultMaxAmps
        }
        return {
          limitAmps: connectorLimitAmps,
          limitWatts: Utils.convertAmpToPowerWatts(chargingStation, connectorLimitAmps)
        };
      }
      // Get the current connector limitation from OCPP parameter
      const ocppConfiguration = await OCPPUtils.requestChargingStationConfiguration(
        tenantID, chargingStation, { key: [this.getOCPPParamNameForChargingLimitation()] });
      if (ocppConfiguration && ocppConfiguration.configurationKey && ocppConfiguration.configurationKey.length > 0 &&
        ocppConfiguration.configurationKey[0].value) {
        let connectorLimitAmps = Utils.convertToInt(ocppConfiguration.configurationKey[0].value);
        // Check
        if (connectorLimitAmps > limitDefaultMaxAmps) {
          connectorLimitAmps = limitDefaultMaxAmps
        }
        return {
          limitAmps: connectorLimitAmps,
          limitWatts: Utils.convertAmpToPowerWatts(chargingStation, connectorLimitAmps)
        };
      }
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.GET_CONNECTOR_CURRENT_LIMIT,
        message: `Cannot retrieve the current limitation on Connector ID '${connectorID}'`,
        module: 'ChargingStationVendor', method: 'getCurrentConnectorLimit',
        detailedMessages: error
      });
    }
    // Default on current connector
    return {
      limitAmps: limitDefaultMaxAmps,
      limitWatts: Utils.convertAmpToPowerWatts(chargingStation, limitDefaultMaxAmps)
    };
  }
}
