import * as moment from 'moment';
import momentDurationFormatSetup from 'moment-duration-format';
import tzlookup from 'tz-lookup';
import BackendError from '../exception/BackendError';
import buildChargingStationClient from '../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import Company from '../types/Company';
import Constants from '../utils/Constants';
import Database from '../utils/Database';
import DbParams from '../types/database/DbParams';
import Logging from '../utils/Logging';
import OCPPConstants from '../server/ocpp/utils/OCPPConstants';
import OCPPStorage from '../storage/mongodb/OCPPStorage';
import OCPPUtils from '../server/ocpp/utils/OCPPUtils';
import Site from '../types/Site';
import SiteArea from '../types/SiteArea';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../storage/mongodb/SiteStorage';
import TenantHolder from './TenantHolder';
import Transaction from './Transaction';
import User from '../types/User';
import Utils from '../utils/Utils';

momentDurationFormatSetup(moment);

export default class ChargingStation extends TenantHolder {
  public site: Site;
  public company: Company;
  private _model: any = {};

  constructor(tenantID, chargingStation) {
    super(tenantID);
    Database.updateChargingStation(chargingStation, this._model);
  }

  handleAction(action, params = {}) {
    return this['request' + action](params);
  }

  getTimezone() {
    if (this._model.latitude && this._model.longitude) {
      return tzlookup(this._model.latitude, this._model.longitude);
    }
  }



  getChargingStationClient() {
    // Get the client
    return buildChargingStationClient(this);
  }


  async requestAndSaveConfiguration() {
    let configuration = null;
    try {
      // In case of error. the boot should no be denied
      configuration = await this.requestGetConfiguration({});
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(), source: this.getID(), module: 'ChargingStation',
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
        const existingConfiguration = await this.getConfiguration();
        if (!existingConfiguration) {
          // No config at all: Set default OCCP configuration
          configuration = OCPPConstants.DEFAULT_OCPP_CONFIGURATION;
        } else {
          // Set default
          configuration = existingConfiguration;
        }
      }
      // Set the charger ID
      configuration.chargeBoxID = this.getID();
      configuration.timestamp = new Date();
      // Save config
      await OCPPStorage.saveConfiguration(this.getTenantID(), configuration);
      // Update connector power
      await OCPPUtils.updateConnectorsPower(this);
      // Ok
      Logging.logInfo({
        tenantID: this.getTenantID(), source: this.getID(), module: 'ChargingStation',
        method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
        message: 'Configuration has been saved'
      });
      return { status: 'Accepted' };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(this.getTenantID(), 'RequestConfiguration', error);
      return { status: 'Rejected' };
    }
  }


  async checkAndFreeConnector(connectorId, saveOtherConnectors = false) {
    // Cleanup connector transaction data
    this.cleanupConnectorTransactionInfo(connectorId);
    // Check if Charger can charge in //
    if (!this.canChargeInParallel()) {
      // Set all the other connectors to Available
      this.getConnectors().forEach(async (connector) => {
        // Only other Occupied connectors
        if ((connector.status === Constants.CONN_STATUS_OCCUPIED ||
          connector.status === Constants.CONN_STATUS_UNAVAILABLE) &&
          connector.connectorId !== connectorId) {
          // Set connector Available again
          connector.status = Constants.CONN_STATUS_AVAILABLE;
          // Save other updated connectors?
          if (saveOtherConnectors) {
            await this.saveChargingStationConnector(connector.connectorId);
          }
        }
      });
    }
  }

  cleanupConnectorTransactionInfo(connectorId) {
    const connector = this.getConnector(connectorId);
    // Clear
    if (connector) {
      connector.currentConsumption = 0;
      connector.totalConsumption = 0;
      connector.totalInactivitySecs = 0;
      connector.currentStateOfCharge = 0;
      connector.activeTransactionID = 0;
    }
  }

  requestReset(params) {
    return this._requestExecuteCommand('reset', params);
  }

  requestRemoteStopTransaction(params) {
    return this._requestExecuteCommand('remoteStopTransaction', params);
  }

  requestRemoteStartTransaction(params) {
    return this._requestExecuteCommand('remoteStartTransaction', params);
  }

  requestSetChargingProfile(params) {
    return this._requestExecuteCommand('setChargingProfile', params);
  }

  requestClearChargingProfile(params) {
    return this._requestExecuteCommand('clearChargingProfile', params);
  }

  requestGetDiagnostics(params) {
    return this._requestExecuteCommand('getDiagnostics', params);
  }

  requestUpdateFirmware(params) {
    return this._requestExecuteCommand('updateFirmware', params);
  }

  requestChangeAvailability(params) {
    return this._requestExecuteCommand('changeAvailability', params);
  }

  async requestGenericOCPPCommand(commandName, params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Set Charging Profile
    const result = await chargingStationClient.genericOCPPCommand(commandName, params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(), source: this.getID(),
      module: 'ChargingStation', method: 'requestGenericOCPPCommand', action: 'GenericOCPPCommand',
      message: 'Command sent with success', detailedMessages: result
    });
    // Return
    return result;
  }

  requestGetCompositeSchedule(params) {
    return this._requestExecuteCommand('getCompositeSchedule', params);
  }

  requestClearCache() {
    return this._requestExecuteCommand('clearCache');
  }

  requestGetConfiguration(params) {
    return this._requestExecuteCommand('getConfiguration', params);
  }

  async requestChangeConfiguration(params) {
    const result = await this._requestExecuteCommand('changeConfiguration', params);
    // Request the new Configuration?
    if (result.status !== 'Accepted') {
      // Error
      throw new BackendError(this.getID(), `Cannot set the configuration param ${params.key} with value ${params.value} to ${this.getID()}`,
        'ChargingStation', 'requestChangeConfiguration');
    }
    // Retrieve and Save it in the DB
    await this.requestAndSaveConfiguration();
    // Return
    return result;
  }

  // Unlock connector
  requestUnlockConnector(params) {
    return this._requestExecuteCommand('unlockConnector', params);
  }

  async _requestExecuteCommand(method, params?) {
    try {
      // Get the client
      const chargingStationClient = await this.getChargingStationClient();
      // Set Charging Profile
      const result = await chargingStationClient[method](params);
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(), source: this.getID(),
        module: 'ChargingStation', method: '_requestExecuteCommand',
        action: Utils.firstLetterInUpperCase(method),
        message: 'Command sent with success',
        detailedMessages: result
      });
      // Return
      return result;
    } catch (error) {
      // OCPP 1.6?
      if (Array.isArray(error.error)) {
        const response = error.error;
        throw new BackendError(this.getID(), response[3], 'ChargingStation',
          '_requestExecuteCommand', Utils.firstLetterInUpperCase(method));
      } else {
        throw error;
      }
    }
  }

  getConfiguration() {
    return ChargingStationStorage.getConfiguration(this.getTenantID(), this.getID());
  }

  getConfigurationParamValue(paramName) {
    return ChargingStationStorage.getConfigurationParamValue(this.getTenantID(), this.getID(), paramName);
  }

  async hasAtLeastOneTransaction() {
    // Get the consumption
    const transactions = await Transaction.getTransactions(this.getTenantID(), { 'chargeBoxID': this.getID() }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Return
    return (transactions.count > 0);
  }

  async getTransactions(connectorId, startDateTime, endDateTime, withChargeBoxes = false) {
    // Get the consumption
    const transactions = await Transaction.getTransactions(this.getTenantID(),
      {
        'chargeBoxID': this.getID(), 'connectorId': connectorId, 'startDateTime': startDateTime,
        'endDateTime': endDateTime, 'withChargeBoxes': withChargeBoxes
      },
      Constants.DB_RECORD_COUNT_NO_LIMIT);
    // Return list of transactions
    return transactions;
  }
}
