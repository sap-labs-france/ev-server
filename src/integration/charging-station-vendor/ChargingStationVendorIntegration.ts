import { ChargingProfile, ChargingSchedule } from '../../types/ChargingProfile';
import ChargingStation, { ConnectorCurrentLimit, ConnectorCurrentLimitSource, StaticLimitAmps } from '../../types/ChargingStation';
import { OCPPChangeConfigurationCommandResult, OCPPChargingProfileStatus, OCPPClearChargingProfileCommandResult, OCPPClearChargingProfileStatus, OCPPConfigurationStatus, OCPPGetCompositeScheduleCommandResult, OCPPGetCompositeScheduleStatus, OCPPSetChargingProfileCommandResult } from '../../types/ocpp/OCPPClient';

import BackendError from '../../exception/BackendError';
import ChargingStationClientFactory from '../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Logging from '../../utils/Logging';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../types/Server';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'ChargingStationVendor';

export default abstract class ChargingStationVendorIntegration {
  protected chargingStation: ChargingStation;

  constructor(chargingStation: ChargingStation) {
    this.chargingStation = chargingStation;
  }

  public async setPowerLimitation(tenantID: string, chargingStation: ChargingStation,
    connectorID?: number, maxAmps?: number): Promise<OCPPChangeConfigurationCommandResult> {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_STATION_LIMIT_POWER,
      message: `Set Power limitation is being called with ${maxAmps}A for '${chargingStation.chargePointVendor}'`,
      module: MODULE_NAME, method: 'setPowerLimitation',
      detailedMessages: { connectorID, maxAmps }
    });
    // Check if feature is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportStaticLimitationForChargingStation) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setPowerLimitation',
        message: 'Charging Station does not support static power limitation'
      });
    }
    if (connectorID > 0) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setPowerLimitation',
        message: `Not allowed to limit the power on Connector ID '${connectorID}' but only on the whole Charging Station (Connector ID '0')`,
      });
    }
    if (maxAmps < StaticLimitAmps.MIN_LIMIT) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setPowerLimitation',
        message: `Cannot set the minimum power limit to ${maxAmps}A, minimum expected ${StaticLimitAmps.MIN_LIMIT}A`,
      });
    }
    if (Utils.isEmptyArray(chargingStation.connectors)) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setPowerLimitation',
        message: 'The Charging Station has no connector',
        detailedMessages: { maxAmps }
      });
    }
    // Fixed the max amp per connector
    const occpLimitAmpValue = this.getOCPPParamValueForChargingLimitation(chargingStation, maxAmps);
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setPowerLimitation',
        message: 'Charging Station is not connected to the backend',
      });
    }
    let result: OCPPChangeConfigurationCommandResult;
    try {
      Logging.logDebug({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        message: `Set Power limitation via OCPP to ${occpLimitAmpValue}A for '${chargingStation.chargePointVendor}'`,
        module: MODULE_NAME, method: 'setPowerLimitation',
        detailedMessages: { connectorID, maxAmps, occpLimitAmpValue }
      });
      // Change the config
      result = await chargingStationClient.changeConfiguration({
        key: this.getOCPPParamNameForChargingLimitation(),
        value: occpLimitAmpValue + ''
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
    if (result.status === OCPPConfigurationStatus.ACCEPTED ||
        result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
      // Refresh Configuration
      await OCPPUtils.requestAndSaveChargingStationOcppParameters(tenantID, chargingStation);
      // Update the charger's connectors
      for (const connector of chargingStation.connectors) {
        connector.amperageLimit = maxAmps / chargingStation.connectors.length;
      }
      // Save it
      await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
    }
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_STATION_LIMIT_POWER,
      message: 'Set Power limitation has been called',
      module: MODULE_NAME, method: 'setPowerLimitation',
      detailedMessages: { result }
    });
    return result;
  }

  public async checkUpdateOfOCPPParams(tenantID: string, chargingStation: ChargingStation,
    ocppParamName: string, ocppParamValue: string) {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.OCPP_PARAM_UPDATE,
      message: 'Check update of OCPP Params is being called',
      module: MODULE_NAME, method: 'checkUpdateOfOCPPParams',
      detailedMessages: { ocppParamName, ocppParamValue }
    });
    if (ocppParamName === this.getOCPPParamNameForChargingLimitation()) {
      // Update the charger
      for (const connector of chargingStation.connectors) {
        connector.amperageLimit = Utils.convertToInt(ocppParamValue);
      }
      // Save it
      await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.OCPP_PARAM_UPDATE,
        message: 'Charging Station power limit has been updated following an OCPP parameter update',
        module: MODULE_NAME, method: 'checkUpdateOfOCPPParams',
        detailedMessages: { ocppParamName, ocppParamValue, chargingStation }
      });
    }
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.OCPP_PARAM_UPDATE,
      message: 'Check update of OCPP Params has been called',
      module: MODULE_NAME, method: 'checkUpdateOfOCPPParams'
    });
  }

  public async setChargingProfile(tenantID: string, chargingStation: ChargingStation,
    chargingProfile: ChargingProfile): Promise<OCPPSetChargingProfileCommandResult | OCPPSetChargingProfileCommandResult[]> {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_PROFILE_UPDATE,
      message: 'Set Charging Profile is being called',
      module: MODULE_NAME, method: 'setChargingProfile',
      detailedMessages: { chargingProfile }
    });
    // Check if feature is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setChargingProfile',
        message: 'Charging Station does not support charging profiles'
      });
    }
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setChargingProfile',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Convert to vendor specific profile
    const vendorSpecificChargingProfile = this.convertToVendorChargingProfile(chargingStation, chargingProfile);
    try {
      // Check if we have to load all connectors in case connector 0 fails
      if (chargingProfile.connectorID === 0) {
        // Set the Profile
        const result = await chargingStationClient.setChargingProfile({
          connectorId: vendorSpecificChargingProfile.connectorID,
          csChargingProfiles: vendorSpecificChargingProfile.profile
        });
        // Call each connector?
        if (result.status !== OCPPChargingProfileStatus.ACCEPTED) {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_PROFILE_UPDATE,
            message: 'Set Charging Profile on Connector ID 0 has been rejected, will try connector per connector',
            module: MODULE_NAME, method: 'clearChargingProfile',
            detailedMessages: { result }
          });
          const results = [] as OCPPSetChargingProfileCommandResult[];
          for (const connector of chargingStation.connectors) {
            const ret = await chargingStationClient.setChargingProfile({
              connectorId: connector.connectorId,
              csChargingProfiles: vendorSpecificChargingProfile.profile
            });
            results.push(ret);
          }
          Logging.logDebug({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_PROFILE_UPDATE,
            message: 'Set Charging Profile has been called',
            module: MODULE_NAME, method: 'setChargingProfile',
            detailedMessages: { results }
          });
          return results;
        }
        Logging.logDebug({
          tenantID: tenantID,
          source: chargingStation.id,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          message: 'Set Charging Profile has been called',
          module: MODULE_NAME, method: 'setChargingProfile',
          detailedMessages: { result }
        });
        return result;
      }
      // Connector ID > 0
      const result = await chargingStationClient.setChargingProfile({
        connectorId: vendorSpecificChargingProfile.connectorID,
        csChargingProfiles: vendorSpecificChargingProfile.profile
      });
      Logging.logDebug({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        message: 'Set Charging Profile has been called',
        module: MODULE_NAME, method: 'setChargingProfile',
        detailedMessages: { result }
      });
      return result;
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        message: 'Error occurred while setting the Charging Profile',
        module: MODULE_NAME, method: 'setChargingProfile',
        detailedMessages: { error: error.message, stack: error.stack }
      });
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
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_PROFILE_DELETE,
      message: 'Clear Charging Profile is being called',
      module: MODULE_NAME, method: 'clearChargingProfile',
      detailedMessages: { chargingProfile }
    });
    // Check if feature is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearChargingProfile',
        message: 'Charging Station does not support charging profiles'
      });
    }
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearChargingProfile',
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
            action: ServerAction.CHARGING_PROFILE_DELETE,
            module: MODULE_NAME, method: 'clearChargingProfile',
            message: 'Clear Charging Profile on Connector ID 0 has been rejected, will try connector per connector',
            detailedMessages: { result }
          });
          const results = [] as OCPPClearChargingProfileCommandResult[];
          for (const connector of chargingStation.connectors) {
            // Clear the Profile
            const ret = await chargingStationClient.clearChargingProfile({
              connectorId: connector.connectorId
            });
            results.push(ret);
          }
          // Reapply the current limitation
          await this.setPowerLimitation(tenantID, chargingStation, 0,
            Utils.getTotalAmpLimitOfChargingStation(chargingStation));
          Logging.logDebug({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_PROFILE_DELETE,
            message: 'Clear Charging Profile has been called',
            module: MODULE_NAME, method: 'clearChargingProfile',
            detailedMessages: { results }
          });
          return results;
        }
        // Reapply the current limitation
        if (result.status === OCPPClearChargingProfileStatus.ACCEPTED) {
          await this.setPowerLimitation(tenantID, chargingStation, 0,
            Utils.getTotalAmpLimitOfChargingStation(chargingStation));
        }
        Logging.logDebug({
          tenantID: tenantID,
          source: chargingStation.id,
          action: ServerAction.CHARGING_PROFILE_DELETE,
          message: 'Clear Charging Profile has been called',
          module: MODULE_NAME, method: 'clearChargingProfile',
          detailedMessages: { result }
        });
        return result;
      }
      // Connector ID > 0
      // Clear the Profile
      const result = await chargingStationClient.clearChargingProfile({
        connectorId: chargingProfile.connectorID
      });
      if (result.status === OCPPClearChargingProfileStatus.ACCEPTED) {
        // Reapply the current limitation
        await this.setPowerLimitation(tenantID, chargingStation, 0,
          Utils.getTotalAmpLimitOfChargingStation(chargingStation));
      }
      Logging.logDebug({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        message: 'Clear Charging Profile has been called',
        module: MODULE_NAME, method: 'clearChargingProfile',
        detailedMessages: { result }
      });
      return result;
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        message: 'Error occurred while clearing the Charging Profile',
        module: MODULE_NAME, method: 'clearChargingProfile',
        detailedMessages: { error: error.message, stack: error.stack }
      });
      throw error;
    }
  }

  public async getCompositeSchedule(tenantID: string, chargingStation: ChargingStation,
    connectorID: number, durationSecs: number): Promise<OCPPGetCompositeScheduleCommandResult | OCPPGetCompositeScheduleCommandResult[]> {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
      message: 'Get Composite Schedule is being called',
      module: MODULE_NAME, method: 'getCompositeSchedule',
      detailedMessages: { connectorID, durationSecs }
    });
    // Check if feature is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
        module: MODULE_NAME, method: 'getCompositeSchedule',
        message: 'Charging Station does not support charging profiles'
      });
    }
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
        module: MODULE_NAME, method: 'getCompositeSchedule',
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
            action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
            message: 'Get Composite Schedule on Connector ID 0 has been rejected, will try connector per connector',
            module: MODULE_NAME, method: 'getCompositeSchedule',
            detailedMessages: { result }
          });
          const results = [] as OCPPGetCompositeScheduleCommandResult[];
          for (const connector of chargingStation.connectors) {
            // Get the Composite Schedule
            const connectorResult = await chargingStationClient.getCompositeSchedule({
              connectorId: connector.connectorId,
              duration: durationSecs,
              chargingRateUnit: chargingStation.powerLimitUnit
            });
            // Convert
            connectorResult.chargingSchedule = this.convertFromVendorChargingSchedule(chargingStation, connectorResult.chargingSchedule);
            results.push(connectorResult);
          }
          Logging.logDebug({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
            message: 'Get Composite Schedule has been called',
            module: MODULE_NAME, method: 'getCompositeSchedule',
            detailedMessages: { results }
          });
          return results;
        }
        Logging.logDebug({
          tenantID: tenantID,
          source: chargingStation.id,
          action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
          message: 'Get Composite Schedule has been called',
          module: MODULE_NAME, method: 'getCompositeSchedule',
          detailedMessages: { result }
        });
        // Convert
        result.chargingSchedule = this.convertFromVendorChargingSchedule(chargingStation, result.chargingSchedule);
        return result;
      }
      // Connector ID > 0
      // Get the Composite Schedule
      const result = await chargingStationClient.getCompositeSchedule({
        connectorId: connectorID,
        duration: durationSecs,
        chargingRateUnit: chargingStation.powerLimitUnit
      });
      Logging.logDebug({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
        message: 'Get Composite Schedule has been called',
        module: MODULE_NAME, method: 'getCompositeSchedule',
        detailedMessages: { result }
      });
      // Convert
      result.chargingSchedule = this.convertFromVendorChargingSchedule(chargingStation, result.chargingSchedule);
      return result;
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
        message: 'Error occurred while getting the Composite Schedule',
        module: MODULE_NAME, method: 'getCompositeSchedule',
        detailedMessages: { error: error.message, stack: error.stack }
      });
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
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
      message: 'Get current connector limitation is being called',
      module: MODULE_NAME, method: 'getCurrentConnectorLimit',
      detailedMessages: { connectorID }
    });
    // Default
    const limitDefaultMaxAmps = chargingStation.connectors[connectorID - 1].amperageLimit;
    const limitDefaultMaxPower = chargingStation.connectors[connectorID - 1].power;
    // Should fail safe!
    try {
      if (connectorID === 0) {
        throw new BackendError({
          source: chargingStation.id,
          action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
          module: MODULE_NAME, method: 'getCurrentConnectorLimit',
          message: 'Cannot get the current connector limit on Connector ID 0',
        });
      }
      // Check First the Charging Profile
      if (chargingStation.capabilities && chargingStation.capabilities.supportChargingProfiles) {
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
            connectorLimitAmps = limitDefaultMaxAmps;
          }
          const result: ConnectorCurrentLimit = {
            limitAmps: connectorLimitAmps,
            limitWatts: Utils.convertAmpToWatt(chargingStation, connectorID, connectorLimitAmps),
            limitSource: ConnectorCurrentLimitSource.CHARGING_PROFILE,
          };
          Logging.logDebug({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
            message: `Get current limitation on Chargin Plan has been called: ${result.limitAmps} A, ${result.limitWatts} W`,
            module: MODULE_NAME, method: 'getCurrentConnectorLimit',
            detailedMessages: { result }
          });
          return result;
        }
      }
      // Check next the static power limitation
      if (chargingStation.capabilities && chargingStation.capabilities.supportStaticLimitationForChargingStation) {
        // Read the OCPP Parameter
        const ocppConfiguration = await OCPPUtils.requestChargingStationOcppParameters(
          tenantID, chargingStation, { key: [this.getOCPPParamNameForChargingLimitation()] });
        if (ocppConfiguration && ocppConfiguration.configurationKey && ocppConfiguration.configurationKey.length > 0 &&
          ocppConfiguration.configurationKey[0].value) {
          let connectorLimitAmps = Utils.convertToInt(ocppConfiguration.configurationKey[0].value);
          // Check
          if (connectorLimitAmps > limitDefaultMaxAmps) {
            connectorLimitAmps = limitDefaultMaxAmps;
          }
          const result: ConnectorCurrentLimit = {
            limitAmps: connectorLimitAmps,
            limitWatts: Utils.convertAmpToWatt(chargingStation, connectorID, connectorLimitAmps),
            limitSource: ConnectorCurrentLimitSource.STATIC_LIMITATION,
          };
          Logging.logDebug({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
            message: `Get current limitation on Static Limitation has been called: ${result.limitAmps} A, ${result.limitWatts} W`,
            module: MODULE_NAME, method: 'getCurrentConnectorLimit',
            detailedMessages: { result }
          });
          return result;
        }
      }
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
        message: `Cannot retrieve the current limitation on Connector ID '${connectorID}'`,
        module: MODULE_NAME, method: 'getCurrentConnectorLimit',
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    // Default on current connector
    const result: ConnectorCurrentLimit = {
      limitAmps: limitDefaultMaxAmps,
      limitWatts: limitDefaultMaxPower,
      limitSource: ConnectorCurrentLimitSource.CONNECTOR
    };
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
      message: `Get current limitation on Connectors has been called: ${result.limitAmps} A, ${result.limitWatts} W`,
      module: MODULE_NAME, method: 'getCurrentConnectorLimit',
      detailedMessages: { result }
    });
    return result;
  }

  public abstract getOCPPParamNameForChargingLimitation(): string;

  public abstract getOCPPParamValueForChargingLimitation(chargingStation: ChargingStation, limitAmp: number);

  public abstract convertToVendorChargingProfile(chargingStation: ChargingStation, chargingProfile: ChargingProfile): ChargingProfile;

  public abstract convertFromVendorChargingSchedule(chargingStation: ChargingStation, connectorID: number, vendorSpecificChargingSchedule: ChargingSchedule): ChargingSchedule;
}

