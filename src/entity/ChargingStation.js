const AbstractTenantEntity = require('./AbstractTenantEntity');
const ChargingStationClient = require('../client/ChargingStationClient');
const Utils = require('../utils/Utils');
const Logging = require('../utils/Logging');
const User = require('./User');
const Transaction = require('./Transaction');
const SiteArea = require('./SiteArea');
const Constants = require('../utils/Constants');
const Database = require('../utils/Database');
const moment = require('moment');
const Configuration = require('../utils/Configuration');
const NotificationHandler = require('../notification/NotificationHandler');
const Authorizations = require('../authorization/Authorizations');
const BackendError = require('../exception/BackendError');
const ChargingStationStorage = require('../storage/mongodb/ChargingStationStorage');
const SiteAreaStorage = require('../storage/mongodb/SiteAreaStorage');
const TransactionStorage = require('../storage/mongodb/TransactionStorage');
const momentDurationFormatSetup = require("moment-duration-format");
momentDurationFormatSetup(moment);
const _configChargingStation = Configuration.getChargingStationConfig();

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
    return ChargingStationStorage.getChargingStations(tenantID, params, limit, skip, sort)
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
    return this._model.connectors[identifier - 1];
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

  async handleStatusNotification(statusNotification) {
    // Set the Station ID
    statusNotification.chargeBoxID = this.getID();
    if (!statusNotification.timestamp) {
      statusNotification.timestamp = new Date().toISOString();
    }
    // Handle connectorId = 0 case => Currently status is distributed to each individual connectors
    if (statusNotification.connectorId == 0) {
      // Log
      Logging.logWarning({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation',
        method: 'handleStatusNotification', action: 'StatusNotification',
        message: `Connector '${statusNotification.connectorId}': '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
      });
      // Get the connectors
      const connectors = this.getConnectors();
      // Update ALL connectors -----------------------------------------
      for (let i = 0; i < connectors.length; i++) {
        // Check if former connector can be set
        if (connectors[i]) {
          // update message with proper connectorId
          statusNotification.connectorId = i + 1;
          // update TS to avoid duplicates in case StatusNotification are also sent in parallel for other connectors
          statusNotification.timestamp = new Date().toISOString();
          await this.updateConnectorStatus(statusNotification);
        }
      }
    } else {
      // update only the given connectorId
      await this.updateConnectorStatus(statusNotification);
    }
  }

  async updateConnectorStatus(statusNotification) {
    // Get the connectors
    const connectors = this.getConnectors();
    // Init previous connector status
    for (let i = 0; i < statusNotification.connectorId; i++) {
      // Check if former connector can be set
      if (!connectors[i]) {
        // Init
        connectors[i] = {connectorId: i + 1, currentConsumption: 0, status: 'Unknown', power: 0};
      }
    }
    // Set the status
    connectors[statusNotification.connectorId - 1].connectorId = statusNotification.connectorId;
    // Error Code?
    connectors[statusNotification.connectorId - 1].status = statusNotification.status;
    connectors[statusNotification.connectorId - 1].errorCode = statusNotification.errorCode;
    connectors[statusNotification.connectorId - 1].info = (statusNotification.info ? statusNotification.info : '');
    connectors[statusNotification.connectorId - 1].vendorErrorCode = (statusNotification.vendorErrorCode ? statusNotification.vendorErrorCode : '');
    // Set
    this.setConnectors(connectors);
    if (!connectors[statusNotification.connectorId - 1].power) {
      // Update Connector's Power
      this.updateConnectorsPower();
    }
    // Save Status Notif
    await ChargingStationStorage.saveStatusNotification(this.getTenantID(), statusNotification);
    // Save Connector
    await ChargingStationStorage.saveChargingStationConnector(this.getTenantID(), this.getModel(), statusNotification.connectorId);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(),
      module: 'ChargingStation',
      method: 'handleStatusNotification',
      action: 'StatusNotification',
      message: `'${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}' on Connector '${statusNotification.connectorId}' has been saved`
    });
    // Notify if error
    if (statusNotification.status === Constants.CONN_STATUS_FAULTED) {
      // Log
      Logging.logError({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation',
        method: 'handleStatusNotification', action: 'StatusNotification',
        message: `Error on connector ${statusNotification.connectorId}: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
      });
      // Send Notification
      NotificationHandler.sendChargingStationStatusError(
        this.getTenantID(),
        Utils.generateGUID(),
        this.getModel(),
        {
          'chargeBoxID': this.getID(),
          'connectorId': statusNotification.connectorId,
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${statusNotification.info}`,
          'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain()),
          'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(this, statusNotification.connectorId)
        },
        {
          'connectorId': statusNotification.connectorId,
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${statusNotification.info}`,
        }
      );
    }
  }

  async updateConnectorsPower() {
    let voltageRerefence = 0;
    let current = 0;
    let nbPhase = 0;
    let power = 0;
    let totalPower = 0;

    // Only for Schneider
    if (this.getChargePointVendor() === 'Schneider Electric') {
      // Get the configuration
      const configuration = await this.getConfiguration();
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
        if (this.getNumberOfConnectedPhase()) {
          // Yes
          nbPhase = this.getNumberOfConnectedPhase();
        }
        // Compute it
        if (voltageRerefence && current && nbPhase) {
          // One Phase?
          if (nbPhase == 1) {
            power = Math.floor(230 * current);
          } else {
            power = Math.floor(400 * current * Math.sqrt(nbPhase));
          }
        }
      }
      // Set Power
      for (const connector of this.getConnectors()) {
        if (connector) {
          connector.power = power;
          totalPower += power;
        }
      }
      // Set total power
      if (totalPower && !this.getMaximumPower()) {
        // Set
        this.setMaximumPower(totalPower);
      }
    }
  }

  async handleBootNotification(bootNotification) {
    // Set the Station ID
    bootNotification.chargeBoxID = this.getID();
    // Send Notification
    NotificationHandler.sendChargingStationRegistered(
      this.getTenantID(),
      Utils.generateGUID(),
      this.getModel(),
      {
        'chargeBoxID': this.getID(),
        'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain()),
        'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(this)
      }
    );
    // Save Boot Notification
    await ChargingStationStorage.saveBootNotification(this.getTenantID(), bootNotification);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(),
      module: 'ChargingStation', method: 'handleBootNotification',
      action: 'BootNotification', message: `Boot notification saved`
    });
    // Handle the get of configuration later on
    setTimeout(() => {
      // Get config and save it
      this.requestAndSaveConfiguration();
    }, 3000);
  }

  async handleHeartBeat() {
    // Set Heartbeat
    this.setLastHeartBeat(new Date());
    // Save
    await this.saveHeartBeat();
    // Update Charger Max Power?
    if (!this.getMaximumPower()) {
      // Yes
      await this.updateConnectorsPower();
      // Save Charger
      await this.save();
    }
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(),
      module: 'ChargingStation', method: 'handleHeartBeat',
      action: 'Heartbeat', message: `Heartbeat saved`
    });
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
      }
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
    // Save it
    await this.saveConfiguration(configuration);
    // Ok
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
      message: `Configuration has been saved`
    });
    // Update connector power
    await this.updateConnectorsPower();
    // Ok
    return {status: 'Accepted'};
  }

  async updateChargingStationConsumption(transaction) {
    // Get the connector
    const connector = this.getConnector(transaction.getConnectorId());
    // Active transaction?
    if (transaction.isActive()) {
      // Set consumption
      connector.currentConsumption = transaction.getCurrentConsumption();
      connector.totalConsumption = transaction.getCurrentTotalConsumption();
      connector.currentStateOfCharge = transaction.getCurrentStateOfCharge();
      // Set Transaction ID
      connector.activeTransactionID = transaction.getID();
      // Update Heartbeat
      this.setLastHeartBeat(new Date());
      // Handle End Of charge
      this.checkNotificationEndOfCharge(transaction);
    } else {
      // Set consumption
      connector.currentConsumption = 0;
      connector.totalConsumption = 0;
      connector.currentStateOfCharge = 0;
      // Reset Transaction ID
      connector.activeTransactionID = 0;
    }
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'updateChargingStationConsumption', action: 'ChargingStationConsumption',
      message: `Connector '${connector.connectorId}' - Consumption ${connector.currentConsumption}, Total: ${connector.totalConsumption}, SoC: ${connector.currentStateOfCharge}`
    });
  }

  async checkNotificationEndOfCharge(transaction) {
    // Transaction in progress?
    if (transaction && transaction.isActive()) {
      // Has consumption?
      if (transaction.hasMultipleConsumptions()) {
        // --------------------------------------------------------------------
        // Notification End of charge
        // --------------------------------------------------------------------
        if (_configChargingStation.notifEndOfChargeEnabled && (transaction.getCurrentTotalInactivitySecs() > 60 || transaction.getCurrentStateOfCharge() === 100)) {
          // Notify User?
          if (transaction.getUserJson()) {
            // Send Notification
            NotificationHandler.sendEndOfCharge(
              this.getTenantID(),
              transaction.getID() + '-EOC',
              transaction.getUserJson(),
              this.getModel(),
              {
                'user': transaction.getUserJson(),
                'chargingBoxID': this.getID(),
                'connectorId': transaction.getConnectorId(),
                'totalConsumption': (transaction.getCurrentTotalConsumption() / 1000).toLocaleString(
                  (transaction.getUserJson().locale ? transaction.getUserJson().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
                  {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
                'stateOfCharge': transaction.getCurrentStateOfCharge(),
                'totalDuration': this._buildCurrentTransactionDuration(transaction),
                'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID()),
                'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain())
              },
              transaction.getUserJson().locale,
              {
                'transactionId': transaction.getID(),
                'connectorId': transaction.getConnectorId()
              }
            );
          }
        // Check the SoC (Optimal Charge)
        } else if (_configChargingStation.notifBeforeEndOfChargeEnabled &&
          transaction.getCurrentStateOfCharge() >= _configChargingStation.notifBeforeEndOfChargePercent) {
          // Notify User?
          if (transaction.getUserJson()) {
            // Notifcation Before End Of Charge
            NotificationHandler.sendOptimalChargeReached(
              this.getTenantID(),
              transaction.getID() + '-OCR',
              transaction.getUserJson(),
              this.getModel(),
              {
                'user': transaction.getUserJson(),
                'chargingBoxID': this.getID(),
                'connectorId': transaction.getConnectorId(),
                'totalConsumption': (transaction.getCurrentTotalConsumption() / 1000).toLocaleString(
                  (transaction.getUserJson().locale ? transaction.getUserJson().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
                  {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
                'stateOfCharge': transaction.getCurrentStateOfCharge(),
                'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID()),
                'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain())
              },
              transaction.getUserJson().locale,
              {
                'transactionId': transaction.getID(),
                'connectorId': transaction.getConnectorId()
              }
            );
          }
        }
      }
    }
  }

  // Build Inactivity
  _buildTransactionInactivity(transaction, i18nHourShort = 'h') {
    // Get total
    const totalInactivitySecs = transaction.getTotalInactivitySecs()
    // None?
    if (totalInactivitySecs === 0) {
      return `0${i18nHourShort}00 (0%)`;      
    }
    // Build the inactivity percentage
    const totalInactivityPercent = Math.round((totalInactivitySecs * 100) / transaction.getTotalDurationSecs());
    // Format
    return moment.duration(totalInactivitySecs, "s").format(`h[${i18nHourShort}]mm`, {trim: false}) + ` (${totalInactivityPercent}%)`;
  }

  // Build duration
  _buildCurrentTransactionDuration(transaction) {
    return moment.duration(transaction.getCurrentTotalDurationSecs(), "s").format(`h[h]mm`, {trim: false});
  }

  // Build duration
  _buildTransactionDuration(transaction) {
    return moment.duration(transaction.getTotalDurationSecs(), "s").format(`h[h]mm`, {trim: false});
  }

  async handleMeterValues(meterValues) {
    // Create model
    const newMeterValues = {};
    // Init
    newMeterValues.values = [];
    // Set the charger ID
    newMeterValues.chargeBoxID = this.getID();
    // Check Connector ID
    if (meterValues.connectorId == 0) {
      // BUG KEBA: Connector ID must be > 0 according OCPP
      Logging.logWarning({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleMeterValues',
        action: 'MeterValues', message: `Connector ID cannot be equal to '0' and has been reset to '1'`
      });
      // Set to 1 (KEBA has only one connector)
      meterValues.connectorId = 1;
    }
    // Check if the transaction ID matches
    const chargerTransactionId = this.getConnector(meterValues.connectorId).activeTransactionID;
    // Same?
    if (meterValues.hasOwnProperty('transactionId')) {
      // BUG ABB: Check ID
      if (parseInt(meterValues.transactionId) !== parseInt(chargerTransactionId)) {
        // No: Log
        Logging.logWarning({
          tenantID: this.getTenantID(),
          source: this.getID(),
          module: 'ChargingStation',
          method: 'handleMeterValues',
          action: 'MeterValues',
          message: `Transaction ID '${meterValues.transactionId}' not found but retrieved from StartTransaction '${chargerTransactionId}'`
        });
        // Override it
        meterValues.transactionId = chargerTransactionId;
      }
    } else if (chargerTransactionId > 0) {
      // No Transaction ID, retrieve it
      Logging.logWarning({
        tenantID: this.getTenantID(),
        source: this.getID(),
        module: 'ChargingStation',
        method: 'handleMeterValues',
        action: 'MeterValues',
        message: `Transaction ID is not provided but retrieved from StartTransaction '${chargerTransactionId}'`
      });
      // Override it
      meterValues.transactionId = chargerTransactionId;
    }
    // Check Transaction
    if (meterValues.transactionId && parseInt(meterValues.transactionId) === 0) {
      // Wrong Transaction ID!
      throw new BackendError(this.getID(), 
        `Transaction ID must not be equal to '0'`,
        "ChargingStation", "handleMeterValues")
    }
    // Handle Values
    // Check if OCPP 1.6
    if (this.getOcppVersion() === Constants.OCPP_VERSION_16) { //meterValues.meterValue
      // Set it to 'values'
      meterValues.values = meterValues.meterValue;
    }
    // Only one value?
    if (!Array.isArray(meterValues.values)) {
      // Make it an array
      meterValues.values = [meterValues.values];
    }
    // For each value
    for (const value of meterValues.values) {
      const newMeterValue = {};
      // Set the ID
      newMeterValue.chargeBoxID = newMeterValues.chargeBoxID;
      newMeterValue.connectorId = meterValues.connectorId;
      if (meterValues.transactionId) {
        newMeterValue.transactionId = meterValues.transactionId;
      }
      newMeterValue.timestamp = value.timestamp;
      // Check OCPP 1.6
      if (this.getOcppVersion() === Constants.OCPP_VERSION_16) {
        // Multiple Values?
        if (Array.isArray(value.sampledValue)) {
          // Create one record per value
          for (const sampledValue of value.sampledValue) {
            // Clone header
            // eslint-disable-next-line prefer-const
            let newLocalMeterValue = JSON.parse(JSON.stringify(newMeterValue));
            // Normalize
            newLocalMeterValue.attribute = {};
            // Enrich with OCPP16 attributes
            newLocalMeterValue.attribute.context = (sampledValue.context ? sampledValue.context : Constants.METER_VALUE_CTX_SAMPLE_PERIODIC);
            newLocalMeterValue.attribute.format = (sampledValue.format ? sampledValue.format : Constants.METER_VALUE_FORMAT_RAW);
            newLocalMeterValue.attribute.measurand = (sampledValue.measurand ? sampledValue.measurand : Constants.METER_VALUE_MEASURAND_IMPREG);
            newLocalMeterValue.attribute.location = (sampledValue.location ? sampledValue.location : Constants.METER_VALUE_LOCATION_OUTLET);
            newLocalMeterValue.attribute.unit = (sampledValue.unit ? sampledValue.unit : Constants.METER_VALUE_UNIT_WH);
            newLocalMeterValue.attribute.phase = (sampledValue.phase ? sampledValue.phase : '');
            newLocalMeterValue.value = parseInt(sampledValue.value);
            // Add
            newMeterValues.values.push(newLocalMeterValue);
          }
        } else {
          // Clone header
          // eslint-disable-next-line prefer-const
          let newLocalMeterValue = JSON.parse(JSON.stringify(newMeterValue));
          // Normalize
          newLocalMeterValue.attribute = {};
          // Enrich with OCPP16 attributes
          newLocalMeterValue.attribute.context = (value.sampledValue.context ? value.sampledValue.context : Constants.METER_VALUE_CTX_SAMPLE_PERIODIC);
          newLocalMeterValue.attribute.format = (value.sampledValue.format ? value.sampledValue.format : Constants.METER_VALUE_FORMAT_RAW);
          newLocalMeterValue.attribute.measurand = (value.sampledValue.measurand ? value.sampledValue.measurand : Constants.METER_VALUE_MEASURAND_IMPREG);
          newLocalMeterValue.attribute.location = (value.sampledValue.location ? value.sampledValue.location : Constants.METER_VALUE_LOCATION_OUTLET);
          newLocalMeterValue.attribute.unit = (value.sampledValue.unit ? value.sampledValue.unit : Constants.METER_VALUE_UNIT_WH);
          newLocalMeterValue.attribute.phase = (value.sampledValue.phase ? value.sampledValue.phase : '');
          newLocalMeterValue.value = parseInt(value.sampledValue.value);
          // Add
          newMeterValues.values.push(newLocalMeterValue);
        }
        // Values provided?
      } else if (value.value) {
        // OCCP1.2: Set the values
        if (value.value.$value) {
          // Set
          newMeterValue.value = value.value.$value;
          newMeterValue.attribute = value.value.attributes;
        } else {
          newMeterValue.value = parseInt(value.value);
        }
        // Add
        newMeterValues.values.push(newMeterValue);
      }
    }
    // Clean up Sample.Clock meter value
    if (this.getChargePointVendor() !== 'ABB' || this.getOcppVersion() !== Constants.OCPP_VERSION_15) {
      // Filter Sample.Clock meter value for all chargers except ABB using OCPP 1.5
      newMeterValues.values = newMeterValues.values.filter(value => value.attribute.context !== 'Sample.Clock');
    }
    // No Transaction ID
    if (!meterValues.transactionId) {
      // Log
      Logging.logWarning({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleMeterValues',
        action: 'MeterValues', message: `MeterValue not saved (not linked to a Transaction)`,
        detailedMessages: meterValues
      });
    // No Values
    } else if (newMeterValues.values.length == 0) {
      Logging.logDebug({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleMeterValues',
        action: 'MeterValues', message: `No MeterValue to save (clocks only)`,
        detailedMessages: meterValues
      });
    // Process values
    } else {
      // Save Meter Values
      await TransactionStorage.saveMeterValues(this.getTenantID(), newMeterValues);
      // Get the transaction
      const transaction = await TransactionStorage.getTransaction(this.getTenantID(), meterValues.transactionId);
      // Update
      newMeterValues.values.forEach(async (meterValue) => await transaction.updateWithMeterValue(meterValue));
      // Save Transaction
      await TransactionStorage.saveTransaction(transaction.getTenantID(), transaction.getModel());
      // Update Charging Station Consumption
      await this.updateChargingStationConsumption(transaction);
      // Save Charging Station
      await this.save();
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getID(),
        module: 'ChargingStation',
        method: 'handleMeterValues',
        action: 'MeterValues',
        message: `MeterValue have been saved for Transaction ID '${meterValues.transactionId}'`,
        detailedMessages: meterValues
      });
    }
  }

  saveConfiguration(configuration) {
    // Set the charger ID
    configuration.chargeBoxID = this.getID();
    configuration.timestamp = new Date();

    // Save config
    return ChargingStationStorage.saveConfiguration(this.getTenantID(), configuration);
  }

  setDeleted(deleted) {
    this._model.deleted = deleted;
  }

  isDeleted() {
    return this._model.deleted;
  }

  deleteTransaction(transaction) {
    // Yes: save it
    return TransactionStorage.deleteTransaction(this.getTenantID(), transaction);
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

  async handleDataTransfer(dataTransfer) {
    // Set the charger ID
    dataTransfer.chargeBoxID = this.getID();
    dataTransfer.timestamp = new Date();
    // Save it
    await ChargingStationStorage.saveDataTransfer(this.getTenantID(), dataTransfer);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'CharingStation', method: 'handleDataTransfer',
      action: 'DataTransfer', message: `Data Transfer has been saved`
    });
  }

  async handleDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Set the charger ID
    diagnosticsStatusNotification.chargeBoxID = this.getID();
    diagnosticsStatusNotification.timestamp = new Date();
    // Save it
    await ChargingStationStorage.saveDiagnosticsStatusNotification(this.getTenantID(), diagnosticsStatusNotification);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation', method: 'handleDiagnosticsStatusNotification',
      action: 'DiagnosticsStatusNotification', message: `Diagnostics Status Notification has been saved`
    });
  }

  async handleFirmwareStatusNotification(firmwareStatusNotification) {
    // Set the charger ID
    firmwareStatusNotification.chargeBoxID = this.getID();
    firmwareStatusNotification.timestamp = new Date();
    // Save it
    await ChargingStationStorage.saveFirmwareStatusNotification(this.getTenantID(), firmwareStatusNotification);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation', method: 'handleFirmwareStatusNotification',
      action: 'FirmwareStatusNotification', message: `Firmware Status Notification has been saved`
    });
  }

  async handleAuthorize(authorize) {
    // Set the charger ID
    authorize.chargeBoxID = this.getID();
    authorize.timestamp = new Date();
    // Execute
    const users = await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(
      Constants.ACTION_AUTHORIZE, this, authorize.idTag);
    // Check
    if (users) {
      // Set current user
      authorize.user = users.user;
    }
    // Save
    await ChargingStationStorage.saveAuthorize(this.getTenantID(), authorize);
    // Log
    if (authorize.user) {
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleAuthorize',
        action: 'Authorize', user: authorize.user.getModel(),
        message: `User has been authorized to use Charging Station`
      });
    } else {
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleAuthorize',
        action: 'Authorize', message: `Anonymous user has been authorized to use the Charging Station`
      });
    }
  }

  async getSite() {
    // Get Site Area
    const siteArea = await this.getSiteArea();
    // Check Site Area
    if (!siteArea) {
      return null;
    }
    // Get Site
    const site = await siteArea.getSite();
    return site;
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

  getTransaction(transactionId) {
    // Get the tranasction first (to get the connector id)
    return TransactionStorage.getTransaction(this.getTenantID(), transactionId);
  }

  async handleStartTransaction(startTransaction) {
    let user;
    // Set the charger ID
    startTransaction.chargeBoxID = this.getID();
    startTransaction.tagID = startTransaction.idTag;
    // Check Authorization with Tag ID
    const users = await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(
      Constants.ACTION_START_TRANSACTION, this, startTransaction.tagID);
    if (users) {
      // Set current user
      user = (users.alternateUser ? users.alternateUser : users.user);
      // Set the user
      startTransaction.user = user.getModel();
    }
    // Create
    let transaction = new Transaction(this.getTenantID(), startTransaction);
    // Start Transaction
    await transaction.startTransaction(user);
    // Cleanup old ongoing transactions
    await TransactionStorage.cleanupRemainingActiveTransactions(this.getTenantID(), this.getID(), transaction.getConnectorId());
    // Save it
    transaction = await TransactionStorage.saveTransaction(transaction.getTenantID(), transaction.getModel());
    // Lock the other connectors?
    if (!this.canChargeInParallel()) {
      // Yes
      this.lockAllConnectors();
    }
    // Clean up connector info
    // Get the connector
    const connector = this.getConnector(transaction.getConnectorId());
    // Set data
    connector.currentConsumption = 0;
    connector.totalConsumption = 0;
    connector.currentStateOfCharge = 0;
    connector.activeTransactionID = transaction.getID();
    // Save
    await this.save();
    // Log
    if (user) {
      // Notify
      NotificationHandler.sendTransactionStarted(
        this.getTenantID(),
        transaction.getID(),
        user.getModel(),
        this.getModel(),
        {
          'user': user.getModel(),
          'chargingBoxID': this.getID(),
          'connectorId': transaction.getConnectorId(),
          'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain()),
          'evseDashboardChargingStationURL':
            await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID())
        },
        user.getLocale(),
        {
          'transactionId': transaction.getID(),
          'connectorId': transaction.getConnectorId()
        }
      );
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleStartTransaction',
        action: 'StartTransaction', user: user.getModel(),
        message: `Transaction ID '${transaction.getID()}' has been started on Connector '${transaction.getConnectorId()}'`
      });
    } else {
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getID(),
        module: 'ChargingStation',
        method: 'handleStartTransaction',
        action: 'StartTransaction',
        message: `Transaction ID '${transaction.getID()}' has been started by an anonymous user on Connector '${transaction.getConnectorId()}'`
      });
    }
    // Return
    return transaction;
  }

  lockAllConnectors() {
    this.getConnectors().forEach(async (connector) => {
      // Check
      if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
        // Check OCPP Version 
        if (this.getOcppVersion() === Constants.OCPP_VERSION_15) {
          // Set OCPP 1.5 Occupied
          connector.status = Constants.CONN_STATUS_OCCUPIED;
        } else {
          // Set OCPP 1.6 Unavailable
          connector.status = Constants.CONN_STATUS_UNAVAILABLE;
        }
      }
    });
  }

  _getStoppingTransactionTagId(stopTransactionData, transaction) {
    // Stopped Remotely?
    if (transaction.isRemotelyStopped()) {
      // Yes: Get the diff from now
      const secs = moment.duration(moment().diff(
        moment(transaction.getRemoteStop().timestamp))).asSeconds();
      // In a minute
      if (secs < 60) {
        // Return tag that remotely stopped the transaction
        return transaction.getRemoteStop().tagID;
      }
    }
    // Already provided?
    if (stopTransactionData.idTag) {
      // Return tag that stopped the transaction
      return stopTransactionData.idTag
    }
    // Default: return tag that started the transaction
    return transaction.getTagID();
  }

  async freeConnector(connectorId) {
    // Get the connector
    const connector = this.getConnector(connectorId);
    // Cleanup
    connector.currentConsumption = 0;
    connector.totalConsumption = 0;
    connector.activeTransactionID = 0;
    connector.currentStateOfCharge = 0;
    // Check if Charger can charge in //
    if (!this.canChargeInParallel()) {
      // Set all the other connectors to Available
      this.getConnectors().forEach(async (connector) => {
        // Only other Occupied connectors
        if ((connector.status === Constants.CONN_STATUS_OCCUPIED || 
             connector.status === Constants.CONN_STATUS_UNAVAILABLE) &&
          (connector.connectorId !== connectorId)) {
          // Set connector Available again
          connector.status = Constants.CONN_STATUS_AVAILABLE;
        }
      });
    }
  }

  async handleStopTransaction(stopTransactionData, isSoftStop = false) {
    let user;
    // Set the charger ID
    stopTransactionData.chargeBoxID = this.getID();
    // Get the transaction first (to get the connector id)
    let transaction = await this.getTransaction(stopTransactionData.transactionId);
    // Found?
    if (!transaction) {
      // Wrong Transaction ID!
      throw new BackendError(this.getID(), 
        `Transaction ID '${stopTransactionData.transactionId}' does not exist`,
        "ChargingStation", "handleStopTransaction")
    }
    // Get the TagID
    const tagId = this._getStoppingTransactionTagId(stopTransactionData, transaction);
    // Check User
    const users = await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(
      Constants.ACTION_STOP_TRANSACTION, this, transaction.getTagID(), tagId);
    if (users) {
      // Set current user
      user = (users.alternateUser ? users.alternateUser : users.user);
    }
    // Clean up connector
    await this.freeConnector(transaction.getConnectorId());
    // Save Charger
    await this.save();
    // Soft Stop?
    if (isSoftStop) {
      // Yes: Add the latest Meter Value
      if (transaction.getLastMeterValue()) {
        stopTransactionData.meterStop = transaction.getLastMeterValue().value;
      } else {
        stopTransactionData.meterStop = 0;
      }
    }
    // Stop
    await transaction.stopTransaction(user, tagId, stopTransactionData.meterStop, new Date(stopTransactionData.timestamp));
    // Save Transaction
    transaction = await TransactionStorage.saveTransaction(transaction.getTenantID(), transaction.getModel());
    // Notify User
    if (user) {
      // Send Notification
      NotificationHandler.sendEndOfSession(
        this.getTenantID(),
        transaction.getID() + '-EOS',
        user.getModel(),
        this.getModel(),
        {
          'user': user.getModel(),
          'alternateUser': (user.getID() != users.alternateUser.getID() ? users.alternateUser.getModel() : null),
          'chargingBoxID': this.getID(),
          'connectorId': transaction.getConnectorId(),
          'totalConsumption': (transaction.getTotalConsumption() / 1000).toLocaleString(
            (user.getLocale() ? user.getLocale().replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
          'totalDuration': this._buildTransactionDuration(transaction),
          'totalInactivity': this._buildTransactionInactivity(transaction),
          'stateOfCharge': transaction.getEndStateOfCharge(),
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID()),
          'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain())
        },
        user.getLocale(),
        {
          'transactionId': transaction.getID(),
          'connectorId': transaction.getConnectorId()
        }
      );
    }
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation', method: 'handleStopTransaction',
      action: 'StopTransaction', user: user.getModel(),
      actionOnUser: users.user.getModel(),
      message: `Transaction ID '${transaction.getID()}' has been stopped`
    });
    // Return
    return transaction;
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
        "ChargingStation", "requestChangeConfiguration")
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
    const transactions = await TransactionStorage.getTransactions(this.getTenantID(),
      {'chargeBoxID': this.getID()}, 1);
    // Return
    return (transactions.count > 0);
  }

  async getTransactions(connectorId, startDateTime, endDateTime, withChargeBoxes = false) {
    // Get the consumption
    const transactions = await TransactionStorage.getTransactions(this.getTenantID(),
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
