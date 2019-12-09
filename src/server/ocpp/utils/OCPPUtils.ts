import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import buildChargingStationClient from '../../../client/ocpp/ChargingStationClientFactory';
import BackendError from '../../../exception/BackendError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import ChargingStation, { ChargingStationTemplate } from '../../../types/ChargingStation';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import OCPPConstants from './OCPPConstants';

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
    }
    // Copy from template
    if (foundTemplate) {
      for (const key in foundTemplate.template) {
        chargingStation[key] = foundTemplate.template[key];
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

  static async updateConnectorsPower(tenantID: string, chargingStation: ChargingStation) {
    let voltageRerefence = 0;
    let current = 0;
    let nbPhase = 0;
    let power = 0;
    let totalPower = 0;

    // Only for Schneider
    if (chargingStation.chargePointVendor === Constants.VENDOR_SCHNEIDER) {
      // Get the configuration
      const configuration = await ChargingStationStorage.getConfiguration(tenantID, chargingStation.id);
      // Config Provided?
      if (configuration && configuration.configuration) {
        // Search for params
        for (let i = 0; i < configuration.configuration.length; i++) {
          // Check
          switch (configuration.configuration[i].key) {
            // Voltage
            case 'voltagererefence':
              // Get the meter interval
              voltageRerefence = parseInt(configuration.configuration[i].value);
              break;
            // Current
            case 'currentpb1':
              // Get the meter interval
              current = parseInt(configuration.configuration[i].value);
              break;
            // Nb Phase
            case 'nbphase':
              // Get the meter interval
              nbPhase = parseInt(configuration.configuration[i].value);
              break;
          }
        }
        // Override?
        if (chargingStation.numberOfConnectedPhase) {
          // Yes
          nbPhase = chargingStation.numberOfConnectedPhase;
        }
        // Compute it
        if (voltageRerefence && current && nbPhase) {
          // One Phase?
          if (nbPhase === 1) {
            power = Math.floor(230 * current);
          } else {
            power = Math.floor(400 * current * Math.sqrt(nbPhase));
          }
        }
      }
      // Set Power
      for (const connector of chargingStation.connectors) {
        if (connector) {
          connector.power = power;
          totalPower += power;
        }
      }
      // Set total power
      if (totalPower && !chargingStation.maximumPower) {
        chargingStation.maximumPower = totalPower;
      }
    }
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

  public static async requestAndSaveChargingStationConfiguration(tenantID: string, chargingStation: ChargingStation) {
    let configuration = null;
    try {
      // In case of error. the boot should no be denied
      configuration = await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'getConfiguration', {});
      // Log
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id, module: 'ChargingStationService',
        method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
        message: 'Command sent with success', detailedMessages: configuration
      });
      // Override with Conf
      configuration = {
        'configuration': configuration.configurationKey
      };
      // Set default?
      if (!configuration) {
        // Check if there is an already existing config
        const existingConfiguration = await ChargingStationStorage.getConfiguration(tenantID, chargingStation.id);
        if (!existingConfiguration) {
          // No config at all: Set default OCPP configuration
          configuration = OCPPConstants.DEFAULT_OCPP_CONFIGURATION;
        } else {
          // Set default
          configuration = existingConfiguration;
        }
      }
      // Set the charger ID
      configuration.chargeBoxID = chargingStation.id;
      configuration.timestamp = new Date();
      // Save config
      await OCPPStorage.saveConfiguration(tenantID, configuration);
      // Update connector power
      await OCPPUtils.updateConnectorsPower(tenantID, chargingStation);
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

  public static checkAndFreeChargingStationConnector(tenantID: string, chargingStation: ChargingStation, connectorId: number, saveOtherConnectors = false) {
    // Cleanup connector transaction data
    const foundConnector = chargingStation.connectors.find((connector) => connector.connectorId === connectorId);
    if (foundConnector) {
      foundConnector.currentConsumption = 0;
      foundConnector.totalConsumption = 0;
      foundConnector.totalInactivitySecs = 0;
      foundConnector.currentStateOfCharge = 0;
      foundConnector.activeTransactionID = 0;
      foundConnector.activeTransactionDate = null;
      foundConnector.activeTagID = null;
    }
  }
}
