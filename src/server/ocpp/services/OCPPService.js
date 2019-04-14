const NotificationHandler = require('../../../notification/NotificationHandler');
const ChargingStation = require('../../../entity/ChargingStation');
const Authorizations = require('../../../authorization/Authorizations');
const Transaction = require('../../../entity/Transaction');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const OCPPUtils = require('../utils/OCPPUtils');
const OCPPValidation = require('../validation/OCPPValidation');
const BackendError = require('../../../exception/BackendError');
const Configuration = require('../../../utils/Configuration');
const OCPPStorage = require('../../../storage/mongodb/OCPPStorage');
const SiteArea = require('../../../entity/SiteArea');
const moment = require('moment-timezone');
const momentDurationFormatSetup = require("moment-duration-format");

require('source-map-support').install();

momentDurationFormatSetup(moment);
const _configChargingStation = Configuration.getChargingStationConfig();

class OCPPService {
  // Common constructor for Central System Service
  constructor(centralSystemConfig, chargingStationConfig) {
    // Keep params
    this._centralSystemConfig = centralSystemConfig;
    this._chargingStationConfig = chargingStationConfig;
  }

  async _checkAndGetChargingStation(chargeBoxIdentity, tenantID) {
    // Get the charging station
    const chargingStation = await ChargingStation.getChargingStation(tenantID, chargeBoxIdentity);
    // Found?
    if (!chargingStation) {
      // Error
      throw new BackendError(chargeBoxIdentity, `Charging Station does not exist`,
        "OCPPService", "_checkAndGetChargingStation");
    }
    // Found?
    if (chargingStation.isDeleted()) {
      // Error
      throw new BackendError(chargeBoxIdentity, `Charging Station is deleted`,
        "OCPPService", "_checkAndGetChargingStation");
    }
    return chargingStation;
  }

  async handleBootNotification(bootNotification) {
    try {
      // Check props
      OCPPValidation.validateBootNotification(bootNotification);
      // Set the endpoint
      if (bootNotification.From) {
        bootNotification.endpoint = bootNotification.From.Address;
      }
      // Set the ChargeBox ID
      bootNotification.id = bootNotification.chargeBoxIdentity;
      // Set the default Heart Beat
      bootNotification.lastReboot = new Date();
      bootNotification.lastHeartBeat = bootNotification.lastReboot;
      bootNotification.timestamp = bootNotification.lastReboot;
      // Get the charging station
      let chargingStation = await ChargingStation.getChargingStation(bootNotification.tenantID, bootNotification.chargeBoxIdentity);
      if (!chargingStation) {
        // New Charging Station: Create
        chargingStation = new ChargingStation(bootNotification.tenantID, bootNotification);
        // Update timestamp
        chargingStation.setCreatedOn(new Date());
        chargingStation.setLastHeartBeat(new Date());
      } else {
        // Existing Charging Station: Update
        // Check if same vendor and model
        if (chargingStation.getChargePointVendor() !== bootNotification.chargePointVendor ||
            chargingStation.getChargePointModel() !== bootNotification.chargePointModel) {
          // Not the same charger!
          throw new BackendError(
            chargingStation.getID(), 
            `Registration rejected: the Vendor '${bootNotification.chargePointVendor}' / Model '${bootNotification.chargePointModel}' are different! Expected Vendor '${chargingStation.getChargePointVendor()}' / Model '${chargingStation.getChargePointModel()}'`, 
            "OCPPService", "handleBootNotification", "BootNotification");
        }
        chargingStation.setChargePointVendor(bootNotification.chargePointVendor);
        chargingStation.setChargePointModel(bootNotification.chargePointModel);
        chargingStation.setChargePointSerialNumber(bootNotification.chargePointSerialNumber);
        chargingStation.setChargeBoxSerialNumber(bootNotification.chargeBoxSerialNumber);
        chargingStation.setFirmwareVersion(bootNotification.firmwareVersion);
        chargingStation.setOcppVersion(bootNotification.ocppVersion);
        chargingStation.setOcppProtocol(bootNotification.ocppProtocol);
        chargingStation.setLastHeartBeat(new Date());
        // Set the charger URL?
        if (bootNotification.chargingStationURL) {
          chargingStation.setChargingStationURL(bootNotification.chargingStationURL)
        }
        // Back again
        chargingStation.setDeleted(false);
      }
      // Save Charging Station
      const updatedChargingStation = await chargingStation.save();

      // Set the Station ID
      bootNotification.chargeBoxID = updatedChargingStation.getID();
      // Send Notification
      NotificationHandler.sendChargingStationRegistered(
        updatedChargingStation.getTenantID(),
        Utils.generateGUID(),
        updatedChargingStation.getModel(),
        {
          'chargeBoxID': updatedChargingStation.getID(),
          'evseDashboardURL': Utils.buildEvseURL((await updatedChargingStation.getTenant()).getSubdomain()),
          'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(updatedChargingStation)
        }
      );
      // Save Boot Notification
      await OCPPStorage.saveBootNotification(updatedChargingStation.getTenantID(), bootNotification);
      // Log
      Logging.logInfo({
        tenantID: updatedChargingStation.getTenantID(),
        source: updatedChargingStation.getID(),
        module: 'OCPPService', method: 'handleBootNotification',
        action: 'BootNotification', message: `Boot notification saved`
      });
      // Handle the get of configuration later on
      setTimeout(() => {
        // Get config and save it
        updatedChargingStation.requestAndSaveConfiguration();
      }, 3000);
      // Check if charger will be automatically assigned
      if (Configuration.getTestConfig() && Configuration.getTestConfig().automaticChargerAssignment) {
        // Get all the site areas
        const siteAreas = await SiteArea.getSiteAreas(bootNotification.tenantID);
        // Assign them
        if (Array.isArray(siteAreas.result) && siteAreas.result.length > 0) {
          // Set
          chargingStation.setSiteArea(siteAreas.result[0]);
          // Save
          await updatedChargingStation.saveChargingStationSiteArea()
        }
      }
      // Return the result
      return {
        'currentTime': new Date().toISOString(),
        'status': 'Accepted',
        'heartbeatInterval': this._chargingStationConfig.heartbeatIntervalSecs
      };
    } catch (error) {
      // Set the source
      error.source = bootNotification.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(bootNotification.tenantID, 'BootNotification', error);
      // Reject
      return {
        'status': 'Rejected',
        'currentTime': new Date().toISOString(),
        'heartbeatInterval': this._chargingStationConfig.heartbeatIntervalSecs
      };
    }
  }

  async handleHeartbeat(heartbeat) {
    try {
      // Get Charging Station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(heartbeat.chargeBoxIdentity, heartbeat.tenantID);
      // Check props
      OCPPValidation.validateHeartbeat(chargingStation, heartbeat);
      // Set Heartbeat
      chargingStation.setLastHeartBeat(new Date());
      // Save
      await chargingStation.saveHeartBeat();
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.getID(),
        module: 'OCPPService', method: 'handleHeartbeat',
        action: 'Heartbeat', message: `Heartbeat saved`
      }); 
      // Return
      return {
        'currentTime': chargingStation.getLastHeartBeat().toISOString()
      };
    } catch (error) {
      // Set the source
      error.source = heartbeat.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(heartbeat.tenantID, 'HeartBeat', error);
      // Send the response
      return {
        'currentTime': new Date().toISOString()
      };
    }
  }

  async handleStatusNotification(statusNotification) {
    try {
      // Get charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(statusNotification.chargeBoxIdentity, statusNotification.tenantID);
      // Check props
      OCPPValidation.validateStatusNotification(chargingStation, statusNotification);
      // Set Header
      statusNotification.chargeBoxID = chargingStation.getID();
      statusNotification.timezone = chargingStation.getTimezone();
      // Handle connectorId = 0 case => Currently status is distributed to each individual connectors
      if (statusNotification.connectorId === 0) {
        // Ignore EBEE charger
        if (chargingStation.getChargePointVendor() !== Constants.CHARGER_VENDOR_EBEE) {
          // Log
          Logging.logInfo({
            tenantID: chargingStation.getTenantID(),
            source: chargingStation.getID(), module: 'OCPPService',
            method: 'handleStatusNotification', action: 'StatusNotification',
            message: `Connector ID '0' received with status '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
          });
          // Get the connectors
          const connectors = chargingStation.getConnectors();
          // Update ALL connectors
          for (let i = 0; i < connectors.length; i++) {
            // update message with proper connectorId
            statusNotification.connectorId = connectors[i].connectorId;
            // Update
            await this._updateConnectorStatus(chargingStation, statusNotification, true);
          }
        } else {
          // Do not take connector '0' into account for EBEE
          Logging.logWarning({
            tenantID: chargingStation.getTenantID(),
            source: chargingStation.getID(), module: 'OCPPService',
            method: 'handleStatusNotification', action: 'StatusNotification',
            message: `Ignored EBEE with Connector ID '0' with status '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
          });
        }
      } else {
        // update only the given connectorId
        await this._updateConnectorStatus(chargingStation, statusNotification, false);
      }
      // Respond
      return {};
    } catch (error) {
      // Set the source
      error.source = statusNotification.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(statusNotification.tenantID, 'StatusNotification', error);
      // Return
      return {};
    }
  }

  async _updateConnectorStatus(chargingStation, statusNotification, bothConnectorsUpdated) {
    // Get it
    let connector = chargingStation.getConnector(statusNotification.connectorId);
    if (!connector) {
      // Does not exist: Create
      connector = { connectorId: statusNotification.connectorId, currentConsumption: 0, status: 'Unknown', power: 0 };
      // Add
      chargingStation.getConnectors().push(connector);
    }
    // Check if status has changed
    if (connector.status === statusNotification.status &&
        connector.errorCode === statusNotification.errorCode) {
      // No Change: Do not save it
      Logging.logWarning({
        tenantID: chargingStation.getTenantID(), source: chargingStation.getID(),
        module: 'OCPPService', method: 'handleStatusNotification', action: 'StatusNotification',
        message: `Status on Connector '${statusNotification.connectorId}' has not changed then not saved: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}''`
      });
      return;
    }
    // Set connector data
    connector.connectorId = statusNotification.connectorId;
    connector.status = statusNotification.status;
    connector.errorCode = statusNotification.errorCode;
    connector.info = (statusNotification.info ? statusNotification.info : '');
    connector.vendorErrorCode = (statusNotification.vendorErrorCode ? statusNotification.vendorErrorCode : '');
    // Save Status Notification
    await OCPPStorage.saveStatusNotification(chargingStation.getTenantID(), statusNotification);
    // Log
    Logging.logInfo({
      tenantID: chargingStation.getTenantID(), source: chargingStation.getID(),
      module: 'OCPPService', method: 'handleStatusNotification', action: 'StatusNotification',
      message: `Connector '${statusNotification.connectorId}' status '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}' has been saved`
    });
    // Handle connector is available but a transaction is ongoing (ABB bug)!!!
    this._checkStatusNotificationOngoingTransaction(chargingStation, statusNotification, connector, bothConnectorsUpdated);
    // Notify admins
    this._notifyStatusNotification(chargingStation, statusNotification);
    // Save Connector
    await chargingStation.saveChargingStationConnector(statusNotification.connectorId);
  }

  async _checkStatusNotificationOngoingTransaction(chargingStation, statusNotification, connector, bothConnectorsUpdated) {
    // Check the status
    if (!bothConnectorsUpdated &&
        connector.activeTransactionID > 0 &&
        (statusNotification.status === Constants.CONN_STATUS_AVAILABLE || statusNotification.status === Constants.CONN_STATUS_FINISHING)) {
      // Cleanup ongoing transactions on the connector
      await Transaction.stopOrDeleteActiveTransactions(
        chargingStation.getTenantID(), chargingStation.getID(), statusNotification.connectorId);
      // Clean up connector
      await OCPPUtils.checkAndFreeConnector(chargingStation, statusNotification.connectorId, true);
    }
  }

  async _notifyStatusNotification(chargingStation, statusNotification) {
    // Faulted?
    if (statusNotification.status === Constants.CONN_STATUS_FAULTED) {
      // Log
      Logging.logError({
        tenantID: chargingStation.getTenantID(), source: chargingStation.getID(), module: 'OCPPService',
        method: '_notifyStatusNotification', action: 'StatusNotification',
        message: `Error on Connector '${statusNotification.connectorId}': '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : "N/A")}'`
      });
      // Send Notification
      NotificationHandler.sendChargingStationStatusError(
        chargingStation.getTenantID(),
        Utils.generateGUID(),
        chargingStation.getModel(),
        {
          'chargeBoxID': chargingStation.getID(),
          'connectorId': statusNotification.connectorId,
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${(statusNotification.info ? statusNotification.info : "N/A")}`,
          'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain()),
          'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(chargingStation, statusNotification.connectorId)
        },
        {
          'connectorId': statusNotification.connectorId,
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${statusNotification.info}`,
        }
      );
    }
  }

  async handleMeterValues(meterValues) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(meterValues.chargeBoxIdentity, meterValues.tenantID);
      // Check props
      OCPPValidation.validateMeterValues(chargingStation, meterValues);
      // Normalize Meter Values
      const newMeterValues = this._normalizeMeterValues(chargingStation, meterValues);
      // Handle charger's specificities
      this._checkMeterValuesCharger(chargingStation, newMeterValues);
      // No Values?
      if (newMeterValues.values.length == 0) {
        Logging.logDebug({
          tenantID: chargingStation.getTenantID(),
          source: chargingStation.getID(), module: 'OCPPService', method: 'handleMeterValues',
          action: 'MeterValues', message: `No relevant MeterValues to save`,
          detailedMessages: meterValues
        });
        // Process values
      } else {
        // Handle Meter Value only for transaction
        if (meterValues.transactionId) {
          // Get the transaction
          const transaction = await Transaction.getTransaction(chargingStation.getTenantID(), meterValues.transactionId);
          // Handle Meter Values
          await transaction.updateWithMeterValues(newMeterValues);
          // Save Transaction
          await transaction.save();
          // Update Charging Station Consumption
          await this._updateChargingStationConsumption(chargingStation, transaction);
          // Save Charging Station
          await chargingStation.save();
          // Log
          Logging.logInfo({
            tenantID: chargingStation.getTenantID(), source: chargingStation.getID(),
            module: 'OCPPService', method: 'handleMeterValues', action: 'MeterValues',
            message: `MeterValue have been saved for Transaction ID '${meterValues.transactionId}'`,
            detailedMessages: meterValues
          });
        } else {
          // Log
          Logging.logWarning({
            tenantID: chargingStation.getTenantID(), source: chargingStation.getID(),
            module: 'OCPPService', method: 'handleMeterValues', action: 'MeterValues',
            message: `MeterValues is ignored as it is not linked to a transaction`,
            detailedMessages: meterValues
          });
        }
      }
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = meterValues.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(meterValues.tenantID, 'MeterValues', error);
      // Response
      return {};
    }
  }

  async _updateChargingStationConsumption(chargingStation, transaction) {
    // Get the connector
    const connector = chargingStation.getConnector(transaction.getConnectorId());
    // Active transaction?
    if (transaction.isActive()) {
      // Set consumption
      connector.currentConsumption = transaction.getCurrentConsumption();
      connector.totalConsumption = transaction.getCurrentTotalConsumption();
      connector.currentStateOfCharge = transaction.getCurrentStateOfCharge();
      // Set Transaction ID
      connector.activeTransactionID = transaction.getID();
      // Update Heartbeat
      chargingStation.setLastHeartBeat(new Date());
      // Handle End Of charge
      this._checkNotificationEndOfCharge(chargingStation, transaction);
    } else {
      // Cleanup connector transaction data
      OCPPUtils.cleanupConnectorTransactionInfo(chargingStation, transaction.getConnectorId());
    }
    // Log
    Logging.logInfo({
      tenantID: chargingStation.getTenantID(),
      source: chargingStation.getID(), module: 'OCPPService',
      method: 'updateChargingStationConsumption', action: 'ChargingStationConsumption',
      message: `Connector '${connector.connectorId}' - Consumption ${connector.currentConsumption}, Total: ${connector.totalConsumption}, SoC: ${connector.currentStateOfCharge}`
    });
  }

  async _checkNotificationEndOfCharge(chargingStation, transaction) {
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
              chargingStation.getTenantID(),
              transaction.getID() + '-EOC',
              transaction.getUserJson(),
              chargingStation.getModel(),
              {
                'user': transaction.getUserJson(),
                'chargeBoxID': chargingStation.getID(),
                'connectorId': transaction.getConnectorId(),
                'totalConsumption': (transaction.getCurrentTotalConsumption() / 1000).toLocaleString(
                  (transaction.getUserJson().locale ? transaction.getUserJson().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
                  {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
                'stateOfCharge': transaction.getCurrentStateOfCharge(),
                'totalDuration': this._buildCurrentTransactionDuration(transaction),
                'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(chargingStation, transaction.getConnectorId(), transaction.getID()),
                'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain())
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
              chargingStation.getTenantID(),
              transaction.getID() + '-OCR',
              transaction.getUserJson(),
              chargingStation.getModel(),
              {
                'user': transaction.getUserJson(),
                'chargeBoxID': chargingStation.getID(),
                'connectorId': transaction.getConnectorId(),
                'totalConsumption': (transaction.getCurrentTotalConsumption() / 1000).toLocaleString(
                  (transaction.getUserJson().locale ? transaction.getUserJson().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
                  {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
                'stateOfCharge': transaction.getCurrentStateOfCharge(),
                'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(chargingStation, transaction.getConnectorId(), transaction.getID()),
                'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain())
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
  
  _checkMeterValuesCharger(chargingStation, meterValues) {
    // Clean up Sample.Clock meter value
    if (chargingStation.getChargePointVendor() !== 'ABB' || chargingStation.getOcppVersion() !== Constants.OCPP_VERSION_15) {
      // Filter Sample.Clock meter value for all chargers except ABB using OCPP 1.5
      meterValues.values = meterValues.values.filter(value => value.attribute.context !== 'Sample.Clock');
    }
  }

  _normalizeMeterValues(chargingStation, meterValues) {
    // Create the model
    const newMeterValues = {};
    newMeterValues.values = [];
    newMeterValues.chargeBoxID = chargingStation.getID();
    // OCPP 1.6
    if (chargingStation.getOcppVersion() === Constants.OCPP_VERSION_16) {
      meterValues.values = meterValues.meterValue;
    }
    // Only one value?
    if (!Array.isArray(meterValues.values)) {
      // Make it an array
      meterValues.values = [meterValues.values];
    }
    // Process the Meter Values
    for (const value of meterValues.values) {
      const newMeterValue = {};
      // Set the Meter Value header
      newMeterValue.chargeBoxID = newMeterValues.chargeBoxID;
      newMeterValue.connectorId = meterValues.connectorId;
      newMeterValue.transactionId = meterValues.transactionId;
      newMeterValue.timestamp = value.timestamp;
      // OCPP 1.6
      if (chargingStation.getOcppVersion() === Constants.OCPP_VERSION_16) {
        // Multiple Values?
        if (Array.isArray(value.sampledValue)) {
          // Create one record per value
          for (const sampledValue of value.sampledValue) {
            // Add Attributes
            const newLocalMeterValue = JSON.parse(JSON.stringify(newMeterValue));
            newLocalMeterValue.attribute = this._buildMeterValueAttributes(sampledValue);
            newLocalMeterValue.value = parseInt(sampledValue.value);
            // Add
            newMeterValues.values.push(newLocalMeterValue);
          }
        } else {
          // Add Attributes
          const newLocalMeterValue = JSON.parse(JSON.stringify(newMeterValue));
          newLocalMeterValue.attribute = this._buildMeterValueAttributes(sampledValue);
          // Add
          newMeterValues.values.push(newLocalMeterValue);
        }
      // OCPP < 1.6
      } else if (value.value) {
        // OCPP 1.2
        if (value.value.$value) {
          // Set
          newMeterValue.value = value.value.$value;
          newMeterValue.attribute = value.value.attributes;
      // OCPP 1.5
      } else {
          newMeterValue.value = parseInt(value.value);
        }
        // Add
        newMeterValues.values.push(newMeterValue);
      }
    }
    return newMeterValues;
  }

  _buildMeterValueAttributes(sampledValue) {
    return {
      context: (sampledValue.context ? sampledValue.context : Constants.METER_VALUE_CTX_SAMPLE_PERIODIC),
      format: (sampledValue.format ? sampledValue.format : Constants.METER_VALUE_FORMAT_RAW),
      measurand: (sampledValue.measurand ? sampledValue.measurand : Constants.METER_VALUE_MEASURAND_IMPREG),
      location: (sampledValue.location ? sampledValue.location : Constants.METER_VALUE_LOCATION_OUTLET),
      unit: (sampledValue.unit ? sampledValue.unit : Constants.METER_VALUE_UNIT_WH),
      phase: (sampledValue.phase ? sampledValue.phase : '')
    }
  }

  async handleAuthorize(authorize) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(authorize.chargeBoxIdentity, authorize.tenantID);
      // Check props
      OCPPValidation.validateAuthorize(chargingStation, authorize);
      // Set header
      authorize.chargeBoxID = chargingStation.getID();
      authorize.timestamp = new Date();
      authorize.timezone = chargingStation.getTimezone();
      // Check
      authorize.user = await Authorizations.isTagIDAuthorizedOnChargingStation(chargingStation, authorize.idTag, Constants.ACTION_AUTHORIZE);
      // Save
      await OCPPStorage.saveAuthorize(chargingStation.getTenantID(), authorize);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.getID(), module: 'OCPPService', method: 'handleAuthorize',
        action: 'Authorize', user: (authorize.user ? authorize.user.getModel() : null),
        message: `User has been authorized with Badge ID '${authorize.idTag}'`
      });
      // Return
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
        error.source = authorize.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(authorize.tenantID, 'Authorize', error);
      return {
        'status': 'Invalid'
      };
    }
  }

  async handleDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(diagnosticsStatusNotification.chargeBoxIdentity, diagnosticsStatusNotification.tenantID);
      // Check props
      OCPPValidation.validateDiagnosticsStatusNotification(chargingStation, diagnosticsStatusNotification);
      // Set the charger ID
      diagnosticsStatusNotification.chargeBoxID = chargingStation.getID();
      diagnosticsStatusNotification.timestamp = new Date();
      diagnosticsStatusNotification.timezone = chargingStation.getTimezone();
      // Save it
      await OCPPStorage.saveDiagnosticsStatusNotification(chargingStation.getTenantID(), diagnosticsStatusNotification);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.getID(), module: 'OCPPService', method: 'handleDiagnosticsStatusNotification',
        action: 'DiagnosticsStatusNotification', message: `Diagnostics Status Notification has been saved`
      });
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = diagnosticsStatusNotification.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(chargingStation.getTenantID(), 'DiagnosticsStatusNotification', error);
      return {};
    }
  }

  async handleFirmwareStatusNotification(firmwareStatusNotification) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(firmwareStatusNotification.chargeBoxIdentity, firmwareStatusNotification.tenantID);
      // Check props
      OCPPValidation.validateFirmwareStatusNotification(chargingStation, firmwareStatusNotification);
      // Set the charger ID
      firmwareStatusNotification.chargeBoxID = chargingStation.getID();
      firmwareStatusNotification.timestamp = new Date();
      firmwareStatusNotification.timezone = chargingStation.getTimezone();
      // Save it
      await OCPPStorage.saveFirmwareStatusNotification(chargingStation.getTenantID(), firmwareStatusNotification);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.getID(), module: 'OCPPService', method: 'handleFirmwareStatusNotification',
        action: 'FirmwareStatusNotification', message: `Firmware Status Notification has been saved`
      });
      // Return
      return {};
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(firmwareStatusNotification.tenantID, 'FirmwareStatusNotification', error);
      return {};
    }
  }

  async handleStartTransaction(startTransaction) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(startTransaction.chargeBoxIdentity, startTransaction.tenantID);
      // Check props
      OCPPValidation.validateStartTransaction(chargingStation, startTransaction);
      // Check Connector ID
      if (!chargingStation.getConnector(startTransaction.connectorId)) {
        throw new BackendError(chargingStation.getID(),
          `The Connector ID '${startTransaction.connectorId}' is invalid`,
          "OCPPService", "handleStartTransaction", "StartTransaction");
      }
      // Set the header
      startTransaction.chargeBoxID = chargingStation.getID();
      startTransaction.tagID = startTransaction.idTag;
      startTransaction.timezone = chargingStation.getTimezone();
      // Get the Organization component
      const isOrgCompActive = await chargingStation.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
      // Check Authorization with Tag ID
      const user = await Authorizations.isTagIDAuthorizedOnChargingStation(
        chargingStation, startTransaction.tagID, Constants.ACTION_START_TRANSACTION);
      if (user) {
        // Set the user
        startTransaction.user = user.getModel();
      }
      // Check Org
      if (isOrgCompActive) {
        // Set the Site Area ID
        startTransaction.siteAreaID = chargingStation.getSiteAreaID();
        // Set the Site ID
        const site = await chargingStation.getSite();
        if (site) {
          startTransaction.siteID = site.getID();
        }      
      }
      // Cleanup ongoing transactions
      await Transaction.stopOrDeleteActiveTransactions(
        chargingStation.getTenantID(), chargingStation.getID(), startTransaction.connectorId);
      // Create the Transaction
      let transaction = new Transaction(chargingStation.getTenantID(), startTransaction);
      // Start Transactions
      await transaction.startTransaction(user);
      // Save it
      transaction = await transaction.save();
      // Lock the other connectors?
      if (!chargingStation.canChargeInParallel()) {
        // Yes
        OCPPUtils.lockAllConnectors(chargingStation);
      }
      // Clean up connector transaction info
      OCPPUtils.cleanupConnectorTransactionInfo(chargingStation, transaction.getConnectorId());
      // Set the active transaction on the connector
      chargingStation.getConnector(transaction.getConnectorId()).activeTransactionID = transaction.getID();
      // Update Heartbeat
      chargingStation.setLastHeartBeat(new Date());
      // Save
      await chargingStation.save();
      // Log
      if (user) {
        // Notify
        NotificationHandler.sendTransactionStarted(
          chargingStation.getTenantID(),
          transaction.getID(),
          user.getModel(),
          chargingStation.getModel(),
          {
            'user': user.getModel(),
            'chargeBoxID': chargingStation.getID(),
            'connectorId': transaction.getConnectorId(),
            'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain()),
            'evseDashboardChargingStationURL':
              await Utils.buildEvseTransactionURL(chargingStation, transaction.getConnectorId(), transaction.getID())
          },
          user.getLocale(),
          {
            'transactionId': transaction.getID(),
            'connectorId': transaction.getConnectorId()
          }
        );
        // Log
        Logging.logInfo({
          tenantID: chargingStation.getTenantID(),
          source: chargingStation.getID(), module: 'OCPPService', method: 'handleStartTransaction',
          action: 'StartTransaction', user: user.getModel(),
          message: `Transaction ID '${transaction.getID()}' has been started on Connector '${transaction.getConnectorId()}'`
        });
      } else {
        // Log
        Logging.logInfo({
          tenantID: chargingStation.getTenantID(), source: chargingStation.getID(),
          module: 'OCPPService', method: 'handleStartTransaction', action: 'StartTransaction',
          message: `Transaction ID '${transaction.getID()}' has been started on Connector '${transaction.getConnectorId()}'`
        });
      }
      // Return
      return {
        'transactionId': transaction.getID(),
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = startTransaction.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(startTransaction.tenantID, 'StartTransaction', error);
      return {
        'transactionId': 0,
        'status': 'Invalid'
      };
    }
  }

  async handleDataTransfer(dataTransfer) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(dataTransfer.chargeBoxIdentity, dataTransfer.tenantID);
      // Check props
      OCPPValidation.validateDataTransfer(chargingStation, dataTransfer);
      // Set the charger ID
      dataTransfer.chargeBoxID = chargingStation.getID();
      dataTransfer.timestamp = new Date();
      dataTransfer.timezone = chargingStation.getTimezone();
      // Save it
      await OCPPStorage.saveDataTransfer(chargingStation.getTenantID(), dataTransfer);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.getID(), module: 'OCPPService', method: 'handleDataTransfer',
        action: 'DataTransfer', message: `Data Transfer has been saved`
      });
      // Return
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = dataTransfer.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(dataTransfer.tenantID, 'DataTransfer', error);
      return {
        'status': 'Rejected'
      };
    }
  }

  async handleStopTransaction(stopTransaction, isSoftStop=false) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(stopTransaction.chargeBoxIdentity, stopTransaction.tenantID);
      // Check props
      OCPPValidation.validateStopTransaction(chargingStation, stopTransaction);
      // Set header
      stopTransaction.chargeBoxID = chargingStation.getID();
      // Get the transaction
      let transaction = await Transaction.getTransaction(chargingStation.getTenantID(), stopTransaction.transactionId);
      if (!transaction) {
        // Wrong Transaction ID!
        throw new BackendError(chargingStation.getID(),
          `Transaction ID '${stopTransaction.transactionId}' does not exist`,
          'OCPPService', 'handleStopTransaction', 'StopTransaction');
      }
      let user, alternateUser;
      // Get the TagID that stopped the transaction
      const tagId = this._getStopTransactionTagId(stopTransaction, transaction);
      // Check if same user
      if (tagId !== transaction.getTagID()) {
        // No: Check alternate user
        alternateUser = await Authorizations.isTagIDAuthorizedOnChargingStation(
          chargingStation, tagId, Constants.ACTION_STOP_TRANSACTION);
        // Anonymous?
        if (alternateUser) {
          // Get the owner of the transaction
          user = await transaction.getUser();
          // Not Check if Alternate User belongs to a Site --------------------------------
          // Organization component active?
          const isOrgCompActive = await chargingStation.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
          if (isOrgCompActive) {
            // Get the site (site existence is already checked by isTagIDAuthorizedOnChargingStation())
            const site = await chargingStation.getSite();
            // Check if the site allows to stop the transaction of another user
            if (!Authorizations.isAdmin(alternateUser.getModel()) &&
                !site.isAllowAllUsersToStopTransactionsEnabled()) {
                // Reject the User
              throw new BackendError(
                chargingStation.getID(),
                `User '${alternateUser.getFullName()}' is not allowed to perform 'Stop Transaction' on User '${user.getFullName()}' on Site '${site.getName()}'!`,
                'OCPPService', "handleStopTransaction", "StopTransaction",
                (alternateUser ? alternateUser.getModel() : null), (user ? user.getModel() : null));
            }
          } else {
            // Only Admins can stop a transaction when org is not active
            if (!Authorizations.isAdmin(alternateUser.getModel())) {
                // Reject the User
              throw new BackendError(
                chargingStation.getID(),
                `User '${alternateUser.getFullName()}' is not allowed to perform 'Stop Transaction' on User '${user.getFullName()}'!`,
                'OCPPService', "handleStopTransaction", "StopTransaction",
                (alternateUser ? alternateUser.getModel() : null), (user ? user.getModel() : null));
            }
          }
        }
      } else {
        // Check user
        user = await Authorizations.isTagIDAuthorizedOnChargingStation(
          chargingStation, transaction.getTagID(), Constants.ACTION_STOP_TRANSACTION);
      }
      // Check if the transaction has already been stopped
      if (!transaction.isActive()) {
        throw new BackendError(chargingStation.getID(),
          `Transaction ID '${stopTransaction.transactionId}' has already been stopped`,
          'OCPPService', "handleStopTransaction", "StopTransaction",
          (alternateUser ? alternateUser.getID() : (user ? user.getID() : null)),
          (alternateUser ? (user ? user.getID() : null) : null));
      }
      // Check and free the connector
      await OCPPUtils.checkAndFreeConnector(chargingStation, transaction.getConnectorId(), false);
      // Update Heartbeat
      chargingStation.setLastHeartBeat(new Date());
      // Save Charger
      await chargingStation.save();
      // Soft Stop?
      if (isSoftStop) {
        // Yes: Add the latest Meter Value
        if (transaction.getLastMeterValue()) {
          stopTransaction.meterStop = transaction.getLastMeterValue().value;
        } else {
          stopTransaction.meterStop = 0;
        }
      }
      // Stop
      await transaction.stopTransaction(
        (alternateUser ? alternateUser.getID() : (user ? user.getID() : null)),
        tagId, stopTransaction.meterStop, new Date(stopTransaction.timestamp));
      // Save the transaction
      transaction = await transaction.save();
      // Notify User
      this._notifyStopTransaction(chargingStation, user, alternateUser, transaction);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.getID(), module: 'OCPPService', method: 'handleStopTransaction',
        action: 'StopTransaction', 
        user: (alternateUser ? alternateUser.getID() : (user ? user.getID() : null)),
        actionOnUser: (alternateUser ? (user ? user.getID() : null) : null),
        message: `Transaction ID '${transaction.getID()}' has been stopped successfully`
      });
      // Success
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = stopTransaction.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(stopTransaction.tenantID, 'StopTransaction', error);
      // Error
      return {
        'status': 'Invalid'
      };
    }
  }

  _getStopTransactionTagId(stopTransaction, transaction) {
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
    if (stopTransaction.idTag) {
      // Return tag that stopped the transaction
      return stopTransaction.idTag
    }
    // Default: return tag that started the transaction
    return transaction.getTagID();
  }

  async _notifyStopTransaction(chargingStation, user, alternateUser, transaction) {
    // User provided?
    if (user) {
      // Send Notification
      NotificationHandler.sendEndOfSession(
        chargingStation.getTenantID(),
        transaction.getID() + '-EOS',
        user.getModel(),
        chargingStation.getModel(),
        {
          'user': user.getModel(),
          'alternateUser': (alternateUser ? alternateUser.getModel() : null),
          'chargeBoxID': chargingStation.getID(),
          'connectorId': transaction.getConnectorId(),
          'totalConsumption': (transaction.getTotalConsumption() / 1000).toLocaleString(
            (user.getLocale() ? user.getLocale().replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
          'totalDuration': this._buildTransactionDuration(transaction),
          'totalInactivity': this._buildTransactionInactivity(transaction),
          'stateOfCharge': transaction.getEndStateOfCharge(),
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(chargingStation, transaction.getConnectorId(), transaction.getID()),
          'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain())
        },
        user.getLocale(),
        {
          'transactionId': transaction.getID(),
          'connectorId': transaction.getConnectorId()
        }
      );
    }
  }
}

module.exports = OCPPService;
