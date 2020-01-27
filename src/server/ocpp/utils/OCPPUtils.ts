import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import BackendError from '../../../exception/BackendError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ChargingStation, { ChargingStationCapabilities, ChargingStationConfiguration, ChargingStationCurrentType, ChargingStationTemplate } from '../../../types/ChargingStation';
import { KeyValue } from '../../../types/GlobalType';
import { OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPConfigurationStatus } from '../../../types/ocpp/OCPPClient';
import { OCPPNormalizedMeterValue, OCPPStatusNotificationRequest } from '../../../types/ocpp/OCPPServer';
import { InactivityStatus } from '../../../types/Transaction';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import OCPPConstants from './OCPPConstants';
import Utils from '../../../utils/Utils';

export default class OCPPUtils {

  public static async getCharingStationTemplate(chargingStation: ChargingStation): Promise<ChargingStationTemplate> {
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
    return foundTemplate;
  }

  public static async enrichChargingStationWithTemplate(tenantID: string, chargingStation: ChargingStation): Promise<boolean> {
    // Get Template
    const chargingStationTemplate = await OCPPUtils.getCharingStationTemplate(chargingStation);
    // Copy from template
    if (chargingStationTemplate) {
      // Assign props
      if (chargingStationTemplate.template.hasOwnProperty('cannotChargeInParallel')) {
        chargingStation.cannotChargeInParallel = chargingStationTemplate.template.cannotChargeInParallel;
      }
      if (chargingStationTemplate.template.hasOwnProperty('maximumPower')) {
        chargingStation.maximumPower = chargingStationTemplate.template.maximumPower;
      }
      if (chargingStationTemplate.template.hasOwnProperty('currentType')) {
        chargingStation.currentType = chargingStationTemplate.template.currentType;
      }
      // Handle capabilities
      chargingStation.capabilities = {} as ChargingStationCapabilities;
      if (chargingStationTemplate.template.hasOwnProperty('capabilities')) {
        let matchFirmware = true;
        let matchOcpp = true;
        // Search Firmware/Ocpp match
        for (const capabilities of chargingStationTemplate.template.capabilities) {
          // Check Firmware version
          if (capabilities.supportedFirmwareVersions) {
            matchFirmware = capabilities.supportedFirmwareVersions.includes(chargingStation.firmwareVersion);
          }
          // Check Ocpp version
          if (capabilities.supportedOcppVersions) {
            matchOcpp = capabilities.supportedOcppVersions.includes(chargingStation.ocppVersion);
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
      if (chargingStationTemplate.template.hasOwnProperty('ocppAdvancedCommands')) {
        let matchFirmware = true;
        let matchOcpp = true;
        // Search Firmware/Ocpp match
        for (const ocppAdvancedCommands of chargingStationTemplate.template.ocppAdvancedCommands) {
          // Check Firmware version
          if (ocppAdvancedCommands.supportedFirmwareVersions) {
            matchFirmware = ocppAdvancedCommands.supportedFirmwareVersions.includes(chargingStation.firmwareVersion);
          }
          // Check Ocpp version
          if (ocppAdvancedCommands.supportedOcppVersions) {
            matchOcpp = ocppAdvancedCommands.supportedOcppVersions.includes(chargingStation.ocppVersion);
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
      if (chargingStationTemplate.template.hasOwnProperty('ocppStandardParameters')) {
        let matchOcpp = true;
        // Search Firmware/Ocpp match
        for (const ocppStandardParameters of chargingStationTemplate.template.ocppStandardParameters) {
          // Check Ocpp version
          if (ocppStandardParameters.supportedOcppVersions) {
            matchOcpp = ocppStandardParameters.supportedOcppVersions.includes(chargingStation.ocppVersion);
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
      if (chargingStationTemplate.template.hasOwnProperty('ocppVendorParameters')) {
        let matchFirmware = true;
        let matchOcpp = true;
        // Search Firmware/Ocpp match
        for (const ocppVendorParameters of chargingStationTemplate.template.ocppVendorParameters) {
          // Check Firmware version
          if (ocppVendorParameters.supportedFirmwareVersions) {
            matchFirmware = ocppVendorParameters.supportedFirmwareVersions.includes(chargingStation.firmwareVersion);
          }
          // Check Ocpp version
          if (ocppVendorParameters.supportedOcppVersions) {
            matchOcpp = ocppVendorParameters.supportedOcppVersions.includes(chargingStation.ocppVersion);
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
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        module: 'OCPPUtils', method: 'enrichChargingStationWithTemplate',
        action: 'ChargingStationTemplate',
        message: `Template has been applied successfully for '${chargingStation.chargePointVendor}'`,
        detailedMessages: chargingStationTemplate
      });
      return true;
    }
    // Log
    Logging.logWarning({
      tenantID: tenantID,
      source: chargingStation.id,
      module: 'OCPPUtils', method: 'enrichChargingStationWithTemplate',
      action: 'ChargingStationTemplate',
      message: `No Template has been found for '${chargingStation.chargePointVendor}'`
    });
    return false;
  }

  public static async enrichChargingStationConnectorWithTemplate(tenantID: string, chargingStation: ChargingStation, connectorID: number): Promise<boolean> {
    // Get Template
    const chargingStationTemplate = await OCPPUtils.getCharingStationTemplate(chargingStation);
    // Copy from template
    if (chargingStationTemplate) {
      // Handle connector
      if (chargingStationTemplate.template.hasOwnProperty('connectors')) {
        // Find the connector in the template
        const templateConnector = chargingStationTemplate.template.connectors.find(
          (connector) => connector.connectorId === connectorID);
        if (!templateConnector) {
          // Log
          Logging.logWarning({
            tenantID: tenantID, source: chargingStation.id,
            module: 'OCPPUtils', method: 'enrichChargingStationConnectorWithTemplate',
            action: 'ChargingStationTemplate',
            message: `No Connector found in Template for Connector ID '${connectorID}' on '${chargingStation.chargePointVendor}'`
          });
          return false;
        }
        // Force Update
        for (const connector of chargingStation.connectors) {
          // Set
          if (connector.connectorId === connectorID) {
            connector.power = templateConnector.power;
            connector.type = templateConnector.type;
            connector.currentType = templateConnector.currentType;
            connector.numberOfConnectedPhase = templateConnector.numberOfConnectedPhase;
            connector.voltage = templateConnector.voltage;
            connector.amperage = templateConnector.amperage;
            connector.amperageLimit = templateConnector.amperage;
            break;
          }
        }
        // Recalculate Max Power
        this.recalculateChargingStationMaxPower(chargingStation);
      }
      // Log
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id,
        module: 'OCPPUtils', method: 'enrichChargingStationConnectorWithTemplate',
        action: 'ChargingStationTemplate',
        message: `Template for Connector ID '${connectorID}' has been applied successfully on '${chargingStation.chargePointVendor}'`,
        detailedMessages: chargingStationTemplate
      });
      return true;
    }
    // Log
    Logging.logWarning({
      tenantID: tenantID, source: chargingStation.id,
      module: 'OCPPUtils', method: 'enrichChargingStationConnectorWithTemplate',
      action: 'ChargingStationTemplate',
      message: `No Template for Connector ID '${connectorID}' has been found for '${chargingStation.chargePointVendor}'`
    });
    return false;
  }

  public static recalculateChargingStationMaxPower(chargingStation: ChargingStation) {
    let maximumPower = 0;
    // Only for AC
    if (chargingStation.currentType !== ChargingStationCurrentType.AC) {
      return;
    }
    for (const connector of chargingStation.connectors) {
      if (connector.hasOwnProperty('power')) {
        maximumPower += connector.power;
      }
    }
    if (maximumPower) {
      chargingStation.maximumPower = maximumPower;
    }
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

  static isSocMeterValue(meterValue: OCPPNormalizedMeterValue) {
    return meterValue.attribute
      && meterValue.attribute.context === 'Sample.Periodic'
      && meterValue.attribute.measurand === 'SoC';
  }

  static isConsumptionMeterValue(meterValue: OCPPNormalizedMeterValue) {
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
        method: 'checkAndGetChargingStation',
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
        method: 'checkAndGetChargingStation',
        message: 'Charging Station does not exist'
      });
    }
    // Deleted?
    if (chargingStation.deleted) {
      throw new BackendError({
        source: chargeBoxIdentity,
        module: 'OCPPUtils',
        method: 'checkAndGetChargingStation',
        message: 'Charging Station is deleted'
      });
    }
    return chargingStation;
  }

  public static async requestAndSaveChargingStationOcppConfiguration(tenantID: string, chargingStation: ChargingStation, newChargingStation = false): Promise<OCPPChangeConfigurationCommandResult> {
    try {
      // Get the OCPP Client
      const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
      // Get the OCPP Configuration
      const ocppConfiguration = await chargingStationClient.getConfiguration({});
      // Log
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id, module: 'OCPPUtils',
        method: 'requestAndSaveChargingStationOcppConfiguration', action: 'RequestConfiguration',
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
        await this.checkAndUpdateChargingStationOcppParameters(tenantID, chargingStation, chargingStationConfiguration);
      }
      // Ok
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id, module: 'OCPPUtils',
        method: 'requestAndSaveChargingStationOcppConfiguration', action: 'RequestConfiguration',
        message: 'Configuration has been saved'
      });
      return { status: OCPPConfigurationStatus.ACCEPTED };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, 'RequestConfiguration', error);
      return { status: OCPPConfigurationStatus.REJECTED };
    }
  }

  public static async checkAndUpdateChargingStationOcppParameters(tenantID: string, chargingStation: ChargingStation, currentConfiguration: ChargingStationConfiguration) {
    let oneOCPPParameterUpdated = false;
    if (Utils.isEmptyArray(chargingStation.ocppStandardParameters) && Utils.isEmptyArray(chargingStation.ocppVendorParameters)) {
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id, module: 'OCPPUtils',
        method: 'checkAndUpdateChargingStationOcppParameters', action: 'ChangeConfiguration',
        message: 'Charging Station has no Standard/Vendor OCPP Parameters to change'
      });
      return;
    }
    // Get the Charging Station client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    // Merge Standard and Specific parameters
    const ocppParameters = chargingStation.ocppStandardParameters.concat(chargingStation.ocppVendorParameters);
    // Check Standard OCPP Params
    for (const ocppParameter of ocppParameters) {
      // Find OCPP Param
      const currentOcppParam: KeyValue = currentConfiguration.configuration.find(
        (ocppParam) => ocppParam.key === ocppParameter.key);
      try {
        if (!currentOcppParam) {
          // Not Found in Charging Station!
          Logging.logError({
            tenantID: tenantID, source: chargingStation.id, module: 'OCPPUtils',
            method: 'checkAndUpdateChargingStationOcppParameters', action: 'ChangeConfiguration',
            message: `OCPP Parameter '${ocppParameter.key}' not found in Charging Station's configuration`
          });
        }
        // Check Value
        if (ocppParameter.value === currentOcppParam.value) {
          // Ok: Already the good value
          Logging.logInfo({
            tenantID: tenantID, source: chargingStation.id, module: 'OCPPUtils',
            method: 'checkAndUpdateChargingStationOcppParameters', action: 'ChangeConfiguration',
            message: `OCPP Parameter '${ocppParameter.key}' has the correct value '${currentOcppParam.value}'`
          });
          continue;
        }
        // Execute update command
        const result = await chargingStationClient.changeConfiguration({
          key: ocppParameter.key,
          value: ocppParameter.value
        });
        if (result.status === OCPPConfigurationStatus.ACCEPTED) {
          // Ok
          oneOCPPParameterUpdated = true;
          // Value is different: Update it
          Logging.logInfo({
            tenantID: tenantID, source: chargingStation.id, module: 'OCPPUtils',
            method: 'checkAndUpdateChargingStationOcppParameters', action: 'ChangeConfiguration',
            message: `OCPP Parameter '${currentOcppParam.key}' has been successfully set from '${currentOcppParam.value}' to '${ocppParameter.value}'`
          });
        } else {
          Logging.logError({
            tenantID: tenantID, source: chargingStation.id, module: 'OCPPUtils',
            method: 'checkAndUpdateChargingStationOcppParameters', action: 'ChangeConfiguration',
            message: `Error '${result.status}' in changing OCPP parameter '${ocppParameter.key}' from '${currentOcppParam.value}' to '${ocppParameter.value}': `
          });
        }
      } catch (error) {
        Logging.logError({
          tenantID: tenantID, source: chargingStation.id, module: 'OCPPUtils',
          method: 'checkAndUpdateChargingStationOcppParameters', action: 'ChangeConfiguration',
          message: `Error in changing OCPP parameter '${ocppParameter.key}' from '${currentOcppParam.value}' to '${ocppParameter.value}'`,
          detailedMessages: error
        });
      }
    }
    // Parameter Updated?
    if (oneOCPPParameterUpdated) {
      // Reload the configuration
      await this.requestAndSaveChargingStationOcppConfiguration(tenantID, chargingStation);
    }
  }

  public static async requestChangeChargingStationConfiguration(
    tenantID: string, chargingStation: ChargingStation, params: OCPPChangeConfigurationCommandParam) {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    // Get the configuration
    const result = await chargingStationClient.changeConfiguration(params);
    // Request the new Configuration?
    if (result.status === OCPPConfigurationStatus.ACCEPTED) {
      // Retrieve and Save it
      await OCPPUtils.requestAndSaveChargingStationOcppConfiguration(tenantID, chargingStation);
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
