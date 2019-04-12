const NotificationHandler = require('../../../notification/NotificationHandler');
const ChargingStationService = require('./ChargingStationService');
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
require('source-map-support').install();

class ChargingStationService16 extends ChargingStationService {
  // Common constructor for Central System Service
  constructor(centralSystemConfig, chargingStationConfig) {
    super(centralSystemConfig, chargingStationConfig);
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
            "ChargingStationService16", "handleBootNotification", "BootNotification");
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
        module: 'ChargingStationService16', method: 'handleBootNotification',
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
      // Check props
      OCPPValidation.validateHeartbeat(heartbeat);
      // Get Charging Station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(heartbeat.chargeBoxIdentity, heartbeat.tenantID);
      // Set Heartbeat
      chargingStation.setLastHeartBeat(new Date());
      // Save
      await chargingStation.saveHeartBeat();
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.getID(),
        module: 'ChargingStationService16', method: 'handleHeartbeat',
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
      // Check props
      OCPPValidation.validateStatusNotification(statusNotification);
      // Get charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(statusNotification.chargeBoxIdentity, statusNotification.tenantID);
      // Set Header
      statusNotification.chargeBoxID = chargingStation.getID();
      statusNotification.timezone = chargingStation.getTimezone();
      // Handle connectorId = 0 case => Currently status is distributed to each individual connectors
      if (statusNotification.connectorId === 0) {
        // Log
        Logging.logWarning({
          tenantID: chargingStation.getTenantID(),
          source: chargingStation.getID(), module: 'ChargingStationService16',
          method: 'handleStatusNotification', action: 'StatusNotification',
          message: `Connector ID is '0' with status '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
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
        module: 'ChargingStationService16', method: 'handleStatusNotification', action: 'StatusNotification',
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
      module: 'ChargingStationService16', method: 'handleStatusNotification', action: 'StatusNotification',
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
      // Cleanup connector transaction data
      OCPPUtils.cleanupConnectorTransactionInfo(chargingStation, statusNotification.connectorId);
      // Check transaction
      const activeTransaction = await Transaction.getActiveTransaction(chargingStation.getTenantID(), chargingStation.getID(), statusNotification.connectorId);
      // Found?
      if (activeTransaction) {
        // Has consumption?
        if (activeTransaction.getCurrentTotalConsumption() <= 0) {
          // No consumption: delete
          Logging.logError({
            tenantID: chargingStation.getTenantID(),
            source: chargingStation.getID(), module: 'ChargingStationService16', method: '_checkStatusNotificationOngoingTransaction',
            action: 'StartTransaction', actionOnUser: activeTransaction.getUserID(),
            message: `Pending Transaction ID '${activeTransaction.getID()}' has been deleted on Connector '${activeTransaction.getConnectorId()}'`
          });
          // Delete
          await activeTransaction.delete();
        } else {
          // Has consumption: close it!
          Logging.logWarning({
            tenantID: chargingStation.getTenantID(),
            source: chargingStation.getID(), module: 'ChargingStationService16', method: '_checkStatusNotificationOngoingTransaction',
            action: 'StatusNotification', actionOnUser: activeTransaction.getUserID(),
            message: `Active Transaction ID '${activeTransaction.getID()}' has been closed on Connector '${activeTransaction.getConnectorId()}'`
          });
          // Stop
          await activeTransaction.stopTransaction(activeTransaction.getUserID(), activeTransaction.getTagID(),
            activeTransaction.getLastMeterValue().value + 1, new Date(statusNotification.timestamp));
          // Save Transaction
          await activeTransaction.save();
        }
        // Clean up connector
        await OCPPUtils.checkAndFreeConnector(chargingStation, activeTransaction.getConnectorId(), true);
      }
    }
  }

  async _notifyStatusNotification(chargingStation, statusNotification) {
    // Faulted?
    if (statusNotification.status === Constants.CONN_STATUS_FAULTED) {
      // Log
      Logging.logError({
        tenantID: chargingStation.getTenantID(), source: chargingStation.getID(), module: 'ChargingStationService16',
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

  async handleMeterValues(payload) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenantID);
      // Save
      await chargingStation.handleMeterValues(payload);
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(payload.tenantID, 'MeterValues', error);
      // Response
      return {};
    }
  }

  async handleAuthorize(authorize) {
    try {
      // Check props
      OCPPValidation.validateAuthorize(authorize);
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(authorize.chargeBoxIdentity, authorize.tenantID);
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
        source: chargingStation.getID(), module: 'ChargingStation', method: 'handleAuthorize',
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

  async handleDiagnosticsStatusNotification(payload) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenantID);
      // Save
      await chargingStation.handleDiagnosticsStatusNotification(payload);
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(payload.tenantID, 'DiagnosticsStatusNotification', error);
      return {};
    }
  }

  async handleFirmwareStatusNotification(payload) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenantID);
      // Save
      await chargingStation.handleFirmwareStatusNotification(payload);
      // Return
      return {};
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(payload.tenantID, 'FirmwareStatusNotification', error);
      return {};
    }
  }

  async handleStartTransaction(payload) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenantID);
      // Save
      const transaction = await chargingStation.handleStartTransaction(payload);
      // Return
      return {
        'transactionId': transaction.getID(),
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(payload.tenantID, 'StartTransaction', error);
      return {
        'transactionId': 0,
        'status': 'Invalid'
      };
    }
  }

  async handleDataTransfer(payload) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenantID);
      // Save
      await chargingStation.handleDataTransfer(payload);
      // Return
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(payload.tenantID, 'DataTransfer', error);
      return {
        'status': 'Rejected'
      };
    }
  }

  async handleStopTransaction(payload) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenantID);
      // Handle
      await chargingStation.handleStopTransaction(payload);
      // Success
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(payload.tenantID, 'StopTransaction', error);
      // Error
      return {
        'status': 'Invalid'
      };
    }
  }
}

module.exports = ChargingStationService16;
