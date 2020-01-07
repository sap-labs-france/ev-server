import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import buildChargingStationClient from '../../../client/ocpp/ChargingStationClientFactory';
import BackendError from '../../../exception/BackendError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import ChargingStation, { ChargingStationTemplate, ChargingStationConfiguration } from '../../../types/ChargingStation';
import { InactivityStatus } from '../../../types/Transaction';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import OCPPConstants from './OCPPConstants';
import { OCPPConfiguration } from '../../../types/ocpp/OCPPConfiguration';

export default class OCPPUtils {

  public static async enrichCharingStationWithTemplate(chargingStation: ChargingStation): Promise<boolean> {
    let foundTemplate: ChargingStationTemplate = null;
    // Get the Templates
    const chargingStationTemplates: ChargingStationTemplate[] =
      await ChargingStationStorage.getChargingStationTemplates(chargingStation.chargePointVendor);
    // Parse Them
    for (const chargingStationTemplate of chargingStationTemplates) {
      // Keep it
      foundTemplate = chargingStationTemplate;
      // Browse filter for extra matching
      for (const filter in chargingStationTemplate.extraFilters) {
        // Check
        if (chargingStationTemplate.extraFilters.hasOwnProperty(filter)) {
          const filterValue: string = chargingStationTemplate.extraFilters[filter];
          if (!(new RegExp(filterValue).test(chargingStation[filter]))) {
            foundTemplate = null;
            break;
          }
        }
      }
      // Found?
      if (foundTemplate) {
        break;
      }
    }
    // Copy from template
    if (foundTemplate) {
      // Assign props
      if (foundTemplate.template.hasOwnProperty('cannotChargeInParallel')) {
        chargingStation.cannotChargeInParallel = foundTemplate.template.cannotChargeInParallel;
      }
      if (foundTemplate.template.hasOwnProperty('currentType')) {
        chargingStation.currentType = foundTemplate.template.currentType;
      }
      if (foundTemplate.template.hasOwnProperty('connectors')) {
        chargingStation.connectors = foundTemplate.template.connectors;
      }
      // Handle capabilities
      chargingStation.capabilities = {};
      if (foundTemplate.template.hasOwnProperty('capabilities')) {
        let matchFirmware = true;
        let matchOcpp = true;
        // Search Firmware/Ocpp match
        for (const capabilities of foundTemplate.template.capabilities) {
          // Check Firmware version
          if (capabilities.supportedFirmwareVersions) {
            matchFirmware = capabilities.supportedFirmwareVersions.indexOf(chargingStation.firmwareVersion) !== -1;
          }
          // Check Ocpp version
          if (capabilities.supportedOcppVersions) {
            matchOcpp = capabilities.supportedOcppVersions.indexOf(chargingStation.ocppVersion) !== -1;
          }
          // Found?
          if (matchFirmware && matchOcpp) {
            chargingStation.capabilities = capabilities.capabilities;
            break;
          }
        }
      }
      // Handle OCPP Advanced Commands
      chargingStation.ocppAdvancedCommands = [];
      if (foundTemplate.template.hasOwnProperty('ocppAdvancedCommands')) {
        let matchFirmware = true;
        let matchOcpp = true;
        // Search Firmware/Ocpp match
        for (const ocppAdvancedCommands of foundTemplate.template.ocppAdvancedCommands) {
          // Check Firmware version
          if (ocppAdvancedCommands.supportedFirmwareVersions) {
            matchFirmware = ocppAdvancedCommands.supportedFirmwareVersions.indexOf(chargingStation.firmwareVersion) !== -1;
          }
          // Check Ocpp version
          if (ocppAdvancedCommands.supportedOcppVersions) {
            matchOcpp = ocppAdvancedCommands.supportedOcppVersions.indexOf(chargingStation.ocppVersion) !== -1;
          }
          // Found?
          if (matchFirmware && matchOcpp) {
            chargingStation.ocppAdvancedCommands = ocppAdvancedCommands.commands;
            break;
          }
        }
      }
      // Handle OCPP Standard Parameters
      chargingStation.ocppStandardParameters = [];
      if (foundTemplate.template.hasOwnProperty('ocppStandardParameters')) {
        let matchOcpp = true;
        // Search Firmware/Ocpp match
        for (const ocppStandardParameters of foundTemplate.template.ocppStandardParameters) {
          // Check Ocpp version
          if (ocppStandardParameters.supportedOcppVersions) {
            matchOcpp = ocppStandardParameters.supportedOcppVersions.indexOf(chargingStation.ocppVersion) !== -1;
          }
          // Found?
          if (matchOcpp) {
            for (const parameter in ocppStandardParameters.parameters) {
              chargingStation.ocppStandardParameters.push({
                key: parameter,
                value: ocppStandardParameters.parameters[parameter]
              });
            }
            break;
          }
        }
      }
      // Handle OCPP Vendor Parameters
      chargingStation.ocppVendorParameters = [];
      if (foundTemplate.template.hasOwnProperty('ocppVendorParameters')) {
        let matchFirmware = true;
        let matchOcpp = true;
        // Search Firmware/Ocpp match
        for (const ocppVendorParameters of foundTemplate.template.ocppVendorParameters) {
          // Check Firmware version
          if (ocppVendorParameters.supportedFirmwareVersions) {
            matchFirmware = ocppVendorParameters.supportedFirmwareVersions.indexOf(chargingStation.firmwareVersion) !== -1;
          }
          // Check Ocpp version
          if (ocppVendorParameters.supportedOcppVersions) {
            matchOcpp = ocppVendorParameters.supportedOcppVersions.indexOf(chargingStation.ocppVersion) !== -1;
          }
          // Found?
          if (matchFirmware && matchOcpp) {
            for (const parameter in ocppVendorParameters.parameters) {
              chargingStation.ocppVendorParameters.push({
                key: parameter,
                value: ocppVendorParameters.parameters[parameter]
              });
            }
            break;
          }
        }
      }
      return true;
    }
    return false;
  }

  public static getIfChargingStationIsInactive(chargingStation: ChargingStation): boolean {
    let inactive = false;
    // Get Heartbeat Interval from conf
    const config = Configuration.getChargingStationConfig();
    if (config) {
      const heartbeatIntervalSecs = config.heartbeatIntervalSecs;
      // Compute against the last Heartbeat
      if (chargingStation.lastHeartBeat) {
        const inactivitySecs = Math.floor((Date.now() - chargingStation.lastHeartBeat.getTime()) / 1000);
        // Inactive?
        if (inactivitySecs > (heartbeatIntervalSecs * 5)) {
          inactive = true;
        }
      }
    }
    return inactive;
  }

  static isSocMeterValue(meterValue) {
    return meterValue.attribute
      && meterValue.attribute.context === 'Sample.Periodic'
      && meterValue.attribute.measurand === 'SoC';
  }

  static isConsumptionMeterValue(meterValue) {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === 'Energy.Active.Import.Register'
        && (meterValue.attribute.context === 'Sample.Periodic' || meterValue.attribute.context === 'Sample.Clock'));
  }

  static async checkAndGetChargingStation(chargeBoxIdentity: string, tenantID: string): Promise<ChargingStation> {
    // Check
    if (!chargeBoxIdentity) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'OCPPUtils',
        method: '_checkAndGetChargingStation',
        message: 'Should have the required property \'chargeBoxIdentity\'!'
      });
    }
    // Get the charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, chargeBoxIdentity);
    // Found?
    if (!chargingStation) {
      throw new BackendError({
        source: chargeBoxIdentity,
        module: 'OCPPUtils',
        method: '_checkAndGetChargingStation',
        message: 'Charging Station does not exist'
      });
    }
    // Deleted?
    if (chargingStation.deleted) {
      throw new BackendError({
        source: chargeBoxIdentity,
        module: 'OCPPUtils',
        method: '_checkAndGetChargingStation',
        message: 'Charging Station is deleted'
      });
    }
    return chargingStation;
  }

  public static getChargingStationClient(tenantID: string, chargingStation: ChargingStation): Promise<ChargingStationClient> {
    return buildChargingStationClient(tenantID, chargingStation);
  }

  public static async requestExecuteChargingStationCommand(tenantID: string, chargingStation: ChargingStation, method: string, params?) {
    try {
      // Get the client
      const chargingStationClient = await OCPPUtils.getChargingStationClient(tenantID, chargingStation);
      // Set Charging Profile
      const result = await chargingStationClient[method](params);
      // Log
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id,
        module: 'ChargingStation', method: '_requestExecuteCommand',
        action: Utils.firstLetterInUpperCase(method),
        message: 'Command sent with success',
        detailedMessages: result
      });
      return result;
    } catch (error) {
      // OCPP 1.6?
      if (Array.isArray(error.error)) {
        const response = error.error;
        throw new BackendError({
          source: chargingStation.id,
          module: 'OCPPUtils',
          method: 'requestExecuteChargingStationCommand',
          message: response[3],
          action: Utils.firstLetterInUpperCase(method)
        });
      } else {
        throw error;
      }
    }
  }

  public static async requestAndSaveChargingStationConfiguration(tenantID: string, chargingStation: ChargingStation, newChargingStation: boolean = false) {
    try {
      // In case of error. the boot should no be denied
      const ocppConfiguration: OCPPConfiguration = await OCPPUtils.requestExecuteChargingStationCommand(
        tenantID, chargingStation, 'getConfiguration', {});
      // Log
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id, module: 'ChargingStationService',
        method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
        message: 'Command sent with success', detailedMessages: ocppConfiguration
      });
      // Create Conf
      const chargingStationConfiguration: ChargingStationConfiguration = {
        id: chargingStation.id,
        configuration: ocppConfiguration.configurationKey,
        timestamp: new Date()
      };
      // Set default?
      if (!chargingStationConfiguration.configuration) {
        // Check if there is an already existing config in DB
        const existingConfiguration = await ChargingStationStorage.getConfiguration(tenantID, chargingStation.id);
        if (!existingConfiguration) {
          // No config at all: Set default OCPP configuration
          chargingStationConfiguration.configuration = OCPPConstants.DEFAULT_OCPP_CONFIGURATION;
        }
      }
      // Save config
      await ChargingStationStorage.saveConfiguration(tenantID, chargingStationConfiguration);
      // Check OCPP Configuration
      if (newChargingStation) {
        this.checkAndUpdateChargingStationOcppParameters(chargingStation, chargingStationConfiguration);
      }
      // Ok
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id, module: 'ChargingStation',
        method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
        message: 'Configuration has been saved'
      });
      return { status: 'Accepted' };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, 'RequestConfiguration', error);
      return { status: 'Rejected' };
    }
  }
  public static checkAndUpdateChargingStationOcppParameters(chargingStation: ChargingStation, currentConfiguration: ChargingStationConfiguration) {
  }

  public static async requestChangeChargingStationConfiguration(tenantID: string, chargingStation: ChargingStation, params) {
    const result = await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'changeConfiguration', params);
    // Request the new Configuration?
    if (result.status === 'Accepted') {
      // Retrieve and Save it in the DB (Async)
      OCPPUtils.requestAndSaveChargingStationConfiguration(tenantID, chargingStation);
    }
    // Return
    return result;
  }

  public static checkAndFreeChargingStationConnector(chargingStation: ChargingStation, connectorId: number, saveOtherConnectors = false) {
    // Cleanup connector transaction data
    const foundConnector = chargingStation.connectors.find((connector) => connector.connectorId === connectorId);
    if (foundConnector) {
      foundConnector.currentConsumption = 0;
      foundConnector.totalConsumption = 0;
      foundConnector.totalInactivitySecs = 0;
      foundConnector.inactivityStatus = InactivityStatus.INFO;
      foundConnector.currentStateOfCharge = 0;
      foundConnector.activeTransactionID = 0;
      foundConnector.activeTransactionDate = null;
      foundConnector.activeTagID = null;
    }
  }
}
