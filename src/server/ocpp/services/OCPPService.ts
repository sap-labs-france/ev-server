import { Action } from '../../../types/Authorization';
import momentDurationFormatSetup from 'moment-duration-format';
import Authorizations from '../../../authorization/Authorizations';
import BackendError from '../../../exception/BackendError';
import BillingFactory from '../../../integration/billing/BillingFactory';
import PricingFactory from '../../../integration/pricing/PricingFactory';
import NotificationHandler from '../../../notification/NotificationHandler';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import RegistrationTokenStorage from '../../../storage/mongodb/RegistrationTokenStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import ChargingStation, { ChargerVendor, Connector, PowerLimitUnits, ConnectorType } from '../../../types/ChargingStation';
import Consumption from '../../../types/Consumption';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import { ChargePointStatus, OCPPAttribute, OCPPAuthorizationStatus, OCPPAuthorizeRequestExtended, OCPPAuthorizeResponse, OCPPBootNotificationRequestExtended, OCPPBootNotificationResponse, OCPPDataTransferRequestExtended, OCPPDataTransferResponse, OCPPDataTransferStatus, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequestExtended, OCPPHeartbeatResponse, OCPPLocation, OCPPMeasurand, OCPPMeterValuesExtended, OCPPMeterValuesResponse, OCPPNormalizedMeterValue, OCPPNormalizedMeterValues, OCPPReadingContext, OCPPSampledValue, OCPPStartTransactionRequestExtended, OCPPStartTransactionResponse, OCPPStatusNotificationRequestExtended, OCPPStatusNotificationResponse, OCPPStopTransactionRequestExtended, OCPPStopTransactionResponse, OCPPUnitOfMeasure, OCPPValueFormat, OCPPVersion, RegitrationStatus } from '../../../types/ocpp/OCPPServer';
import RegistrationToken from '../../../types/RegistrationToken';
import Transaction, { InactivityStatus, TransactionAction } from '../../../types/Transaction';
import User from '../../../types/User';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import UtilsService from '../../rest/service/UtilsService';
import OCPPUtils from '../utils/OCPPUtils';
import OCPPValidation from '../validation/OCPPValidation';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import Tenant from '../../../types/Tenant';
import CpoOCPIClient from '../../../client/ocpi/CpoOCPIClient';

const moment = require('moment');
momentDurationFormatSetup(moment);
const _configChargingStation = Configuration.getChargingStationConfig();

const DEFAULT_OCPP_CONSUMPTION_ATTRIBUTE: OCPPAttribute = {
  unit: OCPPUnitOfMeasure.WATT_HOUR,
  location: OCPPLocation.OUTLET,
  measurand: OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER,
  format: OCPPValueFormat.RAW,
  context: OCPPReadingContext.SAMPLE_PERIODIC
};
export default class OCPPService {
  private chargingStationConfig: any;

  public constructor(chargingStationConfig = null) {
    this.chargingStationConfig = chargingStationConfig;
  }

  public async handleBootNotification(headers: OCPPHeader, bootNotification: OCPPBootNotificationRequestExtended): Promise<OCPPBootNotificationResponse> {
    let newChargingStation = false;
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
            action: Action.BOOT_NOTIFICATION
          });
        }
        const token: RegistrationToken = await RegistrationTokenStorage.getRegistrationToken(headers.tenantID, headers.token);
        if (!token || !token.expirationDate || moment().isAfter(token.expirationDate)) {
          throw new BackendError({
            source: headers.chargeBoxIdentity,
            module: 'OCPPService',
            method: 'handleBootNotification',
            message: `Registration rejected: Token '${headers.token}' is invalid or expired for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress}'`,
            action: Action.BOOT_NOTIFICATION
          });
        }
        if (token.revocationDate || moment().isAfter(token.revocationDate)) {
          throw new BackendError({
            source: headers.chargeBoxIdentity,
            module: 'OCPPService',
            method: 'handleBootNotification',
            message: `Registration rejected: Token '${headers.token}' is revoked for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress}'`,
            action: Action.BOOT_NOTIFICATION
          });
        }
        // New Charging Station: Create
        chargingStation = {} as ChargingStation;
        for (const key in bootNotification) {
          chargingStation[key] = bootNotification[key];
        }
        // Update props
        chargingStation.createdOn = new Date();
        chargingStation.issuer = true;
        chargingStation.powerLimitUnit = PowerLimitUnits.AMPERE;
        // Assign to Site Area
        if (token.siteAreaID) {
          const siteArea = await SiteAreaStorage.getSiteArea(headers.tenantID, token.siteAreaID);
          if (siteArea) {
            chargingStation.siteAreaID = token.siteAreaID;
            // Set the same coordinates
            if (siteArea.address && siteArea.address.coordinates && siteArea.address.coordinates.length === 2) {
              chargingStation.coordinates = siteArea.address.coordinates;
            }
          }
        }
        // Enrich Charging Station
        await OCPPUtils.enrichChargingStationWithTemplate(headers.tenantID, chargingStation);
        newChargingStation = true;
      } else {
        // Existing Charging Station: Update
        // Check if same vendor and model
        if ((chargingStation.chargePointVendor !== bootNotification.chargePointVendor ||
          chargingStation.chargePointModel !== bootNotification.chargePointModel) ||
          (chargingStation.chargePointSerialNumber && bootNotification.chargePointSerialNumber &&
            chargingStation.chargePointSerialNumber !== bootNotification.chargePointSerialNumber)) {
          // Not the same Charging Station!
          throw new BackendError({
            source: chargingStation.id,
            module: 'OCPPService',
            method: 'handleBootNotification',
            message: 'Boot Notif Rejected: Attribute mismatch: ' +
              (bootNotification.chargePointVendor !== chargingStation.chargePointVendor ?
                `Got chargePointVendor='${bootNotification.chargePointVendor}' but expected '${chargingStation.chargePointVendor}'! ` : '') +
              (bootNotification.chargePointModel !== chargingStation.chargePointModel ?
                `Got chargePointModel='${bootNotification.chargePointModel}' but expected '${chargingStation.chargePointModel}'! ` : '') +
              (bootNotification.chargePointSerialNumber !== chargingStation.chargePointSerialNumber ?
                `Got chargePointSerialNumber='${bootNotification.chargePointSerialNumber ? bootNotification.chargePointSerialNumber : ''}' but expected '${chargingStation.chargePointSerialNumber ? chargingStation.chargePointSerialNumber : ''}'!` : ''),
            action: Action.BOOT_NOTIFICATION
          });
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
      // Set the Charging Station URL?
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
        await OCPPUtils.requestAndSaveChargingStationOcppConfiguration(headers.tenantID, chargingStation, newChargingStation);
      }, 3000);
      // Return the result
      return {
        'currentTime': bootNotification.timestamp.toISOString(),
        'status': RegitrationStatus.ACCEPTED,
        'heartbeatInterval': this.chargingStationConfig.heartbeatIntervalSecs
      };
    } catch (error) {
      // Log error
      error.source = headers.chargeBoxIdentity;
      Logging.logActionExceptionMessage(headers.tenantID, 'BootNotification', error);
      // Reject
      return {
        'status': RegitrationStatus.REJECTED,
        'currentTime': bootNotification.timestamp ? bootNotification.timestamp.toISOString() : new Date().toISOString(),
        'heartbeatInterval': this.chargingStationConfig.heartbeatIntervalSecs
      };
    }
  }

  public async handleHeartbeat(headers: OCPPHeader, heartbeat: OCPPHeartbeatRequestExtended): Promise<OCPPHeartbeatResponse> {
    try {
      // Get Charging Station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Replace IP
      chargingStation.currentIPAddress = headers.currentIPAddress;
      // Check props
      OCPPValidation.getInstance().validateHeartbeat(heartbeat);
      // Set Heartbeat
      chargingStation.lastHeartBeat = new Date();
      // Set Heart Beat Object
      heartbeat = {
        chargeBoxID: chargingStation.id,
        timestamp: new Date(),
        timezone: Utils.getTimezone(chargingStation.coordinates)
      };
      // Save Charging Station
      await ChargingStationStorage.saveChargingStationHeartBeat(headers.tenantID, chargingStation);
      // Save Heart Beat
      await OCPPStorage.saveHeartbeat(headers.tenantID, heartbeat);
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

  public async handleStatusNotification(headers: OCPPHeader, statusNotification: OCPPStatusNotificationRequestExtended): Promise<OCPPStatusNotificationResponse> {
    try {
      // Get charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateStatusNotification(statusNotification);
      // Set Header
      statusNotification.chargeBoxID = chargingStation.id;
      statusNotification.timezone = Utils.getTimezone(chargingStation.coordinates);
      // Handle connectorId = 0 case => Currently status is distributed to each individual connectors
      if (statusNotification.connectorId === 0) {
        // Ignore EBEE Charging Station
        if (chargingStation.chargePointVendor !== ChargerVendor.EBEE) {
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
            await this.updateConnectorStatus(headers.tenantID, chargingStation, statusNotification, true);
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
        await this.updateConnectorStatus(headers.tenantID, chargingStation, statusNotification, false);
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

  private async updateConnectorStatus(tenantID: string, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended, bothConnectorsUpdated) {
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
        status: ChargePointStatus.UNAVAILABLE,
        power: 0,
        type: ConnectorType.UNKNOWN
      };
      chargingStation.connectors.push(foundConnector);
      // Enrich Charging Station's Connector
      await OCPPUtils.enrichChargingStationConnectorWithTemplate(tenantID, chargingStation, statusNotification.connectorId);
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
    await this.checkStatusNotificationInactivity(tenantID, chargingStation, statusNotification, foundConnector);
    // Set connector data
    foundConnector.connectorId = statusNotification.connectorId;
    foundConnector.status = statusNotification.status;
    foundConnector.errorCode = statusNotification.errorCode;
    foundConnector.info = (statusNotification.info ? statusNotification.info : '');
    foundConnector.vendorErrorCode = (statusNotification.vendorErrorCode ? statusNotification.vendorErrorCode : '');
    foundConnector.statusLastChangedOn = new Date(statusNotification.timestamp);
    // Save Status Notification
    await OCPPStorage.saveStatusNotification(tenantID, statusNotification);
    // Update Heartbeat
    chargingStation.lastHeartBeat = new Date();
    // Log
    Logging.logInfo({
      tenantID: tenantID, source: chargingStation.id,
      module: 'OCPPService', method: 'handleStatusNotification', action: 'StatusNotification',
      message: `Connector '${statusNotification.connectorId}' > Transaction ID '${foundConnector.activeTransactionID}' > Status: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}' has been saved`,
      detailedMessages: [statusNotification, foundConnector]
    });
    // Check if transaction is ongoing (ABB bug)!!!
    await this.checkStatusNotificationOngoingTransaction(tenantID, chargingStation, statusNotification, foundConnector, bothConnectorsUpdated);
    // Notify admins
    await this.notifyStatusNotification(tenantID, chargingStation, statusNotification);
    // Send new status to IOP
    await this.updateOCPIStatus(tenantID, chargingStation, statusNotification);
    // Save
    await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
  }

  private async checkStatusNotificationInactivity(tenantID: string, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended, connector: Connector) {
    // Check Inactivity
    // OCPP 1.6: Finishing --> Available
    if (connector.status === ChargePointStatus.FINISHING &&
      statusNotification.status === ChargePointStatus.AVAILABLE &&
      statusNotification.hasOwnProperty('timestamp')) {
      // Get the last transaction
      const lastTransaction = await TransactionStorage.getLastTransaction(
        tenantID, chargingStation.id, connector.connectorId);
      // Finished?
      if (lastTransaction && lastTransaction.stop) {
        if (!lastTransaction.stop.extraInactivityComputed) {
          const transactionStopTimestamp = lastTransaction.stop.timestamp;
          const statusNotifTimestamp = new Date(statusNotification.timestamp);
          lastTransaction.stop.extraInactivitySecs = Math.floor((statusNotifTimestamp.getTime() - transactionStopTimestamp.getTime()) / 1000);
          lastTransaction.stop.extraInactivityComputed = true;
          lastTransaction.stop.inactivityStatus = Utils.getInactivityStatusLevel(lastTransaction.chargeBox, lastTransaction.connectorId,
            lastTransaction.stop.totalInactivitySecs + lastTransaction.stop.extraInactivitySecs);
          // Save
          await TransactionStorage.saveTransaction(tenantID, lastTransaction);
          // Log
          Logging.logInfo({
            tenantID: tenantID, source: chargingStation.id, user: lastTransaction.userID,
            module: 'OCPPService', method: 'checkStatusNotificationInactivity', action: 'ExtraInactivity',
            message: `Connector '${lastTransaction.connectorId}' > Transaction ID '${lastTransaction.id}' > Extra Inactivity of ${lastTransaction.stop.extraInactivitySecs} secs has been added`,
            detailedMessages: [statusNotification, lastTransaction]
          });
        } else {
          // Log
          Logging.logWarning({
            tenantID: tenantID, source: chargingStation.id, user: lastTransaction.userID,
            module: 'OCPPService', method: 'checkStatusNotificationInactivity', action: 'ExtraInactivity',
            message: `Connector '${lastTransaction.connectorId}' > Transaction ID '${lastTransaction.id}' > Extra Inactivity has already been computed`,
            detailedMessages: [statusNotification, lastTransaction]
          });
        }
      }
      // OCPP 1.6: Charging --> Available
    } else if (connector.status === ChargePointStatus.CHARGING &&
      statusNotification.status === ChargePointStatus.AVAILABLE) {
      // Get the last transaction
      const lastTransaction = await TransactionStorage.getLastTransaction(
        tenantID, chargingStation.id, connector.connectorId);
      // FInished?
      if (lastTransaction && lastTransaction.stop && !lastTransaction.stop.extraInactivityComputed) {
        // Marked done
        lastTransaction.stop.extraInactivityComputed = true;
        // Save
        await TransactionStorage.saveTransaction(tenantID, lastTransaction);
        // Log
        Logging.logInfo({
          tenantID: tenantID, source: chargingStation.id, user: lastTransaction.userID,
          module: 'OCPPService', method: 'checkStatusNotificationInactivity', action: 'ExtraInactivity',
          message: `Connector '${lastTransaction.connectorId}' > Transaction ID '${lastTransaction.id}' > No Extra Inactivity has been added`,
          detailedMessages: [statusNotification, lastTransaction]
        });
      }
    }
  }

  private async checkStatusNotificationOngoingTransaction(tenantID: string, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended, connector: Connector, bothConnectorsUpdated: boolean) {
    // Check the status
    if (!bothConnectorsUpdated &&
      connector.activeTransactionID > 0 &&
      statusNotification.status === ChargePointStatus.AVAILABLE) {
      // Cleanup ongoing transactions on the connector
      await this.stopOrDeleteActiveTransactions(
        tenantID, chargingStation.id, statusNotification.connectorId);
      // Clean up connector
      OCPPUtils.checkAndFreeChargingStationConnector(chargingStation, statusNotification.connectorId, true);
    }
  }

  private async updateOCPIStatus(tenantID: string, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended) {
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.OCPI)) {
      try {
        const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, Constants.OCPI_ROLE.CPO) as CpoOCPIClient;
        if (ocpiClient) {
          await ocpiClient.patchChargingStationStatus(chargingStation, statusNotification.status);
        }
      } catch (exception) {
        Logging.logError({
          tenantID: tenantID,
          source: chargingStation.id, module: 'OCPPService', method: 'updateOCPIStatus',
          action: 'updateOCPIStatus',
          message: `An error occurred while patching the charging station status of ${chargingStation.id}`,
          detailedMessages: exception
        });
      }
    }
  }

  private async notifyStatusNotification(tenantID: string, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended) {
    // Faulted?
    if (statusNotification.status === ChargePointStatus.FAULTED) {
      // Log
      Logging.logError({
        tenantID: tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'notifyStatusNotification',
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
          'connectorId': Utils.getConnectorLetterFromConnectorID(statusNotification.connectorId),
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${(statusNotification.info ? statusNotification.info : 'N/A')}`,
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain),
          'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(tenantID, chargingStation, '#inerror')
        }
      );
    }
  }

  public async handleMeterValues(headers: OCPPHeader, meterValues: OCPPMeterValuesExtended): Promise<OCPPMeterValuesResponse> {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateMeterValues(headers.tenantID, chargingStation, meterValues);
      // Normalize Meter Values
      const newMeterValues = this.normalizeMeterValues(chargingStation, meterValues);
      // Handle Charging Station's specificities
      this.filterMeterValuesOnCharger(headers.tenantID, chargingStation, newMeterValues);
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
        if (meterValues.transactionId) {
          // Get the transaction
          const transaction = await TransactionStorage.getTransaction(headers.tenantID, meterValues.transactionId);
          // Save Meter Values
          await OCPPStorage.saveMeterValues(headers.tenantID, newMeterValues);
          // Handle Meter Values
          await this.updateTransactionWithMeterValues(headers.tenantID, transaction, newMeterValues);
          // Save Transaction
          await TransactionStorage.saveTransaction(headers.tenantID, transaction);
          // Update Charging Station Consumption
          await this.updateChargingStationConsumption(headers.tenantID, chargingStation, transaction);
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

  private buildConsumptionAndUpdateTransactionFromMeterValue(transaction: Transaction, meterValue: OCPPNormalizedMeterValue): Consumption {
    // Get the last one
    const lastMeterValue = transaction.lastMeterValue;
    // State of Charge?
    if (OCPPUtils.isSocMeterValue(meterValue)) {
      // Set current
      transaction.currentStateOfCharge = Utils.convertToFloat(meterValue.value);
      // Consumption?
    } else if (OCPPUtils.isConsumptionMeterValue(meterValue)) {
      // Update
      transaction.numberOfMeterValues = transaction.numberOfMeterValues + 1;
      transaction.lastMeterValue = {
        value: Utils.convertToFloat(meterValue.value),
        timestamp: Utils.convertToDate(meterValue.timestamp)
      };
      // Compute duration
      const diffSecs = moment(meterValue.timestamp).diff(lastMeterValue.timestamp, 'milliseconds') / 1000;
      // Check if the new value is greater
      if (Utils.convertToFloat(meterValue.value) >= lastMeterValue.value) {
        // Compute consumption
        const sampleMultiplier = diffSecs > 0 ? 3600 / diffSecs : 0;
        const consumption = Utils.convertToFloat(meterValue.value) - Utils.convertToFloat(lastMeterValue.value);
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
      // Update inactivity status
      transaction.currentInactivityStatus = Utils.getInactivityStatusLevel(
        transaction.chargeBox, transaction.connectorId, transaction.currentTotalInactivitySecs);
    }
    // Compute consumption
    return this.buildConsumptionFromTransactionAndMeterValue(
      transaction, lastMeterValue.timestamp, meterValue.timestamp, meterValue);
  }

  private buildConsumptionFromTransactionAndMeterValue(transaction: Transaction, startedAt: Date, endedAt: Date, meterValue: OCPPNormalizedMeterValue): Consumption {
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

  private async updateTransactionWithMeterValues(tenantID: string, transaction: Transaction, meterValues: OCPPNormalizedMeterValues) {
    // Build consumptions
    const consumptions: Consumption[] = [];
    for (const meterValue of meterValues.values) {
      // Handles Signed Data values
      if (meterValue.attribute.format === 'SignedData') {
        if (meterValue.attribute.context === 'Transaction.Begin') {
          transaction.signedData = meterValue.value;
          continue;
        } else if (meterValue.attribute.context === 'Transaction.End') {
          transaction.currentSignedData = meterValue.value + '';
          continue;
        }
      }
      // SoC handling
      if (meterValue.attribute.measurand === 'SoC') {
        // Set the first SoC
        if (meterValue.attribute.context === 'Transaction.Begin') {
          transaction.stateOfCharge = Utils.convertToFloat(meterValue.value);
          continue;
          // Set the Last SoC
        } else if (meterValue.attribute.context === 'Transaction.End') {
          transaction.currentStateOfCharge = Utils.convertToFloat(meterValue.value);
          continue;
        }
      }
      // Only Consumption Meter Value
      if (OCPPUtils.isSocMeterValue(meterValue) ||
        OCPPUtils.isConsumptionMeterValue(meterValue)) {
        // Build Consumption and Update Transaction with Meter Values
        const consumption: Consumption = await this.buildConsumptionAndUpdateTransactionFromMeterValue(transaction, meterValue);
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
        await this.priceTransaction(tenantID, transaction, consumption, TransactionAction.UPDATE);
        await this.billTransaction(tenantID, transaction, TransactionAction.UPDATE);
      }
      await ConsumptionStorage.saveConsumption(tenantID, consumption);
    }
  }

  private async priceTransaction(tenantID: string, transaction: Transaction, consumption: Consumption, action: TransactionAction) {
    let pricedConsumption;
    // Get the pricing impl
    const pricingImpl = await PricingFactory.getPricingImpl(tenantID, transaction);
    switch (action) {
      // Start Transaction
      case TransactionAction.START:
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
      case TransactionAction.UPDATE:
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
              consumption.cumulatedAmount = Utils.convertToFloat((transaction.currentCumulatedPrice + consumption.amount).toFixed(6));
            }
            transaction.currentCumulatedPrice = consumption.cumulatedAmount;
          }
        }
        break;
      // Stop Transaction
      case TransactionAction.STOP:
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
              consumption.cumulatedAmount = Utils.convertToFloat((transaction.currentCumulatedPrice + consumption.amount).toFixed(6));
            }
            transaction.currentCumulatedPrice = consumption.cumulatedAmount;
            // Update Transaction
            if (!transaction.stop) {
              (transaction as any).stop = {};
            }
            transaction.stop.price = Utils.convertToFloat(transaction.currentCumulatedPrice.toFixed(6));
            transaction.stop.roundedPrice = Utils.convertToFloat((transaction.currentCumulatedPrice).toFixed(2));
            transaction.stop.priceUnit = pricedConsumption.currencyCode;
            transaction.stop.pricingSource = pricedConsumption.pricingSource;
          }
        }
        break;
    }
  }

  private async billTransaction(tenantID: string, transaction: Transaction, action: TransactionAction) {
    const billingImpl = await BillingFactory.getBillingImpl(tenantID);
    if (!billingImpl) {
      return;
    }
    // Checl
    switch (action) {
      // Start Transaction
      case TransactionAction.START:
        // Delegate
        const billingDataStart = await billingImpl.startTransaction(transaction);
        // Update
        transaction.billingData = {
          lastUpdate: new Date()
        };
        // Cancel?
        if (billingDataStart.cancelTransaction) {
        }
        break;
      // Meter Values
      case TransactionAction.UPDATE:
        // Delegate
        const billingDataUpdate = await billingImpl.updateTransaction(transaction);
        // Update
        transaction.billingData.lastUpdate = new Date();
        // Cancel?
        if (billingDataUpdate.cancelTransaction) {
        }
        break;
      // Stop Transaction
      case TransactionAction.STOP:
        // Delegate
        const billingDataStop = await billingImpl.stopTransaction(transaction);
        // Update
        transaction.billingData.status = billingDataStop.status;
        transaction.billingData.invoiceStatus = billingDataStop.invoiceStatus;
        transaction.billingData.invoiceItem = billingDataStop.invoiceItem;
        transaction.billingData.lastUpdate = new Date();
        break;
    }
  }

  // Save Consumption
  private async updateChargingStationConsumption(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    // Get the connector
    const foundConnector: Connector = chargingStation.connectors.find(
      (connector) => connector.connectorId === transaction.connectorId);
    // Active transaction?
    if (!transaction.stop && foundConnector) {
      // Set consumption
      foundConnector.currentConsumption = transaction.currentConsumption;
      foundConnector.totalConsumption = transaction.currentTotalConsumption;
      foundConnector.totalInactivitySecs = transaction.currentTotalInactivitySecs;
      foundConnector.inactivityStatus = Utils.getInactivityStatusLevel(
        transaction.chargeBox, transaction.connectorId, transaction.currentTotalInactivitySecs);
      foundConnector.currentStateOfCharge = transaction.currentStateOfCharge;
      foundConnector.totalInactivitySecs = transaction.currentTotalInactivitySecs;
      // Set Transaction ID
      foundConnector.activeTransactionID = transaction.id;
      foundConnector.activeTagID = transaction.tagID;
      // Update Heartbeat
      chargingStation.lastHeartBeat = new Date();
      // Handle End Of charge
      await this.checkNotificationEndOfCharge(tenantID, chargingStation, transaction);
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id, module: 'OCPPService',
        method: 'updateChargingStationConsumption', action: 'ChargingStationConsumption',
        message: `Connector '${foundConnector.connectorId}' > Transaction ID '${foundConnector.activeTransactionID}' > Instant: ${foundConnector.currentConsumption / 1000} kW.h, Total: ${foundConnector.totalConsumption / 1000} kW.h${foundConnector.currentStateOfCharge ? ', SoC: ' + foundConnector.currentStateOfCharge + ' %' : ''}`
      });
      // Cleanup connector transaction data
    } else if (foundConnector) {
      foundConnector.currentConsumption = 0;
      foundConnector.totalConsumption = 0;
      foundConnector.totalInactivitySecs = 0;
      foundConnector.inactivityStatus = InactivityStatus.INFO;
      foundConnector.currentStateOfCharge = 0;
      foundConnector.activeTransactionID = 0;
      foundConnector.activeTransactionDate = null;
      foundConnector.activeTagID = null;
    }
  }

  private async notifyEndOfCharge(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Switch language
      I18nManager.switchLocale(transaction.user.locale);
      // Notify (Async)
      NotificationHandler.sendEndOfCharge(
        tenantID,
        transaction.user,
        chargingStation,
        {
          'user': transaction.user,
          'transactionId': transaction.id,
          'chargeBoxID': chargingStation.id,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'totalConsumption': I18nManager.formatNumber(Math.round(transaction.currentTotalConsumption / 10) / 100),
          'stateOfCharge': transaction.currentStateOfCharge,
          'totalDuration': this.buildCurrentTransactionDuration(transaction),
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#inprogress'),
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
        }
      );
    }
  }

  private async notifyOptimalChargeReached(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Switch language
      I18nManager.switchLocale(transaction.user.locale);
      // Notifcation Before End Of Charge (Async)
      NotificationHandler.sendOptimalChargeReached(
        tenantID,
        transaction.id + '-OCR',
        transaction.user,
        chargingStation,
        {
          'user': transaction.user,
          'chargeBoxID': chargingStation.id,
          'transactionId': transaction.id,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'totalConsumption': I18nManager.formatNumber(Math.round(transaction.currentTotalConsumption / 10) / 100),
          'stateOfCharge': transaction.currentStateOfCharge,
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#inprogress'),
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
        }
      );
    }
  }

  private async checkNotificationEndOfCharge(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    // Transaction in progress?
    if (transaction && !transaction.stop) {
      // Has consumption?
      if (transaction.numberOfMeterValues > 1 && transaction.currentTotalConsumption > 0) {
        // End of charge?
        if (_configChargingStation.notifEndOfChargeEnabled &&
          (transaction.currentTotalInactivitySecs > 60 || transaction.currentStateOfCharge === 100)) {
          // Send Notification
          await this.notifyEndOfCharge(tenantID, chargingStation, transaction);
          // Optimal Charge? (SoC)
        } else if (_configChargingStation.notifBeforeEndOfChargeEnabled &&
          transaction.currentStateOfCharge >= _configChargingStation.notifBeforeEndOfChargePercent) {
          // Send Notification
          await this.notifyOptimalChargeReached(tenantID, chargingStation, transaction);
        }
      }
    }
  }

  // Build Inactivity
  private buildTransactionInactivity(transaction: Transaction, i18nHourShort = 'h') {
    // Get total
    const totalInactivitySecs = transaction.stop.totalInactivitySecs;
    // None?
    if (totalInactivitySecs === 0) {
      return `0${i18nHourShort}00 (${I18nManager.formatPercentage(0)})`;
    }
    // Build the inactivity percentage
    const totalInactivityPercent = I18nManager.formatPercentage(Math.round((totalInactivitySecs / transaction.stop.totalDurationSecs) * 100) / 100);
    return moment.duration(totalInactivitySecs, 's').format(`h[${i18nHourShort}]mm`, { trim: false }) + ` (${totalInactivityPercent})`;
  }

  // Build duration
  private buildCurrentTransactionDuration(transaction: Transaction): string {
    let totalDuration;
    if (!transaction.stop) {
      totalDuration = moment.duration(moment(transaction.lastMeterValue.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    } else {
      totalDuration = moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    }
    return moment.duration(totalDuration, 's').format('h[h]mm', { trim: false });
  }

  // Build duration
  private buildTransactionDuration(transaction: Transaction): string {
    return moment.duration(transaction.stop.totalDurationSecs, 's').format('h[h]mm', { trim: false });
  }

  private filterMeterValuesOnCharger(tenantID: string, chargingStation: ChargingStation, meterValues: OCPPNormalizedMeterValues) {
    // Clean up Sample.Clock meter value
    if (chargingStation.chargePointVendor !== ChargerVendor.ABB ||
      chargingStation.ocppVersion !== OCPPVersion.VERSION_15) {
      // Filter Sample.Clock meter value for all chargers except ABB using OCPP 1.5
      meterValues.values = meterValues.values.filter((meterValue) => {
        // Remove Sample Clock
        if (meterValue.attribute.context === 'Sample.Clock') {
          // Log
          Logging.logWarning({
            tenantID: tenantID, source: chargingStation.id,
            module: 'OCPPService', method: 'filterMeterValuesOnCharger', action: 'MeterValues',
            message: 'Removed Meter Value with attribute context \'Sample.Clock\'',
            detailedMessages: meterValue
          });
          return false;
        }
        return true;
      });
    }
  }

  private normalizeMeterValues(chargingStation: ChargingStation, meterValues: OCPPMeterValuesExtended): OCPPNormalizedMeterValues {
    // Create the model
    const newMeterValues: OCPPNormalizedMeterValues = {} as OCPPNormalizedMeterValues;
    newMeterValues.values = [];
    newMeterValues.chargeBoxID = chargingStation.id;
    // OCPP 1.6
    if (chargingStation.ocppVersion === OCPPVersion.VERSION_16) {
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
      const newMeterValue: OCPPNormalizedMeterValue = {} as OCPPNormalizedMeterValue;
      // Set the Meter Value header
      newMeterValue.chargeBoxID = newMeterValues.chargeBoxID;
      newMeterValue.connectorId = meterValues.connectorId;
      newMeterValue.transactionId = meterValues.transactionId;
      newMeterValue.timestamp = Utils.convertToDate(value.timestamp);
      // OCPP 1.6
      if (chargingStation.ocppVersion === OCPPVersion.VERSION_16) {
        // Multiple Values?
        if (Array.isArray(value.sampledValue)) {
          // Create one record per value
          for (const sampledValue of value.sampledValue) {
            // Add Attributes
            const newLocalMeterValue = JSON.parse(JSON.stringify(newMeterValue));
            newLocalMeterValue.attribute = this.buildMeterValueAttributes(sampledValue);
            // Data is to be interpreted as integer/decimal numeric data
            if (newLocalMeterValue.attribute.format === 'Raw') {
              newLocalMeterValue.value = Utils.convertToFloat(sampledValue.value);
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
          newLocalMeterValue.attribute = this.buildMeterValueAttributes(value.sampledValue);
          // Add
          newMeterValues.values.push(newLocalMeterValue);
        }
        // OCPP < 1.6
      } else if (value['value']) {
        // OCPP 1.2
        if (value['value']['$value']) {
          // Set
          newMeterValue.value = value['value']['$value'];
          newMeterValue.attribute = value['value'].attributes;
          // OCPP 1.5
        } else {
          newMeterValue.value = Utils.convertToFloat(value['value']);
        }
        // Add
        newMeterValues.values.push(newMeterValue);
      }
    }
    return newMeterValues;
  }

  private buildMeterValueAttributes(sampledValue: OCPPSampledValue): OCPPAttribute {
    return {
      context: (sampledValue.context ? sampledValue.context : OCPPReadingContext.SAMPLE_PERIODIC),
      format: (sampledValue.format ? sampledValue.format : OCPPValueFormat.RAW),
      measurand: (sampledValue.measurand ? sampledValue.measurand : OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER),
      location: (sampledValue.location ? sampledValue.location : OCPPLocation.OUTLET),
      unit: (sampledValue.unit ? sampledValue.unit : OCPPUnitOfMeasure.WATT_HOUR),
      phase: (sampledValue.phase ? sampledValue.phase : null)
    };
  }

  public async handleAuthorize(headers: OCPPHeader, authorize: OCPPAuthorizeRequestExtended): Promise<OCPPAuthorizeResponse> {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateAuthorize(authorize);
      // Set header
      authorize.chargeBoxID = chargingStation.id;
      authorize.timestamp = new Date();
      authorize.timezone = Utils.getTimezone(chargingStation.coordinates);
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
        'status': OCPPAuthorizationStatus.ACCEPTED
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, 'Authorize', error);
      return {
        'status': OCPPAuthorizationStatus.INVALID
      };
    }
  }

  public async handleDiagnosticsStatusNotification(headers: OCPPHeader, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequestExtended): Promise<OCPPDiagnosticsStatusNotificationResponse> {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateDiagnosticsStatusNotification(chargingStation, diagnosticsStatusNotification);
      // Set the Charging Station ID
      diagnosticsStatusNotification.chargeBoxID = chargingStation.id;
      diagnosticsStatusNotification.timestamp = new Date();
      diagnosticsStatusNotification.timezone = Utils.getTimezone(chargingStation.coordinates);
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

  public async handleFirmwareStatusNotification(headers: OCPPHeader, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended): Promise<OCPPFirmwareStatusNotificationResponse> {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateFirmwareStatusNotification(chargingStation, firmwareStatusNotification);
      // Set the Charging Station ID
      firmwareStatusNotification.chargeBoxID = chargingStation.id;
      firmwareStatusNotification.timestamp = new Date();
      firmwareStatusNotification.timezone = Utils.getTimezone(chargingStation.coordinates);
      // Save it
      await OCPPStorage.saveFirmwareStatusNotification(headers.tenantID, firmwareStatusNotification);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'handleFirmwareStatusNotification',
        action: 'FirmwareStatusNotification',
        message: `Firmware Status Notification '${firmwareStatusNotification.status}' has been saved`
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

  public async handleStartTransaction(headers: OCPPHeader, startTransaction: OCPPStartTransactionRequestExtended): Promise<OCPPStartTransactionResponse> {
    try {
      // Get the charging station
      const chargingStation: ChargingStation = await OCPPUtils.checkAndGetChargingStation(
        headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateStartTransaction(chargingStation, startTransaction);
      // Set the header
      startTransaction.chargeBoxID = chargingStation.id;
      startTransaction.tagID = startTransaction.idTag;
      startTransaction.timezone = Utils.getTimezone(chargingStation.coordinates);
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
      await this.stopOrDeleteActiveTransactions(
        headers.tenantID, chargingStation.id, startTransaction.connectorId);
      // Create
      const transaction: Transaction = {
        chargeBoxID: startTransaction.chargeBoxID,
        tagID: startTransaction.idTag,
        timezone: startTransaction.timezone,
        userID: startTransaction.userID,
        siteAreaID: startTransaction.siteAreaID,
        siteID: startTransaction.siteID,
        connectorId: startTransaction.connectorId,
        meterStart: startTransaction.meterStart,
        timestamp: Utils.convertToDate(startTransaction.timestamp),
        numberOfMeterValues: 0,
        lastMeterValue: {
          value: startTransaction.meterStart,
          timestamp: Utils.convertToDate(startTransaction.timestamp)
        },
        currentTotalInactivitySecs: 0,
        currentInactivityStatus: InactivityStatus.INFO,
        currentStateOfCharge: 0,
        currentConsumption: 0,
        currentTotalConsumption: 0,
        currentConsumptionWh: 0,
        signedData: '',
        stateOfCharge: 0,
        user
      };
      // Build first Dummy consumption for pricing the Start Transaction
      const consumption = this.buildConsumptionFromTransactionAndMeterValue(
        transaction, transaction.timestamp, transaction.timestamp, {
          id: '666',
          chargeBoxID: transaction.chargeBoxID,
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          timestamp: transaction.timestamp,
          value: transaction.meterStart,
          attribute: DEFAULT_OCPP_CONSUMPTION_ATTRIBUTE
        }
      );
      // Price it
      await this.priceTransaction(headers.tenantID, transaction, consumption, TransactionAction.START);
      // Billing
      await this.billTransaction(headers.tenantID, transaction, TransactionAction.START);
      // Save it
      transaction.id = await TransactionStorage.saveTransaction(headers.tenantID, transaction);
      // Clean up Charging Station's connector transaction info
      const foundConnector = chargingStation.connectors.find(
        (connector) => connector.connectorId === transaction.connectorId);
      if (foundConnector) {
        foundConnector.currentConsumption = 0;
        foundConnector.totalConsumption = 0;
        foundConnector.totalInactivitySecs = 0;
        foundConnector.inactivityStatus = InactivityStatus.INFO;
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
      // Notifiy
      await this.notifyStartTransaction(headers.tenantID, transaction, chargingStation, user);
      // Log
      if (user) {
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
        'status': OCPPAuthorizationStatus.ACCEPTED
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, Action.START_TRANSACTION, error);
      return {
        'transactionId': 0,
        'status': OCPPAuthorizationStatus.INVALID
      };
    }
  }

  private async stopOrDeleteActiveTransactions(tenantID: string, chargeBoxID: string, connectorId: number) {
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
            module: 'OCPPService', method: 'stopOrDeleteActiveTransactions',
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
            'chargeBoxID': activeTransaction.chargeBoxID,
            'transactionId': activeTransaction.id,
            'meterStop': activeTransaction.lastMeterValue.value,
            'timestamp': Utils.convertToDate(activeTransaction.lastMeterValue.timestamp).toISOString(),
          }, false, true);
          // Check
          if (result.status === 'Invalid') {
            // No consumption: delete
            Logging.logError({
              tenantID: tenantID, source: chargeBoxID,
              module: 'OCPPService', method: 'stopOrDeleteActiveTransactions',
              action: 'CleanupTransaction', actionOnUser: activeTransaction.userID,
              message: `Connector '${activeTransaction.connectorId}' > Cannot delete pending Transaction ID '${activeTransaction.id}' with no consumption`
            });
          } else {
            // Has consumption: close it!
            Logging.logWarning({
              tenantID: tenantID, source: chargeBoxID,
              module: 'OCPPService', method: 'stopOrDeleteActiveTransactions',
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

  private async notifyStartTransaction(tenantID: string, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user) {
      // Notify (Async)
      NotificationHandler.sendSessionStarted(
        tenantID,
        transaction.id + '',
        user,
        chargingStation,
        {
          'user': user,
          'transactionId': transaction.id,
          'chargeBoxID': chargingStation.id,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain),
          'evseDashboardChargingStationURL':
            await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#inprogress')
        }
      );
    }
  }

  public async handleDataTransfer(headers: OCPPHeader, dataTransfer: OCPPDataTransferRequestExtended): Promise<OCPPDataTransferResponse> {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateDataTransfer(chargingStation, dataTransfer);
      // Set the Charging Station ID
      dataTransfer.chargeBoxID = chargingStation.id;
      dataTransfer.timestamp = new Date();
      dataTransfer.timezone = Utils.getTimezone(chargingStation.coordinates);
      // Save it
      await OCPPStorage.saveDataTransfer(headers.tenantID, dataTransfer);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID, source: chargingStation.id,
        module: 'OCPPService', method: 'handleDataTransfer',
        action: Action.DATA_TRANSFER, message: 'Data Transfer has been saved'
      });
      // Return
      return {
        'status': OCPPDataTransferStatus.ACCEPTED
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, Action.DATA_TRANSFER, error);
      return {
        'status': OCPPDataTransferStatus.REJECTED
      };
    }
  }

  public async handleStopTransaction(headers: OCPPHeader, stopTransaction: OCPPStopTransactionRequestExtended, isSoftStop = false, stoppedByCentralSystem = false): Promise<OCPPStopTransactionResponse> {
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
      const tagId = this.getStopTransactionTagId(stopTransaction, transaction);
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
          module: 'OCPPService', method: 'handleStopTransaction',
          message: `Transaction ID '${stopTransaction.transactionId}' has already been stopped`,
          action: Action.STOP_TRANSACTION,
          user: (alternateUser ? alternateUser : user),
          actionOnUser: (alternateUser ? (user ? user : null) : null)
        });
      }
      // Check and free the connector
      OCPPUtils.checkAndFreeChargingStationConnector(chargingStation, transaction.connectorId, false);
      // Update Heartbeat
      chargingStation.lastHeartBeat = new Date();
      // Save Charging Station
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
      const lastMeterValue = this.updateTransactionWithStopTransaction(
        transaction, stopTransaction, user, alternateUser, tagId);
      // Build final consumption
      const consumption: Consumption = this.buildConsumptionFromTransactionAndMeterValue(
        transaction, lastMeterValue.timestamp, transaction.stop.timestamp, {
          id: '6969',
          chargeBoxID: transaction.chargeBoxID,
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          timestamp: transaction.stop.timestamp,
          value: transaction.stop.meterStop,
          attribute: DEFAULT_OCPP_CONSUMPTION_ATTRIBUTE
        }
      );
      // Update the price
      await this.priceTransaction(headers.tenantID, transaction, consumption, TransactionAction.STOP);
      // Finalize billing
      await this.billTransaction(headers.tenantID, transaction, TransactionAction.STOP);
      // Save Consumption
      await ConsumptionStorage.saveConsumption(headers.tenantID, consumption);
      // Save the transaction
      transaction.id = await TransactionStorage.saveTransaction(headers.tenantID, transaction);
      // Notify User
      await this.notifyStopTransaction(headers.tenantID, chargingStation, transaction, user, alternateUser);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID,
        source: chargingStation.id, module: 'OCPPService', method: 'handleStopTransaction',
        action: Action.STOP_TRANSACTION,
        user: (alternateUser ? alternateUser : (user ? user : null)),
        actionOnUser: (alternateUser ? (user ? user : null) : null),
        message: `Connector '${transaction.connectorId}' > Transaction ID '${transaction.id}' has been stopped successfully`
      });
      // Success
      return {
        'status': OCPPAuthorizationStatus.ACCEPTED
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, Action.STOP_TRANSACTION, error);
      // Error
      return { 'status': OCPPAuthorizationStatus.INVALID };
    }
  }

  private updateTransactionWithStopTransaction(transaction: Transaction, stopTransaction: OCPPStopTransactionRequestExtended, user: User, alternateUser: User, tagId) {
    if (!transaction.stop) {
      (transaction as any).stop = {};
    }
    transaction.stop.meterStop = Utils.convertToFloat(stopTransaction.meterStop);
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
      const consumption = transaction.stop.meterStop - Utils.convertToFloat(lastMeterValue.value);
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
    // Update Inactivity Status
    transaction.stop.inactivityStatus =
      Utils.getInactivityStatusLevel(transaction.chargeBox, transaction.connectorId, transaction.stop.totalInactivitySecs);
    return lastMeterValue;
  }

  private getStopTransactionTagId(stopTransaction: OCPPStopTransactionRequestExtended, transaction: Transaction): string {
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

  private async notifyStopTransaction(tenantID: string, chargingStation: ChargingStation, transaction: Transaction, user: User, alternateUser: User) {
    // User provided?
    if (user) {
      // Switch language
      I18nManager.switchLocale(user.locale);
      // Send Notification (Async)
      NotificationHandler.sendEndOfSession(
        tenantID,
        transaction.id + '-EOS',
        user,
        chargingStation,
        {
          'user': user,
          'alternateUser': (alternateUser ? alternateUser : null),
          'transactionId': transaction.id,
          'chargeBoxID': chargingStation.id,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'totalConsumption': I18nManager.formatNumber(Math.round(transaction.stop.totalConsumption / 10) / 100),
          'totalDuration': this.buildTransactionDuration(transaction),
          'totalInactivity': this.buildTransactionInactivity(transaction),
          'stateOfCharge': transaction.stop.stateOfCharge,
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#history'),
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
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
            'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
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
          }
        );
      }
    }
  }
}

