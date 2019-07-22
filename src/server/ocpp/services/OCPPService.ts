import momentDurationFormatSetup from 'moment-duration-format'; // TODO: what?
import Authorizations from '../../../authorization/Authorizations';
import BackendError from '../../../exception/BackendError';
import ChargingStation from '../../../types/ChargingStation';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import NotificationHandler from '../../../notification/NotificationHandler';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import OCPPUtils from '../utils/OCPPUtils';
import OCPPValidation from '../validation/OCPPValidation';
import PricingFactory from '../../../integration/pricing/PricingFactory';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import Transaction from '../../../entity/Transaction';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ChargingStationService from '../../rest/service/ChargingStationService';

// FIXME
const moment = require('moment');
momentDurationFormatSetup(moment);
const _configChargingStation = Configuration.getChargingStationConfig();

const DEFAULT_CONSUMPTION_ATTRIBUTE = {
  unit: 'Wh',
  location: 'Outlet',
  measurand: 'Energy.Active.Import.Register',
  format: 'Raw',
  context: 'Sample.Periodic'
};
export default class OCPPService {
  private chargingStationConfig: any;

  public constructor(chargingStationConfig = null) {
    this.chargingStationConfig = chargingStationConfig;
  }

  async handleBootNotification(headers, bootNotification) {
    try {
      // Check props
      OCPPValidation.getInstance().validateBootNotification(bootNotification);
      // Set the endpoint
      if (headers.From) {
        bootNotification.endpoint = headers.From.Address;
      }
      // Set the ChargeBox ID
      if (!headers.chargeBoxIdentity) {
        throw new BackendError(Constants.CENTRAL_SERVER,
          'Should have the required property \'chargeBoxIdentity\'!',
          'OCPPUtils', '_checkAndGetChargingStation');
      }
      bootNotification.id = headers.chargeBoxIdentity;
      // Set the default Heart Beat
      bootNotification.lastReboot = new Date();
      bootNotification.lastHeartBeat = bootNotification.lastReboot;
      bootNotification.timestamp = bootNotification.lastReboot;
      // Get the charging station
      let chargingStation = await ChargingStationStorage.getChargingStation(headers.tenantID, headers.chargeBoxIdentity);
      if (!chargingStation) {
        // New Charging Station: Create
        chargingStation = bootNotification; // TODO: VERIFY THIS. WHAT IS BOOT NOTIFICATION?
        // Update timestamp
        chargingStation.createdOn = new Date();
      } else {
        // Existing Charging Station: Update
        // Check if same vendor and model
        if (chargingStation.chargePointVendor !== bootNotification.chargePointVendor ||
          chargingStation.chargePointModel !== bootNotification.chargePointModel) {
          // Double check on Serial Number
          if (!chargingStation.chargePointSerialNumber || !bootNotification.chargePointSerialNumber ||
            chargingStation.chargePointSerialNumber !== bootNotification.chargePointSerialNumber) {
            // Not the same charger!
            throw new BackendError(
              chargingStation.id,
              `Registration rejected: Vendor, Model or Serial Number attribute is different: '${bootNotification.chargePointVendor}' / '${bootNotification.chargePointModel} / ${bootNotification.chargePointSerialNumber}'! Expected '${chargingStation.chargePointVendor}' / '${chargingStation.chargePointModel}' / '${chargingStation.chargePointSerialNumber}'`,
              'OCPPService', 'handleBootNotification', 'BootNotification');
          }
        }
        chargingStation.chargePointSerialNumber = bootNotification.chargePointSerialNumber;
        chargingStation.chargeBoxSerialNumber = bootNotification.chargeBoxSerialNumber;
        chargingStation.firmwareVersion = bootNotification.firmwareVersion;
        chargingStation.lastReboot = bootNotification.lastReboot;
        // Back again
        chargingStation.deleted = false;
      }

      chargingStation.ocppVersion = headers.ocppVersion;
      chargingStation.ocppProtocol = headers.ocppProtocol;
      chargingStation.lastHeartBeat = bootNotification.lastHeartBeat;
      // Set the charger URL?
      if (headers.chargingStationURL) {
        chargingStation.chargingStationURL = headers.chargingStationURL;
      }

      // Save Charging Station
      await ChargingStationStorage.saveChargingStation(headers.tenantID, chargingStation);

      // Send Notification
      NotificationHandler.sendChargingStationRegistered(
        headers.tenantID,
        Utils.generateGUID(),
        chargingStation,
        {
          'chargeBoxID': chargingStation.id,
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(headers.tenantID)).getSubdomain()),
          'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(chargingStation, '#all')
        }
      );
      // Save Boot Notification
      await OCPPStorage.saveBootNotification(headers.tenantID, bootNotification);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID,
        source: chargingStation.id,
        module: 'OCPPService', method: 'handleBootNotification',
        action: 'BootNotification', message: 'Boot notification saved'
      });
      // Handle the get of configuration later on
      setTimeout(() => {
        // Get config and save it
        ChargingStationService.requestAndSaveConfiguration();
      }, 3000);
      // Return the result
      return {
        'currentTime': bootNotification.timestamp.toISOString(),
        'status': 'Accepted',
        'heartbeatInterval': this.chargingStationConfig.heartbeatIntervalSecs
      };
    } catch (error) {
      // Log error
      error.source = headers.chargeBoxIdentity;
      Logging.logActionExceptionMessage(headers.tenantID, 'BootNotification', error);
      // Reject
      return {
        'status': 'Rejected',
        'currentTime': bootNotification.timestamp ? bootNotification.timestamp.toISOString() : new Date().toISOString(),
        'heartbeatInterval': this.chargingStationConfig.heartbeatIntervalSecs
      };
    }
  }

  async handleHeartbeat(headers, heartbeat) {
    try {
      // Get Charging Station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateHeartbeat(heartbeat);
      // Set Heartbeat
      chargingStation.setLastHeartBeat(new Date());
      // Save
      await chargingStation.saveHeartBeat();
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.id,
        module: 'OCPPService', method: 'handleHeartbeat',
        action: 'Heartbeat', message: 'Heartbeat saved'
      });
      // Return
      return {
        'currentTime': chargingStation.getLastHeartBeat().toISOString()
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, 'HeartBeat', error);
      // Send the response
      return {
        'currentTime': new Date().toISOString()
      };
    }
  }

  async handleStatusNotification(headers, statusNotification) {
    try {
      // Get charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateStatusNotification(statusNotification);
      // Set Header
      statusNotification.chargeBoxID = chargingStation.id;
      statusNotification.timezone = chargingStation.getTimezone();
      // Handle connectorId = 0 case => Currently status is distributed to each individual connectors
      if (statusNotification.connectorId === 0) {
        // Ignore EBEE charger
        if (chargingStation.getChargePointVendor() !== Constants.CHARGER_VENDOR_EBEE) {
          // Log
          Logging.logInfo({
            tenantID: chargingStation.getTenantID(),
            source: chargingStation.id, module: 'OCPPService',
            method: 'handleStatusNotification', action: 'StatusNotification',
            message: `Connector ID '0' received with status '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
          });
          // Get the connectors
          const connectors = chargingStation.getConnectors();
          // Update ALL connectors
          for (let i = 0; i < connectors.length; i++) {
            // Update message with proper connectorId
            statusNotification.connectorId = connectors[i].connectorId;
            // Update
            await this._updateConnectorStatus(chargingStation, statusNotification, true);
          }
        } else {
          // Do not take connector '0' into account for EBEE
          Logging.logWarning({
            tenantID: chargingStation.getTenantID(),
            source: chargingStation.id, module: 'OCPPService',
            method: 'handleStatusNotification', action: 'StatusNotification',
            message: `Ignored EBEE with Connector ID '0' with status '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
          });
        }
      } else {
        // Update only the given connectorId
        await this._updateConnectorStatus(chargingStation, statusNotification, false);
      }
      // Respond
      return {};
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, 'StatusNotification', error);
      // Return
      return {};
    }
  }

  async _updateConnectorStatus(tenantID: string, chargingStation: ChargingStation, statusNotification, bothConnectorsUpdated) {
    // Get it
    let connector = chargingStation.connectors[statusNotification.connectorId]; // TODO: Is it really an array or is it a search? Might be search. FIXME
    if (!connector) {
      // Does not exist: Create
      connector = { connectorId: statusNotification.connectorId, currentConsumption: 0, status: 'Unknown', power: 0, type: Constants.CONNECTOR_TYPES.UNKNOWN };
      chargingStation.connectors.push(connector);
    }
    // Check if status has changed
    if (connector.status === statusNotification.status &&
      connector.errorCode === statusNotification.errorCode) {
      // No Change: Do not save it
      Logging.logWarning({
        tenantID: tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'handleStatusNotification', action: 'StatusNotification',
        message: `Status on Connector '${statusNotification.connectorId}' has not changed then not saved: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}''`
      });
      return;
    }
    // Check for inactivity
    await this._checkStatusNotificationInactivity(chargingStation, statusNotification, connector);
    // Set connector data
    connector.connectorId = statusNotification.connectorId;
    connector.status = statusNotification.status;
    connector.errorCode = statusNotification.errorCode;
    connector.info = (statusNotification.info ? statusNotification.info : '');
    connector.vendorErrorCode = (statusNotification.vendorErrorCode ? statusNotification.vendorErrorCode : '');
    // Save Status Notification
    await OCPPStorage.saveStatusNotification(tenantID, statusNotification);
    // Log
    Logging.logInfo({
      tenantID: tenantID, source: chargingStation.id,
      module: 'OCPPService', method: 'handleStatusNotification', action: 'StatusNotification',
      message: `Connector '${statusNotification.connectorId}' status '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}' has been saved`
    });
    // Check if transaction is ongoing (ABB bug)!!!
    await this._checkStatusNotificationOngoingTransaction(chargingStation, statusNotification, connector, bothConnectorsUpdated);
    // Notify admins
    this._notifyStatusNotification(chargingStation, statusNotification);
    // Save Connector
    await ChargingStationStorage.saveChargingStationConnector(tenantID, chargingStation, statusNotification.connectorId);
  }

  async _checkStatusNotificationInactivity(chargingStation, statusNotification, connector) {
    // Check Inactivity
    // OCPP 1.6: Finishing --> Available
    if (connector.status === Constants.CONN_STATUS_FINISHING &&
      statusNotification.status === Constants.CONN_STATUS_AVAILABLE &&
      statusNotification.hasOwnProperty('timestamp')) {
      // Get the last transaction
      const lastTransaction = await Transaction.getLastTransaction(
        chargingStation.getTenantID(), chargingStation.id, connector.connectorId);
      // FInished?
      if (lastTransaction && lastTransaction.isFinished()) {
        // Compute Extra inactivity
        const transactionStopTimestamp = lastTransaction.getStopDate();
        const statusNotifTimestamp = new Date(statusNotification.timestamp);
        const extraInactivitySecs = Math.floor((statusNotifTimestamp.getTime() - transactionStopTimestamp.getTime()) / 1000);
        lastTransaction.setStopExtraInactivitySecs(extraInactivitySecs);
        // Save
        await lastTransaction.save();
      }
    }
  }

  async _checkStatusNotificationOngoingTransaction(chargingStation, statusNotification, connector, bothConnectorsUpdated) {
    // Check the status
    if (!bothConnectorsUpdated &&
      connector.activeTransactionID > 0 &&
      (statusNotification.status === Constants.CONN_STATUS_AVAILABLE || statusNotification.status === Constants.CONN_STATUS_FINISHING)) {
      // Cleanup ongoing transactions on the connector
      await this._stopOrDeleteActiveTransactions(
        chargingStation.getTenantID(), chargingStation.id, statusNotification.connectorId);
      // Clean up connector
      await chargingStation.checkAndFreeConnector(statusNotification.connectorId, true);
    }
  }

  async _notifyStatusNotification(chargingStation, statusNotification) {
    // Faulted?
    if (statusNotification.status === Constants.CONN_STATUS_FAULTED) {
      // Log
      Logging.logError({
        tenantID: chargingStation.getTenantID(), source: chargingStation.id, module: 'OCPPService',
        method: '_notifyStatusNotification', action: 'StatusNotification',
        message: `Error on Connector '${statusNotification.connectorId}': '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}'`
      });
      // Send Notification
      NotificationHandler.sendChargingStationStatusError(
        chargingStation.getTenantID(),
        Utils.generateGUID(),
        chargingStation.getModel(),
        {
          'chargeBoxID': chargingStation.id,
          'connectorId': statusNotification.connectorId,
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${(statusNotification.info ? statusNotification.info : 'N/A')}`,
          'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain()),
          'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(chargingStation, '#inerror')
        },
        {
          'connectorId': statusNotification.connectorId,
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${statusNotification.info}`,
        }
      );
    }
  }

  async handleMeterValues(headers, meterValues) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateMeterValues(chargingStation, meterValues);
      // Normalize Meter Values
      const newMeterValues = this._normalizeMeterValues(chargingStation, meterValues);
      // Handle charger's specificities
      this._filterMeterValuesOnCharger(chargingStation, newMeterValues);
      // No Values?
      if (newMeterValues.values.length === 0) {
        Logging.logDebug({
          tenantID: chargingStation.getTenantID(),
          source: chargingStation.id, module: 'OCPPService', method: 'handleMeterValues',
          action: 'MeterValues', message: 'No relevant MeterValues to save',
          detailedMessages: meterValues
        });
        // Process values
      } else {
        // Handle Meter Value only for transaction
        // eslint-disable-next-line no-lonely-if
        if (meterValues.transactionId) {
          // Get the transaction
          const transaction = await Transaction.getTransaction(chargingStation.getTenantID(), meterValues.transactionId);
          // Handle Meter Values
          await this._updateTransactionWithMeterValues(transaction, newMeterValues);
          // Save Transaction
          await transaction.save();
          // Update Charging Station Consumption
          await this._updateChargingStationConsumption(chargingStation, transaction);
          // Save Charging Station
          await chargingStation.save();
          // Log
          Logging.logInfo({
            tenantID: chargingStation.getTenantID(), source: chargingStation.id,
            module: 'OCPPService', method: 'handleMeterValues', action: 'MeterValues',
            message: `MeterValue have been saved for Transaction ID '${meterValues.transactionId}'`,
            detailedMessages: meterValues
          });
        } else {
          // Log
          Logging.logWarning({
            tenantID: chargingStation.getTenantID(), source: chargingStation.id,
            module: 'OCPPService', method: 'handleMeterValues', action: 'MeterValues',
            message: 'MeterValues is ignored as it is not linked to a transaction',
            detailedMessages: meterValues
          });
        }
      }
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, 'MeterValues', error);
      // Return
      return {};
    }
  }

  _buildConsumptionAndUpdateTransactionFromMeterValue(transaction, meterValue) {
    // Get the last one
    const lastMeterValue = transaction.getLastMeterValue();
    // State of Charge?
    if (OCPPUtils.isSocMeterValue(meterValue)) {
      // Set current
      transaction.setCurrentStateOfCharge(meterValue.value);
    // Consumption?
    } else if (OCPPUtils.isConsumptionMeterValue(meterValue)) {
      // Update
      transaction.setNumberOfConsumptionMeterValues(transaction.getNumberOfMeterValues() + 1);
      transaction.setLastConsumptionMeterValue({
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
        transaction.setCurrentConsumption(currentConsumption);
        transaction.setCurrentConsumptionWh(consumption);
        transaction.setLastUpdateDate(meterValue.timestamp);
        transaction.setCurrentTotalConsumption(transaction.getCurrentTotalConsumption() + consumption);
        // Inactivity?
        if (consumption === 0) {
          transaction.setCurrentTotalInactivitySecs(transaction.getCurrentTotalInactivitySecs() + diffSecs);
        }
      } else {
        // Update current consumption
        transaction.setCurrentConsumption(0);
        transaction.setCurrentTotalInactivitySecs(transaction.getCurrentTotalInactivitySecs() + diffSecs);
      }
    }
    // Compute consumption
    return this._buildConsumptionFromTransactionAndMeterValue(
      transaction, lastMeterValue.timestamp, meterValue.timestamp, meterValue);
  }

  _buildConsumptionFromTransactionAndMeterValue(transaction, startedAt, endedAt, meterValue) {
    // Only Consumption and SoC (No consumption for Transaction Begin/End: scenario already handled in Start/Stop Transaction)
    if (OCPPUtils.isSocMeterValue(meterValue) ||
      OCPPUtils.isConsumptionMeterValue(meterValue)) {
      // Init
      const consumption: any = {
        transactionId: transaction.getID(),
        connectorId: transaction.getConnectorId(),
        chargeBoxID: transaction.getChargeBoxID(),
        siteAreaID: transaction.getSiteAreaID(),
        siteID: transaction.getSiteID(),
        userID: transaction.getUserID(),
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt)
      };
      // SoC?
      if (OCPPUtils.isSocMeterValue(meterValue)) {
        // Set SoC
        consumption.stateOfCharge = transaction.getCurrentStateOfCharge();
      // Consumption
      } else {
        // Set Consumption
        consumption.consumption = transaction.getCurrentConsumptionWh();
        consumption.instantPower = Math.round(transaction.getCurrentConsumption());
        consumption.cumulatedConsumption = transaction.getCurrentTotalConsumption();
        consumption.totalInactivitySecs = transaction.getCurrentTotalInactivitySecs();
        consumption.totalDurationSecs = transaction.getCurrentTotalDurationSecs();
        consumption.stateOfCharge = transaction.getCurrentStateOfCharge();
        consumption.toPrice = true;
      }
      // Return
      return consumption;
    }
  }

  async _updateTransactionWithMeterValues(transaction, meterValues) {
    // Save Meter Values
    await OCPPStorage.saveMeterValues(transaction.getTenantID(), meterValues);
    // Build consumptions
    const consumptions = [];
    for (const meterValue of meterValues.values) {
      // Handles Signed Data values
      if (meterValue.attribute.format === 'SignedData') {
        if (meterValue.attribute.context === 'Transaction.Begin') {
          transaction.setSignedData(meterValue.value);
          continue;
        } else if (meterValue.attribute.context === 'Transaction.End') {
          transaction.setCurrentSignedData(meterValue.value);
          continue;
        }
      }
      // SoC handling
      if (meterValue.attribute.measurand === 'SoC') {
        // Set the first SoC
        if (meterValue.attribute.context === 'Transaction.Begin') {
          transaction.setStateOfCharge(meterValue.value);
          continue;
        // Set the Last SoC
        } else if (meterValue.attribute.context === 'Transaction.End') {
          transaction.setCurrentStateOfCharge(meterValue.value);
          continue;
        }
      }
      // Only Consumption Meter Value
      if (OCPPUtils.isSocMeterValue(meterValue) ||
        OCPPUtils.isConsumptionMeterValue(meterValue)) {
        // Build Consumption and Update Transaction with Meter Values
        const consumption = await this._buildConsumptionAndUpdateTransactionFromMeterValue(transaction, meterValue);
        if (consumption) {
          // Existing Consumption (SoC or Consumption MeterValue)?
          const existingConsumption = consumptions.find(
            (c) => {
              return c.endedAt.getTime() === consumption.endedAt.getTime();
            });
          if (existingConsumption) {
            // Update existing
            for (const property in consumption) {
              existingConsumption[property] = consumption[property];
            }
          } else {
            // Add
            consumptions.push(consumption);
          }
        }
      }
    }
    // Price the Consumptions
    for (const consumption of consumptions) {
      // Price
      if (consumption.toPrice) {
        await this._priceTransactionFromConsumption(transaction, consumption, 'update');
      }
      // Save
      await transaction.saveConsumption(consumption);
    }
  }

  async _priceTransactionFromConsumption(transaction, consumption, action) {
    let pricedConsumption;
    // Get the pricing impl
    const pricingImpl = await PricingFactory.getPricingImpl(transaction);
    switch (action) {
      // Start Transaction
      case 'start':
        // Active?
        if (pricingImpl) {
          // Set
          pricedConsumption = await pricingImpl.startSession(consumption);
          // Set the initial pricing
          transaction.setStartPrice(pricedConsumption.amount);
          transaction.setStartRoundedPrice(pricedConsumption.roundedAmount);
          transaction.setStartPriceUnit(pricedConsumption.currencyCode);
          transaction.setStartPricingSource(pricedConsumption.pricingSource);
          // Init the cumulated price
          transaction.setCurrentCumulatedPrice(pricedConsumption.amount);
        } else {
          // Default
          transaction.setStartPrice(0);
          transaction.setStartRoundedPrice(0);
          transaction.setStartPriceUnit('');
          transaction.setStartPricingSource('');
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
            consumption.cumulatedAmount = parseFloat((transaction.getCurrentCumulatedPrice() + consumption.amount).toFixed(6));
          }
          transaction.setCurrentCumulatedPrice(consumption.cumulatedAmount);
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
            consumption.cumulatedAmount = parseFloat((transaction.getCurrentCumulatedPrice() + consumption.amount).toFixed(6));
          }
          transaction.setCurrentCumulatedPrice(consumption.cumulatedAmount);
          // Update Transaction
          transaction.setStopPrice(parseFloat(transaction.getCurrentCumulatedPrice().toFixed(6)));
          transaction.setStopRoundedPrice(parseFloat((transaction.getCurrentCumulatedPrice()).toFixed(2)));
          transaction.setStopPriceUnit(pricedConsumption.currencyCode);
          transaction.setStopPricingSource(pricedConsumption.pricingSource);
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
      connector.totalInactivitySecs = transaction.getCurrentTotalInactivitySecs();
      connector.currentStateOfCharge = transaction.getCurrentStateOfCharge();
      connector.totalInactivitySecs = transaction.getCurrentTotalInactivitySecs();
      // Set Transaction ID
      connector.activeTransactionID = transaction.getID();
      // Update Heartbeat
      chargingStation.setLastHeartBeat(new Date());
      // Handle End Of charge
      await this._checkNotificationEndOfCharge(chargingStation, transaction);
    } else {
      // Cleanup connector transaction data
      await chargingStation.cleanupConnectorTransactionInfo(transaction.getConnectorId());
    }
    // Log
    Logging.logInfo({
      tenantID: chargingStation.getTenantID(),
      source: chargingStation.id, module: 'OCPPService',
      method: 'updateChargingStationConsumption', action: 'ChargingStationConsumption',
      message: `Connector '${connector.connectorId}' - Consumption ${connector.currentConsumption}, Total: ${connector.totalConsumption}, SoC: ${connector.currentStateOfCharge}`
    });
  }

  async _notifyEndOfCharge(chargingStation, transaction) {
    // Notify
    NotificationHandler.sendEndOfCharge(
      chargingStation.getTenantID(),
      transaction.getID() + '-EOC',
      transaction.getUserJson(),
      chargingStation.getModel(),
      {
        'user': transaction.getUserJson(),
        'chargeBoxID': chargingStation.id,
        'connectorId': transaction.getConnectorId(),
        'totalConsumption': (transaction.getCurrentTotalConsumption() / 1000).toLocaleString(
          (transaction.getUserJson().locale ? transaction.getUserJson().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
          { minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2 }),
        'stateOfCharge': transaction.getCurrentStateOfCharge(),
        'totalDuration': this._buildCurrentTransactionDuration(transaction),
        'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(chargingStation, transaction.getID(), '#inprogress'),
        'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain())
      },
      transaction.getUserJson().locale,
      {
        'transactionId': transaction.getID(),
        'connectorId': transaction.getConnectorId()
      }
    );
  }

  async _notifyOptimalChargeReached(chargingStation, transaction) {
    // Notifcation Before End Of Charge
    NotificationHandler.sendOptimalChargeReached(
      chargingStation.getTenantID(),
      transaction.getID() + '-OCR',
      transaction.getUserJson(),
      chargingStation.getModel(),
      {
        'user': transaction.getUserJson(),
        'chargeBoxID': chargingStation.id,
        'connectorId': transaction.getConnectorId(),
        'totalConsumption': (transaction.getCurrentTotalConsumption() / 1000).toLocaleString(
          (transaction.getUserJson().locale ? transaction.getUserJson().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
          { minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2 }),
        'stateOfCharge': transaction.getCurrentStateOfCharge(),
        'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(chargingStation, transaction.getID(), '#inprogress'),
        'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain())
      },
      transaction.getUserJson().locale,
      {
        'transactionId': transaction.getID(),
        'connectorId': transaction.getConnectorId()
      }
    );
  }

  async _checkNotificationEndOfCharge(chargingStation, transaction) {
    // Transaction in progress?
    if (transaction && transaction.isActive()) {
      // Has consumption?
      if (transaction.hasMultipleConsumptions()) {
        // End of charge?
        if (_configChargingStation.notifEndOfChargeEnabled &&
          (transaction.getCurrentTotalInactivitySecs() > 60 || transaction.getCurrentStateOfCharge() === 100)) {
          // Notify User?
          if (transaction.getUserJson()) {
            // Send Notification
            await this._notifyEndOfCharge(chargingStation, transaction);
          }
        // Optimal Charge? (SoC)
        } else if (_configChargingStation.notifBeforeEndOfChargeEnabled &&
          transaction.getCurrentStateOfCharge() >= _configChargingStation.notifBeforeEndOfChargePercent) {
          // Notify User?
          if (transaction.getUserJson()) {
            // Send Notification
            await this._notifyOptimalChargeReached(chargingStation, transaction);
          }
        }
      }
    }
  }

  // Build Inactivity
  _buildTransactionInactivity(transaction, i18nHourShort = 'h') {
    // Get total
    const totalInactivitySecs = transaction.getStopTotalInactivitySecs();
    // None?
    if (totalInactivitySecs === 0) {
      return `0${i18nHourShort}00 (0%)`;
    }
    // Build the inactivity percentage
    const totalInactivityPercent = Math.round((totalInactivitySecs * 100) / transaction.getStopTotalDurationSecs());
    // Format
    return moment.duration(totalInactivitySecs, 's').format(`h[${i18nHourShort}]mm`, { trim: false }) + ` (${totalInactivityPercent}%)`;
  }

  // Build duration
  _buildCurrentTransactionDuration(transaction) {
    return moment.duration(transaction.getCurrentTotalDurationSecs(), 's').format('h[h]mm', { trim: false });
  }

  // Build duration
  _buildTransactionDuration(transaction) {
    return moment.duration(transaction.getStopTotalDurationSecs(), 's').format('h[h]mm', { trim: false });
  }

  _filterMeterValuesOnCharger(chargingStation, meterValues) {
    // Clean up Sample.Clock meter value
    if (chargingStation.getChargePointVendor() !== Constants.CHARGER_VENDOR_ABB ||
      chargingStation.getOcppVersion() !== Constants.OCPP_VERSION_15) {
      // Filter Sample.Clock meter value for all chargers except ABB using OCPP 1.5
      meterValues.values = meterValues.values.filter((meterValue) => {
        // Remove Sample Clock
        if (meterValue.attribute.context === 'Sample.Clock') {
          // Log
          Logging.logWarning({
            tenantID: chargingStation.getTenantID(),
            source: chargingStation.id, module: 'OCPPService', method: '_filterMeterValuesOnCharger',
            action: 'MeterValues',
            message: 'Removed Meter Value with attribute context \'Sample.Clock\'',
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
    const newMeterValues: any = {};
    newMeterValues.values = [];
    newMeterValues.chargeBoxID = chargingStation.id;
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
      const newMeterValue: any = {};
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
            // Data is to be interpreted as integer/decimal numeric data
            if (newLocalMeterValue.attribute.format === 'Raw') {
              newLocalMeterValue.value = parseFloat(sampledValue.value);
            // Data is represented as a signed binary data block, encoded as hex data
            } else if (newLocalMeterValue.attribute.format === 'SignedData') {
              newLocalMeterValue.value = sampledValue.value;
            }
            // Add
            newMeterValues.values.push(newLocalMeterValue);
          }
        } else {
          // Add Attributes
          const newLocalMeterValue = JSON.parse(JSON.stringify(newMeterValue));
          newLocalMeterValue.attribute = this._buildMeterValueAttributes(value.sampledValue);
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
          newMeterValue.value = parseFloat(value.value);
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

  async handleAuthorize(headers, authorize) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateAuthorize(authorize);
      // Set header
      authorize.chargeBoxID = chargingStation.id;
      authorize.timestamp = new Date();
      authorize.timezone = chargingStation.getTimezone();
      // Check
      authorize.user = await Authorizations.isTagIDAuthorizedOnChargingStation(chargingStation, authorize.idTag, Constants.ACTION_AUTHORIZE);
      // Save
      await OCPPStorage.saveAuthorize(chargingStation.getTenantID(), authorize);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.id, module: 'OCPPService', method: 'handleAuthorize',
        action: 'Authorize', user: (authorize.user ? authorize.user : null),
        message: `User has been authorized with Badge ID '${authorize.idTag}'`
      });
      // Return
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, 'Authorize', error);
      return {
        'status': 'Invalid'
      };
    }
  }

  async handleDiagnosticsStatusNotification(headers, diagnosticsStatusNotification) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateDiagnosticsStatusNotification(chargingStation, diagnosticsStatusNotification);
      // Set the charger ID
      diagnosticsStatusNotification.chargeBoxID = chargingStation.id;
      diagnosticsStatusNotification.timestamp = new Date();
      diagnosticsStatusNotification.timezone = chargingStation.getTimezone();
      // Save it
      await OCPPStorage.saveDiagnosticsStatusNotification(chargingStation.getTenantID(), diagnosticsStatusNotification);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.id, module: 'OCPPService', method: 'handleDiagnosticsStatusNotification',
        action: 'DiagnosticsStatusNotification', message: 'Diagnostics Status Notification has been saved'
      });
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, 'DiagnosticsStatusNotification', error);
      return {};
    }
  }

  async handleFirmwareStatusNotification(headers, firmwareStatusNotification) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateFirmwareStatusNotification(chargingStation, firmwareStatusNotification);
      // Set the charger ID
      firmwareStatusNotification.chargeBoxID = chargingStation.id;
      firmwareStatusNotification.timestamp = new Date();
      firmwareStatusNotification.timezone = chargingStation.getTimezone();
      // Save it
      await OCPPStorage.saveFirmwareStatusNotification(chargingStation.getTenantID(), firmwareStatusNotification);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.id, module: 'OCPPService', method: 'handleFirmwareStatusNotification',
        action: 'FirmwareStatusNotification', message: 'Firmware Status Notification has been saved'
      });
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, 'FirmwareStatusNotification', error);
      return {};
    }
  }

  async handleStartTransaction(headers, startTransaction) {
    try {
      // Get the charging station
      const chargingStation: ChargingStation = await OCPPUtils.checkAndGetChargingStation(
        headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateStartTransaction(chargingStation, startTransaction);
      // Set the header
      startTransaction.chargeBoxID = chargingStation.id;
      startTransaction.tagID = startTransaction.idTag;
      startTransaction.timezone = chargingStation.getTimezone();
      // Check Authorization with Tag ID
      const user = await Authorizations.isTagIDAuthorizedOnChargingStation(headers.tenantID,
        chargingStation, startTransaction.tagID, Constants.ACTION_REMOTE_START_TRANSACTION);
      if (user) {
        startTransaction.user = user;
      }
      // Check Org
      const tenant = await TenantStorage.getTenant(chargingStation.getTenantID());
      const isOrgCompActive = await tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
      if (isOrgCompActive) {
        // Set the Site Area ID
        startTransaction.siteAreaID = chargingStation.getSiteAreaID();
        // Set the Site ID
        const site = await chargingStation.getSite();
        if (site) {
          startTransaction.siteID = site.id;
        }
      }
      // Cleanup ongoing transactions
      await this._stopOrDeleteActiveTransactions(
        chargingStation.getTenantID(), chargingStation.id, startTransaction.connectorId);
      // Create
      let transaction = new Transaction(chargingStation.getTenantID(), startTransaction);
      // Init
      transaction.setNumberOfConsumptionMeterValues(0);
      transaction.setLastConsumptionMeterValue({
        value: transaction.getMeterStart(),
        timestamp: transaction.getStartDate()
      });
      transaction.setCurrentTotalInactivitySecs(0);
      transaction.setCurrentStateOfCharge(0);
      transaction.setCurrentSignedData('');
      transaction.setStateOfCharge(0);
      transaction.setSignedData('');
      transaction.setCurrentConsumption(0);
      transaction.setCurrentTotalConsumption(0);
      transaction.setCurrentConsumptionWh(0);
      transaction.setUser(user);
      // Build first Dummy consumption for pricing the Start Transaction
      const consumption = await this._buildConsumptionFromTransactionAndMeterValue(
        transaction, transaction.getStartDate(), transaction.getStartDate(), {
          id: '666',
          connectorId: transaction.getConnectorId(),
          transactionId: transaction.getID(),
          timestamp: transaction.getStartDate(),
          value: transaction.getMeterStart(),
          attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
        }
      );
      // Price it
      await this._priceTransactionFromConsumption(transaction, consumption, 'start');
      // Save it
      transaction = await transaction.save();
      // Lock the other connectors?
      if (!chargingStation.canChargeInParallel()) {
        OCPPUtils.lockAllConnectors(chargingStation);
      }
      // Clean up Charger's connector transaction info
      chargingStation.cleanupConnectorTransactionInfo(transaction.getConnectorId());
      // Set the active transaction on the connector
      chargingStation.getConnector(transaction.getConnectorId()).activeTransactionID = transaction.getID();
      // Update Heartbeat
      chargingStation.setLastHeartBeat(new Date());
      // Save
      await chargingStation.save();
      // Log
      if (user) {
        await this._notifyStartTransaction(transaction, chargingStation, user);
        // Log
        Logging.logInfo({
          tenantID: chargingStation.getTenantID(),
          source: chargingStation.id, module: 'OCPPService', method: 'handleStartTransaction',
          action: 'StartTransaction', user: user,
          message: `Transaction ID '${transaction.getID()}' has been started on Connector '${transaction.getConnectorId()}'`
        });
      } else {
        // Log
        Logging.logInfo({
          tenantID: chargingStation.getTenantID(), source: chargingStation.id,
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
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, Constants.ACTION_REMOTE_START_TRANSACTION, error);
      return {
        'transactionId': 0,
        'status': 'Invalid'
      };
    }
  }

  async _stopOrDeleteActiveTransactions(tenantID, chargeBoxID, connectorId) {
    // Check
    let activeTransaction, lastCheckedTransactionID;
    do {
      // Check if the charging station has already a transaction
      activeTransaction = await Transaction.getActiveTransaction(tenantID, chargeBoxID, connectorId);
      // Exists already?
      if (activeTransaction) {
        // Avoid infinite Loop
        if (lastCheckedTransactionID === activeTransaction.getID()) {
          return;
        }
        // Has consumption?
        if (activeTransaction.getCurrentTotalConsumption() <= 0) {
          // No consumption: delete
          Logging.logWarning({
            tenantID: tenantID, source: chargeBoxID, module: 'OCPPService', method: '_stopOrDeleteActiveTransactions',
            action: 'CleanupTransaction', actionOnUser: activeTransaction.getUserID(),
            message: `Pending Transaction ID '${activeTransaction.getID()}' with no consumption has been deleted on Connector '${activeTransaction.getConnectorId()}'`
          });
          // Delete
          await activeTransaction.delete();
        } else {
          // Simulate a Stop Transaction
          const result = await this.handleStopTransaction({
            'tenantID': activeTransaction.getTenantID(),
            'chargeBoxIdentity': activeTransaction.getChargeBoxID()
          }, {
            'transactionId': activeTransaction.getID(),
            'meterStop': activeTransaction.getLastMeterValue().value,
            'timestamp': activeTransaction.getLastMeterValue().timestamp,
          }, false, true);
          // Check
          if (result.status === 'Invalid') {
            // No consumption: delete
            Logging.logError({
              tenantID: tenantID, source: chargeBoxID, module: 'OCPPService', method: '_stopOrDeleteActiveTransactions',
              action: 'CleanupTransaction', actionOnUser: activeTransaction.getUserID(),
              message: `Cannot delete pending Transaction ID '${activeTransaction.getID()}' with no consumption on Connector '${activeTransaction.getConnectorId()}'`
            });
          } else {
            // Has consumption: close it!
            Logging.logWarning({
              tenantID: tenantID, source: chargeBoxID, module: 'OCPPService', method: '_stopOrDeleteActiveTransactions',
              action: 'CleanupTransaction', actionOnUser: activeTransaction.getUserID(),
              message: `Pending Transaction ID '${activeTransaction.getID()}' has been stopped on Connector '${activeTransaction.getConnectorId()}'`
            });
          }
        }
        // Keep last Transaction ID
        lastCheckedTransactionID = activeTransaction.getID();
      }
    } while (activeTransaction);
  }

  async _notifyStartTransaction(transaction, chargingStation, user: User) {
    // Notify
    await NotificationHandler.sendTransactionStarted(
      chargingStation.getTenantID(),
      transaction.getID(),
      user,
      chargingStation.getModel(),
      {
        'user': user,
        'chargeBoxID': chargingStation.id,
        'connectorId': transaction.getConnectorId(),
        'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain()),
        'evseDashboardChargingStationURL':
          await Utils.buildEvseTransactionURL(chargingStation, transaction.getID(), '#inprogress')
      },
      user.locale,
      {
        'transactionId': transaction.getID(),
        'connectorId': transaction.getConnectorId()
      }
    );
  }

  async handleDataTransfer(headers, dataTransfer) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateDataTransfer(chargingStation, dataTransfer);
      // Set the charger ID
      dataTransfer.chargeBoxID = chargingStation.id;
      dataTransfer.timestamp = new Date();
      dataTransfer.timezone = chargingStation.getTimezone();
      // Save it
      await OCPPStorage.saveDataTransfer(chargingStation.getTenantID(), dataTransfer);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.id, module: 'OCPPService', method: 'handleDataTransfer',
        action: Constants.ACTION_DATA_TRANSFER, message: 'Data Transfer has been saved'
      });
      // Return
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, Constants.ACTION_DATA_TRANSFER, error);
      return {
        'status': 'Rejected'
      };
    }
  }

  async handleStopTransaction(headers, stopTransaction, isSoftStop = false, stoppedByCentralSystem = false) {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateStopTransaction(chargingStation, stopTransaction);
      // Set header
      stopTransaction.chargeBoxID = chargingStation.id;
      // Get the transaction
      let transaction = await Transaction.getTransaction(chargingStation.getTenantID(), stopTransaction.transactionId);
      if (!transaction) {
        // Wrong Transaction ID!
        throw new BackendError(chargingStation.id,
          `Transaction ID '${stopTransaction.transactionId}' does not exist`,
          'OCPPService', 'handleStopTransaction', Constants.ACTION_REMOTE_STOP_TRANSACTION);
      }
      // Get the TagID that stopped the transaction
      const tagId = this._getStopTransactionTagId(stopTransaction, transaction);
      let user: User, alternateUser: User;
      // Transaction is stopped by central system?
      if (!stoppedByCentralSystem) {
        // Check and get users
        const users = await Authorizations.isTagIDsAuthorizedOnChargingStation(headers.tenantID,
          chargingStation, tagId, transaction.getTagID(), Constants.ACTION_REMOTE_STOP_TRANSACTION);
        user = users.user;
        alternateUser = users.alternateUser;
      } else {
        // Get the user
        user = await UserStorage.getUserByTagId(chargingStation.getTenantID(), tagId);
      }
      // Check if the transaction has already been stopped
      if (!transaction.isActive()) {
        throw new BackendError(chargingStation.id,
          `Transaction ID '${stopTransaction.transactionId}' has already been stopped`,
          'OCPPService', 'handleStopTransaction', Constants.ACTION_REMOTE_STOP_TRANSACTION,
          (alternateUser ? alternateUser : user),
          (alternateUser ? (user ? user : null) : null));
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
      // Update the transaction
      const lastMeterValue = this._updateTransactionWithStopTransaction(
        transaction, stopTransaction, user, alternateUser, tagId);
      // Build final consumption
      const consumption = await this._buildConsumptionFromTransactionAndMeterValue(
        transaction, lastMeterValue.timestamp, transaction.getStopDate(), {
          id: '6969',
          connectorId: transaction.getConnectorId(),
          transactionId: transaction.getID(),
          timestamp: transaction.getStopDate(),
          value: transaction.getStopMeter(),
          attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
        }
      );
      // Update the price
      await this._priceTransactionFromConsumption(transaction, consumption, 'stop');
      // Save Consumption
      await transaction.saveConsumption(consumption);
      // Remove runtime data
      transaction.clearRuntimeData();
      // Save the transaction
      transaction = await transaction.save();
      // Notify User
      await this._notifyStopTransaction(chargingStation, transaction, user, alternateUser);
      // Log
      Logging.logInfo({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.id, module: 'OCPPService', method: 'handleStopTransaction',
        action: Constants.ACTION_REMOTE_STOP_TRANSACTION,
        user: (alternateUser ? alternateUser : (user ? user : null)),
        actionOnUser: (alternateUser ? (user ? user : null) : null),
        message: `Transaction ID '${transaction.getID()}' has been stopped successfully`
      });
      // Success
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, Constants.ACTION_REMOTE_STOP_TRANSACTION, error);
      // Error
      return { 'status': 'Invalid' };
    }
  }

  _updateTransactionWithStopTransaction(transaction, stopTransaction, user: User, alternateUser: User, tagId) {
    transaction.setStopMeter(Utils.convertToInt(stopTransaction.meterStop));
    transaction.setStopDate(new Date(stopTransaction.timestamp));
    transaction.setStopUserID((alternateUser ? alternateUser.id : (user ? user.id : null)));
    transaction.setStopTagID(tagId);
    transaction.setStopStateOfCharge(transaction.getCurrentStateOfCharge());
    transaction.setEndSignedData(transaction.getCurrentSignedData());
    // Keep the last Meter Value
    const lastMeterValue = transaction.getLastMeterValue();
    // Compute duration
    const diffSecs = moment(transaction.getStopDate()).diff(lastMeterValue.timestamp, 'milliseconds') / 1000;
    // Check if the new value is greater
    if (transaction.getStopMeter() >= lastMeterValue.value) {
      // Compute consumption
      const consumption = transaction.getStopMeter() - lastMeterValue.value;
      const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
      const currentConsumption = consumption * sampleMultiplier;
      // Update current consumption
      transaction.setCurrentConsumption(currentConsumption);
      transaction.setCurrentTotalConsumption(transaction.getCurrentTotalConsumption() + consumption);
      transaction.setCurrentConsumptionWh(consumption);
      // Inactivity?
      if (consumption === 0) {
        transaction.setCurrentTotalInactivitySecs(transaction.getCurrentTotalInactivitySecs() + diffSecs);
      }
    } else {
      // Update current consumption
      transaction.setCurrentConsumption(0);
      transaction.setCurrentTotalInactivitySecs(transaction.getCurrentTotalInactivitySecs() + diffSecs);
    }
    // Set Total data
    transaction.setStopTotalConsumption(transaction.getCurrentTotalConsumption());
    transaction.setStopTotalInactivitySecs(transaction.getCurrentTotalInactivitySecs());
    transaction.setStopTotalDurationSecs(Math.round(moment.duration(moment(transaction.getStopDate()).diff(moment(transaction.getStartDate()))).asSeconds()));
    // No Duration?
    if (transaction.getStopTotalDurationSecs() === 0) {
      // Compute it from now
      transaction.setStopTotalDurationSecs(Math.round(moment.duration(moment().diff(moment(transaction.getStartDate()))).asSeconds()));
      transaction.setStopTotalInactivitySecs(transaction.getStopTotalDurationSecs());
    }
    return lastMeterValue;
  }

  _getStopTransactionTagId(stopTransaction, transaction) {
    // Stopped Remotely?
    if (transaction.isRemotelyStopped()) {
      // Yes: Get the diff from now
      const secs = moment.duration(moment().diff(
        moment(transaction.getRemoteStopDate()))).asSeconds();
      // In a minute
      if (secs < 60) {
        // Return tag that remotely stopped the transaction
        return transaction.getRemoteStopTagID();
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

  async _notifyStopTransaction(chargingStation, transaction, user: User, alternateUser: User) {
    // User provided?
    if (user) {
      // Send Notification
      await NotificationHandler.sendEndOfSession(
        chargingStation.getTenantID(),
        transaction.getID() + '-EOS',
        user,
        chargingStation.getModel(),
        {
          'user': user,
          'alternateUser': (alternateUser ? alternateUser : null),
          'chargeBoxID': chargingStation.id,
          'connectorId': transaction.getConnectorId(),
          'totalConsumption': (transaction.getStopTotalConsumption() / 1000).toLocaleString(
            (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            { minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2 }),
          'totalDuration': this._buildTransactionDuration(transaction),
          'totalInactivity': this._buildTransactionInactivity(transaction),
          'stateOfCharge': transaction.getStopStateOfCharge(),
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(chargingStation, transaction.getID(), '#history'),
          'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain())
        },
        user.locale,
        {
          'transactionId': transaction.getID(),
          'connectorId': transaction.getConnectorId()
        }
      );
    }
  }
}

