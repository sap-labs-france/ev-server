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
        return this.requestGenericOCPPCommand('SetChargingProfile', params);
      
      case 'GetCompositeSchedule':
        return this.requestGenericOCPPCommand('GetCompositeSchedule', params);

      // Not Exists!
      default:
        return this.requestGenericOCPPCommand(action, params);
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

    const connector = this.getConnector(transaction.getConnectorId());

    if (transaction.isActive()) {
      // Changed?
      if (connector.currentConsumption !== transaction.getCurrentConsumption() ||
        connector.totalConsumption !== transaction.getTotalConsumption() ||
        connector.currentStateOfCharge !== transaction.getCurrentStateOfCharge()) {
        // Set consumption
        connector.currentConsumption = transaction.getCurrentConsumption();
        connector.totalConsumption = transaction.getTotalConsumption();
        connector.currentStateOfCharge = transaction.getCurrentStateOfCharge();
      }
      // Update Transaction ID
      connector.activeTransactionID = transaction.getID();
      // Update Heartbeat
      this.setLastHeartBeat(new Date());
      // Handle End Of charge
      this.handleNotificationEndOfCharge(transaction);
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

  async handleNotificationEndOfCharge(transaction) {
    // Transaction in progress?
    if (transaction && transaction.isActive()) {
      // Has consumption?
      if (transaction.hasMultipleConsumptions()) {
        // --------------------------------------------------------------------
        // Notification End of charge
        // --------------------------------------------------------------------
        if (_configChargingStation.notifEndOfChargeEnabled && (transaction.getAverageConsumptionOnLast(2) === 0 || transaction.getCurrentStateOfCharge() == 100)) {
          // Notify User?
          if (transaction.getUser()) {
            // Send Notification
            NotificationHandler.sendEndOfCharge(
              this.getTenantID(),
              transaction.getID() + '-EOC',
              transaction.getUser(),
              this.getModel(),
              {
                'user': transaction.getUser(),
                'chargingBoxID': this.getID(),
                'connectorId': transaction.getConnectorId(),
                'totalConsumption': (transaction.getTotalConsumption() / 1000).toLocaleString(
                  (transaction.getUser().locale ? transaction.getUser().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
                  {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
                'stateOfCharge': transaction.getCurrentStateOfCharge(),
                'totalDuration': this._buildCurrentTransactionDuration(transaction),
                'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID()),
                'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain())
              },
              transaction.getUser().locale
            );
          }

          // Stop Transaction and Unlock Connector?
          if (_configChargingStation.notifStopTransactionAndUnlockConnector) {
            try {
              // Yes: Stop the transaction
              let result = await this.requestStopTransaction(transaction.getID());
              // Ok?
              if (result && result.status === 'Accepted') {
                // Cannot unlock the connector
                Logging.logInfo({
                  tenantID: this.getTenantID(),
                  source: this.getID(), module: 'ChargingStation', method: 'handleNotificationEndOfCharge',
                  action: 'NotifyEndOfCharge', message: `Transaction ID '${transaction.getID()}' has been stopped`,
                  detailedMessages: transaction.getModel()
                });
                // Unlock the connector
                result = await this.requestUnlockConnector(transaction.getConnectorId());
                // Ok?
                if (result && result.status === 'Accepted') {
                  // Cannot unlock the connector
                  Logging.logInfo({
                    tenantID: this.getTenantID(),
                    source: this.getID(),
                    module: 'ChargingStation',
                    method: 'handleNotificationEndOfCharge',
                    action: 'NotifyEndOfCharge',
                    message: `Connector '${transaction.getConnectorId()}' has been unlocked`,
                    detailedMessages: transaction.getModel()
                  });
                } else {
                  // Cannot unlock the connector
                  Logging.logError({
                    tenantID: this.getTenantID(),
                    source: this.getID(),
                    module: 'ChargingStation',
                    method: 'handleNotificationEndOfCharge',
                    action: 'NotifyEndOfCharge',
                    message: `Cannot unlock the connector '${transaction.getConnectorId()}'`,
                    detailedMessages: transaction.getModel()
                  });
                }
              } else {
                // Cannot stop the transaction
                Logging.logError({
                  tenantID: this.getTenantID(),
                  source: this.getID(), module: 'ChargingStation', method: 'handleNotificationEndOfCharge',
                  action: 'NotifyEndOfCharge', message: `Cannot stop the transaction`,
                  detailedMessages: transaction.getModel()
                });
              }
            } catch (error) {
              // Log error
              Logging.logActionExceptionMessage(this.getTenantID(), 'EndOfCharge', error);
            }
          }
          // Check the SoC
        } else if (_configChargingStation.notifBeforeEndOfChargeEnabled &&
          transaction.getCurrentStateOfCharge() >= _configChargingStation.notifBeforeEndOfChargePercent) {
          // Notify User?
          if (transaction.getUser()) {
            // Notifcation Before End Of Charge
            NotificationHandler.sendOptimalChargeReached(
              this.getTenantID(),
              transaction.getID() + '-OCR',
              transaction.getUser(),
              this.getModel(),
              {
                'user': transaction.getUser(),
                'chargingBoxID': this.getID(),
                'connectorId': transaction.getConnectorId(),
                'totalConsumption': (transaction.getTotalConsumption() / 1000).toLocaleString(
                  (transaction.getUser().locale ? transaction.getUser().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
                  {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
                'stateOfCharge': transaction.getCurrentStateOfCharge(),
                'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID()),
                'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain())
              },
              transaction.getUser().locale
            );
          }
        }
      }
    }
  }

  // Build Inactivity
  _buildCurrentTransactionInactivity(transaction, i18nHourShort = 'h') {
    const totalInactivitySecs = transaction.getTotalInactivitySecs();

    if (transaction.isActive() || totalInactivitySecs === 0) {
      return `0${i18nHourShort}00 (0%)`;
    }

    const duration = transaction.getDuration();
    const totalInactivityPercent = Math.round(parseInt(totalInactivitySecs) * 100 / duration.asSeconds());
    return transaction.getDuration().format(`h[${i18nHourShort}]mm`, {trim: false}) + ` (${totalInactivityPercent}%)`;
  }

  // Build duration
  _buildCurrentTransactionDuration(transaction) {
    return transaction.getDuration().format(`h[h]mm`, {trim: false});
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
        // Override
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
      // Override
      meterValues.transactionId = chargerTransactionId;
    }
    // Check Transaction
    if (meterValues.transactionId && parseInt(meterValues.transactionId) === 0) {
      // Wrong Transaction ID!
      Logging.logError({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleMeterValues',
        action: 'MeterValues', message: `Transaction ID must not be equal to '0'`
      });
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
    newMeterValues.values = this._filterClockMeterValues(newMeterValues.values);

    // Compute consumption?
    if (!meterValues.transactionId) {
      // Log
      Logging.logWarning({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleMeterValues',
        action: 'MeterValues', message: `MeterValue not saved (not linked to a Transaction)`,
        detailedMessages: meterValues
      });
    } else if (newMeterValues.values.length == 0) {
      Logging.logDebug({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleMeterValues',
        action: 'MeterValues', message: `No MeterValue to save (clocks only)`,
        detailedMessages: meterValues
      });
    } else {
      // Save Meter Values
      await TransactionStorage.saveMeterValues(this.getTenantID(), newMeterValues);
      const transaction = await TransactionStorage.getTransaction(this.getTenantID(), meterValues.transactionId);
      newMeterValues.values.forEach(meterValue => transaction.updateWithMeterValue(meterValue));
      await TransactionStorage.saveTransaction(transaction);

      // Update Charging Station Consumption
      await this.updateChargingStationConsumption(transaction);
      // Save
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

  _filterClockMeterValues(meterValues) {
    if (this.getChargePointVendor() === 'ABB' && this.getOcppVersion() === Constants.OCPP_VERSION_15) {
      return meterValues;
    }
    return meterValues.filter(value => value.attribute.context !== 'Sample.Clock');
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

  async handleStartTransaction(transactionData) {
    // Set the charger ID
    transactionData.chargeBoxID = this.getID();
    transactionData.tagID = transactionData.idTag;

    // Check user and save
    const users = await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(
      Constants.ACTION_START_TRANSACTION, this, transactionData.tagID);
    // Check
    let user;
    if (users) {
      // Set current user
      user = (users.alternateUser ? users.alternateUser : users.user);
      // Set the user
      transactionData.user = user.getModel();
    }
    let transactionEntity = new Transaction(this.getTenantID(), transactionData);
    await TransactionStorage.cleanupRemainingActiveTransactions(this.getTenantID(), this.getID(), transactionEntity.getConnectorId());
    transactionEntity = await TransactionStorage.saveTransaction(transactionEntity);

    if (!this.canChargeInParallel()) {
      this.lockAllConnectors();
    }

    await this.updateChargingStationConsumption(transactionEntity);
    // Save
    await this.save();
    // Log
    if (transactionEntity.getUser()) {
      // Notify
      NotificationHandler.sendTransactionStarted(
        this.getTenantID(),
        transactionEntity.getID(),
        user.getModel(),
        this.getModel(),
        {
          'user': user.getModel(),
          'chargingBoxID': this.getID(),
          'connectorId': transactionEntity.getConnectorId(),
          'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain()),
          'evseDashboardChargingStationURL':
            await Utils.buildEvseTransactionURL(this, transactionEntity.getConnectorId(), transactionEntity.getID())
        },
        user.getLocale()
      );
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleStartTransaction',
        action: 'StartTransaction', user: transactionEntity.getUser(),
        message: `Transaction ID '${transactionEntity.getID()}' has been started on Connector '${transactionEntity.getConnectorId()}'`
      });
    } else {
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getID(),
        module: 'ChargingStation',
        method: 'handleStartTransaction',
        action: 'StartTransaction',
        message: `Transaction ID '${transactionEntity.getID()}' has been started by an anonymous user on Connector '${transactionEntity.getConnectorId()}'`
      });
    }
    // Return
    return transactionEntity;
  }

  lockAllConnectors() {
    this.getConnectors().forEach(async (connector) => {
      // Check
      if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
        // Set Occupied
        connector.status = Constants.CONN_STATUS_OCCUPIED;
      }
    });
  }

  _getStoppingTransactionTagId(stopTransactionData, transactionEntity) {
    if (transactionEntity.isRemotelyStopped()) {
      const secs = moment.duration(moment().diff(
        moment(transactionEntity.getRemoteStop().timestamp))).asSeconds();
      // In a minute
      if (secs < 60) {
        // return tag that remotely stopped the transaction
        return transactionEntity.getRemoteStop().tagID;
      }
    }
    if (stopTransactionData.idTag) {
      // return tag that stopped the transaction
      return stopTransactionData.idTag
    }
    // return tag that started the transaction
    return transactionEntity.getTagID();
  }

  async freeConnector(connectorId) {
    const connector = this.getConnector(connectorId);

    connector.currentConsumption = 0;
    connector.totalConsumption = 0;
    connector.activeTransactionID = 0;
    // Check if Charger can charge in //
    if (!this.canChargeInParallel()) {
      // Set all the other connectors to Available
      this.getConnectors().forEach(async (connector) => {
        // Only other Occupied connectors
        if ((connector.status === Constants.CONN_STATUS_OCCUPIED) &&
          (connector.connectorId !== connectorId)) {
          // Set connector Available again
          connector.status = Constants.CONN_STATUS_AVAILABLE;
        }
      });
    }
  }

  async handleStopTransaction(stopTransactionData, isSoftStop = false) {
    // Set the charger ID
    stopTransactionData.chargeBoxID = this.getID();
    // Get the transaction first (to get the connector id)
    let transactionEntity = await this.getTransaction(stopTransactionData.transactionId);
    // Found?
    if (!transactionEntity) {
      throw new Error(`Transaction ID '${stopTransactionData.transactionId}' does not exist`);
    }

    const stoppingTagId = this._getStoppingTransactionTagId(stopTransactionData, transactionEntity);
    let stoppingUserModel = undefined;
    // Check User
    const users = await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(
      Constants.ACTION_STOP_TRANSACTION, this, transactionEntity.getTagID(), stoppingTagId);
    if (users) {
      // Set current user
      const user = (users.alternateUser ? users.alternateUser : users.user);
      // Set the User ID
      stoppingUserModel = user.getModel();
    }

    await this.freeConnector(transactionEntity.getConnectorId());
    await this.save();

    if (isSoftStop) {
      stopTransactionData.meterStop = transactionEntity._getLatestMeterValue().value;
    }
    transactionEntity.stopTransaction(stoppingUserModel, stoppingTagId, stopTransactionData.meterStop, new Date(stopTransactionData.timestamp));
    transactionEntity = await TransactionStorage.saveTransaction(transactionEntity);

    // Notify User
    if (transactionEntity.getUser()) {
      // Send Notification
      NotificationHandler.sendEndOfSession(
        this.getTenantID(),
        transactionEntity.getID() + '-EOS',
        transactionEntity.getUser(),
        this.getModel(),
        {
          'user': users.user.getModel(),
          'alternateUser': (users.user.getID() != users.alternateUser.getID() ? users.alternateUser.getModel() : null),
          'chargingBoxID': this.getID(),
          'connectorId': transactionEntity.getConnectorId(),
          'totalConsumption': (transactionEntity.getTotalConsumption() / 1000).toLocaleString(
            (transactionEntity.getUser().locale ? transactionEntity.getUser().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
          'totalDuration': this._buildCurrentTransactionDuration(transactionEntity),
          'totalInactivity': this._buildCurrentTransactionInactivity(transactionEntity),
          'stateOfCharge': transactionEntity.getEndStateOfCharge(),
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(this, transactionEntity.getConnectorId(), transactionEntity.getID()),
          'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain())
        },
        transactionEntity.getUser().locale
      );
    }

    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation', method: 'handleStopTransaction',
      action: 'StopTransaction', user: transactionEntity.getFinisher(),
      actionOnUser: transactionEntity.getUser(),
      message: `Transaction ID '${transactionEntity.getID()}' has been stopped`
    });
    // Publish to Cloud Revenue
    setTimeout(() => {
      // Check Chargers
      if (this.getID() === 'PERNICE-WB-01' ||
        this.getID() === 'HANNO-WB-01' ||
        this.getID() === 'DAUDRE-WB-01' ||
        this.getID() === 'WINTER-WB-01' ||
        this.getID() === 'GIMENO-WB-01' ||
        this.getID() === 'HANNO-WB-02') {
        // Check Users
        if (transactionEntity.getTagID() === '5D38ED8F' || // Hanno 1
          transactionEntity.getTagID() === 'B31FB2DD' || // Hanno 2
          transactionEntity.getTagID() === '43329EF7' || // Gimeno
          transactionEntity.getTagID() === 'WJ00001' || // Winter Juergen
          transactionEntity.getTagID() === 'DP596512770' || // DAUDRE-VIGNIER Philippe
          transactionEntity.getTagID() === 'C3E4B3DD') { // Florent
          // Transfer it to the Revenue Cloud async
          Utils.pushTransactionToRevenueCloud('StopTransaction', transactionEntity,
            transactionEntity.getFinisher(), transactionEntity.getUser());
        }
      }
    }, 3000);
    // Return
    return transactionEntity;
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
