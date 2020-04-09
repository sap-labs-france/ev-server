import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import BackendError from '../../../exception/BackendError';
import ChargingStationVendorFactory from '../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import { Action } from '../../../types/Authorization';
import { ChargingProfile, ChargingProfilePurposeType } from '../../../types/ChargingProfile';
import ChargingStation, { ChargingStationCapabilities, ChargingStationCurrentType, ChargingStationOcppParameters, ChargingStationTemplate } from '../../../types/ChargingStation';
import { ActionsResponse, KeyValue } from '../../../types/GlobalType';
import { OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPChargingProfileStatus, OCPPConfigurationStatus, OCPPGetConfigurationCommandParam } from '../../../types/ocpp/OCPPClient';
import { OCPPNormalizedMeterValue } from '../../../types/ocpp/OCPPServer';
import SiteArea from '../../../types/SiteArea';
import { InactivityStatus } from '../../../types/Transaction';
import UserToken from '../../../types/UserToken';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import OCPPConstants from './OCPPConstants';

const MODULE_NAME = 'OCPPUtils';

export default class OCPPUtils {

  public static async getChargingStationTemplate(chargingStation: ChargingStation): Promise<ChargingStationTemplate> {
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
        if (Utils.objectHasProperty(chargingStationTemplate.extraFilters, filter)) {
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
    const chargingStationTemplate = await OCPPUtils.getChargingStationTemplate(chargingStation);
    // Copy from template
    if (chargingStationTemplate) {
      // Already updated?
      if (chargingStation.templateHash !== chargingStationTemplate.hash) {
        // Set the hash
        chargingStation.templateHash = chargingStationTemplate.hash;
        // Assign props
        if (Utils.objectHasProperty(chargingStationTemplate.template, 'cannotChargeInParallel')) {
          chargingStation.cannotChargeInParallel = chargingStationTemplate.template.cannotChargeInParallel;
        }
        if (Utils.objectHasProperty(chargingStationTemplate.template, 'private')) {
          chargingStation.private = chargingStationTemplate.template.private;
        }
        if (Utils.objectHasProperty(chargingStationTemplate.template, 'maximumPower')) {
          chargingStation.maximumPower = chargingStationTemplate.template.maximumPower;
        }
        if (Utils.objectHasProperty(chargingStationTemplate.template, 'currentType')) {
          chargingStation.currentType = chargingStationTemplate.template.currentType;
        }
        // Enrich connectors
        if (chargingStation.connectors) {
          for (const connector of chargingStation.connectors) {
            await OCPPUtils.enrichChargingStationConnectorWithTemplate(
              tenantID, chargingStation, connector.connectorId, chargingStationTemplate);
          }
        }
        // Handle capabilities
        chargingStation.capabilities = {} as ChargingStationCapabilities;
        if (Utils.objectHasProperty(chargingStationTemplate.template, 'capabilities')) {
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
        if (Utils.objectHasProperty(chargingStationTemplate.template, 'ocppAdvancedCommands')) {
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
        if (Utils.objectHasProperty(chargingStationTemplate.template, 'ocppStandardParameters')) {
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
        if (Utils.objectHasProperty(chargingStationTemplate.template, 'ocppVendorParameters')) {
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
          action: Action.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
          message: `Template has been applied successfully for '${chargingStation.chargePointVendor}'`,
          detailedMessages: { chargingStationTemplate }
        });
        return true;
      }
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
        message: `Template has already been applied for '${chargingStation.chargePointVendor}'`,
        detailedMessages: { chargingStationTemplate }
      });
      return false;

    }
    // Log
    Logging.logWarning({
      tenantID: tenantID,
      source: chargingStation.id,
      action: Action.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
      message: 'No Template has been found!',
      detailedMessages: { chargingStation }
    });
    return false;

  }

  public static async enrichChargingStationConnectorWithTemplate(
    tenantID: string, chargingStation: ChargingStation, connectorID: number,
    chargingStationTemplate: ChargingStationTemplate): Promise<boolean> {
    // Copy from template
    if (chargingStationTemplate) {
      // Handle connector
      if (Utils.objectHasProperty(chargingStationTemplate.template, 'connectors')) {
        // Find the connector in the template
        const templateConnector = chargingStationTemplate.template.connectors.find(
          (connector) => connector.connectorId === connectorID);
        if (!templateConnector) {
          // Log
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
            module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
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
        tenantID: tenantID, 
        source: chargingStation.id,
        action: Action.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
        message: `Template for Connector ID '${connectorID}' has been applied successfully on '${chargingStation.chargePointVendor}'`,
        detailedMessages: { chargingStationTemplate }
      });
      return true;
    }
    // Log
    Logging.logWarning({
      tenantID: tenantID,
      source: chargingStation.id,
      action: Action.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
      message: `No Template for Connector ID '${connectorID}' has been found for '${chargingStation.chargePointVendor}'`
    });
    return false;
  }

  public static async clearAndDeleteChargingProfilesForSiteArea(
      tenantID: string, siteArea: SiteArea,
      params?: { profilePurposeType?: ChargingProfilePurposeType; transactionId?: number; }): Promise<ActionsResponse> {
    const actionsResponse: ActionsResponse = {
      inError: 0,
      inSuccess: 0
    };
    for (const chargingStation of siteArea.chargingStations) {
      const chargingProfiles = await ChargingStationStorage.getChargingProfiles(tenantID, { 
        chargingStationID: chargingStation.id,
        profilePurposeType: params.profilePurposeType,
        transactionId: params.transactionId
      }, Constants.DB_PARAMS_MAX_LIMIT);
      for (const chargingProfile of chargingProfiles.result) {
        try {
          await this.clearAndDeleteChargingProfile(tenantID, chargingProfile);
          actionsResponse.inSuccess++;
        } catch (error) {
          Logging.logError({
            tenantID: tenantID,
            source: chargingProfile.chargingStationID,
            action: Action.CHARGING_PROFILE_DELETE,
            module: MODULE_NAME, method: 'clearAndDeleteChargingProfilesForSiteArea',
            message: `Error while clearing the charging profile for chargingStation ${chargingProfile.chargingStationID}`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
          actionsResponse.inError++;
        }
      }
    }
    return actionsResponse;
  }

  public static async clearAndDeleteChargingProfile(tenantID: string, chargingProfile: ChargingProfile) {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingProfile.chargingStationID,
      action: Action.CHARGING_PROFILE_DELETE,
      message: 'Clear and Delete Charging Profile is being called',
      module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
      detailedMessages: { chargingProfile }
    });
    // Get charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, chargingProfile.chargingStationID);
    // Check if Charging Profile is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new BackendError({
        source: chargingProfile.chargingStationID,
        action: Action.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
        message: `Charging Station '${chargingStation.id}' does not support the Charging Profiles`,
      });
    }
    // Get Vendor Instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorInstance(chargingStation);
    if (!chargingStationVendor) {
      throw new BackendError({
        source: chargingProfile.chargingStationID,
        action: Action.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for setting a Charging Profile`,
      });
    }
    // Clear Charging Profile
    // Do not check the result beacause:
    // 1\ Charging Profile exists and has been deleted: Status = ACCEPTED
    // 2\ Charging Profile does not exist : Status = UNKNOWN
    // As there are only 2 statuses, testing them is not necessary
    try {
      await chargingStationVendor.clearChargingProfile(tenantID, chargingStation, chargingProfile);
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.CHARGING_PROFILE_DELETE,
        message: 'Error occurred while clearing the Charging Profile',
        module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
        detailedMessages: { error: error.message, stack: error.stack }
      });
      throw error;
    }
    // Delete from database
    await ChargingStationStorage.deleteChargingProfile(tenantID, chargingProfile.id);
    // Log
    Logging.logInfo({
      tenantID: tenantID,
      source: chargingStation.id,
      action: Action.CHARGING_PROFILE_DELETE,
      module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
      message: 'Charging Profile has been deleted successfully',
    });
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingProfile.chargingStationID,
      action: Action.CHARGING_PROFILE_DELETE,
      message: 'Clear and Delete Charging Profile has been called',
      module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
      detailedMessages: { tenantID, chargingProfile }
    });
  }

  public static async setAndSaveChargingProfile(tenantID: string, chargingProfile: ChargingProfile, user?: UserToken) {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingProfile.chargingStationID,
      action: Action.CHARGING_PROFILE_UPDATE,
      message: 'Set and Save Charging Profile is being called',
      module: MODULE_NAME, method: 'setAndSaveChargingProfile',
      detailedMessages: { tenantID, chargingProfile, user }
    });
    // Get charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, chargingProfile.chargingStationID);
    if (!chargingStation) {
      throw new BackendError({
        source: chargingProfile.chargingStationID,
        action: Action.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: 'Charging Station not found',
      });
    }
    // Get Vendor Instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorInstance(chargingStation);
    if (!chargingStationVendor) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for setting a Charging Profile`,
      });
    }
    // Set Charging Profile
    const result = await chargingStationVendor.setChargingProfile(tenantID, chargingStation, chargingProfile);
    // Check for Array
    let resultStatus = OCPPChargingProfileStatus.ACCEPTED;
    if (Array.isArray(result)) {
      for (const oneResult of result) {
        if (oneResult.status !== OCPPChargingProfileStatus.ACCEPTED) {
          resultStatus = oneResult.status;
          break;
        }
      }
    } else {
      resultStatus = (result).status;
    }
    if (resultStatus !== OCPPChargingProfileStatus.ACCEPTED) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.CHARGING_PROFILE_UPDATE,
        user: user,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: 'Cannot set the Charging Profile!',
        detailedMessages: { result, chargingProfile },
      });
    }
    // Save
    await ChargingStationStorage.saveChargingProfile(tenantID, chargingProfile);
    Logging.logInfo({
      tenantID: user.tenantID,
      source: chargingStation.id,
      action: Action.CHARGING_PROFILE_UPDATE,
      user: user,
      module: MODULE_NAME, method: 'setAndSaveChargingProfile',
      message: 'Charging Profile has been successfully pushed and saved',
      detailedMessages: { chargingProfile }
    });
    // Log
    Logging.logDebug({
      tenantID: tenantID,
      source: chargingProfile.chargingStationID,
      action: Action.CHARGING_PROFILE_UPDATE,
      message: 'Set and Save Charging Profile has been called',
      module: MODULE_NAME, method: 'setAndSaveChargingProfile'
    });
  }

  public static recalculateChargingStationMaxPower(chargingStation: ChargingStation) {
    let maximumPower = 0;
    // Only for AC
    if (chargingStation.currentType !== ChargingStationCurrentType.AC) {
      return;
    }
    for (const connector of chargingStation.connectors) {
      if (Utils.objectHasProperty(connector, 'power')) {
        maximumPower += connector.power;
      }
    }
    if (maximumPower) {
      chargingStation.maximumPower = maximumPower;
    }
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
        module: MODULE_NAME,
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
        module: MODULE_NAME,
        method: 'checkAndGetChargingStation',
        message: 'Charging Station does not exist'
      });
    }
    // Deleted?
    if (chargingStation.deleted) {
      throw new BackendError({
        source: chargeBoxIdentity,
        module: MODULE_NAME,
        method: 'checkAndGetChargingStation',
        message: 'Charging Station is deleted'
      });
    }
    return chargingStation;
  }

  public static async requestAndSaveChargingStationOcppParameters(tenantID: string,
    chargingStation: ChargingStation, forceUpdateOCPPParametersWithTemplate = false): Promise<OCPPChangeConfigurationCommandResult> {
    try {
      // Get the OCPP Client
      const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
      if (!chargingStationClient) {
        throw new BackendError({
          source: chargingStation.id,
          action: Action.CHANGE_CONFIGURATION,
          module: MODULE_NAME, method: 'requestAndSaveChargingStationOcppParameters',
          message: 'Charging Station is not connected to the backend',
        });
      }
      // Get the OCPP Configuration
      const ocppConfiguration = await chargingStationClient.getConfiguration({});
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestAndSaveChargingStationOcppParameters',
        message: 'Command sent with success',
        detailedMessages: { ocppConfiguration }
      });
      // Create Conf
      const chargingStationOcppParameters: ChargingStationOcppParameters = {
        id: chargingStation.id,
        configuration: ocppConfiguration.configurationKey,
        timestamp: new Date()
      };
      // Set default?
      if (!chargingStationOcppParameters.configuration) {
        // Check if there is an already existing config in DB
        const existingConfiguration = await ChargingStationStorage.getOcppParameters(tenantID, chargingStation.id);
        if (!existingConfiguration) {
          // No config at all: Set default OCPP configuration
          chargingStationOcppParameters.configuration = OCPPConstants.DEFAULT_OCPP_16_CONFIGURATION;
        }
      }
      // Save config
      await ChargingStationStorage.saveOcppParameters(tenantID, chargingStationOcppParameters);
      // Check OCPP Configuration
      if (forceUpdateOCPPParametersWithTemplate) {
        await this.checkAndUpdateChargingStationOcppParameters(tenantID, chargingStation, chargingStationOcppParameters);
      }
      // Ok
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestAndSaveChargingStationOcppParameters',
        message: 'Configuration has been saved'
      });
      return { status: OCPPConfigurationStatus.ACCEPTED };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, Action.GET_CONFIGURATION, error);
      return { status: OCPPConfigurationStatus.REJECTED };
    }
  }

  public static async checkAndUpdateChargingStationOcppParameters(tenantID: string, chargingStation: ChargingStation, currentParameters: ChargingStationOcppParameters) {
    let oneOCPPParameterUpdated = false;
    if (Utils.isEmptyArray(chargingStation.ocppStandardParameters) && Utils.isEmptyArray(chargingStation.ocppVendorParameters)) {
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: Action.CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
        message: 'Charging Station has no Standard/Vendor OCPP Parameters to change'
      });
      return;
    }
    // Get the Charging Station client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Merge Standard and Specific parameters
    const ocppParameters = chargingStation.ocppStandardParameters.concat(chargingStation.ocppVendorParameters);
    // Check Standard OCPP Params
    for (const ocppParameter of ocppParameters) {
      // Find OCPP Param
      const currentOcppParam: KeyValue = currentParameters.configuration.find(
        (ocppParam) => ocppParam.key === ocppParameter.key);
      try {
        if (!currentOcppParam) {
          // Not Found in Charging Station!
          Logging.logError({
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
            message: `OCPP Parameter '${ocppParameter.key}' not found in Charging Station's configuration`
          });
        }
        // Check Value
        if (ocppParameter.value === currentOcppParam.value) {
          // Ok: Already the good value
          Logging.logInfo({
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
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
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
            message: `OCPP Parameter '${currentOcppParam.key}' has been successfully set from '${currentOcppParam.value}' to '${ocppParameter.value}'`
          });
        } else {
          Logging.logError({
            tenantID: tenantID,
            source: chargingStation.id,
            action: Action.CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
            message: `Error '${result.status}' in changing OCPP parameter '${ocppParameter.key}' from '${currentOcppParam.value}' to '${ocppParameter.value}': `
          });
        }
      } catch (error) {
        Logging.logError({
          tenantID: tenantID,
          source: chargingStation.id,
          action: Action.CHANGE_CONFIGURATION,
          module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
          message: `Error in changing OCPP parameter '${ocppParameter.key}' from '${currentOcppParam.value}' to '${ocppParameter.value}'`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Parameter Updated?
    if (oneOCPPParameterUpdated) {
      // Reload the configuration
      await this.requestAndSaveChargingStationOcppParameters(tenantID, chargingStation);
    }
  }

  public static async requestChangeChargingStationOcppParameters(
    tenantID: string, chargingStation: ChargingStation, params: OCPPChangeConfigurationCommandParam) {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestChangeChargingStationOcppParameters',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Get the configuration
    const result = await chargingStationClient.changeConfiguration(params);
    // Request the new Configuration?
    if (result.status === OCPPConfigurationStatus.ACCEPTED) {
      // Retrieve and Save it
      await OCPPUtils.requestAndSaveChargingStationOcppParameters(tenantID, chargingStation);
    }
    // Return
    return result;
  }

  public static async requestChargingStationOcppParameters(
    tenantID: string, chargingStation: ChargingStation, params: OCPPGetConfigurationCommandParam) {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    // Get the configuration
    const result = await chargingStationClient.getConfiguration(params);
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
