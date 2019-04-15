const AbstractTenantEntity = require('./AbstractTenantEntity');
const ChargingStationClient = require('../client/ChargingStationClient');
const Logging = require('../utils/Logging');
const User = require('./User');
const Transaction = require('./Transaction');
const SiteArea = require('./SiteArea');
const Constants = require('../utils/Constants');
const Database = require('../utils/Database');
const BackendError = require('../exception/BackendError');
const ChargingStationStorage = require('../storage/mongodb/ChargingStationStorage');
const OCPPStorage = require('../storage/mongodb/OCPPStorage');
const OCPPUtils = require('../server/ocpp/utils/OCPPUtils');
const SiteAreaStorage = require('../storage/mongodb/SiteAreaStorage');
const moment = require('moment-timezone');
const momentDurationFormatSetup = require("moment-duration-format");
const tzlookup = require("tz-lookup");

require('source-map-support').install();

momentDurationFormatSetup(moment);

class ChargingStation extends AbstractTenantEntity {
  constructor(tenantID, chargingStation) {
    super(tenantID);
    // Set it
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
    // Handle Client Requests
    switch (action) {
      // Reset
      case 'Reset':
        return this.requestReset(params);

      // Clear cache
      case 'ClearCache':
        return this.requestClearCache();

      // Get Configuration
      case 'GetConfiguration':
        return this.requestGetConfiguration(params);

      // Set Configuration
      case 'ChangeConfiguration':
        // Change the config
        return this.requestChangeConfiguration(params);

      // Unlock Connector
      case 'UnlockConnector':
        return this.requestUnlockConnector(params);

      // Start Transaction
      case 'StartTransaction':
        return this.requestStartTransaction(params);

      // Stop Transaction
      case 'StopTransaction':
        return this.requestStopTransaction(params);

      case 'SetChargingProfile':
        return this.requestSetChargingProfile(params);
      case 'GetCompositeSchedule':
        return this.requestGetCompositeSchedule(params);

      case 'GetDiagnostics':
        return this.requestGetDiagnostics(params);

      case 'UpdateFirmware':
        return this.requestUpdateFirmware(params);

      case 'ChangeAvailability':
        return this.requestChangeAvailability(params);

      case 'ClearChargingProfile':
        return this.requestClearChargingProfile(params);

      // Not Exists!
      default:
        throw new BackendError(this.getID(), `Unhandled action ${action}`, "ChargingStation", "handleAction");
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
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation',
        method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
        message: `Command sent with success`,
        detailedMessages: configuration
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
        configuration = {
          'configuration': [
            {'key': 'AllowOfflineTxForUnknownId', 'readonly': false, 'value': null},
            {'key': 'AuthorizationCacheEnabled', 'readonly': false, 'value': null},
            {'key': 'AuthorizeRemoteTxRequests', 'readonly': false, 'value': null},
            {'key': 'BlinkRepeat', 'readonly': false, 'value': null},
            {'key': 'ClockAlignedDataInterval', 'readonly': false, 'value': null},
            {'key': 'ConnectionTimeOut', 'readonly': false, 'value': null},
            {'key': 'GetConfigurationMaxKeys', 'readonly': false, 'value': null},
            {'key': 'HeartbeatInterval', 'readonly': false, 'value': null},
            {'key': 'LightIntensity', 'readonly': false, 'value': null},
            {'key': 'LocalAuthorizeOffline', 'readonly': false, 'value': null},
            {'key': 'LocalPreAuthorize', 'readonly': false, 'value': null},
            {'key': 'MaxEnergyOnInvalidId', 'readonly': false, 'value': null},
            {'key': 'MeterValuesAlignedData', 'readonly': false, 'value': null},
            {'key': 'MeterValuesAlignedDataMaxLength', 'readonly': false, 'value': null},
            {'key': 'MeterValuesSampledData', 'readonly': false, 'value': null},
            {'key': 'MeterValuesSampledDataMaxLength', 'readonly': false, 'value': null},
            {'key': 'MeterValueSampleInterval', 'readonly': false, 'value': null},
            {'key': 'MinimumStatusDuration', 'readonly': false, 'value': null},
            {'key': 'NumberOfConnectors', 'readonly': false, 'value': null},
            {'key': 'ResetRetries', 'readonly': false, 'value': null},
            {'key': 'ConnectorPhaseRotation', 'readonly': false, 'value': null},
            {'key': 'ConnectorPhaseRotationMaxLength', 'readonly': false, 'value': null},
            {'key': 'StopTransactionOnEVSideDisconnect', 'readonly': false, 'value': null},
            {'key': 'StopTransactionOnInvalidId', 'readonly': false, 'value': null},
            {'key': 'StopTxnAlignedData', 'readonly': false, 'value': null},
            {'key': 'StopTxnAlignedDataMaxLength', 'readonly': false, 'value': null},
            {'key': 'StopTxnSampledData', 'readonly': false, 'value': null},
            {'key': 'StopTxnSampledDataMaxLength', 'readonly': false, 'value': null},
            {'key': 'SupportedFeatureProfiles', 'readonly': false, 'value': null},
            {'key': 'SupportedFeatureProfilesMaxLength', 'readonly': false, 'value': null},
            {'key': 'TransactionMessageAttempts', 'readonly': false, 'value': null},
            {'key': 'TransactionMessageRetryInterval', 'readonly': false, 'value': null},
            {'key': 'UnlockConnectorOnEVSideDisconnect', 'readonly': false, 'value': null},
            {'key': 'WebSocketPingInterval', 'readonly': false, 'value': null},
            {'key': 'LocalAuthListEnabled', 'readonly': false, 'value': null},
            {'key': 'LocalAuthListMaxLength', 'readonly': false, 'value': null},
            {'key': 'SendLocalListMaxLength', 'readonly': false, 'value': null},
            {'key': 'ReserveConnectorZeroSupported', 'readonly': false, 'value': null},
            {'key': 'ChargeProfileMaxStackLevel', 'readonly': false, 'value': null},
            {'key': 'ChargingScheduleAllowedChargingRateUnit', 'readonly': false, 'value': null},
            {'key': 'ChargingScheduleMaxPeriods', 'readonly': false, 'value': null},
            {'key': 'ConnectorSwitch3to1PhaseSupported', 'readonly': false, 'value': null},
            {'key': 'MaxChargingProfilesInstalled', 'readonly': false, 'value': null}
          ]
        };
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
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
      message: `Configuration has been saved`
    });
    // Ok
    return {status: 'Accepted'};
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
    // Get the Site
    const site = await this.getSite();
    // Check Site
    if (!site) {
      return null;
    }
    // Get the Company
    const company = await site.getCompany();
    return company;
  }

  // Restart the charger
  async requestReset(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Restart
    const result = await chargingStationClient.reset(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestReset', action: 'Reset',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Stop Transaction
  async requestStopTransaction(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Stop Transaction
    const result = await chargingStationClient.remoteStopTransaction(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestStopTransaction', action: 'StopTransaction',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Start Transaction
  async requestStartTransaction(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Start Transaction
    const result = await chargingStationClient.startTransaction(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestStartTransaction', action: 'StartTransaction',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Set Charging Profile
  async requestSetChargingProfile(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Set Charging Profile
    const result = await chargingStationClient.setChargingProfile(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestSetChargingProfile', action: 'SetChargingProfile',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Clear Profiles
  async requestClearChargingProfile(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Clear Profiles
    const result = await chargingStationClient.clearChargingProfile(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestClearChargingProfiles', action: 'ClearChargingProfile',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  async requestGetDiagnostics(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Get Diagnostics
    const result = await chargingStationClient.getDiagnostics(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestGetDiagnostics', action: 'GetDiagnostics',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  async requestUpdateFirmware(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Update Firmware
    const result = await chargingStationClient.updateFirmware(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestUpdateFirmware', action: 'UpdateFirmware',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  async requestChangeAvailability(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Change Availibility
    const result = await chargingStationClient.changeAvailability(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestChangeAvailability', action: 'ChangeAvailability',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  async requestGenericOCPPCommand(commandName, params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Set Charging Profile
    const result = await chargingStationClient.genericOCPPCommand(commandName, params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestGenericOCPPCommand', action: 'GenericOCPPCommand',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Retrieve Composite Schedule (Charging power limitation)
  async requestGetCompositeSchedule(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Set Charging Profile
    const result = await chargingStationClient.getCompositeSchedule(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestSetChargingProfile', action: 'SetChargingProfile',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Clear the cache
  async requestClearCache() {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Clear
    const result = await chargingStationClient.clearCache();
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestClearCache', action: 'ClearCache',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Get the configuration for the EVSE
  async requestGetConfiguration(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Get config
    const result = await chargingStationClient.getConfiguration(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestGetConfiguration', action: 'GetConfiguration',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Get the configuration for the EVSE
  async requestChangeConfiguration(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Get config
    const result = await chargingStationClient.changeConfiguration(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestChangeConfiguration', action: 'ChangeConfiguration',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Request the new Configuration?
    if (result.status !== 'Accepted') {
      // Error
      throw new BackendError(this.getID(), `Cannot set the configuration param ${params.key} with value ${params.value} to ${this.getID()}`,
        "ChargingStation", "requestChangeConfiguration");
    }
    // Update
    await this.requestAndSaveConfiguration();
    // Return
    return result;
  }

  // Unlock connector
  async requestUnlockConnector(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Get config
    const result = await chargingStationClient.unlockConnector(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestUnlockConnector', action: 'UnlockConnector',
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
    const transactions = await Transaction.getTransactions(this.getTenantID(), {'chargeBoxID': this.getID()}, 1);
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
