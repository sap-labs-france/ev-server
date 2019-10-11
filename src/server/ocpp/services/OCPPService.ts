import momentDurationFormatSetup from 'moment-duration-format';
import Authorizations from '../../../authorization/Authorizations';
import BackendError from '../../../exception/BackendError';
import BillingFactory from '../../../integration/billing/BillingFactory';
import { BillingTransactionData } from '../../../integration/billing/Billing';
import PricingFactory from '../../../integration/pricing/PricingFactory';
import NotificationHandler from '../../../notification/NotificationHandler';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import RegistrationTokenStorage from '../../../storage/mongodb/RegistrationTokenStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import ChargingStation from '../../../types/ChargingStation';
import Connector from '../../../types/Connector';
import Consumption from '../../../types/Consumption';
import RegistrationToken from '../../../types/RegistrationToken';
import Transaction from '../../../types/Transaction';
import User from '../../../types/User';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import UtilsService from '../../rest/service/UtilsService';
import OCPPUtils from '../utils/OCPPUtils';
import OCPPValidation from '../validation/OCPPValidation';

const moment = require('moment');
momentDurationFormatSetup(moment);
const _configChargingStation = Configuration.getChargingStationConfig();

const DEFAULT_OCPP_CONSUMPTION_ATTRIBUTE = {
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
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'OCPPService',
          method: '_checkAndGetChargingStation',
          message: 'Should have the required property \'chargeBoxIdentity\'!'
        });
      }
      bootNotification.id = headers.chargeBoxIdentity;
      bootNotification.chargeBoxID = headers.chargeBoxIdentity;
      bootNotification.currentIPAddress = headers.currentIPAddress;
      bootNotification.ocppProtocol = headers.ocppProtocol;
      bootNotification.ocppVersion = headers.ocppVersion;
      // Set the default Heart Beat
      bootNotification.lastReboot = new Date();
      bootNotification.lastHeartBeat = bootNotification.lastReboot;
      bootNotification.timestamp = bootNotification.lastReboot;
      // Get the charging station
      let chargingStation = await ChargingStationStorage.getChargingStation(headers.tenantID, headers.chargeBoxIdentity);
      if (!chargingStation) {
        if (!headers.token) {
          throw new BackendError({
            source: headers.chargeBoxIdentity,
            module: 'OCPPService',
            method: 'handleBootNotification',
            message: `Registration rejected: Token is required for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress}'`,
            action: 'BootNotification'
          });
        }
        const token: RegistrationToken = await RegistrationTokenStorage.getRegistrationToken(headers.tenantID, headers.token);
        if (!token || !token.expirationDate || moment().isAfter(token.expirationDate)) {
          throw new BackendError({
            source: headers.chargeBoxIdentity,
            module: 'OCPPService',
            method: 'handleBootNotification',
            message: `Registration rejected: Token '${headers.token}' is invalid or expired for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress}'`,
            action: 'BootNotification'
          });
        }
        if (token.revocationDate || moment().isAfter(token.revocationDate)) {
          throw new BackendError({
            source: headers.chargeBoxIdentity,
            module: 'OCPPService',
            method: 'handleBootNotification',
            message: `Registration rejected: Token '${headers.token}' is revoked for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress}'`,
            action: 'BootNotification'
          });
        }
        // New Charging Station: Create
        chargingStation = bootNotification;
        // Update timestamp
        chargingStation.createdOn = new Date();

        if (token.siteAreaID) {
          chargingStation.siteAreaID = token.siteAreaID;
        }
      } else {
        // Existing Charging Station: Update
        // Check if same vendor and model
        if (chargingStation.chargePointVendor !== bootNotification.chargePointVendor ||
          chargingStation.chargePointModel !== bootNotification.chargePointModel) {
          // Double check on Serial Number
          if (!chargingStation.chargePointSerialNumber || !bootNotification.chargePointSerialNumber ||
            chargingStation.chargePointSerialNumber !== bootNotification.chargePointSerialNumber) {
            // Not the same charger!
            throw new BackendError({
              source: chargingStation.id,
              module: 'OCPPService',
              method: 'handleBootNotification',
              message: `Registration rejected: Vendor, Model or Serial Number attribute is different: '${bootNotification.chargePointVendor}' / '${bootNotification.chargePointModel} / ${bootNotification.chargePointSerialNumber}'! Expected '${chargingStation.chargePointVendor}' / '${chargingStation.chargePointModel}' / '${chargingStation.chargePointSerialNumber}'`,
              action: 'BootNotification'
            });
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
      chargingStation.currentIPAddress = bootNotification.currentIPAddress;
      // Set the charger URL?
      if (headers.chargingStationURL) {
        chargingStation.chargingStationURL = headers.chargingStationURL;
      }
      // Update CF Instance
      if (Configuration.isCloudFoundry()) {
        chargingStation.cfApplicationIDAndInstanceIndex = Configuration.getCFApplicationIDAndInstanceIndex();
      }
      // Save Charging Station
      await ChargingStationStorage.saveChargingStation(headers.tenantID, chargingStation);
      // Save Boot Notification
      await OCPPStorage.saveBootNotification(headers.tenantID, bootNotification);
      // Send Notification (Async)
      NotificationHandler.sendChargingStationRegistered(
        headers.tenantID,
        Utils.generateGUID(),
        chargingStation,
        {
          'chargeBoxID': chargingStation.id,
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(headers.tenantID)).subdomain),
          'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(headers.tenantID, chargingStation, '#all')
        }
      );
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'handleBootNotification',
        action: 'BootNotification', message: 'Boot notification saved'
      });
      // Handle the get of configuration later on
      setTimeout(async () => {
        // Get config and save it
        await OCPPUtils.requestAndSaveChargingStationConfiguration(headers.tenantID, chargingStation);
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
      // Replace IP
      chargingStation.currentIPAddress = headers.currentIPAddress;
      // Check props
      OCPPValidation.getInstance().validateHeartbeat(heartbeat);
      // Set Heartbeat
      chargingStation.lastHeartBeat = new Date();
      // Save
      await ChargingStationStorage.saveChargingStationHeartBeat(headers.tenantID, chargingStation);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'handleHeartbeat',
        action: 'Heartbeat', message: `Heartbeat saved with IP '${chargingStation.currentIPAddress}'`
      });
      // Return
      return {
        'currentTime': chargingStation.lastHeartBeat.toISOString()
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
      statusNotification.timezone = Utils.getTimezone(chargingStation.latitude, chargingStation.longitude);
      // Handle connectorId = 0 case => Currently status is distributed to each individual connectors
      if (statusNotification.connectorId === 0) {
        // Ignore EBEE charger
        if (chargingStation.chargePointVendor !== Constants.CHARGER_VENDOR_EBEE) {
          // Log
          Logging.logInfo({
            tenantID: headers.tenantID,
            source: chargingStation.id, module: 'OCPPService',
            method: 'handleStatusNotification', action: 'StatusNotification',
            message: `Connector '0' > Received Status: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
          });
          // Get the connectors
          const connectors = chargingStation.connectors;
          // Update ALL connectors
          for (let i = 0; i < connectors.length; i++) {
            // Update message with proper connectorId
            statusNotification.connectorId = connectors[i].connectorId;
            // Update
            await this._updateConnectorStatus(headers.tenantID, chargingStation, statusNotification, true);
          }
        } else {
          // Do not take connector '0' into account for EBEE
          Logging.logWarning({
            tenantID: headers.tenantID,
            source: chargingStation.id, module: 'OCPPService',
            method: 'handleStatusNotification', action: 'StatusNotification',
            message: `Connector '0' > Ignored EBEE with with Status: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
          });
        }
      } else {
        // Update only the given connectorId
        await this._updateConnectorStatus(headers.tenantID, chargingStation, statusNotification, false);
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
    let foundConnector: Connector = chargingStation.connectors.find(
      (connector) => connector.connectorId === statusNotification.connectorId);
    if (!foundConnector) {
      // Does not exist: Create
      foundConnector = {
        activeTransactionID: 0,
        activeTransactionDate: null,
        activeTagID: null,
        connectorId: statusNotification.connectorId,
        currentConsumption: 0,
        status: 'Unknown',
        power: 0,
        type: Constants.CONNECTOR_TYPES.UNKNOWN
      };
      chargingStation.connectors.push(foundConnector);
    }
    // Check if status has changed
    if (foundConnector.status === statusNotification.status &&
      foundConnector.errorCode === statusNotification.errorCode) {
      // No Change: Do not save it
      Logging.logWarning({
        tenantID: tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'handleStatusNotification', action: 'StatusNotification',
        message: `Connector '${statusNotification.connectorId}' > Transaction ID '${foundConnector.activeTransactionID}' > Status has not changed then not saved: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}''`,
        detailedMessages: foundConnector
      });
      return;
    }
    // Check for inactivity
    await this._checkStatusNotificationInactivity(tenantID, chargingStation, statusNotification, foundConnector);
    // Set connector data
    foundConnector.connectorId = statusNotification.connectorId;
    foundConnector.status = statusNotification.status;
    foundConnector.errorCode = statusNotification.errorCode;
    foundConnector.info = (statusNotification.info ? statusNotification.info : '');
    foundConnector.vendorErrorCode = (statusNotification.vendorErrorCode ? statusNotification.vendorErrorCode : '');
    // Save Status Notification
    await OCPPStorage.saveStatusNotification(tenantID, statusNotification);
    // Log
    Logging.logInfo({
      tenantID: tenantID, source: chargingStation.id,
      module: 'OCPPService', method: 'handleStatusNotification', action: 'StatusNotification',
      message: `Connector '${statusNotification.connectorId}' > Transaction ID '${foundConnector.activeTransactionID}' > Status: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}' has been saved`,
      detailedMessages: foundConnector
    });
    // Check if transaction is ongoing (ABB bug)!!!
    await this._checkStatusNotificationOngoingTransaction(tenantID, chargingStation, statusNotification, foundConnector, bothConnectorsUpdated);
    // Notify admins
    await this._notifyStatusNotification(tenantID, chargingStation, statusNotification);
    // Save Connector
    await ChargingStationStorage.saveChargingStationConnector(tenantID, chargingStation, chargingStation.connectors.find((localConnector) =>
      localConnector.connectorId === statusNotification.connectorId));
  }

  async _checkStatusNotificationInactivity(tenantID: string, chargingStation: ChargingStation, statusNotification, connector: Connector) {
    // Check Inactivity
    // OCPP 1.6: Finishing --> Available
    if (connector.status === Constants.CONN_STATUS_FINISHING &&
      statusNotification.status === Constants.CONN_STATUS_AVAILABLE &&
      statusNotification.hasOwnProperty('timestamp')) {
      // Get the last transaction
      const lastTransaction = await TransactionStorage.getLastTransaction(
        tenantID, chargingStation.id, connector.connectorId);
      // FInished?
      if (lastTransaction && lastTransaction.stop) {
        // Compute Extra inactivity
        const transactionStopTimestamp = lastTransaction.stop.timestamp;
        const statusNotifTimestamp = new Date(statusNotification.timestamp);
        const extraInactivitySecs = Math.floor((statusNotifTimestamp.getTime() - transactionStopTimestamp.getTime()) / 1000);
        lastTransaction.stop.extraInactivitySecs = extraInactivitySecs;
        // Save
        await TransactionStorage.saveTransaction(tenantID, lastTransaction);
      }
    }
  }

  async _checkStatusNotificationOngoingTransaction(tenantID: string, chargingStation: ChargingStation, statusNotification, connector: Connector, bothConnectorsUpdated) {
    // Check the status
    if (!bothConnectorsUpdated &&
      connector.activeTransactionID > 0 &&
      (statusNotification.status === Constants.CONN_STATUS_AVAILABLE || statusNotification.status === Constants.CONN_STATUS_FINISHING)) {
      // Cleanup ongoing transactions on the connector
      await this._stopOrDeleteActiveTransactions(
        tenantID, chargingStation.id, statusNotification.connectorId);
      // Clean up connector
      OCPPUtils.checkAndFreeChargingStationConnector(tenantID, chargingStation, statusNotification.connectorId, true);
    }
  }

  async _notifyStatusNotification(tenantID: string, chargingStation: ChargingStation, statusNotification) {
    // Faulted?
    if (statusNotification.status === Constants.CONN_STATUS_FAULTED) {
      // Log
      Logging.logError({
        tenantID: tenantID, source: chargingStation.id,
        module: 'OCPPService', method: '_notifyStatusNotification',
        action: 'StatusNotification',
        message: `Connector '${statusNotification.connectorId}' > Error occurred : '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}'`
      });
      // Send Notification (Async)
      NotificationHandler.sendChargingStationStatusError(
        tenantID,
        Utils.generateGUID(),
        chargingStation,
        {
          'chargeBoxID': chargingStation.id,
          'connectorId': statusNotification.connectorId,
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${(statusNotification.info ? statusNotification.info : 'N/A')}`,
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain),
          'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(tenantID, chargingStation, '#inerror')
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
      OCPPValidation.getInstance().validateMeterValues(headers.tenantID, chargingStation, meterValues);
      // Normalize Meter Values
      const newMeterValues = this._normalizeMeterValues(chargingStation, meterValues);
      // Handle charger's specificities
      this._filterMeterValuesOnCharger(headers.tenantID, chargingStation, newMeterValues);
      // No Values?
      if (newMeterValues.values.length === 0) {
        Logging.logDebug({
          tenantID: headers.tenantID,
          source: chargingStation.id, module: 'OCPPService', method: 'handleMeterValues',
          action: 'MeterValues', message: 'No relevant Meter Values to save',
          detailedMessages: meterValues
        });
        // Process values
      } else {
        // Handle Meter Value only for transaction
        // eslint-disable-next-line no-lonely-if
        if (meterValues.transactionId) {
          // Get the transaction
          const transaction = await TransactionStorage.getTransaction(headers.tenantID, meterValues.transactionId);
          // Handle Meter Values
          await this._updateTransactionWithMeterValues(headers.tenantID, transaction, newMeterValues);
          // Save Transaction
          await TransactionStorage.saveTransaction(headers.tenantID, transaction);
          // Update Charging Station Consumption
          await this._updateChargingStationConsumption(headers.tenantID, chargingStation, transaction);
          // Save Charging Station
          await ChargingStationStorage.saveChargingStation(headers.tenantID, chargingStation);
          // Log
          Logging.logInfo({
            tenantID: headers.tenantID, source: chargingStation.id,
            module: 'OCPPService', method: 'handleMeterValues', action: 'MeterValues',
            message: `Connector '${meterValues.connectorId}' > Transaction ID '${meterValues.transactionId}' > MeterValue have been saved`,
            detailedMessages: meterValues
          });
        } else {
          // Log
          Logging.logWarning({
            tenantID: headers.tenantID, source: chargingStation.id,
            module: 'OCPPService', method: 'handleMeterValues', action: 'MeterValues',
            message: `Connector '${meterValues.connectorId}' > Meter Values are ignored as it is not linked to a transaction`,
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

  _buildConsumptionAndUpdateTransactionFromMeterValue(transaction: Transaction, meterValue): Consumption {
    // Get the last one
    const lastMeterValue = transaction.lastMeterValue;
    // State of Charge?
    if (OCPPUtils.isSocMeterValue(meterValue)) {
      // Set current
      transaction.currentStateOfCharge = meterValue.value;
      // Consumption?
    } else if (OCPPUtils.isConsumptionMeterValue(meterValue)) {
      // Update
      transaction.numberOfMeterValues = transaction.numberOfMeterValues + 1;
      transaction.lastMeterValue = {
        value: Utils.convertToInt(meterValue.value),
        timestamp: Utils.convertToDate(meterValue.timestamp)
      };
      // Compute duration
      const diffSecs = moment(meterValue.timestamp).diff(lastMeterValue.timestamp, 'milliseconds') / 1000;
      // Check if the new value is greater
      if (Utils.convertToInt(meterValue.value) >= lastMeterValue.value) {
        // Compute consumption
        const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
        const consumption = meterValue.value - lastMeterValue.value;
        const currentConsumption = consumption * sampleMultiplier;
        // Update current consumption
        transaction.currentConsumption = currentConsumption;
        transaction.currentConsumptionWh = consumption;
        transaction.lastUpdate = meterValue.timestamp;
        transaction.currentTotalConsumption = transaction.currentTotalConsumption + consumption;
        // Inactivity?
        if (consumption === 0) {
          transaction.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs + diffSecs;
        }
      } else {
        // Update current consumption
        transaction.currentConsumption = 0;
        transaction.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs + diffSecs;
      }
    }
    // Compute consumption
    return this._buildConsumptionFromTransactionAndMeterValue(
      transaction, lastMeterValue.timestamp, meterValue.timestamp, meterValue);
  }

  _buildConsumptionFromTransactionAndMeterValue(transaction: Transaction, startedAt: Date, endedAt: Date, meterValue): Consumption {
    // Only Consumption and SoC (No consumption for Transaction Begin/End: scenario already handled in Start/Stop Transaction)
    if (OCPPUtils.isSocMeterValue(meterValue) ||
      OCPPUtils.isConsumptionMeterValue(meterValue)) {
      // Init
      const consumption: Consumption = {
        transactionId: transaction.id,
        connectorId: transaction.connectorId,
        chargeBoxID: transaction.chargeBoxID,
        siteAreaID: transaction.siteAreaID,
        siteID: transaction.siteID,
        userID: transaction.userID,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt)
      } as Consumption;
      // Set SoC
      if (OCPPUtils.isSocMeterValue(meterValue)) {
        consumption.stateOfCharge = transaction.currentStateOfCharge;
      // Set Consumption
      } else {
        consumption.consumption = transaction.currentConsumptionWh;
        consumption.instantPower = Math.round(transaction.currentConsumption);
        consumption.cumulatedConsumption = transaction.currentTotalConsumption;
        consumption.totalInactivitySecs = transaction.currentTotalInactivitySecs;
        consumption.totalDurationSecs = !transaction.stop ?
          moment.duration(moment(transaction.lastMeterValue.timestamp).diff(moment(transaction.timestamp))).asSeconds() :
          moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
        consumption.stateOfCharge = transaction.currentStateOfCharge;
        consumption.toPrice = true;
      }
      // Return
      return consumption;
    }
  }

  public async _updateTransactionWithMeterValues(tenantID: string, transaction: Transaction, meterValues: any) {
    // Save Meter Values
    await OCPPStorage.saveMeterValues(tenantID, meterValues);
    // Build consumptions
    const consumptions: Consumption[] = [];
    for (const meterValue of meterValues.values) {
      // Handles Signed Data values
      if (meterValue.attribute.format === 'SignedData') {
        if (meterValue.attribute.context === 'Transaction.Begin') {
          transaction.signedData = meterValue.value;
          continue;
        } else if (meterValue.attribute.context === 'Transaction.End') {
          transaction.currentSignedData = meterValue.value;
          continue;
        }
      }
      // SoC handling
      if (meterValue.attribute.measurand === 'SoC') {
        // Set the first SoC
        if (meterValue.attribute.context === 'Transaction.Begin') {
          transaction.stateOfCharge = meterValue.value;
          continue;
          // Set the Last SoC
        } else if (meterValue.attribute.context === 'Transaction.End') {
          transaction.currentStateOfCharge = meterValue.value;
          continue;
        }
      }
      // Only Consumption Meter Value
      if (OCPPUtils.isSocMeterValue(meterValue) ||
        OCPPUtils.isConsumptionMeterValue(meterValue)) {
        // Build Consumption and Update Transaction with Meter Values
        const consumption: Consumption = await this._buildConsumptionAndUpdateTransactionFromMeterValue(transaction, meterValue);
        if (consumption) {
          // Existing Consumption (SoC or Consumption MeterValue)?
          const existingConsumption = consumptions.find(
            (c) => c.endedAt.getTime() === consumption.endedAt.getTime());
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
    // Price and Save the Consumptions
    for (const consumption of consumptions) {
      if (consumption.toPrice) {
        await this._priceTransactionFromConsumption(tenantID, transaction, consumption, 'update');
        await this._handleBillingForTransaction(tenantID, transaction, 'update');
      }
      await ConsumptionStorage.saveConsumption(tenantID, consumption);
    }
  }

  public async _priceTransactionFromConsumption(tenantID: string, transaction: Transaction, consumption: Consumption, action: string) {
    let pricedConsumption;
    // Get the pricing impl
    const pricingImpl = await PricingFactory.getPricingImpl(tenantID, transaction);
    switch (action) {
      // Start Transaction
      case 'start':
        // Active?
        if (pricingImpl) {
          // Set
          pricedConsumption = await pricingImpl.startSession(consumption);
          if (pricedConsumption) {
            // Set the initial pricing
            transaction.price = pricedConsumption.amount;
            transaction.roundedPrice = pricedConsumption.roundedAmount;
            transaction.priceUnit = pricedConsumption.currencyCode;
            transaction.pricingSource = pricedConsumption.pricingSource;
            transaction.currentCumulatedPrice = pricedConsumption.amount;
          }
        } else {
          // Default
          transaction.price = 0;
          transaction.roundedPrice = 0;
          transaction.priceUnit = '';
          transaction.pricingSource = '';
          transaction.currentCumulatedPrice = 0;
        }
        break;
      // Meter Values
      case 'update':
        // Active?
        if (pricingImpl) {
          // Set
          pricedConsumption = await pricingImpl.updateSession(consumption);
          if (pricedConsumption) {
            // Update consumption
            consumption.amount = pricedConsumption.amount;
            consumption.roundedAmount = pricedConsumption.roundedAmount;
            consumption.currencyCode = pricedConsumption.currencyCode;
            consumption.pricingSource = pricedConsumption.pricingSource;
            if (pricedConsumption.cumulatedAmount) {
              consumption.cumulatedAmount = pricedConsumption.cumulatedAmount;
            } else {
              consumption.cumulatedAmount = parseFloat((transaction.currentCumulatedPrice + consumption.amount).toFixed(6));
            }
            transaction.currentCumulatedPrice = consumption.cumulatedAmount;
          }
        }
        break;
      // Stop Transaction
      case 'stop':
        // Active?
        if (pricingImpl) {
          // Set
          pricedConsumption = await pricingImpl.stopSession(consumption);
          if (pricedConsumption) {
            // Update consumption
            consumption.amount = pricedConsumption.amount;
            consumption.roundedAmount = pricedConsumption.roundedAmount;
            consumption.currencyCode = pricedConsumption.currencyCode;
            consumption.pricingSource = pricedConsumption.pricingSource;
            if (pricedConsumption.cumulatedAmount) {
              consumption.cumulatedAmount = pricedConsumption.cumulatedAmount;
            } else {
              consumption.cumulatedAmount = parseFloat((transaction.currentCumulatedPrice + consumption.amount).toFixed(6));
            }
            transaction.currentCumulatedPrice = consumption.cumulatedAmount;
            // Update Transaction
            if (!transaction.stop) {
              (transaction as any).stop = {};
            }
            transaction.stop.price = parseFloat(transaction.currentCumulatedPrice.toFixed(6));
            transaction.stop.roundedPrice = parseFloat((transaction.currentCumulatedPrice).toFixed(2));
            transaction.stop.priceUnit = pricedConsumption.currencyCode;
            transaction.stop.pricingSource = pricedConsumption.pricingSource;
          }
        }
        break;
    }
  }

  public async _handleBillingForTransaction(tenantID: string, transaction: Transaction, action: string, user?: User) {
    const billingImpl = await BillingFactory.getBillingImpl(tenantID);

    switch (action) {
      // Start Transaction
      case 'start':
        // Active?
        if (billingImpl) {
          const billingDataStart = await billingImpl.startTransaction(user, transaction);
          if (!transaction.billingData) {
            transaction.billingData = {} as BillingTransactionData;
          }
          transaction.billingData.errorCode = billingDataStart.errorCode;
          transaction.billingData.errorCodeDesc = billingDataStart.errorCodeDesc;
          transaction.billingData.lastUpdate = new Date();
        }
        break;
      // Meter Values
      case 'update':
        // Active?
        if (billingImpl) {
          const billingDataUpdate = await billingImpl.updateTransaction(transaction);
          transaction.billingData.errorCode = billingDataUpdate.errorCode;
          transaction.billingData.errorCodeDesc = billingDataUpdate.errorCodeDesc;
          transaction.billingData.lastUpdate = new Date();
          if (billingDataUpdate.stopTransaction) {
            // Unclear how to do this...
          }
        }
        break;
      // Stop Transaction
      case 'stop':
        // Active?
        if (billingImpl) {
          const billingDataStop = await billingImpl.stopTransaction(transaction);
          transaction.billingData.status = billingDataStop.status;
          transaction.billingData.errorCode = billingDataStop.errorCode;
          transaction.billingData.errorCodeDesc = billingDataStop.errorCodeDesc;
          transaction.billingData.invoiceStatus = billingDataStop.invoiceStatus;
          transaction.billingData.invoiceItem = billingDataStop.invoiceItem;
          transaction.billingData.lastUpdate = new Date();
        }
        break;
    }
  }

  // Save Consumption
  async _updateChargingStationConsumption(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    // Get the connector
    const foundConnector: Connector = chargingStation.connectors.find(
      (connector) => connector.connectorId === transaction.connectorId);
    // Active transaction?
    if (!transaction.stop && foundConnector) {
      // Set consumption
      foundConnector.currentConsumption = transaction.currentConsumption;
      foundConnector.totalConsumption = transaction.currentTotalConsumption;
      foundConnector.totalInactivitySecs = transaction.currentTotalInactivitySecs;
      foundConnector.currentStateOfCharge = transaction.currentStateOfCharge;
      foundConnector.totalInactivitySecs = transaction.currentTotalInactivitySecs;
      // Set Transaction ID
      foundConnector.activeTransactionID = transaction.id;
      foundConnector.activeTagID = transaction.tagID;
      // Update Heartbeat
      chargingStation.lastHeartBeat = new Date();
      // Handle End Of charge
      await this._checkNotificationEndOfCharge(tenantID, chargingStation, transaction);
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id, module: 'OCPPService',
        method: '_updateChargingStationConsumption', action: 'ChargingStationConsumption',
        message: `Connector '${foundConnector.connectorId}' > Transaction ID '${foundConnector.activeTransactionID}' > Instant: ${foundConnector.currentConsumption / 1000} kW.h, Total: ${foundConnector.totalConsumption / 1000} kW.h${foundConnector.currentStateOfCharge ? ', SoC: ' + foundConnector.currentStateOfCharge + ' %' : ''}`
      });
      // Cleanup connector transaction data
    } else if (foundConnector) {
      foundConnector.currentConsumption = 0;
      foundConnector.totalConsumption = 0;
      foundConnector.totalInactivitySecs = 0;
      foundConnector.currentStateOfCharge = 0;
      foundConnector.activeTransactionID = 0;
      foundConnector.activeTransactionDate = null;
      foundConnector.activeTagID = null;
    }
  }

  async _notifyEndOfCharge(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    // Notify (Async)
    NotificationHandler.sendEndOfCharge(
      tenantID,
      transaction.id + '-EOC',
      transaction.user,
      chargingStation,
      {
        'user': transaction.user,
        'chargeBoxID': chargingStation.id,
        'connectorId': transaction.connectorId,
        'totalConsumption': (transaction.currentTotalConsumption / 1000).toLocaleString(
          (transaction.user.locale ? transaction.user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
          { minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2 }),
        'stateOfCharge': transaction.currentStateOfCharge,
        'totalDuration': this._buildCurrentTransactionDuration(transaction),
        'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#inprogress'),
        'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
      },
      transaction.user.locale,
      {
        'transactionId': transaction.id,
        'connectorId': transaction.connectorId
      }
    );
  }

  async _notifyOptimalChargeReached(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    // Notifcation Before End Of Charge (Async)
    NotificationHandler.sendOptimalChargeReached(
      tenantID,
      transaction.id + '-OCR',
      transaction.user,
      chargingStation,
      {
        'user': transaction.user,
        'chargeBoxID': chargingStation.id,
        'connectorId': transaction.connectorId,
        'totalConsumption': (transaction.currentTotalConsumption / 1000).toLocaleString(
          (transaction.user.locale ? transaction.user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
          { minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2 }),
        'stateOfCharge': transaction.currentStateOfCharge,
        'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#inprogress'),
        'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
      },
      transaction.user.locale,
      {
        'transactionId': transaction.id,
        'connectorId': transaction.connectorId
      }
    );
  }

  async _checkNotificationEndOfCharge(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    // Transaction in progress?
    if (transaction && !transaction.stop) {
      // Has consumption?
      if (transaction.numberOfMeterValues > 1 && transaction.currentTotalConsumption > 0) {
        // End of charge?
        if (_configChargingStation.notifEndOfChargeEnabled &&
          (transaction.currentTotalInactivitySecs > 60 || transaction.currentStateOfCharge === 100)) {
          // Notify User?
          if (transaction.user) {
            // Send Notification
            await this._notifyEndOfCharge(tenantID, chargingStation, transaction);
          }
          // Optimal Charge? (SoC)
        } else if (_configChargingStation.notifBeforeEndOfChargeEnabled &&
          transaction.currentStateOfCharge >= _configChargingStation.notifBeforeEndOfChargePercent) {
          // Notify User?
          if (transaction.user) {
            // Send Notification
            await this._notifyOptimalChargeReached(tenantID, chargingStation, transaction);
          }
        }
      }
    }
  }

  // Build Inactivity
  _buildTransactionInactivity(transaction: Transaction, i18nHourShort = 'h') {
    // Get total
    const totalInactivitySecs = transaction.stop.totalInactivitySecs;
    // None?
    if (totalInactivitySecs === 0) {
      return `0${i18nHourShort}00 (0%)`;
    }
    // Build the inactivity percentage
    const totalInactivityPercent = Math.round((totalInactivitySecs * 100) / transaction.stop.totalDurationSecs);
    // Format
    return moment.duration(totalInactivitySecs, 's').format(`h[${i18nHourShort}]mm`, { trim: false }) + ` (${totalInactivityPercent}%)`;
  }

  // Build duration
  _buildCurrentTransactionDuration(transaction: Transaction): string {
    let totalDuration;
    if (!transaction.stop) {
      totalDuration = moment.duration(moment(transaction.lastMeterValue.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    } else {
      totalDuration = moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    }
    return moment.duration(totalDuration, 's').format('h[h]mm', { trim: false });
  }

  // Build duration
  _buildTransactionDuration(transaction: Transaction): string {
    return moment.duration(transaction.stop.totalDurationSecs, 's').format('h[h]mm', { trim: false });
  }

  _filterMeterValuesOnCharger(tenantID: string, chargingStation: ChargingStation, meterValues) {
    // Clean up Sample.Clock meter value
    if (chargingStation.chargePointVendor !== Constants.CHARGER_VENDOR_ABB ||
      chargingStation.ocppVersion !== Constants.OCPP_VERSION_15) {
      // Filter Sample.Clock meter value for all chargers except ABB using OCPP 1.5
      meterValues.values = meterValues.values.filter((meterValue) => {
        // Remove Sample Clock
        if (meterValue.attribute.context === 'Sample.Clock') {
          // Log
          Logging.logWarning({
            tenantID: tenantID, source: chargingStation.id,
            module: 'OCPPService', method: '_filterMeterValuesOnCharger', action: 'MeterValues',
            message: 'Removed Meter Value with attribute context \'Sample.Clock\'',
            detailedMessages: meterValue
          });
          return false;
        }
        return true;
      });
    }
  }

  _normalizeMeterValues(chargingStation: ChargingStation, meterValues) {
    // Create the model
    const newMeterValues: any = {};
    newMeterValues.values = [];
    newMeterValues.chargeBoxID = chargingStation.id;
    // OCPP 1.6
    if (chargingStation.ocppVersion === Constants.OCPP_VERSION_16) {
      meterValues.values = meterValues.meterValue;
      delete meterValues.meterValue;
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
      if (chargingStation.ocppVersion === Constants.OCPP_VERSION_16) {
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
      authorize.timezone = Utils.getTimezone(chargingStation.latitude, chargingStation.longitude);
      // Check
      authorize.user = await Authorizations.isAuthorizedOnChargingStation(headers.tenantID, chargingStation, authorize.idTag);
      // Save
      await OCPPStorage.saveAuthorize(headers.tenantID, authorize);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID,
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
      diagnosticsStatusNotification.timezone = Utils.getTimezone(chargingStation.latitude, chargingStation.longitude);
      // Save it
      await OCPPStorage.saveDiagnosticsStatusNotification(headers.tenantID, diagnosticsStatusNotification);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'handleDiagnosticsStatusNotification',
        action: 'DiagnosticsStatusNotification',
        message: 'Diagnostics Status Notification has been saved'
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
      firmwareStatusNotification.timezone = Utils.getTimezone(chargingStation.latitude, chargingStation.longitude);
      // Save it
      await OCPPStorage.saveFirmwareStatusNotification(headers.tenantID, firmwareStatusNotification);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'handleFirmwareStatusNotification',
        action: 'FirmwareStatusNotification',
        message: 'Firmware Status Notification has been saved'
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
      startTransaction.timezone = Utils.getTimezone(chargingStation.latitude, chargingStation.longitude);
      // Check Authorization with Tag ID
      const user = await Authorizations.isAuthorizedToStartTransaction(
        headers.tenantID, chargingStation, startTransaction.tagID);
      if (user) {
        startTransaction.userID = user.id;
      }
      // Check Org
      const tenant = await TenantStorage.getTenant(headers.tenantID);
      const isOrgCompActive = Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.ORGANIZATION);
      if (isOrgCompActive) {
        // Set the Site Area ID
        startTransaction.siteAreaID = chargingStation.siteAreaID;
        // Set the Site ID. ChargingStation$siteArea$site checked by TagIDAuthorized.
        const site = chargingStation.siteArea ? chargingStation.siteArea.site : null;
        if (site) {
          startTransaction.siteID = site.id;
        }
      }
      // Cleanup ongoing transactions
      await this._stopOrDeleteActiveTransactions(
        headers.tenantID, chargingStation.id, startTransaction.connectorId);
      // Create
      const transaction: Transaction = startTransaction;
      // Init
      transaction.numberOfMeterValues = 0;
      transaction.lastMeterValue = {
        value: transaction.meterStart,
        timestamp: transaction.timestamp
      };
      transaction.currentTotalInactivitySecs = 0;
      transaction.currentStateOfCharge = 0;
      transaction.signedData = '';
      transaction.stateOfCharge = 0;
      transaction.signedData = '';
      transaction.currentConsumption = 0;
      transaction.currentTotalConsumption = 0;
      transaction.currentConsumptionWh = 0;
      // Build first Dummy consumption for pricing the Start Transaction
      const consumption = this._buildConsumptionFromTransactionAndMeterValue(
        transaction, transaction.timestamp, transaction.timestamp, {
          id: '666',
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          timestamp: transaction.timestamp,
          value: transaction.meterStart,
          attribute: DEFAULT_OCPP_CONSUMPTION_ATTRIBUTE
        }
      );
      // Price it
      await this._priceTransactionFromConsumption(headers.tenantID, transaction, consumption, 'start');
      // Billing
      await this._handleBillingForTransaction(headers.tenantID, transaction, 'start', user);
      // Save it
      transaction.id = await TransactionStorage.saveTransaction(headers.tenantID, transaction);
      // Clean up Charger's connector transaction info
      const foundConnector = chargingStation.connectors.find(
        (connector) => connector.connectorId === transaction.connectorId);
      if (foundConnector) {
        foundConnector.currentConsumption = 0;
        foundConnector.totalConsumption = 0;
        foundConnector.totalInactivitySecs = 0;
        foundConnector.currentStateOfCharge = 0;
        foundConnector.activeTransactionID = transaction.id;
        foundConnector.activeTransactionDate = transaction.timestamp;
        foundConnector.activeTagID = transaction.tagID;
      }
      // Set the active transaction on the connector
      // Update Heartbeat
      chargingStation.lastHeartBeat = new Date();
      // Save
      await ChargingStationStorage.saveChargingStation(headers.tenantID, chargingStation);
      // Log
      if (user) {
        await this._notifyStartTransaction(headers.tenantID, transaction, chargingStation, user);
        // Log
        Logging.logInfo({
          tenantID: headers.tenantID,
          source: chargingStation.id, module: 'OCPPService', method: 'handleStartTransaction',
          action: 'StartTransaction', user: user,
          message: `Connector '${transaction.connectorId}' > Transaction ID '${transaction.id}' has been started`
        });
      } else {
        // Log
        Logging.logInfo({
          tenantID: headers.tenantID, source: chargingStation.id,
          module: 'OCPPService', method: 'handleStartTransaction', action: 'StartTransaction',
          message: `Connector '${transaction.connectorId}' > Transaction ID '${transaction.id}' has been started`
        });
      }
      // Return
      return {
        'transactionId': transaction.id,
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, Constants.ACTION_START_TRANSACTION, error);
      return {
        'transactionId': 0,
        'status': 'Invalid'
      };
    }
  }

  async _stopOrDeleteActiveTransactions(tenantID: string, chargeBoxID: string, connectorId: number) {
    // Check
    let activeTransaction: Transaction, lastCheckedTransactionID;
    do {
      // Check if the charging station has already a transaction
      activeTransaction = await TransactionStorage.getActiveTransaction(tenantID, chargeBoxID, connectorId);
      // Exists already?
      if (activeTransaction) {
        // Avoid infinite Loop
        if (lastCheckedTransactionID === activeTransaction.id) {
          return;
        }
        // Has consumption?
        if (activeTransaction.currentTotalConsumption <= 0) {
          // No consumption: delete
          Logging.logWarning({
            tenantID: tenantID, source: chargeBoxID,
            module: 'OCPPService', method: '_stopOrDeleteActiveTransactions',
            action: 'CleanupTransaction', actionOnUser: activeTransaction.user,
            message: `Connector '${activeTransaction.connectorId}' > Pending Transaction ID '${activeTransaction.id}' with no consumption has been deleted`
          });
          // Delete
          await TransactionStorage.deleteTransaction(tenantID, activeTransaction);
        } else {
          // Simulate a Stop Transaction
          const result = await this.handleStopTransaction({
            'tenantID': tenantID,
            'chargeBoxIdentity': activeTransaction.chargeBoxID
          }, {
            'transactionId': activeTransaction.id,
            'meterStop': activeTransaction.lastMeterValue.value,
            'timestamp': new Date(activeTransaction.lastMeterValue.timestamp).toISOString(),
          }, false, true);
          // Check
          if (result.status === 'Invalid') {
            // No consumption: delete
            Logging.logError({
              tenantID: tenantID, source: chargeBoxID,
              module: 'OCPPService', method: '_stopOrDeleteActiveTransactions',
              action: 'CleanupTransaction', actionOnUser: activeTransaction.userID,
              message: `Connector '${activeTransaction.connectorId}' > Cannot delete pending Transaction ID '${activeTransaction.id}' with no consumption`
            });
          } else {
            // Has consumption: close it!
            Logging.logWarning({
              tenantID: tenantID, source: chargeBoxID,
              module: 'OCPPService', method: '_stopOrDeleteActiveTransactions',
              action: 'CleanupTransaction', actionOnUser: activeTransaction.userID,
              message: `Connector '${activeTransaction.connectorId}' > Pending Transaction ID '${activeTransaction.id}' has been stopped`
            });
          }
        }
        // Keep last Transaction ID
        lastCheckedTransactionID = activeTransaction.id;
      }
    } while (activeTransaction);
  }

  async _notifyStartTransaction(tenantID: string, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    // Notify (Async)
    NotificationHandler.sendTransactionStarted(
      tenantID,
      transaction.id,
      user,
      chargingStation,
      {
        'user': user,
        'chargeBoxID': chargingStation.id,
        'connectorId': transaction.connectorId,
        'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain),
        'evseDashboardChargingStationURL':
          await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#inprogress')
      },
      user.locale,
      {
        'transactionId': transaction.id,
        'connectorId': transaction.connectorId
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
      dataTransfer.timezone = Utils.getTimezone(chargingStation.latitude, chargingStation.longitude);
      // Save it
      await OCPPStorage.saveDataTransfer(headers.tenantID, dataTransfer);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'handleDataTransfer',
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
      const transaction = await TransactionStorage.getTransaction(headers.tenantID, stopTransaction.transactionId);
      UtilsService.assertObjectExists(transaction, `Transaction with ID '${stopTransaction.transactionId}' doesn't exist`,
        'OCPPService', 'handleStopTransaction', null);
      // Get the TagID that stopped the transaction
      const tagId = this._getStopTransactionTagId(stopTransaction, transaction);
      let user: User, alternateUser: User;
      // Transaction is stopped by central system?
      if (!stoppedByCentralSystem) {
        // Check and get users
        const users = await Authorizations.isAuthorizedToStopTransaction(
          headers.tenantID, chargingStation, transaction, tagId);
        user = users.user;
        alternateUser = users.alternateUser;
      } else {
        // Get the user
        user = await UserStorage.getUserByTagId(headers.tenantID, tagId);
      }
      // Check if the transaction has already been stopped
      if (transaction.stop) {
        throw new BackendError({
          source: chargingStation.id,
          module: 'OCPPService',
          method: 'handleStopTransaction',
          message: `Transaction ID '${stopTransaction.transactionId}' has already been stopped`,
          action: Constants.ACTION_STOP_TRANSACTION,
          user: (alternateUser ? alternateUser : user),
          actionOnUser: (alternateUser ? (user ? user : null) : null)
        });
      }
      // Check and free the connector
      OCPPUtils.checkAndFreeChargingStationConnector(
        headers.tenantID, chargingStation, transaction.connectorId, false);
      // Update Heartbeat
      chargingStation.lastHeartBeat = new Date();
      // Save Charger
      await ChargingStationStorage.saveChargingStation(headers.tenantID, chargingStation);
      // Soft Stop?
      if (isSoftStop) {
        // Yes: Add the latest Meter Value
        if (transaction.lastMeterValue) {
          stopTransaction.meterStop = transaction.lastMeterValue.value;
        } else {
          stopTransaction.meterStop = 0;
        }
      }
      // Update the transaction
      const lastMeterValue = this._updateTransactionWithStopTransaction(
        transaction, stopTransaction, user, alternateUser, tagId);
      // Build final consumption
      const consumption: Consumption = this._buildConsumptionFromTransactionAndMeterValue(
        transaction, lastMeterValue.timestamp, transaction.stop.timestamp, {
          id: '6969',
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          timestamp: transaction.stop.timestamp,
          value: transaction.stop.meterStop,
          attribute: DEFAULT_OCPP_CONSUMPTION_ATTRIBUTE
        }
      );
      // Update the price
      await this._priceTransactionFromConsumption(headers.tenantID, transaction, consumption, 'stop');
      // Finalize billing
      await this._handleBillingForTransaction(headers.tenantID, transaction, 'stop');
      // Save Consumption
      await ConsumptionStorage.saveConsumption(headers.tenantID, consumption);
      // Remove runtime data
      delete transaction.currentConsumption;
      delete transaction.currentCumulatedPrice;
      delete transaction.currentSignedData;
      delete transaction.currentTotalInactivitySecs;
      delete transaction.currentTotalConsumption;
      delete transaction.currentStateOfCharge;
      delete transaction.lastMeterValue;
      delete transaction.numberOfMeterValues;
      // Save the transaction
      transaction.id = await TransactionStorage.saveTransaction(headers.tenantID, transaction);
      // Notify User
      await this._notifyStopTransaction(headers.tenantID, chargingStation, transaction, user, alternateUser);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID,
        source: chargingStation.id, module: 'OCPPService', method: 'handleStopTransaction',
        action: Constants.ACTION_STOP_TRANSACTION,
        user: (alternateUser ? alternateUser : (user ? user : null)),
        actionOnUser: (alternateUser ? (user ? user : null) : null),
        message: `Connector '${transaction.connectorId}' > Transaction ID '${transaction.id}' has been stopped successfully`
      });
      // Success
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, Constants.ACTION_STOP_TRANSACTION, error);
      // Error
      return { 'status': 'Invalid' };
    }
  }

  _updateTransactionWithStopTransaction(transaction: Transaction, stopTransaction, user: User, alternateUser: User, tagId) {
    if (!transaction.stop) {
      (transaction as any).stop = {};
    }
    transaction.stop.meterStop = Utils.convertToInt(stopTransaction.meterStop);
    transaction.stop.timestamp = new Date(stopTransaction.timestamp);
    transaction.stop.userID = (alternateUser ? alternateUser.id : (user ? user.id : null));
    transaction.stop.tagID = tagId;
    transaction.stop.stateOfCharge = transaction.currentStateOfCharge;
    transaction.stop.signedData = transaction.currentSignedData ? transaction.currentSignedData : '';
    // Keep the last Meter Value
    const lastMeterValue = transaction.lastMeterValue;
    // Compute duration
    const diffSecs = moment(transaction.stop.timestamp).diff(lastMeterValue.timestamp, 'milliseconds') / 1000;
    // Check if the new value is greater
    if (transaction.stop.meterStop >= lastMeterValue.value) {
      // Compute consumption
      const consumption = transaction.stop.meterStop - lastMeterValue.value;
      const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
      const currentConsumption = consumption * sampleMultiplier;
      // Update current consumption
      transaction.currentConsumption = currentConsumption;
      transaction.currentTotalConsumption = transaction.currentTotalConsumption + consumption;
      transaction.currentConsumptionWh = consumption;
      // Inactivity?
      if (consumption === 0) {
        transaction.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs + diffSecs;
      }
    } else {
      // Update current consumption
      transaction.currentConsumption = 0;
      transaction.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs + diffSecs;
    }
    // Set Total data
    transaction.stop.totalConsumption = transaction.currentTotalConsumption;
    transaction.stop.totalInactivitySecs = transaction.currentTotalInactivitySecs;
    transaction.stop.totalDurationSecs = Math.round(moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds());
    // No Duration?
    if (transaction.stop.totalDurationSecs === 0) {
      // Compute it from now
      transaction.stop.totalDurationSecs = Math.round(moment.duration(moment().diff(moment(transaction.timestamp))).asSeconds());
      transaction.stop.totalInactivitySecs = transaction.stop.totalDurationSecs;
    }
    return lastMeterValue;
  }

  _getStopTransactionTagId(stopTransaction, transaction: Transaction): string {
    // Stopped Remotely?
    if (transaction.remotestop) {
      // Yes: Get the diff from now
      const secs = moment.duration(moment().diff(
        moment(transaction.remotestop.timestamp))).asSeconds();
      // In a minute
      if (secs < 60) {
        // Return tag that remotely stopped the transaction
        return transaction.remotestop.tagID;
      }
    }
    // Already provided?
    if (stopTransaction.idTag) {
      // Return tag that stopped the transaction
      return stopTransaction.idTag;
    }
    // Default: return tag that started the transaction
    return transaction.tagID;
  }

  async _notifyStopTransaction(tenantID: string, chargingStation: ChargingStation, transaction: Transaction, user: User, alternateUser: User) {
    // User provided?
    if (user) {
      // Send Notification (Async)
      NotificationHandler.sendEndOfSession(
        tenantID,
        transaction.id + '-EOS',
        user,
        chargingStation,
        {
          'user': user,
          'alternateUser': (alternateUser ? alternateUser : null),
          'chargeBoxID': chargingStation.id,
          'connectorId': transaction.connectorId,
          'totalConsumption': (transaction.stop.totalConsumption / 1000).toLocaleString(
            (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            { minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2 }),
          'totalDuration': this._buildTransactionDuration(transaction),
          'totalInactivity': this._buildTransactionInactivity(transaction),
          'stateOfCharge': transaction.stop.stateOfCharge,
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#history'),
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
        },
        user.locale,
        {
          'transactionId': transaction.id,
          'connectorId': transaction.connectorId
        }
      );
      if (transaction.stop.signedData !== '') {
        // Send Notification (Async)
        NotificationHandler.sendEndOfSignedSession(
          tenantID,
          transaction.id + '-EOSS',
          user,
          chargingStation,
          {
            'user': user,
            'alternateUser': (alternateUser ? alternateUser : null),
            'transactionId': transaction.id,
            'chargeBoxID': chargingStation.id,
            'connectorId': transaction.connectorId,
            'tagId': transaction.tagID,
            'startDate': transaction.timestamp.toLocaleString('de-DE'),
            'endDate': transaction.stop.timestamp.toLocaleString('de-DE'),
            'meterStart': (transaction.meterStart / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            'meterStop': (transaction.stop.meterStop / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            'totalConsumption': (transaction.stop.totalConsumption / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            'price': transaction.stop.price,
            'relativeCost': (transaction.stop.price / (transaction.stop.totalConsumption / 1000)),
            'startSignedData': transaction.signedData,
            'endSignedData': transaction.stop.signedData,
            'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
          },
          user.locale,
          {
            'transactionId': transaction.id,
            'connectorId': transaction.connectorId
          }
        );
      }
    }
  }
}

