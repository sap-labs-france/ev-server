const AbstractTenantEntity = require('./AbstractTenantEntity');
const ChargingStationClient = require('../client/ocpp/ChargingStationClient');
const Logging = require('../utils/Logging');
const Utils = require('../utils/Utils');
const User = require('./User');
const Transaction = require('./Transaction');
const SiteArea = require('./SiteArea');
const Constants = require('../utils/Constants');
const Database = require('../utils/Database');
const BackendError = require('../exception/BackendError');
const ChargingStationStorage = require('../storage/mongodb/ChargingStationStorage');
const OCPPStorage = require('../storage/mongodb/OCPPStorage');
const OCPPUtils = require('../server/ocpp/utils/OCPPUtils');
const OCPPConstants = require('../server/ocpp/utils/OCPPConstants');
const SiteAreaStorage = require('../storage/mongodb/SiteAreaStorage');
const moment = require('moment-timezone');
const momentDurationFormatSetup = require("moment-duration-format");
const tzlookup = require("tz-lookup");

require('source-map-support').install();

momentDurationFormatSetup(moment);

class ChargingStation extends AbstractTenantEntity {
  constructor(tenantID, chargingStation) {
    super(tenantID);
    Database.updateChargingStation(chargingStation, this._model);
  }

  static getChargingStation(tenantID, id) {
    return ChargingStationStorage.getChargingStation(tenantID, id);
  }

  static getChargingStations(tenantID, params, limit, skip, sort) {
    return ChargingStationStorage.getChargingStations(tenantID, params, limit, skip, sort);
  }

  static getChargingStationsInError(tenantID, params, limit, skip, sort) {
    return ChargingStationStorage.getChargingStationsInError(tenantID, params, limit, skip, sort);
  }

  static addChargingStationsToSiteArea(tenantID, siteAreaID, chargingStationIDs) {
    return ChargingStationStorage.addChargingStationsToSiteArea(tenantID, siteAreaID, chargingStationIDs);
  }

  static removeChargingStationsFromSiteArea(tenantID, siteAreaID, chargingStationIDs) {
    return ChargingStationStorage.removeChargingStationsFromSiteArea(tenantID, siteAreaID, chargingStationIDs);
  }

  handleAction(action, params = {}) {
    // Handle requests to charger
    if (typeof this["request" + action] === 'function') {
      // Call it
      return this["request" + action](params);
    } else {
      throw new BackendError(this.getID(), `Action '${action}' is not implemented in the backend`, "ChargingStation", "handleAction");
    }
  }

  getID() {
    return this._model.id;
  }

  setSiteArea(siteArea) {
    if (siteArea) {
      this._model.siteArea = siteArea.getModel();
      this._model.siteAreaID = siteArea.getID();
    } else {
      this._model.siteArea = null;
    }
  }

  async getSiteArea(withSite = false) {
    if (this._model.siteArea) {
      return new SiteArea(this.getTenantID(), this._model.siteArea);
    } else if (this._model.siteAreaID) {
      // Get from DB
      const siteArea = await SiteAreaStorage.getSiteArea(this.getTenantID(), this._model.siteAreaID, false, withSite);
      // Set it
      this.setSiteArea(siteArea);
      // Return
      return siteArea;
    }
  }

  getSiteAreaID() {
    return this._model.siteAreaID;
  }

  setSiteAreaID(siteAreaID) {
    this._model.siteAreaID = siteAreaID;
  }

  getChargePointVendor() {
    return this._model.chargePointVendor;
  }

  setChargePointVendor(chargePointVendor) {
    this._model.chargePointVendor = chargePointVendor;
  }

  getChargePointModel() {
    return this._model.chargePointModel;
  }

  setChargePointModel(chargePointModel) {
    this._model.chargePointModel = chargePointModel;
  }

  getCFApplicationIDAndInstanceIndex() {
    return this._model.cfApplicationIDAndInstanceIndex;
  }

  setCFApplicationIDAndInstanceIndex(cfApplicationIDAndInstanceIndex) {
    this._model.cfApplicationIDAndInstanceIndex = cfApplicationIDAndInstanceIndex;
  }

  getChargePointSerialNumber() {
    return this._model.chargePointSerialNumber;
  }

  setChargePointSerialNumber(chargePointSerialNumber) {
    this._model.chargePointSerialNumber = chargePointSerialNumber;
  }

  getChargeBoxSerialNumber() {
    return this._model.chargeBoxSerialNumber;
  }

  setChargeBoxSerialNumber(chargeBoxSerialNumber) {
    this._model.chargeBoxSerialNumber = chargeBoxSerialNumber;
  }

  setInactive(inactive) {
    this._model.inactive = inactive;
  }

  isInactive() {
    return this._model.inactive;
  }

  getNumberOfConnectedPhase() {
    return this._model.numberOfConnectedPhase;
  }

  setNumberOfConnectedPhase(numberOfConnectedPhase) {
    this._model.numberOfConnectedPhase = numberOfConnectedPhase;
  }

  getMaximumPower() {
    return this._model.maximumPower;
  }

  setMaximumPower(maximumPower) {
    this._model.maximumPower = maximumPower;
  }

  setCannotChargeInParallel(cannotChargeInParallel) {
    this._model.cannotChargeInParallel = cannotChargeInParallel;
  }

  setPowerLimitUnit(powerLimitUnit) {
    this._model.powerLimitUnit = powerLimitUnit;
  }

  getPowerLimitUnit() {
    return this._model.powerLimitUnit;
  }

  setLatitude(latitude) {
    this._model.latitude = latitude;
  }

  getLatitude() {
    return this._model.latitude;
  }

  setLongitude(longitude) {
    this._model.longitude = longitude;
  }

  getLongitude() {
    return this._model.longitude;
  }

  getTimezone() {
    if (this._model.latitude && this._model.longitude) {
      return tzlookup(this._model.latitude, this._model.longitude);
    }
  }

  canChargeInParallel() {
    return !this._model.cannotChargeInParallel;
  }

  getFirmwareVersion() {
    return this._model.firmwareVersion;
  }

  setFirmwareVersion(firmwareVersion) {
    this._model.firmwareVersion = firmwareVersion;
  }

  getIccid() {
    return this._model.iccid;
  }

  setIccid(iccid) {
    this._model.iccid = iccid;
  }

  getImsi() {
    return this._model.imsi;
  }

  setImsi(imsi) {
    this._model.imsi = imsi;
  }

  getMeterType() {
    return this._model.meterType;
  }

  setMeterType(meterType) {
    this._model.meterType = meterType;
  }

  getMeterSerialNumber() {
    return this._model.meterSerialNumber;
  }

  setMeterSerialNumber(meterSerialNumber) {
    this._model.meterSerialNumber = meterSerialNumber;
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getTenantID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this._model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return new User(this.getTenantID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
  }

  getEndPoint() {
    return this._model.endpoint;
  }

  setEndPoint(endpoint) {
    this._model.endpoint = endpoint;
  }

  getChargingStationURL() {
    return this._model.chargingStationURL;
  }

  setChargingStationURL(chargingStationURL) {
    this._model.chargingStationURL = chargingStationURL;
  }

  getOcppVersion() {
    return this._model.ocppVersion;
  }

  setOcppVersion(ocppVersion) {
    this._model.ocppVersion = ocppVersion;
  }

  getOcppProtocol() {
    return this._model.ocppProtocol;
  }

  setOcppProtocol(ocppProtocol) {
    this._model.ocppProtocol = ocppProtocol;
  }

  getChargingStationClient() {
    // Get the client
    return ChargingStationClient.getChargingStationClient(this);
  }

  getLastHeartBeat() {
    return this._model.lastHeartBeat;
  }

  setLastHeartBeat(lastHeartBeat) {
    this._model.lastHeartBeat = lastHeartBeat;
  }

  getConnectors() {
    return this._model.connectors;
  }

  getConnector(identifier) {
    if (identifier !== undefined && this._model.connectors) {
      for (const connector of this._model.connectors) {
        if (connector && connector.connectorId === identifier) {
          return connector;
        }
      }
    }
    return undefined;
  }

  setConnectors(connectors) {
    this._model.connectors = connectors;
  }

  getLastReboot() {
    return this._model.lastReboot;
  }

  setLastReboot(lastReboot) {
    this._model.lastReboot = lastReboot;
  }

  save() {
    // Init Connectors
    if (!this.getConnectors()) {
      this.setConnectors([]);
    }
    // Save
    return ChargingStationStorage.saveChargingStation(this.getTenantID(), this.getModel());
  }

  saveHeartBeat() {
    // Save
    return ChargingStationStorage.saveChargingStationHeartBeat(this.getTenantID(), this.getModel());
  }

  saveChargingStationSiteArea() {
    // Save
    return ChargingStationStorage.saveChargingStationSiteArea(this.getTenantID(), this.getModel());
  }

  saveChargingStationConnector(connectorId) {
    return ChargingStationStorage.saveChargingStationConnector(this.getTenantID(), this.getModel(), this.getConnector(connectorId));
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
        message: `Command sent with success`, detailedMessages: configuration
      });
      // Override with Conf
      configuration = {
        'configuration': configuration.configurationKey
      };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(this.getTenantID(), 'RequestConfiguration', error);
    }
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
      message: `Configuration has been saved`
    });
    // Ok
    return { status: 'Accepted' };
  }

  setDeleted(deleted) {
    this._model.deleted = deleted;
  }

  isDeleted() {
    return this._model.deleted;
  }

  async delete() {
    // Check if the user has a transaction
    const result = await this.hasAtLeastOneTransaction();
    if (result) {
      // Delete logically
      // Set deleted
      this.setDeleted(true);
      // Delete
      await this.save();
    } else {
      // Delete physically
      await ChargingStationStorage.deleteChargingStation(this.getTenantID(), this.getID());
    }
  }

  async getSite() {
    if (!this.site) {
      // Get Site Area
      const siteArea = await this.getSiteArea();
      // Check Site Area
      if (!siteArea) {
        return null;
      }
      // Get Site
      this.site = await siteArea.getSite();
    }
    return this.site;
  }

  async getCompany() {
    if (!this.company) {
      // Get the Site
      const site = await this.getSite();
      // Check Site
      if (site) {
        // Get the Company
        this.company = await site.getCompany();
      }
    }
    return this.company;
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
      connector.currentStateOfCharge = 0;
      connector.activeTransactionID = 0;
    }
  }

  requestReset(params) {
    return this._requestExecuteCommand('reset', params);
  }

  requestStopTransaction(params) {
    return this._requestExecuteCommand('remoteStopTransaction', params);
  }

  requestStartTransaction(params) {
    return this._requestExecuteCommand('startTransaction', params);
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
    const chargingStationClient = this.getChargingStationClient();
    // Set Charging Profile
    const result = await chargingStationClient.genericOCPPCommand(commandName, params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(), source: this.getID(),
      module: 'ChargingStation', method: 'requestGenericOCPPCommand', action: 'GenericOCPPCommand',
      message: `Command sent with success`, detailedMessages: result
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
        "ChargingStation", "requestChangeConfiguration");
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

  async _requestExecuteCommand(method, params) {
    // Get the client
    const chargingStationClient = this.getChargingStationClient();
    // Set Charging Profile
    const result = await chargingStationClient[method](params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(), source: this.getID(),
      module: 'ChargingStation', method: '_requestCommand',
      action: Utils.firstLetterInUpperCase(method),
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  getConfiguration() {
    return ChargingStationStorage.getConfiguration(this.getTenantID(), this.getID());
  }

  getConfigurationParamValue(paramName) {
    return ChargingStationStorage.getConfigurationParamValue(this.getTenantID(), this.getID(), paramName);
  }

  async hasAtLeastOneTransaction() {
    // Get the consumption
    const transactions = await Transaction.getTransactions(this.getTenantID(), { 'chargeBoxID': this.getID() }, 1);
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
      Constants.NO_LIMIT);
    // Return list of transactions
    return transactions;
  }
}

module.exports = ChargingStation;
