import { ChargingProfile, ChargingRateUnitType, ChargingSchedule } from '../../types/ChargingProfile';
import ChargingStation, { ChargePoint, ConnectorCurrentLimit, ConnectorCurrentLimitSource, StaticLimitAmps } from '../../types/ChargingStation';
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

  public async getStaticPowerLimitation(tenantID: string, chargingStation: ChargingStation,
    chargePoint?: ChargePoint): Promise<number> {
    let ampLimitation = 0;
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_STATION_LIMIT_POWER,
      message: 'Get Power limitation is being called',
      module: MODULE_NAME, method: 'getStaticPowerLimitation',
      detailedMessages: { chargePoint }
    });
    if (chargePoint.excludeFromPowerLimitation) {
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        message: `Charge Point '${chargePoint.chargePointID}' is excluded from power limitation`,
        module: MODULE_NAME, method: 'getStaticPowerLimitation',
        detailedMessages: { chargePoint }
      });
      return ampLimitation;
    }
    if (!chargePoint.ocppParamForPowerLimitation) {
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        message: `No OCPP parameter provided in template for Charge Point '${chargePoint.chargePointID}'`,
        module: MODULE_NAME, method: 'getStaticPowerLimitation',
        detailedMessages: { chargePoint }
      });
      return ampLimitation;
    }
    // Read the OCPP Parameter
    const ocppConfiguration = await OCPPUtils.requestChargingStationOcppParameters(
      tenantID, chargingStation, { key: [chargePoint.ocppParamForPowerLimitation] });
    if (ocppConfiguration && ocppConfiguration.configurationKey && ocppConfiguration.configurationKey.length > 0 &&
      ocppConfiguration.configurationKey[0].value) {
      const connectorLimitAmps = Utils.convertToInt(ocppConfiguration.configurationKey[0].value);
      ampLimitation = this.convertLimitAmpToAllPhases(chargingStation, chargePoint, 0, connectorLimitAmps);
    }
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_STATION_LIMIT_POWER,
      message: 'Get Power limitation has been called',
      module: MODULE_NAME, method: 'getStaticPowerLimitation',
      detailedMessages: { ampLimitation }
    });
    return ampLimitation;
  }

  public async setStaticPowerLimitation(tenantID: string, chargingStation: ChargingStation,
    chargePoint?: ChargePoint, maxAmps?: number): Promise<OCPPChangeConfigurationCommandResult> {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_STATION_LIMIT_POWER,
      message: `Set Power limitation is being called with ${maxAmps}A`,
      module: MODULE_NAME, method: 'setStaticPowerLimitation',
      detailedMessages: { chargePoint, maxAmps }
    });
    if (chargePoint.excludeFromPowerLimitation) {
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        message: `Charge Point '${chargePoint.chargePointID}' is excluded from power limitation`,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        detailedMessages: { chargePoint }
      });
      return { status: OCPPConfigurationStatus.NOT_SUPPORTED };
    }
    if (!chargePoint.ocppParamForPowerLimitation) {
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        message: `No OCPP parameter provided in template for Charge Point '${chargePoint.chargePointID}'`,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        detailedMessages: { chargePoint }
      });
      return { status: OCPPConfigurationStatus.NOT_SUPPORTED };
    }
    // Check if feature is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportStaticLimitationForChargingStation) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        message: 'Charging Station capabilities does not support static power limitation'
      });
    }
    if (maxAmps < StaticLimitAmps.MIN_LIMIT) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        message: `Cannot set the minimum power limit to ${maxAmps}A, minimum expected ${StaticLimitAmps.MIN_LIMIT}A`,
      });
    }
    if (Utils.isEmptyArray(chargingStation.connectors)) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        message: 'The Charging Station has no connector',
        detailedMessages: { maxAmps }
      });
    }
    // Fixed the max amp per connector
    const occpLimitAmpValue = this.convertLimitAmpPerPhase(chargingStation, chargePoint, 0, maxAmps);
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        message: 'Charging Station is not connected to the backend',
      });
    }
    let result: OCPPChangeConfigurationCommandResult;
    try {
      Logging.logDebug({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        message: `Set Power limitation via OCPP to ${occpLimitAmpValue}A`,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        detailedMessages: { maxAmps, ocppParam: chargePoint.ocppParamForPowerLimitation, occpLimitAmpValue }
      });
      // Change the config
      result = await chargingStationClient.changeConfiguration({
        key: chargePoint.ocppParamForPowerLimitation,
        value: occpLimitAmpValue.toString()
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
      const limitAmpsPerConnector = this.chargePointToConnectorLimitAmps(chargePoint, maxAmps);
      for (const connector of chargingStation.connectors) {
        connector.amperageLimit = limitAmpsPerConnector;
      }
      // Save it
      await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
    }
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_STATION_LIMIT_POWER,
      message: 'Set Power limitation has been called',
      module: MODULE_NAME, method: 'setStaticPowerLimitation',
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
    for (const chargePoint of chargingStation.chargePoints) {
      if (ocppParamName === chargePoint.ocppParamForPowerLimitation) {
        // Update the connector limit amps
        for (const connectorID of chargePoint.connectorIDs) {
          const connector = Utils.getConnectorFromID(chargingStation, connectorID);
          connector.amperageLimit = this.convertLimitAmpToAllPhases(
            chargingStation, chargePoint, connectorID, Utils.convertToInt(ocppParamValue));
          Logging.logInfo({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.OCPP_PARAM_UPDATE,
            message: `Connector ID '${connectorID}' amperage limit set to ${connector.amperageLimit}A following an update of OCPP param '${ocppParamName}'`,
            module: MODULE_NAME, method: 'checkUpdateOfOCPPParams',
            detailedMessages: { ocppParamName, ocppParamValue, connectorID,
              amperageLimit: connector.amperageLimit, chargePoint }
          });
        }
        // Save it
        await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
      }
    }
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.OCPP_PARAM_UPDATE,
      message: 'Check update of OCPP Params has been called',
      module: MODULE_NAME, method: 'checkUpdateOfOCPPParams'
    });
  }

  public async setChargingProfile(tenantID: string, chargingStation: ChargingStation, chargePoint: ChargePoint,
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
    const vendorSpecificChargingProfile = this.convertToVendorChargingProfile(
      chargingStation, chargePoint, chargingProfile);
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
          for (const chargePoint of chargingStation.chargePoints) {
            await this.setStaticPowerLimitation(tenantID, chargingStation, chargePoint,
              Utils.getChargingStationAmperageLimit(chargingStation, chargePoint));
          }
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
          for (const chargePoint of chargingStation.chargePoints) {
            await this.setStaticPowerLimitation(tenantID, chargingStation, chargePoint,
              Utils.getChargingStationAmperageLimit(chargingStation, chargePoint));
          }
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
      // Reapply the current limitation
      if (result.status === OCPPClearChargingProfileStatus.ACCEPTED) {
        for (const chargePoint of chargingStation.chargePoints) {
          await this.setStaticPowerLimitation(tenantID, chargingStation, chargePoint,
            Utils.getChargingStationAmperageLimit(chargingStation, chargePoint));
        }
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

  public async getCompositeSchedule(tenantID: string, chargingStation: ChargingStation, chargePoint: ChargePoint,
    connectorID: number, durationSecs: number): Promise<OCPPGetCompositeScheduleCommandResult> {
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
    if (connectorID === 0) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
        module: MODULE_NAME, method: 'getCompositeSchedule',
        message: 'Cannot get the composite schedule on Connector ID 0',
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
      result.chargingSchedule = this.convertFromVendorChargingSchedule(
        chargingStation, chargePoint, result.connectorId, result.chargingSchedule);
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

  public async getCurrentConnectorLimit(tenantID: string, chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID: number): Promise<ConnectorCurrentLimit> {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
      message: 'Get current connector limitation is being called',
      module: MODULE_NAME, method: 'getCurrentConnectorLimit',
      detailedMessages: { connectorID }
    });
    // Default
    const limitDefaultMaxAmps = Utils.getConnectorFromID(chargingStation, connectorID).amperageLimit;
    const limitDefaultMaxPower = Utils.getConnectorFromID(chargingStation, connectorID).power;
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
          tenantID, chargingStation, chargePoint, connectorID, 60);
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
        // Read the static limitation
        let connectorLimitAmps = await this.getStaticPowerLimitation(tenantID, chargingStation, chargePoint);
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
      message: `Get current limitation on Connectors has been called: ${result.limitAmps} A, ${result.limitWatts}W, source '${result.limitSource}'`,
      module: MODULE_NAME, method: 'getCurrentConnectorLimit',
      detailedMessages: { result }
    });
    return result;
  }

  public convertToVendorChargingProfile(chargingStation: ChargingStation,
    chargePoint: ChargePoint, chargingProfile: ChargingProfile): ChargingProfile {
    // Get vendor specific charging profile
    const vendorSpecificChargingProfile = JSON.parse(JSON.stringify(chargingProfile));
    // Check connector
    if (chargingStation.connectors && vendorSpecificChargingProfile.profile && vendorSpecificChargingProfile.profile.chargingSchedule) {
      // Convert to Watts?
      if (chargingStation.powerLimitUnit === ChargingRateUnitType.WATT) {
        vendorSpecificChargingProfile.profile.chargingSchedule.chargingRateUnit = ChargingRateUnitType.WATT;
      }
      // Divide the power by the number of connectors and number of phases
      for (const schedulePeriod of vendorSpecificChargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
        // Check Unit
        if (chargingStation.powerLimitUnit === ChargingRateUnitType.AMPERE) {
          // Limit Amps per phase
          schedulePeriod.limit = this.convertLimitAmpPerPhase(
            chargingStation, chargePoint,
            vendorSpecificChargingProfile.connectorID, schedulePeriod.limit);
        } else {
          // Limit Watts for all the phases (Cahors)
          schedulePeriod.limit = Utils.convertAmpToWatt(
            chargingStation, vendorSpecificChargingProfile.connectorID,
            this.chargePointToConnectorLimitAmps(chargePoint, schedulePeriod.limit));
        }
      }
    }
    return vendorSpecificChargingProfile;
  }

  public convertFromVendorChargingSchedule(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID: number, chargingSchedule: ChargingSchedule): ChargingSchedule {
    // Get vendor specific charging profile
    if (!chargingSchedule) {
      return chargingSchedule;
    }
    chargingSchedule['durationMins'] = Math.round(chargingSchedule.duration / 60);
    if (chargingSchedule.chargingSchedulePeriod) {
      for (const chargingSchedulePeriod of chargingSchedule.chargingSchedulePeriod) {
        chargingSchedulePeriod['startPeriodMins'] = Math.round(chargingSchedulePeriod.startPeriod / 60);
        // Convert to Amps for all phases
        if (chargingSchedule.chargingRateUnit === ChargingRateUnitType.WATT) {
          chargingSchedulePeriod['limitWatts'] = chargingSchedulePeriod.limit;
          chargingSchedulePeriod.limit = Utils.convertWattToAmp(chargingStation, connectorID, chargingSchedulePeriod.limit);
        }
        // Limit is per connector and per phase Convert to max Amp
        chargingSchedulePeriod.limit = this.convertLimitAmpToAllPhases(
          chargingStation, chargePoint, connectorID, chargingSchedulePeriod.limit);
        chargingSchedulePeriod['limitWatts'] = Utils.convertAmpToWatt(chargingStation, connectorID, chargingSchedulePeriod.limit);
      }
    }
    // Convert to Amps?
    if (chargingSchedule.chargingRateUnit === ChargingRateUnitType.WATT) {
      chargingSchedule.chargingRateUnit = ChargingRateUnitType.AMPERE;
    }
    return chargingSchedule;
  }

  private convertLimitAmpPerPhase(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID = 0, limitAmpAllPhases: number): number {
    let limitAmpPerPhase = limitAmpAllPhases;
    // Per charge point?
    if (connectorID === 0) {
      // Get Amp per connector
      limitAmpPerPhase = this.chargePointToConnectorLimitAmps(chargePoint, limitAmpPerPhase);
    }
    // Per pahse
    limitAmpPerPhase /= Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connectorID);
    return limitAmpPerPhase;
  }

  private convertLimitAmpToAllPhases(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID = 0, limitAmpPerPhase: number): number {
    let limitAmpAllPhases = limitAmpPerPhase;
    // Per charge point?
    if (connectorID === 0) {
      // Get Amp per connector
      limitAmpAllPhases = this.connectorToChargePointLimitAmps(chargePoint, limitAmpAllPhases);
    }
    // Per pahse
    limitAmpAllPhases *= Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connectorID);
    return limitAmpAllPhases;
  }

  private chargePointToConnectorLimitAmps(chargePoint: ChargePoint, limitAmp: number): number {
    // Check at charge point level
    if (chargePoint.cannotChargeInParallel || chargePoint.sharePowerToAllConnectors) {
      return limitAmp;
    }
    // Default
    return limitAmp / chargePoint.connectorIDs.length;
  }

  private connectorToChargePointLimitAmps(chargePoint: ChargePoint, limitAmp: number): number {
    // Check at charge point level
    if (chargePoint.cannotChargeInParallel || chargePoint.sharePowerToAllConnectors) {
      return limitAmp;
    }
    // Default
    return limitAmp * chargePoint.connectorIDs.length;
  }
}

