import { ActionsResponse, KeyValue } from '../../../types/GlobalType';
import { ChargingProfile, ChargingProfilePurposeType } from '../../../types/ChargingProfile';
import ChargingStation, { ChargingStationCapabilities, ChargingStationOcppParameters, ChargingStationTemplate, TemplateUpdateResult } from '../../../types/ChargingStation';
import { OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPChargingProfileStatus, OCPPConfigurationStatus, OCPPGetConfigurationCommandParam } from '../../../types/ocpp/OCPPClient';

import BackendError from '../../../exception/BackendError';
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ChargingStationVendorFactory from '../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import Constants from '../../../utils/Constants';
import { InactivityStatus } from '../../../types/Transaction';
import Logging from '../../../utils/Logging';
import OCPPConstants from './OCPPConstants';
import { OCPPNormalizedMeterValue } from '../../../types/ocpp/OCPPServer';
import { ServerAction } from '../../../types/Server';
import SiteArea from '../../../types/SiteArea';
import UserToken from '../../../types/UserToken';
import Utils from '../../../utils/Utils';

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

  public static async enrichChargingStationWithTemplate(tenantID: string, chargingStation: ChargingStation): Promise<TemplateUpdateResult> {
    const templateUpdateResult: TemplateUpdateResult = {
      technicalUpdated: false,
      capabilitiesUpdated: false,
      ocppUpdated: false,
    };
    // Get Template
    const chargingStationTemplate = await OCPPUtils.getChargingStationTemplate(chargingStation);
    // Copy from template
    if (chargingStationTemplate) {
      // Already updated?
      if (chargingStation.templateHash !== chargingStationTemplate.hash) {
        chargingStation.templateHash = chargingStationTemplate.hash;
        // Check Technical Hash
        if (chargingStation.templateHashTechnical !== chargingStationTemplate.hashTechnical) {
          templateUpdateResult.technicalUpdated = true;
          // Set the hash
          chargingStation.templateHashTechnical = chargingStationTemplate.hashTechnical;
          if (Utils.objectHasProperty(chargingStationTemplate.technical, 'maximumPower')) {
            chargingStation.maximumPower = chargingStationTemplate.technical.maximumPower;
          }
          if (Utils.objectHasProperty(chargingStationTemplate.technical, 'chargePoints')) {
            chargingStation.chargePoints = chargingStationTemplate.technical.chargePoints;
          }
          if (Utils.objectHasProperty(chargingStationTemplate.technical, 'powerLimitUnit')) {
            chargingStation.powerLimitUnit = chargingStationTemplate.technical.powerLimitUnit;
          }
          if (Utils.objectHasProperty(chargingStationTemplate.technical, 'voltage')) {
            chargingStation.voltage = chargingStationTemplate.technical.voltage;
          }
          // Enrich connectors
          if (chargingStation.connectors) {
            for (const connector of chargingStation.connectors) {
              await OCPPUtils.enrichChargingStationConnectorWithTemplate(
                tenantID, chargingStation, connector.connectorId, chargingStationTemplate);
            }
          }
        }
        // Already updated?
        if (chargingStation.templateHashCapabilities !== chargingStationTemplate.hashCapabilities) {
          chargingStation.templateHashCapabilities = chargingStationTemplate.hashCapabilities;
          templateUpdateResult.capabilitiesUpdated = true;
          // Handle capabilities
          chargingStation.capabilities = {} as ChargingStationCapabilities;
          if (Utils.objectHasProperty(chargingStationTemplate, 'capabilities')) {
            let matchFirmware = true;
            let matchOcpp = true;
            // Search Firmware/Ocpp match
            for (const capabilities of chargingStationTemplate.capabilities) {
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
        }
        // Already updated?
        if (chargingStation.templateHashOcppStandard !== chargingStationTemplate.hashOcppStandard) {
          chargingStation.templateHashOcppStandard = chargingStationTemplate.hashOcppStandard;
          templateUpdateResult.ocppUpdated = true;
          // Handle OCPP Standard Parameters
          chargingStation.ocppStandardParameters = [];
          if (Utils.objectHasProperty(chargingStationTemplate, 'ocppStandardParameters')) {
            let matchOcpp = true;
            // Search Firmware/Ocpp match
            for (const ocppStandardParameters of chargingStationTemplate.ocppStandardParameters) {
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
        }
        // Already updated?
        if (chargingStation.templateHashOcppVendor !== chargingStationTemplate.hashOcppVendor) {
          chargingStation.templateHashOcppVendor = chargingStationTemplate.hashOcppVendor;
          templateUpdateResult.ocppUpdated = true;
          // Handle OCPP Vendor Parameters
          chargingStation.ocppVendorParameters = [];
          if (Utils.objectHasProperty(chargingStationTemplate, 'ocppVendorParameters')) {
            let matchFirmware = true;
            let matchOcpp = true;
            // Search Firmware/Ocpp match
            for (const ocppVendorParameters of chargingStationTemplate.ocppVendorParameters) {
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
        }
        // Log
        const sectionsUpdated = [];
        if (templateUpdateResult.technicalUpdated) {
          sectionsUpdated.push('Technical');
        }
        if (templateUpdateResult.ocppUpdated) {
          sectionsUpdated.push('OCPP');
        }
        if (templateUpdateResult.capabilitiesUpdated) {
          sectionsUpdated.push('Capabilities');
        }
        Logging.logInfo({
          tenantID: tenantID,
          source: chargingStation.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
          message: `Template applied and updated the following sections: ${sectionsUpdated.join(', ')}`,
          detailedMessages: { templateUpdateResult, chargingStationTemplate }
        });
        return templateUpdateResult;
      }
      // Log
      Logging.logDebug({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
        message: 'Template has already been applied',
        detailedMessages: { chargingStationTemplate }
      });
      return templateUpdateResult;
    }
    // Log
    Logging.logWarning({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
      message: 'No Template has been found!',
      detailedMessages: { chargingStation }
    });
    return templateUpdateResult;
  }

  public static async enrichChargingStationConnectorWithTemplate(
    tenantID: string, chargingStation: ChargingStation, connectorID: number,
    chargingStationTemplate: ChargingStationTemplate): Promise<boolean> {
    // Copy from template
    if (chargingStationTemplate) {
      // Handle connector
      if (Utils.objectHasProperty(chargingStationTemplate.technical, 'connectors')) {
        // Find the connector in the template
        const templateConnector = chargingStationTemplate.technical.connectors.find(
          (connector) => connector.connectorId === connectorID);
        if (!templateConnector) {
          // Log
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
            module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
            message: `No Connector found in Template for Connector ID '${connectorID}' on '${chargingStation.chargePointVendor}'`
          });
          return false;
        }
        // Force Update
        for (const connector of chargingStation.connectors) {
          // Set
          if (connector.connectorId === connectorID) {
            // Assign props
            connector.type = templateConnector.type;
            if (Utils.objectHasProperty(templateConnector, 'power')) {
              connector.power = templateConnector.power;
            } else {
              delete connector.power;
            }
            if (Utils.objectHasProperty(templateConnector, 'amperage')) {
              connector.amperage = templateConnector.amperage;
            } else {
              delete connector.amperage;
            }
            if (Utils.objectHasProperty(templateConnector, 'chargePointID')) {
              connector.chargePointID = templateConnector.chargePointID;
            } else {
              delete connector.chargePointID;
            }
            if (Utils.objectHasProperty(templateConnector, 'voltage')) {
              connector.voltage = templateConnector.voltage;
            } else {
              delete connector.voltage;
            }
            if (Utils.objectHasProperty(templateConnector, 'currentType')) {
              connector.currentType = templateConnector.currentType;
            } else {
              delete connector.currentType;
            }
            if (Utils.objectHasProperty(templateConnector, 'numberOfConnectedPhase')) {
              connector.numberOfConnectedPhase = templateConnector.numberOfConnectedPhase;
            } else {
              delete connector.numberOfConnectedPhase;
            }
            break;
          }
        }
      }
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
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
      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
      message: `No Template for Connector ID '${connectorID}' has been found for '${chargingStation.chargePointVendor}'`
    });
    return false;
  }

  public static async clearAndDeleteChargingProfilesForSiteArea(
    tenantID: string, siteArea: SiteArea,
    params?: { profilePurposeType?: ChargingProfilePurposeType; transactionId?: number }): Promise<ActionsResponse> {
    const actionsResponse: ActionsResponse = {
      inError: 0,
      inSuccess: 0
    };
    for (const chargingStation of siteArea.chargingStations) {
      const chargingProfiles = await ChargingStationStorage.getChargingProfiles(tenantID, {
        chargingStationID: [chargingStation.id],
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
            action: ServerAction.CHARGING_PROFILE_DELETE,
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
    // Get charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, chargingProfile.chargingStationID);
    // Check if Charging Profile is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new BackendError({
        source: chargingProfile.chargingStationID,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
        message: `Charging Station '${chargingStation.id}' does not support the Charging Profiles`,
      });
    }
    // Get Vendor Instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new BackendError({
        source: chargingProfile.chargingStationID,
        action: ServerAction.CHARGING_PROFILE_DELETE,
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
        action: ServerAction.CHARGING_PROFILE_DELETE,
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
      action: ServerAction.CHARGING_PROFILE_DELETE,
      module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
      message: 'Charging Profile has been deleted successfully',
      detailedMessages: { chargingProfile }
    });
  }

  public static async setAndSaveChargingProfile(tenantID: string, chargingProfile: ChargingProfile, user?: UserToken): Promise<string> {
    // Get charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, chargingProfile.chargingStationID);
    if (!chargingStation) {
      throw new BackendError({
        source: chargingProfile.chargingStationID,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: 'Charging Station not found',
      });
    }
    // Get charge point
    const chargePoint = Utils.getChargePointFromID(chargingStation, chargingProfile.chargePointID);
    // Get Vendor Instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for setting a Charging Profile`,
      });
    }
    // Set Charging Profile
    const result = await chargingStationVendor.setChargingProfile(
      tenantID, chargingStation, chargePoint, chargingProfile);
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
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: 'Cannot set the Charging Profile!',
        detailedMessages: { result, chargingProfile },
      });
    }
    // Save
    const chargingProfileID = await ChargingStationStorage.saveChargingProfile(tenantID, chargingProfile);
    Logging.logInfo({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_PROFILE_UPDATE,
      module: MODULE_NAME, method: 'setAndSaveChargingProfile',
      message: 'Charging Profile has been successfully pushed and saved',
      detailedMessages: { chargingProfile }
    });
    return chargingProfileID;
  }

  static isSocMeterValue(meterValue: OCPPNormalizedMeterValue) {
    return meterValue.attribute
      && meterValue.attribute.context === 'Sample.Periodic'
      && meterValue.attribute.measurand === 'SoC';
  }

  static isActiveEnergyMeterValue(meterValue: OCPPNormalizedMeterValue) {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === 'Energy.Active.Import.Register' &&
      (meterValue.attribute.context === 'Sample.Periodic' || meterValue.attribute.context === 'Sample.Clock'));
  }

  static isActivePowerMeterValue(meterValue: OCPPNormalizedMeterValue) {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === 'Power.Active.Import' &&
       meterValue.attribute.context === 'Sample.Periodic');
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
    chargingStation: ChargingStation, forceUpdateOcppParametersWithTemplate = false): Promise<OCPPChangeConfigurationCommandResult> {
    try {
      // Get the OCPP Client
      const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
      if (!chargingStationClient) {
        throw new BackendError({
          source: chargingStation.id,
          action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
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
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
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
      if (forceUpdateOcppParametersWithTemplate) {
        await this.checkAndUpdateChargingStationOcppParameters(tenantID, chargingStation, chargingStationOcppParameters);
      }
      // Ok
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestAndSaveChargingStationOcppParameters',
        message: 'Configuration has been saved'
      });
      return { status: OCPPConfigurationStatus.ACCEPTED };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION, error);
      return { status: OCPPConfigurationStatus.REJECTED };
    }
  }

  public static async checkAndUpdateChargingStationOcppParameters(tenantID: string, chargingStation: ChargingStation, currentParameters: ChargingStationOcppParameters) {
    let oneOcppParameterUpdated = false;
    if (Utils.isEmptyArray(chargingStation.ocppStandardParameters) && Utils.isEmptyArray(chargingStation.ocppVendorParameters)) {
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
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
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
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
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
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
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
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
          oneOcppParameterUpdated = true;
          // Value is different: Update it
          Logging.logInfo({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
            message: `OCPP Parameter '${currentOcppParam.key}' has been successfully set from '${currentOcppParam.value}' to '${ocppParameter.value}'`
          });
        } else {
          Logging.logError({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
            message: `Error '${result.status}' in changing OCPP parameter '${ocppParameter.key}' from '${currentOcppParam.value}' to '${ocppParameter.value}': `
          });
        }
      } catch (error) {
        Logging.logError({
          tenantID: tenantID,
          source: chargingStation.id,
          action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
          module: MODULE_NAME, method: 'checkAndUpdateChargingStationOcppParameters',
          message: `Error in changing OCPP parameter '${ocppParameter.key}' from '${currentOcppParam.value}' to '${ocppParameter.value}'`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Parameter Updated?
    if (oneOcppParameterUpdated) {
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
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
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

  public static checkAndFreeChargingStationConnector(chargingStation: ChargingStation, connectorId: number) {
    // Cleanup connector transaction data
    const foundConnector = Utils.getConnectorFromID(chargingStation, connectorId);
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
