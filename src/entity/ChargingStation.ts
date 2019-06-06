import TenantHolder from './TenantHolder';
import ChargingStationClient from '../client/ocpp/ChargingStationClient';
import Logging from '../utils/Logging';
import Utils from '../utils/Utils';
import User from './User';
import Transaction from './Transaction';
import SiteArea from './SiteArea';
import Constants from '../utils/Constants';
import Database from '../utils/Database';
import BackendError from '../exception/BackendError';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import OCPPStorage from '../storage/mongodb/OCPPStorage';
import OCPPUtils from '../server/ocpp/utils/OCPPUtils';
import OCPPConstants from '../server/ocpp/utils/OCPPConstants';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import * as moment from "moment";
import momentDurationFormatSetup from "moment-duration-format";
import tzlookup from "tz-lookup";
import buildChargingStationClient from '../client/ocpp/ChargingStationClientFactory';

require('source-map-support').install();

momentDurationFormatSetup(moment);

export default class ChargingStation extends TenantHolder {
	public getTenantID: any;
	public getModel: any;
	public site: any;
  public company: any;
  private model: any;

  constructor(tenantID, chargingStation) {
    super(tenantID);
    Database.updateChargingStation(chargingStation, this.model);
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
    return this["request" + action](params);
  }

  getID() {
    return this.model.id;
  }

  setSiteArea(siteArea) {
    if (siteArea) {
      this.model.siteArea = siteArea.getModel();
      this.model.siteAreaID = siteArea.getID();
    } else {
      this.model.siteArea = null;
    }
  }

  async getSiteArea(withSite = false) {
    if (this.model.siteArea) {
      return new SiteArea(this.getTenantID(), this.model.siteArea);
    } else if (this.model.siteAreaID) {
      // Get from DB
      const siteArea = await SiteAreaStorage.getSiteArea(this.getTenantID(), this.model.siteAreaID, false, withSite);
      // Set it
      this.setSiteArea(siteArea);
      // Return
      return siteArea;
    }
  }

  getSiteAreaID() {
    return this.model.siteAreaID;
  }

  setSiteAreaID(siteAreaID) {
    this.model.siteAreaID = siteAreaID;
  }

  getChargePointVendor() {
    return this.model.chargePointVendor;
  }

  setChargePointVendor(chargePointVendor) {
    this.model.chargePointVendor = chargePointVendor;
  }

  getChargePointModel() {
    return this.model.chargePointModel;
  }

  setChargePointModel(chargePointModel) {
    this.model.chargePointModel = chargePointModel;
  }

  getCFApplicationIDAndInstanceIndex() {
    return this.model.cfApplicationIDAndInstanceIndex;
  }

  setCFApplicationIDAndInstanceIndex(cfApplicationIDAndInstanceIndex) {
    this.model.cfApplicationIDAndInstanceIndex = cfApplicationIDAndInstanceIndex;
  }

  getChargePointSerialNumber() {
    return this.model.chargePointSerialNumber;
  }

  setChargePointSerialNumber(chargePointSerialNumber) {
    this.model.chargePointSerialNumber = chargePointSerialNumber;
  }

  getChargeBoxSerialNumber() {
    return this.model.chargeBoxSerialNumber;
  }

  setChargeBoxSerialNumber(chargeBoxSerialNumber) {
    this.model.chargeBoxSerialNumber = chargeBoxSerialNumber;
  }

  setInactive(inactive) {
    this.model.inactive = inactive;
  }

  isInactive() {
    return this.model.inactive;
  }

  getNumberOfConnectedPhase() {
    return this.model.numberOfConnectedPhase;
  }

  setNumberOfConnectedPhase(numberOfConnectedPhase) {
    this.model.numberOfConnectedPhase = numberOfConnectedPhase;
  }

  getMaximumPower() {
    return this.model.maximumPower;
  }

  setMaximumPower(maximumPower) {
    this.model.maximumPower = maximumPower;
  }

  setCannotChargeInParallel(cannotChargeInParallel) {
    this.model.cannotChargeInParallel = cannotChargeInParallel;
  }

  setPowerLimitUnit(powerLimitUnit) {
    this.model.powerLimitUnit = powerLimitUnit;
  }

  getPowerLimitUnit() {
    return this.model.powerLimitUnit;
  }

  setLatitude(latitude) {
    this.model.latitude = latitude;
  }

  getLatitude() {
    return this.model.latitude;
  }

  setLongitude(longitude) {
    this.model.longitude = longitude;
  }

  getLongitude() {
    return this.model.longitude;
  }

  getTimezone() {
    if (this.model.latitude && this.model.longitude) {
      return tzlookup(this.model.latitude, this.model.longitude);
    }
  }

  canChargeInParallel() {
    return !this.model.cannotChargeInParallel;
  }

  getFirmwareVersion() {
    return this.model.firmwareVersion;
  }

  setFirmwareVersion(firmwareVersion) {
    this.model.firmwareVersion = firmwareVersion;
  }

  getIccid() {
    return this.model.iccid;
  }

  setIccid(iccid) {
    this.model.iccid = iccid;
  }

  getImsi() {
    return this.model.imsi;
  }

  setImsi(imsi) {
    this.model.imsi = imsi;
  }

  getMeterType() {
    return this.model.meterType;
  }

  setMeterType(meterType) {
    this.model.meterType = meterType;
  }

  getMeterSerialNumber() {
    return this.model.meterSerialNumber;
  }

  setMeterSerialNumber(meterSerialNumber) {
    this.model.meterSerialNumber = meterSerialNumber;
  }

  getCreatedBy() {
    if (this.model.createdBy) {
      return new User(this.getTenantID(), this.model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this.model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this.model.createdOn;
  }

  setCreatedOn(createdOn) {
    this.model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this.model.lastChangedBy) {
      return new User(this.getTenantID(), this.model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this.model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this.model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this.model.lastChangedOn = lastChangedOn;
  }

  getEndPoint() {
    return this.model.endpoint;
  }

  setEndPoint(endpoint) {
    this.model.endpoint = endpoint;
  }

  getChargingStationURL() {
    return this.model.chargingStationURL;
  }

  setChargingStationURL(chargingStationURL) {
    this.model.chargingStationURL = chargingStationURL;
  }

  getOcppVersion() {
    return this.model.ocppVersion;
  }

  setOcppVersion(ocppVersion) {
    this.model.ocppVersion = ocppVersion;
  }

  getOcppProtocol() {
    return this.model.ocppProtocol;
  }

  setOcppProtocol(ocppProtocol) {
    this.model.ocppProtocol = ocppProtocol;
  }

  getChargingStationClient() {
    // Get the client
    return buildChargingStationClient(this);
  }

  getLastHeartBeat() {
    return this.model.lastHeartBeat;
  }

  setLastHeartBeat(lastHeartBeat) {
    this.model.lastHeartBeat = lastHeartBeat;
  }

  getConnectors() {
    return this.model.connectors;
  }

  getConnector(identifier) {
    if (identifier !== undefined && this.model.connectors) {
      for (const connector of this.model.connectors) {
        if (connector && connector.connectorId === identifier) {
          return connector;
        }
      }
    }
    return undefined;
  }

  setConnectors(connectors) {
    this.model.connectors = connectors;
  }

  getLastReboot() {
    return this.model.lastReboot;
  }

  setLastReboot(lastReboot) {
    this.model.lastReboot = lastReboot;
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
      return { status: 'Accepted' };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(this.getTenantID(), 'RequestConfiguration', error);
      return { status: 'Rejected' };
    }
  }

  setDeleted(deleted) {
    this.model.deleted = deleted;
  }

  isDeleted() {
    return this.model.deleted;
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
        message: `Command sent with success`,
        detailedMessages: result
      });
      // Return
      return result;
    } catch (error) {
      // OCPP 1.6?
      if (Array.isArray(error.error)) {
        const response = error.error;
        throw new BackendError(this.getID(), response[3], "ChargingStation",
          "_requestExecuteCommand", Utils.firstLetterInUpperCase(method));
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
