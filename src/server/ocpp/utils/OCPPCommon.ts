import ChargingStation, { ChargingStationOcppParameters } from '../../../types/ChargingStation';
import { OCPPChangeConfigurationRequest, OCPPChangeConfigurationResponse, OCPPConfigurationStatus, OCPPGetConfigurationRequest, OCPPGetConfigurationResponse, OCPPResetResponse, OCPPResetStatus, OCPPResetType } from '../../../types/ocpp/OCPPClient';

import BackendError from '../../../exception/BackendError';
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'OCPPCommon';

export default class OCPPCommon {
  public static async requestChangeChargingStationOcppParameter(tenant: Tenant, chargingStation: ChargingStation, params: OCPPChangeConfigurationRequest,
      saveChange = true, triggerConditionalReset = false): Promise<OCPPChangeConfigurationResponse> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestChangeChargingStationOcppParameter',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Apply the configuration change
    const result = await chargingStationClient.changeConfiguration(params);
    const isValidResultStatus = (result.status === OCPPConfigurationStatus.ACCEPTED) || (result.status === OCPPConfigurationStatus.REBOOT_REQUIRED);
    // Request the new Configuration?
    if (saveChange && isValidResultStatus) {
      // Request and save it
      await OCPPCommon.requestAndSaveChargingStationOcppParameters(tenant, chargingStation);
    }
    if (triggerConditionalReset && result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
      await Logging.logInfo({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestChangeChargingStationOcppParameter',
        message: `Reboot triggered due to change of OCPP Parameter '${params.key}' to '${params.value}'`,
        detailedMessages: { result }
      });
      await OCPPCommon.triggerChargingStationReset(tenant, chargingStation, true);
    }
    return result;
  }

  public static async requestAndSaveChargingStationOcppParameters(tenant: Tenant, chargingStation: ChargingStation): Promise<OCPPChangeConfigurationResponse> {
    try {
      // Get the OCPP Configuration
      const ocppConfiguration = await OCPPCommon.requestChargingStationOcppParameters(tenant, chargingStation, {});
      await Logging.logDebug({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestAndSaveChargingStationOcppParameters',
        message: 'Get charging station OCPP parameters successfully',
        detailedMessages: { ocppConfiguration }
      });
      // Set OCPP configuration
      const chargingStationOcppParameters: ChargingStationOcppParameters = {
        id: chargingStation.id,
        configuration: ocppConfiguration.configurationKey,
        timestamp: new Date()
      };
      // Get saved OCPP configuration from DB
      const ocppParametersFromDB = await ChargingStationStorage.getOcppParameters(tenant, chargingStation.id);
      // Charging Station configuration not found
      if (!chargingStationOcppParameters.configuration) {
        if (ocppParametersFromDB.count === 0) {
          // No config at all: set default OCPP configuration
          chargingStationOcppParameters.configuration = Constants.DEFAULT_OCPP_16_CONFIGURATION;
        } else {
          // Set from DB
          chargingStationOcppParameters.configuration = ocppParametersFromDB.result;
        }
      }
      // Add the existing custom params
      const customParams = ocppParametersFromDB.result.filter((customParam) => customParam.custom);
      if (!Utils.isEmptyArray(customParams)) {
        for (const customParam of customParams) {
          const foundCustomParam = chargingStationOcppParameters.configuration.find((configuration) => configuration.key === customParam.key);
          if (!foundCustomParam) {
            chargingStationOcppParameters.configuration.push(customParam);
          }
        }
      }
      // Save configuration
      await ChargingStationStorage.saveOcppParameters(tenant, chargingStationOcppParameters);
      await Logging.logInfo({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestAndSaveChargingStationOcppParameters',
        message: 'Save charging station OCPP parameters successfully'
      });
      return { status: OCPPConfigurationStatus.ACCEPTED };
    } catch (error) {
      await Logging.logActionExceptionMessage(tenant.id, ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION, error);
      return { status: OCPPConfigurationStatus.REJECTED };
    }
  }

  public static async triggerChargingStationReset(tenant: Tenant, chargingStation: ChargingStation,
      hardResetFallback = false, resetType: OCPPResetType = OCPPResetType.SOFT): Promise<OCPPResetResponse> {
    // Get the Charging Station client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.CHARGING_STATION_RESET,
        module: MODULE_NAME, method: 'triggerChargingStationReset',
        message: 'Charging Station is not connected to the backend',
      });
    }
    let resetResult = await chargingStationClient.reset({ type: resetType });
    if (resetResult.status === OCPPResetStatus.REJECTED) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.CHARGING_STATION_RESET,
        module: MODULE_NAME, method: 'triggerChargingStationReset',
        message: `Error at ${resetType} Rebooting charging station`,
      });
      if (hardResetFallback && resetType !== OCPPResetType.HARD) {
        await Logging.logInfo({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.CHARGING_STATION_RESET,
          module: MODULE_NAME, method: 'triggerChargingStationReset',
          message: `Conditional ${OCPPResetType.HARD} Reboot requested`,
        });
        resetResult = await chargingStationClient.reset({ type: OCPPResetType.HARD });
        if (resetResult.status === OCPPResetStatus.REJECTED) {
          await Logging.logError({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            tenantID: tenant.id,
            action: ServerAction.CHARGING_STATION_RESET,
            module: MODULE_NAME, method: 'triggerChargingStationReset',
            message: `Error at ${OCPPResetType.HARD} Rebooting charging station`,
          });
        }
      }
    }
    return resetResult;
  }

  public static async requestChargingStationOcppParameters(tenant: Tenant, chargingStation: ChargingStation,
      params: OCPPGetConfigurationRequest): Promise<OCPPGetConfigurationResponse> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.CHARGING_STATION_REQUEST_OCPP_PARAMETERS,
        module: MODULE_NAME, method: 'requestChargingStationOcppParameters',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Get the configuration
    const result = await chargingStationClient.getConfiguration(params);
    return result;
  }
}
