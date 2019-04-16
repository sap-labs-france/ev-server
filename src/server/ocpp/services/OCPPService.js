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

const DEFAULT_CONSUMPTION_ATTRIBUTE = {
  unit: 'Wh',
  location: 'Outlet',
  measurand: 'Energy.Active.Import.Register',
  format: 'Raw',
  context: 'Sample.Periodic'
};

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
          chargingStation.setChargingStationURL(bootNotification.chargingStationURL);
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
          await updatedChargingStation.saveChargingStationSiteArea();
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
      await chargingStation.checkAndFreeConnector(statusNotification.connectorId, true);
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
      this._filterMeterValuesOnCharger(chargingStation, newMeterValues);
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

  // TODO: 
  _isSocMeterValue(meterValue) {
    return meterValue.attribute
      && (meterValue.attribute.context === 'Sample.Periodic'
        || meterValue.attribute.context === 'Transaction.Begin'
        || meterValue.attribute.context === 'Transaction.End')
      && meterValue.attribute.measurand === 'SoC';
  }

  // TODO: 
  _isConsumptionMeterValue(meterValue) {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === 'Energy.Active.Import.Register'
        && (meterValue.attribute.context === "Sample.Periodic" || meterValue.attribute.context === "Sample.Clock"));
  }

  // TODO:
  async updateWithMeterValue(meterValue) {
    // Get the last one
    const lastMeterValue = this.getLastMeterValue();
    // State of Charge?
    if (this.isSocMeterValue(meterValue)) {
      // Check for first SoC
      if (this.getStateOfCharge() === 0) {
        // Set First
        this.setStateOfCharge(meterValue.value);
      }
      // Set current
      this.setCurrentStateOfCharge(meterValue.value);
      // Consumption?
    } else if (this.isConsumptionMeterValue(meterValue)) {
      // Update
      this.setNumberOfMeterValues(this.getNumberOfMeterValues() + 1);
      this.setLastMeterValue({
        value: Utils.convertToInt(meterValue.value),
        timestamp: Utils.convertToDate(meterValue.timestamp).toISOString()
      });
      // Compute duration
      const diffSecs = moment(meterValue.timestamp).diff(lastMeterValue.timestamp, 'milliseconds') / 1000;
      // Check if the new value is greater
      if (Utils.convertToInt(meterValue.value) >= lastMeterValue.value) {
        // Compute consumption
        const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
        const consumption = meterValue.value - lastMeterValue.value;
        const currentConsumption = consumption * sampleMultiplier;
        // Update current consumption
        this.setCurrentConsumption(currentConsumption);
        this.setCurrentConsumptionWh(consumption);
        this.getModel().lastUpdate = meterValue.timestamp;
        this.setCurrentTotalConsumption(this.getCurrentTotalConsumption() + consumption);
        // Inactivity?
        if (consumption === 0) {
          this.setCurrentTotalInactivitySecs(this.getCurrentTotalInactivitySecs() + diffSecs);
        }
      } else {
        // Update current consumption
        this.setCurrentConsumption(0);
        this.setCurrentTotalInactivitySecs(this.getCurrentTotalInactivitySecs() + diffSecs);
      }
    }
    // Return the last meter value
    return lastMeterValue;
  }

  // TODO:
  remoteStop(tagId, timestamp) {
    this._model.remotestop = {};
    this._model.remotestop.tagID = tagId;
    this._model.remotestop.timestamp = timestamp;
  }

  // TODO:
  async buildConsumption(startedAt, endedAt, meterValue) {
    const consumption = {
      transactionId: this.getID(),
      connectorId: this.getConnectorId(),
      chargeBoxID: this.getChargeBoxID(),
      siteAreaID: this.getSiteAreaID(),
      siteID: this.getSiteID(),
      userID: this.getUserID(),
      endedAt: new Date(endedAt)
    };

    // SoC?
    if (this.isSocMeterValue(meterValue)) {
      // Set SoC
      consumption.stateOfCharge = this.getCurrentStateOfCharge();
    } else {
      // Set Consumption
      consumption.startedAt = new Date(startedAt);
      consumption.consumption = this.getCurrentConsumptionWh();
      consumption.instantPower = this.getCurrentConsumption();
      consumption.cumulatedConsumption = this.getCurrentTotalConsumption();
      consumption.totalInactivitySecs = this.getCurrentTotalInactivitySecs();
      consumption.totalDurationSecs = this.getCurrentTotalDurationSecs();
      consumption.stateOfCharge = this.getCurrentStateOfCharge();
    }
    // Return
    return consumption;
  }

  // TODO:
  async updateWithMeterValues(meterValues) {
    // Save Meter Values
    await TransactionStorage.saveMeterValues(this.getTenantID(), meterValues);
    // Process consumption
    const consumptions = [];
    for (const meterValue of meterValues.values) {
      // Update Transaction with Meter Values
      const lastMeterValue = await this.updateWithMeterValue(meterValue);
      // Compute consumption
      let consumption = await this.buildConsumption(lastMeterValue.timestamp, meterValue.timestamp, meterValue);
      const consumptionToUpdateWith = consumptions.find(c => c.endedAt.getTime() === consumption.endedAt.getTime());
      consumption.toPrice = this.isConsumptionMeterValue(meterValue);
      if (consumptionToUpdateWith) {
        consumptions.slice(consumptions.indexOf(consumptionToUpdateWith, 1));
        consumption = {...consumptionToUpdateWith, ...consumption};
      }
      consumptions.push(consumption);
    }
    for (const consumption of consumptions) {
      if (consumption.toPrice) {
        // Update the price
        await this.computePricing(consumption, 'update');
      }
      // Save Consumption
      await this.saveConsumption(consumption);
    }
  }

  // TODO:
  async stopTransaction(userID, tagId, meterStop, timestamp) {
    // Create Stop
    this._model.stop = {};
    this._model.stop.meterStop = meterStop;
    this._model.stop.timestamp = timestamp;
    this._model.stop.userID = userID;
    this._model.stop.tagID = tagId;
    this._model.stop.stateOfCharge = this.getCurrentStateOfCharge();
    // Get the last one
    const lastMeterValue = this.getLastMeterValue();
    // Compute duration
    const diffSecs = moment(timestamp).diff(lastMeterValue.timestamp, 'milliseconds') / 1000;
    // Check if the new value is greater
    if (Utils.convertToInt(meterStop) >= lastMeterValue.value) {
      // Compute consumption
      const consumption = meterStop - lastMeterValue.value;
      const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
      const currentConsumption = consumption * sampleMultiplier;
      // Update current consumption
      this.setCurrentConsumption(currentConsumption);
      this.setCurrentTotalConsumption(this.getCurrentTotalConsumption() + consumption);
      this.setCurrentConsumptionWh(consumption);
      // Inactivity?
      if (consumption === 0) {
        this.setCurrentTotalInactivitySecs(this.getCurrentTotalInactivitySecs() + diffSecs);
      }
    } else {
      // Update current consumption
      this.setCurrentConsumption(0);
      this.setCurrentTotalInactivitySecs(this.getCurrentTotalInactivitySecs() + diffSecs);
    }
    // Set Total data
    this._model.stop.totalConsumption = this.getCurrentTotalConsumption();
    this._model.stop.totalInactivitySecs = this.getCurrentTotalInactivitySecs();
    this._model.stop.totalDurationSecs = Math.round(moment.duration(moment(timestamp).diff(moment(this.getStartDate()))).asSeconds());
    // No Duration?
    if (this._model.stop.totalDurationSecs === 0) {
      // Compute it from now
      this._model.stop.totalDurationSecs = Math.round(moment.duration(moment().diff(moment(this.getStartDate()))).asSeconds());
      this._model.stop.totalInactivitySecs = this._model.stop.totalDurationSecs;
    }
    const meterValueData = {
      id: '6969',
      connectorId: this.getConnectorId(),
      transactionId: this.getID(),
      timestamp: timestamp,
      value: meterStop,
      attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
    };

    // Build final consumption
    const consumption = await this.buildConsumption(lastMeterValue.timestamp, timestamp, meterValueData);
    // Update the price
    await this.computePricing(consumption, 'stop');
    // Save Consumption
    await this.saveConsumption(consumption);
    // Remove runtime data
    delete this._model.currentConsumption;
    delete this._model.currentStateOfCharge;
    delete this._model.currentTotalConsumption;
    delete this._model.currentTotalInactivitySecs;
    delete this._model.currentCumulatedPrice;
    delete this._model.lastMeterValue;
    delete this._model.numberOfMeterValues;
  }

  // TODO:
  async computePricing(consumption, action) {
    let pricedConsumption;
    // Get the pricing impl
    const pricingImpl = await this.getPricingImpl();
    switch (action) {
      // Start Transaction
      case 'start':
        // Active?
        if (pricingImpl) {
          // Set
          pricedConsumption = await pricingImpl.startSession(consumption);
          // Set the initial pricing
          this._model.price = pricedConsumption.amount;
          this._model.roundedPrice = pricedConsumption.roundedAmount;
          this._model.priceUnit = pricedConsumption.currencyCode;
          this._model.pricingSource = pricedConsumption.pricingSource;
          // Init the cumulated price
          this._model.currentCumulatedPrice = pricedConsumption.amount;
        } else {
          // Default
          this._model.price = 0;
          this._model.roundedPrice = 0;
          this._model.priceUnit = "";
          this._model.pricingSource = "";
        }
        break;
      // Meter Values
      case 'update':
        // Active?
        if (pricingImpl) {
          // Set
          pricedConsumption = await pricingImpl.updateSession(consumption);
          // Update consumption
          consumption.amount = pricedConsumption.amount;
          consumption.roundedAmount = pricedConsumption.roundedAmount;
          consumption.currencyCode = pricedConsumption.currencyCode;
          consumption.pricingSource = pricedConsumption.pricingSource;
          if (pricedConsumption.cumulatedAmount) {
            consumption.cumulatedAmount = pricedConsumption.cumulatedAmount;
          } else {
            consumption.cumulatedAmount = parseFloat((this.getCurrentCumulatedPrice() + consumptionData.amount).toFixed(6));
          }
          // Keep latest
          this._model.currentCumulatedPrice = consumption.cumulatedAmount;
        }
        break;
      // Stop Transaction
      case 'stop':
        // Active?
        if (pricingImpl) {
          // Set
          pricedConsumption = await pricingImpl.stopSession(consumption);
          // Update consumption
          consumption.amount = pricedConsumption.amount;
          consumption.roundedAmount = pricedConsumption.roundedAmount;
          consumption.currencyCode = pricedConsumption.currencyCode;
          consumption.pricingSource = pricedConsumption.pricingSource;
          if (pricedConsumption.cumulatedAmount) {
            consumption.cumulatedAmount = pricedConsumption.cumulatedAmount;
          } else {
            consumption.cumulatedAmount = parseFloat((this.getCurrentCumulatedPrice() + consumption.amount).toFixed(6));
          }
          this._model.currentCumulatedPrice = consumption.cumulatedAmount;
          // Update Transaction
          this._model.stop.price = parseFloat(this.getCurrentCumulatedPrice().toFixed(6));
          this._model.stop.roundedPrice = (this.getCurrentCumulatedPrice()).toFixed(2);
          this._model.stop.priceUnit = pricedConsumption.currencyCode;
          this._model.stop.pricingSource = pricedConsumption.pricingSource;
        }
        break;
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
      chargingStation.cleanupConnectorTransactionInfo(transaction.getConnectorId());
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
    const totalInactivitySecs = transaction.getTotalInactivitySecs();
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
  
  _filterMeterValuesOnCharger(chargingStation, meterValues) {
    // Clean up Sample.Clock meter value
    if (chargingStation.getChargePointVendor() !== Constants.CHARGER_VENDOR_ABB ||
        chargingStation.getOcppVersion() !== Constants.OCPP_VERSION_15) {
      // Filter Sample.Clock meter value for all chargers except ABB using OCPP 1.5
      meterValues.values = meterValues.values.filter(meterValue => {
        // Remove Sample Clock
        if (meterValue.attribute.context === 'Sample.Clock') {
          // Log
          Logging.logWarning({
            tenantID: chargingStation.getTenantID(),
            source: chargingStation.getID(), module: 'OCPPService', method: '_filterMeterValuesOnCharger',
            action: 'MeterValues',
            message: `Removed Meter Value with attribute context 'Sample.Clock'`,
            detailedMessages: meterValue
          });
          return false;
        }
        return true;
      });
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
    };
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
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(
        startTransaction.chargeBoxIdentity, startTransaction.tenantID);
      // Check props
      OCPPValidation.validateStartTransaction(chargingStation, startTransaction);
      // Check Connector ID
      if (!chargingStation.getConnector(startTransaction.connectorId)) {
        throw new BackendError(chargingStation.getID(),
          `The Connector ID '${startTransaction.connectorId}' is invalid`,
          'OCPPService', 'handleStartTransaction', Constants.ACTION_START_TRANSACTION);
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
      // Init
      transaction.setNumberOfMeterValues(0);
      transaction.setLastMeterValue({value: this.getMeterStart(), timestamp: this.getStartDate()});
      transaction.setCurrentTotalInactivitySecs(0);
      transaction.setCurrentStateOfCharge(0);
      transaction.setStateOfCharge(0);
      transaction.setCurrentConsumption(0);
      transaction.setCurrentTotalConsumption(0);
      transaction.setCurrentConsumptionWh(0);
      transaction.setUser(user);
      // Build consumption
      const consumption = await this.buildConsumption(this.getStartDate(), this.getStartDate(), {
        id: '666',
        connectorId: this.getConnectorId(),
        transactionId: this.getID(),
        timestamp: this.getStartDate(),
        value: this.getMeterStart(),
        attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
      });
    // Update the price
    await this.computePricing(consumption, 'start');

    await transaction.startTransaction(user);
      // Save it
      transaction = await transaction.save();
      // Lock the other connectors?
      if (!chargingStation.canChargeInParallel()) {
        // Yes
        OCPPUtils.lockAllConnectors(chargingStation);
      }
      // Clean up connector transaction info
      chargingStation.cleanupConnectorTransactionInfo(transaction.getConnectorId());
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
          action: Constants.ACTION_START_TRANSACTION, user: user.getModel(),
          message: `Transaction ID '${transaction.getID()}' has been started on Connector '${transaction.getConnectorId()}'`
        });
      } else {
        // Log
        Logging.logInfo({
          tenantID: chargingStation.getTenantID(), source: chargingStation.getID(),
          module: 'OCPPService', method: 'handleStartTransaction', action: Constants.ACTION_START_TRANSACTION,
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
      Logging.logActionExceptionMessage(startTransaction.tenantID, Constants.ACTION_START_TRANSACTION, error);
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
        action: Constants.ACTION_DATA_TRANSFER, message: `Data Transfer has been saved`
      });
      // Return
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = dataTransfer.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(dataTransfer.tenantID, Constants.ACTION_DATA_TRANSFER, error);
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
          'OCPPService', 'handleStopTransaction', Constants.ACTION_STOP_TRANSACTION);
      }
      // Get the TagID that stopped the transaction
      const tagId = this._getStopTransactionTagId(stopTransaction, transaction);
      // Check and get users
      const { user, alternateUser } = await Authorizations.isTagIDsAuthorizedOnChargingStation(
        chargingStation, tagId, transaction.getTagID(), Constants.ACTION_STOP_TRANSACTION);
      // Check if the transaction has already been stopped
      if (!transaction.isActive()) {
        throw new BackendError(chargingStation.getID(),
          `Transaction ID '${stopTransaction.transactionId}' has already been stopped`,
          'OCPPService', "handleStopTransaction", Constants.ACTION_STOP_TRANSACTION,
          (alternateUser ? alternateUser.getID() : (user ? user.getID() : null)),
          (alternateUser ? (user ? user.getID() : null) : null));
      }
      // Check and free the connector
      await chargingStation.checkAndFreeConnector(transaction.getConnectorId(), false);
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
        action: Constants.ACTION_STOP_TRANSACTION, 
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
      Logging.logActionExceptionMessage(stopTransaction.tenantID, Constants.ACTION_STOP_TRANSACTION, error);
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
      return stopTransaction.idTag;
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
