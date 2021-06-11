import { ChargePointErrorCode, ChargePointStatus, OCPPAttribute, OCPPAuthorizationStatus, OCPPAuthorizeRequestExtended, OCPPAuthorizeResponse, OCPPBootNotificationRequestExtended, OCPPBootNotificationResponse, OCPPDataTransferRequestExtended, OCPPDataTransferResponse, OCPPDataTransferStatus, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequestExtended, OCPPHeartbeatResponse, OCPPLocation, OCPPMeasurand, OCPPMeterValuesRequest, OCPPMeterValuesRequestExtended, OCPPMeterValuesResponse, OCPPNormalizedMeterValue, OCPPNormalizedMeterValues, OCPPPhase, OCPPProtocol, OCPPReadingContext, OCPPSampledValue, OCPPStartTransactionRequestExtended, OCPPStartTransactionResponse, OCPPStatusNotificationRequestExtended, OCPPStatusNotificationResponse, OCPPStopTransactionRequestExtended, OCPPStopTransactionResponse, OCPPUnitOfMeasure, OCPPValueFormat, OCPPVersion, RegistrationStatus } from '../../../types/ocpp/OCPPServer';
import { ChargingProfilePurposeType, ChargingRateUnitType } from '../../../types/ChargingProfile';
import ChargingStation, { ChargerVendor, Connector, ConnectorCurrentLimitSource, ConnectorType, CurrentType, StaticLimitAmps, TemplateUpdateResult } from '../../../types/ChargingStation';
import { OCPPChangeConfigurationCommandResult, OCPPConfigurationStatus } from '../../../types/ocpp/OCPPClient';
import Transaction, { InactivityStatus, TransactionAction } from '../../../types/Transaction';

import { Action } from '../../../types/Authorization';
import Authorizations from '../../../authorization/Authorizations';
import BackendError from '../../../exception/BackendError';
import CarStorage from '../../../storage/mongodb/CarStorage';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import CpoOCPIClient from '../../../client/ocpi/CpoOCPIClient';
import CpoOICPClient from '../../../client/oicp/CpoOICPClient';
import I18nManager from '../../../utils/I18nManager';
import LockingHelper from '../../../locking/LockingHelper';
import LockingManager from '../../../locking/LockingManager';
import Logging from '../../../utils/Logging';
import NotificationHandler from '../../../notification/NotificationHandler';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import OCPPUtils from '../utils/OCPPUtils';
import OCPPValidation from '../validation/OCPPValidation';
import OICPClientFactory from '../../../client/oicp/OICPClientFactory';
import { OICPRole } from '../../../types/oicp/OICPRole';
import RegistrationTokenStorage from '../../../storage/mongodb/RegistrationTokenStorage';
import { ServerAction } from '../../../types/Server';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import SmartChargingFactory from '../../../integration/smart-charging/SmartChargingFactory';
import Tenant from '../../../types/Tenant';
import TenantComponents from '../../../types/TenantComponents';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import moment from 'moment';
import momentDurationFormatSetup from 'moment-duration-format';

momentDurationFormatSetup(moment as any);

const MODULE_NAME = 'OCPPService';

export default class OCPPService {
  private chargingStationConfig: ChargingStationConfiguration;

  public constructor(chargingStationConfig: ChargingStationConfiguration) {
    this.chargingStationConfig = chargingStationConfig;
  }

  public async handleBootNotification(headers: OCPPHeader, bootNotification: OCPPBootNotificationRequestExtended): Promise<OCPPBootNotificationResponse> {
    try {
      // Check
      OCPPValidation.getInstance().validateBootNotification(bootNotification);
      // Enrich Boot Notification
      this.enrichBootNotification(headers, bootNotification);
      // Get heartbeat interval
      const heartbeatIntervalSecs = this.getHeartbeatInterval(headers.ocppProtocol);
      // Check Charging Station
      if (!headers.chargeBoxIdentity) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BOOT_NOTIFICATION,
          module: MODULE_NAME, method: 'handleBootNotification',
          message: 'Should have the required property \'chargeBoxIdentity\'!',
          detailedMessages: { headers, bootNotification }
        });
      }
      // Check Tenant
      const tenant = await TenantStorage.getTenant(headers.tenantID);
      if (!tenant) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'handleBootNotification',
          message: `Tenant ID '${headers.tenantID}' does not exist!`
        });
      }
      // Get Charging Station
      let chargingStation = await ChargingStationStorage.getChargingStation(tenant.id, headers.chargeBoxIdentity);
      if (!chargingStation) {
        // Create Charging Station
        chargingStation = await this.checkAndRegisterNewChargingStation(tenant, bootNotification, headers);
      } else {
        // Check Charging Station
        await this.checkExistingChargingStation(headers, chargingStation, bootNotification);
      }
      // Enrich Charging Station
      this.enrichChargingStation(chargingStation, headers, bootNotification);
      // Apply Charging Station Template
      const templateUpdateResult = await this.applyChargingStationTemplate(tenant, chargingStation);
      // Save Boot Notification
      await OCPPStorage.saveBootNotification(tenant, bootNotification);
      // Send Notification (Async)
      this.notifyBootNotification(tenant, chargingStation);
      // Request OCPP configuration
      this.requestOCPPConfigurationDelayed(tenant, chargingStation, templateUpdateResult, heartbeatIntervalSecs);
      // Log
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        action: ServerAction.BOOT_NOTIFICATION,
        module: MODULE_NAME, method: 'handleBootNotification',
        message: 'Boot Notification saved',
        detailedMessages: { headers, bootNotification }
      });
      // Accept
      return {
        currentTime: bootNotification.timestamp.toISOString(),
        status: RegistrationStatus.ACCEPTED,
        interval: heartbeatIntervalSecs
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.BOOT_NOTIFICATION, error);
      // Reject
      return {
        status: RegistrationStatus.REJECTED,
        currentTime: bootNotification.timestamp ? bootNotification.timestamp.toISOString() : new Date().toISOString(),
        interval: Constants.BOOT_NOTIFICATION_WAIT_TIME
      };
    }
  }

  public async handleHeartbeat(headers: OCPPHeader, heartbeat: OCPPHeartbeatRequestExtended): Promise<OCPPHeartbeatResponse> {
    try {
      // Get Charging Station
      const { chargingStation, tenant } = await OCPPUtils.checkAndGetTenantAndChargingStation(headers);
      // Check
      OCPPValidation.getInstance().validateHeartbeat(heartbeat);
      // Replace IPs
      chargingStation.currentIPAddress = headers.currentIPAddress;
      // Set lastSeen
      chargingStation.lastSeen = new Date();
      // Set Heart Beat Object
      heartbeat = {
        chargeBoxID: chargingStation.id,
        timestamp: new Date(),
        timezone: Utils.getTimezone(chargingStation.coordinates)
      };
      // Save Charging Station lastSeen date
      await ChargingStationStorage.saveChargingStationLastSeen(tenant.id, chargingStation.id, {
        lastSeen: chargingStation.lastSeen,
        currentIPAddress: chargingStation.currentIPAddress,
      });
      // Save Heart Beat
      await OCPPStorage.saveHeartbeat(tenant, heartbeat);
      // Log
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleHeartbeat',
        action: ServerAction.HEARTBEAT,
        message: `Heartbeat saved with IP '${chargingStation.currentIPAddress.toString()}'`,
        detailedMessages: { headers, heartbeat }
      });
      return {
        currentTime: chargingStation.lastSeen.toISOString()
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.HEARTBEAT, error);
      return {
        currentTime: new Date().toISOString()
      };
    }
  }

  public async handleStatusNotification(headers: OCPPHeader, statusNotification: OCPPStatusNotificationRequestExtended): Promise<OCPPStatusNotificationResponse> {
    try {
      // Get charging station
      const { chargingStation, tenant } = await OCPPUtils.checkAndGetTenantAndChargingStation(headers);
      // Check props
      OCPPValidation.getInstance().validateStatusNotification(statusNotification);
      // Set Header
      this.enrichOCPPRequest(chargingStation, statusNotification, false);
      // Skip connectorId = 0 case
      if (statusNotification.connectorId <= 0) {
        await Logging.logInfo({
          tenantID: tenant.id,
          source: chargingStation.id,
          action: ServerAction.STATUS_NOTIFICATION,
          module: MODULE_NAME, method: 'handleStatusNotification',
          message: `Connector ID '0' > Received Status: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`,
          detailedMessages: { headers, statusNotification }
        });
        return {};
      }
      // Update only the given Connector ID
      await this.updateConnectorStatus(tenant, chargingStation, statusNotification);
      return {};
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.STATUS_NOTIFICATION, error);
      return {};
    }
  }

  public async handleMeterValues(headers: OCPPHeader, meterValues: OCPPMeterValuesRequestExtended): Promise<OCPPMeterValuesResponse> {
    try {
      // Get the charging station
      const { chargingStation, tenant } = await OCPPUtils.checkAndGetTenantAndChargingStation(headers);
      // Check
      await OCPPValidation.getInstance().validateMeterValues(tenant.id, chargingStation, meterValues);
      // Normalize Meter Values
      const normalizedMeterValues = this.normalizeMeterValues(chargingStation, meterValues);
      // Handle Charging Station's specificities
      this.filterMeterValuesOnSpecificChargingStations(tenant, chargingStation, normalizedMeterValues);
      if (Utils.isEmptyArray(normalizedMeterValues.values)) {
        await Logging.logDebug({
          tenantID: tenant.id,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'handleMeterValues',
          action: ServerAction.METER_VALUES,
          message: 'No relevant Meter Values to save',
          detailedMessages: { headers, meterValues }
        });
        return {};
      }
      // Get Transaction
      const transaction = await this.getTransactionFromMeterValues(tenant, chargingStation, headers, meterValues);
      // Save Meter Values
      await OCPPStorage.saveMeterValues(tenant, normalizedMeterValues);
      // Update Transaction
      this.updateTransactionWithMeterValues(chargingStation, transaction, normalizedMeterValues.values);
      // Create Consumptions
      const consumptions = await OCPPUtils.createConsumptionsFromMeterValues(tenant, chargingStation, transaction, normalizedMeterValues.values);
      // Price/Bill Transaction and Save them
      for (const consumption of consumptions) {
        // Update Transaction with Consumption
        OCPPUtils.updateTransactionWithConsumption(chargingStation, transaction, consumption);
        if (consumption.toPrice) {
          // Pricing
          await OCPPUtils.processTransactionPricing(tenant, transaction, chargingStation, consumption, TransactionAction.UPDATE);
          // Billing
          await OCPPUtils.processTransactionBilling(tenant, transaction, TransactionAction.UPDATE);
        }
        // Save
        await ConsumptionStorage.saveConsumption(tenant.id, consumption);
      }
      // Get the phases really used from Meter Values (for AC single phase charger/car)
      if (!transaction.phasesUsed &&
          Utils.checkIfPhasesProvidedInTransactionInProgress(transaction) &&
          transaction.numberOfMeterValues >= 1) {
        transaction.phasesUsed = Utils.getUsedPhasesInTransactionInProgress(chargingStation, transaction);
      }
      // Roaming
      await OCPPUtils.processTransactionRoaming(tenant, transaction, chargingStation, TransactionAction.UPDATE);
      // Save Transaction
      await TransactionStorage.saveTransaction(tenant.id, transaction);
      // Update Charging Station
      await this.updateChargingStationWithTransaction(tenant, chargingStation, transaction);
      // Handle End Of charge
      await this.checkNotificationEndOfCharge(tenant, chargingStation, transaction);
      // Save Charging Station
      await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
      // First Meter Value -> Trigger Smart Charging to adjust the limit
      if (transaction.numberOfMeterValues === 1 && transaction.phasesUsed) {
        // Yes: Trigger Smart Charging
        await this.triggerSmartCharging(tenant, chargingStation);
      }
      // Log
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        action: ServerAction.METER_VALUES,
        user: transaction.userID,
        module: MODULE_NAME, method: 'handleMeterValues',
        message: `Connector ID '${meterValues.connectorId.toString()}' > Transaction ID '${meterValues.transactionId.toString()}' > MeterValue have been saved`,
        detailedMessages: { headers, normalizedMeterValues }
      });
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.METER_VALUES, error);
    }
    return {};
  }

  public async handleAuthorize(headers: OCPPHeader, authorize: OCPPAuthorizeRequestExtended): Promise<OCPPAuthorizeResponse> {
    try {
      // Get the charging station
      const { chargingStation, tenant } = await OCPPUtils.checkAndGetTenantAndChargingStation(headers);
      // Check props
      OCPPValidation.getInstance().validateAuthorize(authorize);
      // Check
      const user = await Authorizations.isAuthorizedOnChargingStation(tenant, chargingStation,
        authorize.idTag, ServerAction.AUTHORIZE, Action.AUTHORIZE);
      // Enrich
      this.enrichAuthorize(user, chargingStation, headers, authorize);
      // Save
      await OCPPStorage.saveAuthorize(tenant, authorize);
      // Log
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleAuthorize',
        action: ServerAction.AUTHORIZE, user: (authorize.user ? authorize.user : null),
        message: `User has been authorized with Badge ID '${authorize.idTag}'`,
        detailedMessages: { headers, authorize }
      });
      // Accepted
      return {
        idTagInfo: {
          status: OCPPAuthorizationStatus.ACCEPTED
        }
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.AUTHORIZE, error);
      // Rejected
      return {
        idTagInfo: {
          status: OCPPAuthorizationStatus.INVALID
        }
      };
    }
  }

  public async handleDiagnosticsStatusNotification(headers: OCPPHeader,
      diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequestExtended): Promise<OCPPDiagnosticsStatusNotificationResponse> {
    try {
      // Get the charging station
      const { chargingStation, tenant } = await OCPPUtils.checkAndGetTenantAndChargingStation(headers);
      // Check props
      OCPPValidation.getInstance().validateDiagnosticsStatusNotification(chargingStation, diagnosticsStatusNotification);
      // Enrich
      this.enrichOCPPRequest(chargingStation, diagnosticsStatusNotification);
      // Save it
      await OCPPStorage.saveDiagnosticsStatusNotification(tenant, diagnosticsStatusNotification);
      // Log
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        action: ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION,
        module: MODULE_NAME, method: 'handleDiagnosticsStatusNotification',
        message: 'Diagnostics Status Notification has been saved',
        detailedMessages: { headers, diagnosticsStatusNotification }
      });
      return {};
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION, error);
      return {};
    }
  }

  public async handleFirmwareStatusNotification(headers: OCPPHeader,
      firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended): Promise<OCPPFirmwareStatusNotificationResponse> {
    try {
      // Get the charging station
      const { chargingStation, tenant } = await OCPPUtils.checkAndGetTenantAndChargingStation(headers);
      // Check props
      OCPPValidation.getInstance().validateFirmwareStatusNotification(chargingStation, firmwareStatusNotification);
      // Enrich
      this.enrichOCPPRequest(chargingStation, firmwareStatusNotification);
      // Save the status to Charging Station
      await ChargingStationStorage.saveChargingStationFirmwareStatus(tenant.id, chargingStation.id, firmwareStatusNotification.status);
      // Save it
      await OCPPStorage.saveFirmwareStatusNotification(tenant, firmwareStatusNotification);
      // Log
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleFirmwareStatusNotification',
        action: ServerAction.FIRMWARE_STATUS_NOTIFICATION,
        message: `Firmware Status Notification '${firmwareStatusNotification.status}' has been saved`,
        detailedMessages: { headers, firmwareStatusNotification }
      });
      return {};
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.FIRMWARE_STATUS_NOTIFICATION, error);
      return {};
    }
  }

  public async handleStartTransaction(headers: OCPPHeader, startTransaction: OCPPStartTransactionRequestExtended): Promise<OCPPStartTransactionResponse> {
    try {
      // Get the charging station
      const { chargingStation, tenant } = await OCPPUtils.checkAndGetTenantAndChargingStation(headers);
      // Check props
      OCPPValidation.getInstance().validateStartTransaction(chargingStation, startTransaction);
      // Enrich
      this.enrichStartTransaction(tenant, startTransaction, chargingStation);
      // Check User
      const user = await Authorizations.isAuthorizedToStartTransaction(
        tenant, chargingStation, startTransaction.tagID, ServerAction.START_TRANSACTION, Action.START_TRANSACTION);
      if (user) {
        startTransaction.userID = user.id;
      }
      // Cleanup ongoing Transaction
      await this.stopOrDeleteActiveTransaction(tenant, chargingStation.id, startTransaction.connectorId);
      // Create Transaction
      const transaction = await this.createTransaction(tenant, user, startTransaction);
      // Car
      await this.processCarTransaction(tenant, transaction, user);
      // Pricing
      await OCPPUtils.processTransactionPricing(tenant, transaction, chargingStation, null, TransactionAction.START);
      // Billing
      await OCPPUtils.processTransactionBilling(tenant, transaction, TransactionAction.START);
      // Roaming
      await OCPPUtils.processTransactionRoaming(tenant, transaction, chargingStation, TransactionAction.START);
      // Save it
      await TransactionStorage.saveTransaction(tenant.id, transaction);
      // Clean up Charging Station's connector transaction info
      await this.clearChargingStationConnectorRuntimeData(tenant, transaction, chargingStation, user);
      // Save
      await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
      // Notify
      this.notifyStartTransaction(tenant, transaction, chargingStation, user);
      // Log
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleStartTransaction',
        action: ServerAction.START_TRANSACTION, user: user,
        message: `Connector ID '${transaction.connectorId}' > Transaction ID '${transaction.id}' has been started`
      });
      // Accepted
      return {
        transactionId: transaction.id,
        idTagInfo: {
          status: OCPPAuthorizationStatus.ACCEPTED
        }
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.START_TRANSACTION, error);
      // Invalid
      return {
        transactionId: 0,
        idTagInfo: {
          status: OCPPAuthorizationStatus.INVALID
        }
      };
    }
  }

  public async handleDataTransfer(headers: OCPPHeader, dataTransfer: OCPPDataTransferRequestExtended): Promise<OCPPDataTransferResponse> {
    try {
      // Get the charging station
      const { chargingStation, tenant } = await OCPPUtils.checkAndGetTenantAndChargingStation(headers);
      // Check props
      OCPPValidation.getInstance().validateDataTransfer(chargingStation, dataTransfer);
      // Enrich
      this.enrichOCPPRequest(chargingStation, dataTransfer);
      // Save it
      await OCPPStorage.saveDataTransfer(tenant, dataTransfer);
      // Log
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleDataTransfer',
        action: ServerAction.CHARGING_STATION_DATA_TRANSFER, message: 'Data Transfer has been saved',
        detailedMessages: { headers, dataTransfer }
      });
      // Accepted
      return {
        status: OCPPDataTransferStatus.ACCEPTED
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.CHARGING_STATION_DATA_TRANSFER, error);
      // Rejected
      return {
        status: OCPPDataTransferStatus.REJECTED
      };
    }
  }

  public async handleStopTransaction(headers: OCPPHeader, stopTransaction: OCPPStopTransactionRequestExtended,
      isSoftStop = false, isStoppedByCentralSystem = false): Promise<OCPPStopTransactionResponse> {
    try {
      // Get the charging station
      const { chargingStation, tenant } = await OCPPUtils.checkAndGetTenantAndChargingStation(headers);
      // Check props
      OCPPValidation.getInstance().validateStopTransaction(chargingStation, stopTransaction);
      // Set header
      this.enrichOCPPRequest(chargingStation, stopTransaction, false);
      // Bypass Stop Transaction?
      if (await this.bypassStopTransaction(tenant, chargingStation, headers, stopTransaction)) {
        return {
          idTagInfo: {
            status: OCPPAuthorizationStatus.ACCEPTED
          }
        };
      }
      // Get Transaction
      const transaction = await this.getTransactionFromStopTransaction(tenant, chargingStation, headers, stopTransaction);
      // Get Tag ID that stopped the Transaction
      const tagID = this.getStopTransactionTagId(stopTransaction, transaction);
      // Transaction is stopped by central system?
      const { user, alternateUser } = await this.checkAuthorizeStopTransactionAndGetUsers(
        tenant, chargingStation, transaction, tagID, isStoppedByCentralSystem);
      // Free the connector
      OCPPUtils.checkAndFreeChargingStationConnector(chargingStation, transaction.connectorId);
      // Save Charging Station
      await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
      // Soft Stop
      this.checkSoftStopTransaction(transaction, stopTransaction, isSoftStop);
      // Transaction End has already been received?
      await this.checkAndApplyLastConsumptionInStopTransaction(tenant, chargingStation, transaction, stopTransaction);
      // Update Transaction with Stop Transaction and Stop MeterValues
      OCPPUtils.updateTransactionWithStopTransaction(transaction, stopTransaction, user, alternateUser, tagID);
      // Bill
      await OCPPUtils.processTransactionBilling(tenant, transaction, TransactionAction.STOP);
      // Roaming
      await OCPPUtils.processTransactionRoaming(tenant, transaction, chargingStation, TransactionAction.STOP);
      // Save the transaction
      await TransactionStorage.saveTransaction(tenant.id, transaction);
      // Notify User
      this.notifyStopTransaction(tenant, chargingStation, transaction, user, alternateUser);
      // Recompute the Smart Charging Plan
      await this.triggerSmartChargingStopTransaction(tenant, chargingStation, transaction);
      // Log
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleStopTransaction',
        action: ServerAction.STOP_TRANSACTION,
        user: (alternateUser ? alternateUser : (user ? user : null)),
        actionOnUser: (alternateUser ? (user ? user : null) : null),
        message: `Connector ID '${transaction.connectorId}' > Transaction ID '${transaction.id}' has been stopped successfully`,
        detailedMessages: { headers, stopTransaction }
      });
      // Accepted
      return {
        idTagInfo: {
          status: OCPPAuthorizationStatus.ACCEPTED
        }
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.STOP_TRANSACTION, error);
      // Invalid
      return {
        idTagInfo: {
          status: OCPPAuthorizationStatus.INVALID
        }
      };
    }
  }

  private async checkAuthorizeStopTransactionAndGetUsers(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction,
      tagId: string, isStoppedByCentralSystem: boolean): Promise<{ user: User; alternateUser: User; }> {
    let user: User;
    let alternateUser: User;
    if (!isStoppedByCentralSystem) {
      // Check and get the authorized Users
      const authorizedUsers = await Authorizations.isAuthorizedToStopTransaction(
        tenant, chargingStation, transaction, tagId, ServerAction.STOP_TRANSACTION, Action.STOP_TRANSACTION);
      user = authorizedUsers.user;
      alternateUser = authorizedUsers.alternateUser;
    } else {
      // Get the User
      user = await UserStorage.getUserByTagId(tenant.id, tagId);
    }
    // Already Stopped?
    if (transaction.stop) {
      throw new BackendError({
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleStopTransaction',
        message: `Connector ID '${transaction.connectorId.toString()}' > Transaction ID '${transaction.id.toString()}' > Transaction has already been stopped`,
        action: ServerAction.STOP_TRANSACTION,
        user: (alternateUser ? alternateUser : user),
        actionOnUser: (alternateUser ? user : null),
        detailedMessages: { transaction }
      });
    }
    return { user, alternateUser };
  }

  private async triggerSmartChargingStopTransaction(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
      // Delete TxProfile if any
      await this.deleteAllTransactionTxProfile(tenant, transaction);
      // Call async because the Transaction ID on the connector should be cleared
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        try {
          // Trigger Smart Charging
          await this.triggerSmartCharging(tenant, chargingStation);
        } catch (error) {
          await Logging.logError({
            tenantID: tenant.id,
            source: chargingStation.id,
            module: MODULE_NAME, method: 'handleStopTransaction',
            action: ServerAction.STOP_TRANSACTION,
            message: `Connector ID '${transaction.connectorId.toString()}' > Transaction ID '${transaction.id.toString()}' > Smart Charging exception occurred`,
            detailedMessages: { error: error.message, stack: error.stack, transaction, chargingStation }
          });
        }
      }, Constants.DELAY_SMART_CHARGING_EXECUTION_MILLIS);
    }
  }

  private async deleteAllTransactionTxProfile(tenant: Tenant, transaction: Transaction) {
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(tenant.id, {
      chargingStationIDs: [transaction.chargeBoxID],
      connectorID: transaction.connectorId,
      profilePurposeType: ChargingProfilePurposeType.TX_PROFILE,
      transactionId: transaction.id
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Delete all TxProfiles
    for (const chargingProfile of chargingProfiles.result) {
      try {
        await OCPPUtils.clearAndDeleteChargingProfile(tenant, chargingProfile);
        await Logging.logDebug({
          tenantID: tenant.id,
          source: transaction.chargeBoxID,
          action: ServerAction.CHARGING_PROFILE_DELETE,
          message: `Connector ID '${transaction.connectorId}' > Transaction ID '${transaction.id}' > TX Charging Profile with ID '${chargingProfile.id}'`,
          module: MODULE_NAME, method: 'handleStopTransaction',
          detailedMessages: { chargingProfile }
        });
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          source: transaction.chargeBoxID,
          action: ServerAction.CHARGING_PROFILE_DELETE,
          message: `Connector ID '${transaction.connectorId}' > Transaction ID '${transaction.id}' > Cannot delete TX Charging Profile with ID '${chargingProfile.id}'`,
          module: MODULE_NAME, method: 'handleStopTransaction',
          detailedMessages: { error: error.message, stack: error.stack, chargingProfile }
        });
      }
    }
  }

  private async updateConnectorStatus(tenant: Tenant, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended) {
    // Get it
    let foundConnector: Connector = Utils.getConnectorFromID(chargingStation, statusNotification.connectorId);
    if (!foundConnector) {
      // Does not exist: Create
      foundConnector = {
        currentTransactionID: 0,
        currentTransactionDate: null,
        currentTagID: null,
        userID: null,
        connectorId: statusNotification.connectorId,
        currentInstantWatts: 0,
        status: ChargePointStatus.UNAVAILABLE,
        power: 0,
        type: ConnectorType.UNKNOWN
      };
      chargingStation.connectors.push(foundConnector);
      // Enrich Charging Station's Connector
      const chargingStationTemplate = await OCPPUtils.getChargingStationTemplate(chargingStation);
      if (chargingStationTemplate) {
        await OCPPUtils.enrichChargingStationConnectorWithTemplate(
          tenant, chargingStation, statusNotification.connectorId, chargingStationTemplate);
      }
    }
    // Check if status has changed
    if (foundConnector.status === statusNotification.status &&
        foundConnector.errorCode === statusNotification.errorCode &&
        foundConnector.info === statusNotification.info) {
      // No Change: Do not save it
      await Logging.logWarning({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'updateConnectorStatus',
        action: ServerAction.STATUS_NOTIFICATION,
        message: `Connector ID '${statusNotification.connectorId}' > Transaction ID '${foundConnector.currentTransactionID}' > Status has not changed then not saved: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}''`,
        detailedMessages: { connector: foundConnector }
      });
      return;
    }
    // Check last transaction
    await this.checkLastTransaction(tenant, chargingStation, statusNotification, foundConnector);
    // Set connector data
    foundConnector.connectorId = statusNotification.connectorId;
    foundConnector.status = statusNotification.status;
    foundConnector.errorCode = statusNotification.errorCode;
    foundConnector.info = (statusNotification.info ? statusNotification.info : '');
    foundConnector.vendorErrorCode = (statusNotification.vendorErrorCode ? statusNotification.vendorErrorCode : '');
    foundConnector.statusLastChangedOn = new Date(statusNotification.timestamp);
    // Save Status Notification
    await OCPPStorage.saveStatusNotification(tenant, statusNotification);
    // Update lastSeen
    chargingStation.lastSeen = new Date();
    // Log
    await Logging.logInfo({
      tenantID: tenant.id,
      source: chargingStation.id,
      module: MODULE_NAME, method: 'updateConnectorStatus',
      action: ServerAction.STATUS_NOTIFICATION,
      message: `Connector ID '${statusNotification.connectorId}' > Transaction ID '${foundConnector.currentTransactionID}' > Status: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}' has been saved`,
      detailedMessages: [statusNotification, foundConnector]
    });
    // Notify admins
    await this.notifyStatusNotification(tenant, chargingStation, statusNotification);
    // Send connector status to eRoaming platforms if charging station is public and component is activated
    if (chargingStation.issuer && chargingStation.public) {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.OICP)) {
        // Send new status to Hubject
        await this.updateOICPConnectorStatus(tenant, chargingStation, foundConnector);
      }
      if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        // Send new status to IOP
        await this.updateOCPIConnectorStatus(tenant, chargingStation, foundConnector);
      }
    }
    // Update connector's order
    if (!Utils.isEmptyArray(chargingStation?.connectors)) {
      chargingStation.connectors.sort((connector1: Connector, connector2: Connector) =>
        connector1?.connectorId - connector2?.connectorId);
    }
    // Save
    await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
    // Trigger Smart Charging
    if (statusNotification.status === ChargePointStatus.CHARGING ||
        statusNotification.status === ChargePointStatus.SUSPENDED_EV) {
      try {
        // Trigger Smart Charging
        await this.triggerSmartCharging(tenant, chargingStation);
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'updateConnectorStatus',
          action: ServerAction.STATUS_NOTIFICATION,
          message: `Connector ID '${foundConnector.connectorId.toString()}' > Transaction ID '${foundConnector.currentTransactionID.toString()}' > Smart Charging exception occurred`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
  }

  private async checkLastTransaction(tenant: Tenant, chargingStation: ChargingStation,
      statusNotification: OCPPStatusNotificationRequestExtended, connector: Connector) {
    // Check last transaction
    if (statusNotification.status === ChargePointStatus.AVAILABLE) {
      // Get the last transaction
      const lastTransaction = await TransactionStorage.getLastTransactionFromChargingStation(
        tenant.id, chargingStation.id, connector.connectorId, { withChargingStation: true, withUser: true });
      // Transaction completed
      if (lastTransaction?.stop) {
        // Check Inactivity
        if (Utils.objectHasProperty(statusNotification, 'timestamp')) {
          // Session is finished
          if (!lastTransaction.stop.extraInactivityComputed) {
            const transactionStopTimestamp = Utils.convertToDate(lastTransaction.stop.timestamp);
            const currentStatusNotifTimestamp = Utils.convertToDate(statusNotification.timestamp);
            // Diff
            lastTransaction.stop.extraInactivitySecs =
              Math.floor((currentStatusNotifTimestamp.getTime() - transactionStopTimestamp.getTime()) / 1000);
            // Flag
            lastTransaction.stop.extraInactivityComputed = true;
            // Fix the Inactivity severity
            lastTransaction.stop.inactivityStatus = Utils.getInactivityStatusLevel(lastTransaction.chargeBox, lastTransaction.connectorId,
              lastTransaction.stop.totalInactivitySecs + lastTransaction.stop.extraInactivitySecs);
            // Build extra inactivity consumption
            await OCPPUtils.buildExtraConsumptionInactivity(tenant, lastTransaction);
            // Log
            await Logging.logInfo({
              tenantID: tenant.id,
              source: chargingStation.id,
              user: lastTransaction.userID,
              module: MODULE_NAME, method: 'checkLastTransaction',
              action: ServerAction.EXTRA_INACTIVITY,
              message: `Connector ID '${lastTransaction.connectorId}' > Transaction ID '${lastTransaction.id}' > Extra Inactivity of ${lastTransaction.stop.extraInactivitySecs} secs has been added`,
              detailedMessages: [statusNotification, connector, lastTransaction]
            });
          }
        }
        // OCPI: Post the CDR
        if (lastTransaction.ocpiData?.session) {
          await this.checkAndSendOCPITransactionCdr(tenant, lastTransaction, chargingStation);
        }
        // OICP: Post the CDR
        if (lastTransaction.oicpData?.session) {
          await this.checkAndSendOICPTransactionCdr(tenant, lastTransaction, chargingStation);
        }
        // Save
        await TransactionStorage.saveTransaction(tenant.id, lastTransaction);
      } else if (!Utils.isNullOrUndefined(lastTransaction)) {
        await Logging.logWarning({
          tenantID: tenant.id,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'checkLastTransaction',
          action: ServerAction.STATUS_NOTIFICATION,
          message: `Received status notification '${statusNotification.status}' on connector id ${lastTransaction.connectorId ?? 'unknown'} while a transaction is ongoing, expect inconsistencies in the inactivity time computation. Ask charging station vendor to fix the firmware`,
          detailedMessages: { statusNotification }
        });

      }
    }
  }

  private async checkAndSendOCPITransactionCdr(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation) {
    // CDR not already pushed
    if (transaction.ocpiData && !transaction.ocpiData.cdr?.id) {
      // Get the lock
      const ocpiLock = await LockingHelper.createOCPIPushCdrLock(tenant.id, transaction.id);
      if (ocpiLock) {
        try {
          // Roaming
          await OCPPUtils.processTransactionRoaming(tenant, transaction, chargingStation, TransactionAction.END);
        } finally {
          // Release the lock
          await LockingManager.release(ocpiLock);
        }
      }
    }
  }

  private async checkAndSendOICPTransactionCdr(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation) {
    // CDR not already pushed
    if (transaction.oicpData && !transaction.oicpData.cdr?.SessionID) {
      // Get the lock
      const oicpLock = await LockingHelper.createOICPPushCdrLock(tenant.id, transaction.id);
      if (oicpLock) {
        try {
          // Roaming
          await OCPPUtils.processTransactionRoaming(tenant, transaction, chargingStation, TransactionAction.END);
        } finally {
          // Release the lock
          await LockingManager.release(oicpLock);
        }
      }
    }
  }

  private async updateOCPIConnectorStatus(tenant: Tenant, chargingStation: ChargingStation, connector: Connector) {
    if (chargingStation.issuer && chargingStation.public && Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
      try {
        const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
        if (ocpiClient) {
          await ocpiClient.patchChargingStationStatus(chargingStation, connector);
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'updateOCPIConnectorStatus',
          action: ServerAction.OCPI_PATCH_STATUS,
          message: `An error occurred while patching the charging station status of ${chargingStation.id}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
  }

  private async updateOICPConnectorStatus(tenant: Tenant, chargingStation: ChargingStation, connector: Connector) {
    try {
      const oicpClient = await OICPClientFactory.getAvailableOicpClient(tenant, OICPRole.CPO) as CpoOICPClient;
      if (oicpClient) {
        await oicpClient.updateEVSEStatus(chargingStation, connector);
      }
    } catch (error) {
      await Logging.logError({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'updateOICPStatus',
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: `An error occurred while updating the charging station status of ${chargingStation.id}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  private async notifyStatusNotification(tenant: Tenant, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended) {
    // Faulted?
    if (statusNotification.status !== ChargePointStatus.AVAILABLE &&
        statusNotification.status !== ChargePointStatus.FINISHING && // TODO: To remove after fix of ABB bug having Finishing status with an Error Code to avoid spamming Admins
        statusNotification.errorCode !== ChargePointErrorCode.NO_ERROR) {
      // Log
      await Logging.logError({
        tenantID: tenant.id,
        source: chargingStation.id,
        action: ServerAction.STATUS_NOTIFICATION,
        module: MODULE_NAME, method: 'notifyStatusNotification',
        message: `Connector ID '${statusNotification.connectorId}' > Error occurred : '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}'`
      });
      // Send Notification (Async)
      NotificationHandler.sendChargingStationStatusError(
        tenant.id,
        Utils.generateUUID(),
        chargingStation,
        {
          'chargeBoxID': chargingStation.id,
          'connectorId': Utils.getConnectorLetterFromConnectorID(statusNotification.connectorId),
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${(statusNotification.info ? statusNotification.info : 'N/A')}`,
          'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain),
          'evseDashboardChargingStationURL': Utils.buildEvseChargingStationURL(tenant.subdomain, chargingStation, '#inerror')
        }
      ).catch(() => { });
    }
  }

  private updateTransactionWithMeterValues(chargingStation: ChargingStation, transaction: Transaction, meterValues: OCPPNormalizedMeterValue[]) {
    // Build consumptions
    for (const meterValue of meterValues) {
      // To keep backward compatibility with OCPP 1.5 where there is no Transaction.Begin/End,
      // We store the last Transaction.End meter value in transaction to create the last consumption
      // in Stop Transaction
      if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
        // Flag it
        if (!transaction.transactionEndReceived) {
          // First time: clear all values
          transaction.currentInstantWatts = 0;
          transaction.currentInstantWattsL1 = 0;
          transaction.currentInstantWattsL2 = 0;
          transaction.currentInstantWattsL3 = 0;
          transaction.currentInstantWattsDC = 0;
          transaction.currentInstantVolts = 0;
          transaction.currentInstantVoltsL1 = 0;
          transaction.currentInstantVoltsL2 = 0;
          transaction.currentInstantVoltsL3 = 0;
          transaction.currentInstantVoltsDC = 0;
          transaction.currentInstantAmps = 0;
          transaction.currentInstantAmpsL1 = 0;
          transaction.currentInstantAmpsL2 = 0;
          transaction.currentInstantAmpsL3 = 0;
          transaction.currentInstantAmpsDC = 0;
          transaction.transactionEndReceived = true;
        }
      }
      // Signed Data
      if (OCPPUtils.updateSignedData(transaction, meterValue)) {
        continue;
      }
      // SoC
      if (meterValue.attribute.measurand === OCPPMeasurand.STATE_OF_CHARGE) {
        // Set the first SoC and keep it
        if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_BEGIN) {
          transaction.stateOfCharge = Utils.convertToFloat(meterValue.value);
          continue;
        // Set only the last SoC (will be used in the last consumption building in StopTransaction due to backward compat with OCPP 1.5)
        } else if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
          transaction.currentStateOfCharge = Utils.convertToFloat(meterValue.value);
          continue;
        }
      }
      // Voltage
      if (meterValue.attribute.measurand === OCPPMeasurand.VOLTAGE) {
        // Set only the last Voltage (will be used in the last consumption building in StopTransaction due to backward compat with OCPP 1.5)
        if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
          const voltage = Utils.convertToFloat(meterValue.value);
          const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
          // AC Charging Station
          switch (currentType) {
            case CurrentType.DC:
              transaction.currentInstantVoltsDC = voltage;
              break;
            case CurrentType.AC:
              switch (meterValue.attribute.phase) {
                case OCPPPhase.L1_N:
                case OCPPPhase.L1:
                  transaction.currentInstantVoltsL1 = voltage;
                  break;
                case OCPPPhase.L2_N:
                case OCPPPhase.L2:
                  transaction.currentInstantVoltsL2 = voltage;
                  break;
                case OCPPPhase.L3_N:
                case OCPPPhase.L3:
                  transaction.currentInstantVoltsL3 = voltage;
                  break;
                case OCPPPhase.L1_L2:
                case OCPPPhase.L2_L3:
                case OCPPPhase.L3_L1:
                  // Do nothing
                  break;
                default:
                  transaction.currentInstantVolts = voltage;
                  break;
              }
              break;
          }
          continue;
        }
      }
      // Power
      if (meterValue.attribute.measurand === OCPPMeasurand.POWER_ACTIVE_IMPORT) {
        // Set only the last Power (will be used in the last consumption building in StopTransaction due to backward compat with OCPP 1.5)
        if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
          const powerInMeterValue = Utils.convertToFloat(meterValue.value);
          const powerInMeterValueWatts = (meterValue.attribute && meterValue.attribute.unit === OCPPUnitOfMeasure.KILO_WATT ?
            powerInMeterValue * 1000 : powerInMeterValue);
          const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
          // AC Charging Station
          switch (currentType) {
            case CurrentType.DC:
              transaction.currentInstantWattsDC = powerInMeterValueWatts;
              break;
            case CurrentType.AC:
              switch (meterValue.attribute.phase) {
                case OCPPPhase.L1_N:
                case OCPPPhase.L1:
                  transaction.currentInstantWattsL1 = powerInMeterValueWatts;
                  break;
                case OCPPPhase.L2_N:
                case OCPPPhase.L2:
                  transaction.currentInstantWattsL2 = powerInMeterValueWatts;
                  break;
                case OCPPPhase.L3_N:
                case OCPPPhase.L3:
                  transaction.currentInstantWattsL3 = powerInMeterValueWatts;
                  break;
                default:
                  transaction.currentInstantWatts = powerInMeterValueWatts;
                  break;
              }
              break;
          }
          continue;
        }
      }
      // Current
      if (meterValue.attribute.measurand === OCPPMeasurand.CURRENT_IMPORT) {
        // Set only the last Current (will be used in the last consumption building in StopTransaction due to backward compat with OCPP 1.5)
        if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
          const amperage = Utils.convertToFloat(meterValue.value);
          const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
          // AC Charging Station
          switch (currentType) {
            case CurrentType.DC:
              transaction.currentInstantAmpsDC = amperage;
              break;
            case CurrentType.AC:
              switch (meterValue.attribute.phase) {
                case OCPPPhase.L1:
                  transaction.currentInstantAmpsL1 = amperage;
                  break;
                case OCPPPhase.L2:
                  transaction.currentInstantAmpsL2 = amperage;
                  break;
                case OCPPPhase.L3:
                  transaction.currentInstantAmpsL3 = amperage;
                  break;
                default:
                  // MeterValue Current.Import is per phase and consumption currentInstantAmps attribute expect the total amperage
                  transaction.currentInstantAmps = amperage * Utils.getNumberOfConnectedPhases(chargingStation, null, transaction.connectorId);
                  break;
              }
              break;
          }
          continue;
        }
      }
      // Consumption
      if (OCPPUtils.isEnergyActiveImportMeterValue(meterValue)) {
        transaction.numberOfMeterValues++;
      }
    }
  }

  private async updateChargingStationWithTransaction(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    // Get the connector
    const foundConnector: Connector = Utils.getConnectorFromID(chargingStation, transaction.connectorId);
    // Active transaction?
    if (!transaction.stop && foundConnector) {
      // Set consumption
      foundConnector.currentInstantWatts = transaction.currentInstantWatts;
      foundConnector.currentTotalConsumptionWh = transaction.currentTotalConsumptionWh;
      foundConnector.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs;
      foundConnector.currentInactivityStatus = Utils.getInactivityStatusLevel(
        transaction.chargeBox, transaction.connectorId, transaction.currentTotalInactivitySecs);
      foundConnector.currentStateOfCharge = transaction.currentStateOfCharge;
      foundConnector.currentTagID = transaction.tagID;
      // Set Transaction ID
      foundConnector.currentTransactionID = transaction.id;
      foundConnector.userID = transaction.userID;
      // Update lastSeen
      chargingStation.lastSeen = new Date();
      // Log
      const instantPower = Utils.truncTo(Utils.createDecimal(foundConnector.currentInstantWatts).div(1000).toNumber(), 3);
      const totalConsumption = Utils.truncTo(Utils.createDecimal(foundConnector.currentTotalConsumptionWh).div(1000).toNumber(), 3);
      await Logging.logInfo({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'updateChargingStationWithTransaction',
        action: ServerAction.CONSUMPTION,
        user: transaction.userID,
        message: `Connector ID '${foundConnector.connectorId}' > Transaction ID '${foundConnector.currentTransactionID}' > Instant: ${instantPower} kW, Total: ${totalConsumption} kW.h${foundConnector.currentStateOfCharge ? ', SoC: ' + foundConnector.currentStateOfCharge.toString() + ' %' : ''}`
      });
      // Cleanup connector transaction data
    } else if (foundConnector) {
      OCPPUtils.checkAndFreeChargingStationConnector(chargingStation, foundConnector.connectorId);
    }
  }

  private notifyEndOfCharge(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notify (Async)
      NotificationHandler.sendEndOfCharge(
        tenant.id,
        transaction.user,
        chargingStation,
        {
          'user': transaction.user,
          'transactionId': transaction.id,
          'chargeBoxID': chargingStation.id,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'totalConsumption': i18nManager.formatNumber(Math.round(transaction.currentTotalConsumptionWh / 10) / 100),
          'stateOfCharge': transaction.currentStateOfCharge,
          'totalDuration': this.transactionDurationToString(transaction),
          'evseDashboardChargingStationURL': Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress'),
          'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
        }
      ).catch(() => { });
    }
  }

  private notifyOptimalChargeReached(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notification Before End Of Charge (Async)
      NotificationHandler.sendOptimalChargeReached(
        tenant.id,
        transaction.id.toString() + '-OCR',
        transaction.user,
        chargingStation,
        {
          'user': transaction.user,
          'chargeBoxID': chargingStation.id,
          'transactionId': transaction.id,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'totalConsumption': i18nManager.formatNumber(Math.round(transaction.currentTotalConsumptionWh / 10) / 100),
          'stateOfCharge': transaction.currentStateOfCharge,
          'evseDashboardChargingStationURL': Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress'),
          'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
        }
      ).catch(() => { });
    }
  }

  private async checkNotificationEndOfCharge(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    // Transaction in progress?
    if (transaction && !transaction.stop) {
      // Has consumption?
      if (transaction.numberOfMeterValues > 1 && transaction.currentTotalConsumptionWh > 0) {
        // End of charge?
        if (this.chargingStationConfig.notifEndOfChargeEnabled && transaction.currentTotalConsumptionWh > 0) {
          // Battery full
          if (transaction.currentStateOfCharge === 100) {
            // Send Notification
            this.notifyEndOfCharge(tenant, chargingStation, transaction);
          } else {
            // Check last consumptions
            const consumptions = await ConsumptionStorage.getTransactionConsumptions(
              tenant.id, { transactionId: transaction.id }, { limit: 3, skip: 0, sort: { startedAt: -1 } });
            if (consumptions.result.every((consumption) => consumption.consumptionWh === 0 &&
                (consumption.limitSource !== ConnectorCurrentLimitSource.CHARGING_PROFILE ||
                consumption.limitAmps >= StaticLimitAmps.MIN_LIMIT_PER_PHASE * Utils.getNumberOfConnectedPhases(chargingStation, null, transaction.connectorId)))) {
              // Send Notification
              this.notifyEndOfCharge(tenant, chargingStation, transaction);
            }
          }
          // Optimal Charge? (SoC)
        } else if (this.chargingStationConfig.notifBeforeEndOfChargeEnabled &&
          transaction.currentStateOfCharge >= this.chargingStationConfig.notifBeforeEndOfChargePercent) {
          // Send Notification
          this.notifyOptimalChargeReached(tenant, chargingStation, transaction);
        }
      }
    }
  }

  private transactionInactivityToString(transaction: Transaction, user: User, i18nHourShort = 'h') {
    const i18nManager = I18nManager.getInstanceForLocale(user ? user.locale : Constants.DEFAULT_LANGUAGE);
    // Get total
    const totalInactivitySecs = transaction.stop.totalInactivitySecs;
    // None?
    if (totalInactivitySecs === 0) {
      return `0${i18nHourShort}00 (${i18nManager.formatPercentage(0)})`;
    }
    // Build the inactivity percentage
    const totalInactivityPercent = i18nManager.formatPercentage(Math.round((totalInactivitySecs / transaction.stop.totalDurationSecs) * 100) / 100);
    return moment.duration(totalInactivitySecs, 's').format(`h[${i18nHourShort}]mm`, { trim: false }) + ` (${totalInactivityPercent})`;
  }

  private transactionDurationToString(transaction: Transaction): string {
    let totalDuration;
    if (!transaction.stop) {
      totalDuration = moment.duration(moment(transaction.lastConsumption.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    } else {
      totalDuration = moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    }
    return moment.duration(totalDuration, 's').format('h[h]mm', { trim: false });
  }

  private buildTransactionDuration(transaction: Transaction): string {
    return moment.duration(transaction.stop.totalDurationSecs, 's').format('h[h]mm', { trim: false });
  }

  private filterMeterValuesOnSpecificChargingStations(tenant: Tenant, chargingStation: ChargingStation, meterValues: OCPPNormalizedMeterValues) {
    // Clean up Sample.Clock meter value
    if (chargingStation.chargePointVendor !== ChargerVendor.ABB ||
      chargingStation.ocppVersion !== OCPPVersion.VERSION_15) {
      // Filter Sample.Clock meter value for all chargers except ABB using OCPP 1.5
      meterValues.values = meterValues.values.filter(async (meterValue) => {
        // Remove Sample Clock
        if (meterValue.attribute && meterValue.attribute.context === OCPPReadingContext.SAMPLE_CLOCK) {
          await Logging.logWarning({
            tenantID: tenant.id,
            source: chargingStation.id,
            module: MODULE_NAME, method: 'filterMeterValuesOnSpecificChargingStations',
            action: ServerAction.METER_VALUES,
            message: `Removed Meter Value with attribute context '${OCPPReadingContext.SAMPLE_CLOCK}'`,
            detailedMessages: { meterValue }
          });
          return false;
        }
        return true;
      });
    }
  }

  private normalizeMeterValues(chargingStation: ChargingStation, meterValues: OCPPMeterValuesRequestExtended): OCPPNormalizedMeterValues {
    // Create the normalized meter value
    const normalizedMeterValues: OCPPNormalizedMeterValues = {
      chargeBoxID: chargingStation.id,
      values: []
    };
    // OCPP 1.5: transfer to OCPP 1.6 structure
    if (chargingStation.ocppVersion === OCPPVersion.VERSION_15) {
      meterValues.meterValue = meterValues.values;
      delete meterValues.values;
    }
    // Always convert to an Array
    if (!Array.isArray(meterValues.meterValue)) {
      meterValues.meterValue = [meterValues.meterValue];
    }
    // Process the Meter Values
    for (const meterValue of meterValues.meterValue) {
      const normalizedMeterValue = {
        chargeBoxID: chargingStation.id,
        connectorId: meterValues.connectorId,
        transactionId: meterValues.transactionId,
        timestamp: Utils.convertToDate(meterValue.timestamp),
      } as OCPPNormalizedMeterValue;
      // OCPP 1.6
      if (chargingStation.ocppVersion === OCPPVersion.VERSION_16) {
        // Always an Array
        if (!Array.isArray(meterValue.sampledValue)) {
          meterValue.sampledValue = [meterValue.sampledValue];
        }
        // Create one record per value
        for (const sampledValue of meterValue.sampledValue) {
          // Add Attributes
          const normalizedLocalMeterValue: OCPPNormalizedMeterValue = Utils.cloneObject(normalizedMeterValue);
          normalizedLocalMeterValue.attribute = this.buildMeterValueAttributes(sampledValue);
          // Data is to be interpreted as integer/decimal numeric data
          if (normalizedLocalMeterValue.attribute.format === OCPPValueFormat.RAW) {
            normalizedLocalMeterValue.value = Utils.convertToFloat(sampledValue.value);
            // Data is represented as a signed binary data block, encoded as hex data
          } else if (normalizedLocalMeterValue.attribute.format === OCPPValueFormat.SIGNED_DATA) {
            normalizedLocalMeterValue.value = sampledValue.value;
          }
          // Add
          normalizedMeterValues.values.push(normalizedLocalMeterValue);
        }
      // OCPP 1.5
      } else if (meterValue['value']) {
        if (Array.isArray(meterValue['value'])) {
          for (const currentValue of meterValue['value']) {
            normalizedMeterValue.value = Utils.convertToFloat(currentValue['$value']);
            normalizedMeterValue.attribute = currentValue.attributes;
            normalizedMeterValues.values.push(Utils.cloneObject(normalizedMeterValue));
          }
        } else {
          normalizedMeterValue.value = Utils.convertToFloat(meterValue['value']['$value']);
          normalizedMeterValue.attribute = meterValue['value'].attributes;
          normalizedMeterValues.values.push(Utils.cloneObject(normalizedMeterValue));
        }
      }
    }
    return normalizedMeterValues;
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

  private async stopOrDeleteActiveTransaction(tenant: Tenant, chargingStationID: string, connectorId: number) {
    // Check
    let activeTransaction: Transaction, lastCheckedTransactionID: number;
    do {
      // Check if the charging station has already a transaction
      activeTransaction = await TransactionStorage.getActiveTransaction(tenant.id, chargingStationID, connectorId);
      // Exists already?
      if (activeTransaction) {
        // Avoid infinite Loop
        if (lastCheckedTransactionID === activeTransaction.id) {
          return;
        }
        // Has consumption?
        if (activeTransaction.currentTotalConsumptionWh <= 0) {
          // No consumption: delete
          await Logging.logWarning({
            tenantID: tenant.id,
            source: chargingStationID,
            module: MODULE_NAME, method: 'stopOrDeleteActiveTransactions',
            action: ServerAction.CLEANUP_TRANSACTION,
            actionOnUser: activeTransaction.user,
            message: `Connector ID '${activeTransaction.connectorId}' > Pending Transaction ID '${activeTransaction.id}' with no consumption has been deleted`
          });
          // Delete
          await TransactionStorage.deleteTransaction(tenant.id, activeTransaction.id);
        } else {
          // Simulate a Stop Transaction
          const result = await this.handleStopTransaction({
            tenantID: tenant.id,
            chargeBoxIdentity: activeTransaction.chargeBoxID
          }, {
            chargeBoxID: activeTransaction.chargeBoxID,
            transactionId: activeTransaction.id,
            meterStop: (activeTransaction.lastConsumption ? activeTransaction.lastConsumption.value : activeTransaction.meterStart),
            timestamp: Utils.convertToDate(activeTransaction.lastConsumption ? activeTransaction.lastConsumption.timestamp : activeTransaction.timestamp).toISOString(),
          }, false, true);
          // Check
          if (result.idTagInfo.status === OCPPAuthorizationStatus.INVALID) {
            // No consumption: delete
            await Logging.logError({
              tenantID: tenant.id,
              source: chargingStationID,
              module: MODULE_NAME, method: 'stopOrDeleteActiveTransactions',
              action: ServerAction.CLEANUP_TRANSACTION,
              actionOnUser: activeTransaction.userID,
              message: `Connector ID '${activeTransaction.connectorId}' > Cannot delete pending Transaction ID '${activeTransaction.id}' with no consumption`
            });
          } else {
            // Has consumption: close it!
            await Logging.logWarning({
              tenantID: tenant.id,
              source: chargingStationID,
              module: MODULE_NAME, method: 'stopOrDeleteActiveTransactions',
              action: ServerAction.CLEANUP_TRANSACTION,
              actionOnUser: activeTransaction.userID,
              message: `Connector ID '${activeTransaction.connectorId}' > Pending Transaction ID '${activeTransaction.id}' has been stopped`
            });
          }
        }
        // Keep last Transaction ID
        lastCheckedTransactionID = activeTransaction.id;
      }
    } while (activeTransaction);
  }

  private notifyStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user) {
      NotificationHandler.sendSessionStarted(
        tenant.id,
        transaction.id.toString(),
        user,
        chargingStation,
        {
          'user': user,
          'transactionId': transaction.id,
          'chargeBoxID': chargingStation.id,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain),
          'evseDashboardChargingStationURL': Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress')
        }
      ).catch(() => { });
    }
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

  private notifyStopTransaction(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction, user: User, alternateUser: User) {
    // User provided?
    if (user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(user.locale);
      // Send Notification (Async)
      NotificationHandler.sendEndOfSession(
        tenant.id,
        transaction.id.toString() + '-EOS',
        user,
        chargingStation,
        {
          user: user,
          alternateUser: (alternateUser ? alternateUser : null),
          transactionId: transaction.id,
          chargeBoxID: chargingStation.id,
          connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          totalConsumption: i18nManager.formatNumber(Math.round(transaction.stop.totalConsumptionWh / 10) / 100),
          totalDuration: this.buildTransactionDuration(transaction),
          totalInactivity: this.transactionInactivityToString(transaction, user),
          stateOfCharge: transaction.stop.stateOfCharge,
          evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#history'),
          evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
        }
      ).catch(() => { });
      // Notify Signed Data
      if (transaction.stop.signedData !== '') {
        // Send Notification (Async)
        NotificationHandler.sendEndOfSignedSession(
          tenant.id,
          transaction.id.toString() + '-EOSS',
          user,
          chargingStation,
          {
            user: user,
            alternateUser: (alternateUser ? alternateUser : null),
            transactionId: transaction.id,
            chargeBoxID: chargingStation.id,
            connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
            tagId: transaction.tagID,
            startDate: transaction.timestamp.toLocaleString(user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            endDate: transaction.stop.timestamp.toLocaleString(user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            meterStart: (transaction.meterStart / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            meterStop: (transaction.stop.meterStop / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            totalConsumption: (transaction.stop.totalConsumptionWh / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            price: transaction.stop.price,
            relativeCost: (transaction.stop.price / (transaction.stop.totalConsumptionWh / 1000)),
            startSignedData: transaction.signedData,
            endSignedData: transaction.stop.signedData,
            evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
          }
        ).catch(() => { });
      }
    }
  }

  private async triggerSmartCharging(tenant: Tenant, chargingStation: ChargingStation) {
    // Smart Charging must be active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
      // Get Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(tenant.id, chargingStation.siteAreaID);
      if (siteArea && siteArea.smartCharging) {
        const siteAreaLock = await LockingHelper.createSiteAreaSmartChargingLock(tenant.id, siteArea, 30 * 1000);
        if (siteAreaLock) {
          try {
            const smartCharging = await SmartChargingFactory.getSmartChargingImpl(tenant);
            if (smartCharging) {
              await smartCharging.computeAndApplyChargingProfiles(siteArea);
            }
          } finally {
            // Release lock
            await LockingManager.release(siteAreaLock);
          }
        }
      }
    }
  }

  private async clearChargingStationConnectorRuntimeData(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User): Promise<void> {
    const foundConnector = Utils.getConnectorFromID(chargingStation, transaction.connectorId);
    if (foundConnector) {
      foundConnector.currentInstantWatts = 0;
      foundConnector.currentTotalConsumptionWh = 0;
      foundConnector.currentTotalInactivitySecs = 0;
      foundConnector.currentInactivityStatus = InactivityStatus.INFO;
      foundConnector.currentStateOfCharge = 0;
      foundConnector.currentTransactionID = transaction.id;
      foundConnector.currentTransactionDate = transaction.timestamp;
      foundConnector.currentTagID = transaction.tagID;
      foundConnector.userID = transaction.userID;
    } else {
      await Logging.logWarning({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleStartTransaction',
        action: ServerAction.START_TRANSACTION, user: user,
        message: `Missing connector '${transaction.connectorId}' > Transaction ID '${transaction.id}'`
      });
    }
    // Update lastSeen
    chargingStation.lastSeen = new Date();
  }

  private async processCarTransaction(tenant: Tenant, transaction: Transaction, user: User): Promise<void> {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.CAR) && user) {
      // Check default car
      if (user.lastSelectedCarID) {
        transaction.carID = user.lastSelectedCarID;
      } else {
        // Get default car if any
        const defaultCar = await CarStorage.getDefaultUserCar(tenant.id, user.id, {}, ['id']);
        if (defaultCar) {
          transaction.carID = defaultCar.id;
        }
      }
      // Set Car Catalog ID
      if (transaction.carID) {
        const car = await CarStorage.getCar(tenant.id, transaction.carID, {}, ['id', 'carCatalogID']);
        transaction.carCatalogID = car?.carCatalogID;
      }
      // Clear
      await UserStorage.saveUserLastSelectedCarID(tenant.id, user.id, null);
    }
  }

  private addChargingStationToException(error: BackendError, chargingStationID: string): void {
    if (error.params) {
      error.params.source = chargingStationID;
    }
  }

  private enrichStartTransaction(tenant: Tenant, startTransaction: OCPPStartTransactionRequestExtended, chargingStation: ChargingStation): void {
    // Enrich
    this.enrichOCPPRequest(chargingStation, startTransaction, false);
    startTransaction.tagID = startTransaction.idTag;
    // Organization
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
      // Set the Site Area ID
      startTransaction.siteAreaID = chargingStation.siteAreaID;
      // Set the Site ID. ChargingStation$siteArea$site checked by TagIDAuthorized.
      const site = chargingStation.siteArea ? chargingStation.siteArea.site : null;
      if (site) {
        startTransaction.siteID = site.id;
      }
    }
  }

  private async createTransaction(tenant: Tenant, user, startTransaction: OCPPStartTransactionRequestExtended): Promise<Transaction> {
    return {
      id: await TransactionStorage.findAvailableID(tenant.id),
      issuer: true,
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
      lastConsumption: {
        value: startTransaction.meterStart,
        timestamp: Utils.convertToDate(startTransaction.timestamp)
      },
      currentInstantWatts: 0,
      currentStateOfCharge: 0,
      currentConsumptionWh: 0,
      currentTotalConsumptionWh: 0,
      currentTotalInactivitySecs: 0,
      currentInactivityStatus: InactivityStatus.INFO,
      signedData: '',
      stateOfCharge: 0,
      user
    };
  }

  private getHeartbeatInterval(ocppProtocol: OCPPProtocol): number {
    switch (ocppProtocol) {
      case OCPPProtocol.SOAP:
        return this.chargingStationConfig.heartbeatIntervalOCPPSSecs;
      case OCPPProtocol.JSON:
        return this.chargingStationConfig.heartbeatIntervalOCPPJSecs;
    }
  }

  private enrichBootNotification(headers: OCPPHeader, bootNotification: OCPPBootNotificationRequestExtended): void {
    // Set the endpoint
    if (headers.From) {
      bootNotification.endpoint = headers.From.Address;
    }
    bootNotification.id = headers.chargeBoxIdentity;
    bootNotification.chargeBoxID = headers.chargeBoxIdentity;
    bootNotification.currentIPAddress = headers.currentIPAddress;
    bootNotification.ocppProtocol = headers.ocppProtocol;
    bootNotification.ocppVersion = headers.ocppVersion;
    // Set the default
    bootNotification.lastReboot = new Date();
    bootNotification.lastSeen = bootNotification.lastReboot;
    bootNotification.timestamp = bootNotification.lastReboot;
  }

  private async checkAndRegisterNewChargingStation(tenant: Tenant, bootNotification: OCPPBootNotificationRequestExtended, headers: OCPPHeader): Promise<ChargingStation> {
    // Check Token
    if (!headers.token) {
      throw new BackendError({
        source: headers.chargeBoxIdentity,
        action: ServerAction.BOOT_NOTIFICATION,
        module: MODULE_NAME, method: 'handleBootNotification',
        message: `Registration rejected: Token is required for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress.toString()}'`,
        detailedMessages: { headers, bootNotification }
      });
    }
    const token = await RegistrationTokenStorage.getRegistrationToken(tenant.id, headers.token);
    if (!token || !token.expirationDate || moment().isAfter(token.expirationDate)) {
      throw new BackendError({
        source: headers.chargeBoxIdentity,
        action: ServerAction.BOOT_NOTIFICATION,
        module: MODULE_NAME, method: 'handleBootNotification',
        message: `Registration rejected: Token '${headers.token}' is invalid or expired for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress.toString()}'`,
        detailedMessages: { headers, bootNotification }
      });
    }
    if (token.revocationDate || moment().isAfter(token.revocationDate)) {
      throw new BackendError({
        source: headers.chargeBoxIdentity,
        action: ServerAction.BOOT_NOTIFICATION,
        module: MODULE_NAME, method: 'handleBootNotification',
        message: `Registration rejected: Token '${headers.token}' is revoked for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress.toString()}'`,
        detailedMessages: { headers, bootNotification }
      });
    }
    // New Charging Station: Create
    const newChargingStation = {} as ChargingStation;
    for (const key in bootNotification) {
      newChargingStation[key] = bootNotification[key];
    }
    // Update props
    newChargingStation.createdOn = new Date();
    newChargingStation.issuer = true;
    newChargingStation.powerLimitUnit = ChargingRateUnitType.AMPERE;
    newChargingStation.registrationStatus = RegistrationStatus.ACCEPTED;
    // Assign to Site Area
    if (token.siteAreaID) {
      const siteArea = await SiteAreaStorage.getSiteArea(tenant.id, token.siteAreaID);
      if (siteArea) {
        newChargingStation.siteAreaID = token.siteAreaID;
        newChargingStation.siteID = siteArea.siteID;
        // Set the same coordinates
        if (siteArea?.address?.coordinates?.length === 2) {
          newChargingStation.coordinates = siteArea.address.coordinates;
        }
      }
    }
    return newChargingStation;
  }

  private async checkExistingChargingStation(headers: OCPPHeader, chargingStation: ChargingStation, bootNotification: OCPPBootNotificationRequestExtended) {
    // Existing Charging Station: Update
    // Check if same vendor and model
    if ((chargingStation.chargePointVendor !== bootNotification.chargePointVendor ||
      chargingStation.chargePointModel !== bootNotification.chargePointModel) ||
      (chargingStation.chargePointSerialNumber && bootNotification.chargePointSerialNumber &&
        chargingStation.chargePointSerialNumber !== bootNotification.chargePointSerialNumber)) {
      // Not the same Charging Station!
      // FIXME: valid charging stations in DB with modified parameters cannot be registered at boot notification again without direct
      //        access to the DB, standard charging station replacement is then not possible. The registration status returned should
      //        be 'Pending' and a way to manually accept or refuse such stations should be offered.
      const isChargingStationOnline = moment().subtract(Configuration.getChargingStationConfig().maxLastSeenIntervalSecs, 'seconds').isSameOrBefore(chargingStation.lastSeen);
      if (isChargingStationOnline && chargingStation.registrationStatus === RegistrationStatus.ACCEPTED) {
        await Logging.logWarning({
          tenantID: headers.tenantID,
          source: chargingStation.id,
          action: ServerAction.BOOT_NOTIFICATION,
          module: MODULE_NAME, method: 'handleBootNotification',
          message: 'Trying to connect a charging station matching an online charging station with identical chargeBoxID, registered boot notification and different attributes',
          detailedMessages: { headers, bootNotification }
        });
      }
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.BOOT_NOTIFICATION,
        module: MODULE_NAME, method: 'handleBootNotification',
        message: 'Boot Notification Rejected: Attribute mismatch: ' +
          (bootNotification.chargePointVendor !== chargingStation.chargePointVendor ?
            `Got chargePointVendor='${bootNotification.chargePointVendor}' but expected '${chargingStation.chargePointVendor}'! ` : '') +
          (bootNotification.chargePointModel !== chargingStation.chargePointModel ?
            `Got chargePointModel='${bootNotification.chargePointModel}' but expected '${chargingStation.chargePointModel}'! ` : '') +
          (bootNotification.chargePointSerialNumber !== chargingStation.chargePointSerialNumber ?
            `Got chargePointSerialNumber='${bootNotification.chargePointSerialNumber ? bootNotification.chargePointSerialNumber : ''}' but expected '${chargingStation.chargePointSerialNumber ? chargingStation.chargePointSerialNumber : ''}'!` : ''),
        detailedMessages: { headers, bootNotification }
      });
    }
    chargingStation.chargePointSerialNumber = bootNotification.chargePointSerialNumber;
    chargingStation.chargeBoxSerialNumber = bootNotification.chargeBoxSerialNumber;
    chargingStation.firmwareVersion = bootNotification.firmwareVersion;
    chargingStation.lastReboot = bootNotification.lastReboot;
    chargingStation.registrationStatus = RegistrationStatus.ACCEPTED;
    // Back again
    chargingStation.deleted = false;
  }

  private enrichChargingStation(chargingStation: ChargingStation, headers: OCPPHeader, bootNotification: OCPPBootNotificationRequestExtended) {
    chargingStation.ocppVersion = headers.ocppVersion;
    chargingStation.ocppProtocol = headers.ocppProtocol;
    chargingStation.lastSeen = bootNotification.lastSeen;
    chargingStation.currentIPAddress = bootNotification.currentIPAddress;
    // Set the Charging Station URL?
    if (headers.chargingStationURL) {
      chargingStation.chargingStationURL = headers.chargingStationURL;
    }
    // Update CF Instance
    if (Configuration.isCloudFoundry()) {
      chargingStation.cfApplicationIDAndInstanceIndex = Configuration.getCFApplicationIDAndInstanceIndex();
    }
  }

  private async applyChargingStationTemplate(tenant: Tenant, chargingStation: ChargingStation): Promise<TemplateUpdateResult> {
    const templateUpdateResult = await OCPPUtils.applyTemplateToChargingStation(tenant, chargingStation, false);
    // No matching template or manual configuration
    if (!templateUpdateResult.chargingStationUpdated) {
      OCPPUtils.checkAndSetChargingStationAmperageLimit(chargingStation);
      await OCPPUtils.setChargingStationPhaseAssignment(tenant, chargingStation);
      // Save Charging Station
      await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
    }
    return templateUpdateResult;
  }

  private notifyBootNotification(tenant: Tenant, chargingStation: ChargingStation) {
    void NotificationHandler.sendChargingStationRegistered(
      tenant.id,
      Utils.generateUUID(),
      chargingStation,
      {
        chargeBoxID: chargingStation.id,
        evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
        evseDashboardChargingStationURL: Utils.buildEvseChargingStationURL(tenant.subdomain, chargingStation, '#all')
      }
    );
  }

  private requestOCPPConfigurationDelayed(tenant: Tenant, chargingStation: ChargingStation, templateUpdateResult: TemplateUpdateResult, heartbeatIntervalSecs: number) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
      let result: OCPPChangeConfigurationCommandResult;
      // Synchronize heartbeat interval OCPP parameter for charging stations that do not take into account its value in the boot notification response
      // Set OCPP 'HeartBeatInterval'
      let heartBeatIntervalSettingFailure = false;
      result = await OCPPUtils.requestChangeChargingStationOcppParameter(tenant, chargingStation, {
        key: 'HeartBeatInterval',
        value: heartbeatIntervalSecs.toString()
      }, false);
      if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
        heartBeatIntervalSettingFailure = true;
      }
      // Set OCPP 'HeartbeatInterval'
      result = await OCPPUtils.requestChangeChargingStationOcppParameter(tenant, chargingStation, {
        key: 'HeartbeatInterval',
        value: heartbeatIntervalSecs.toString()
      }, false);
      let heartbeatIntervalSettingFailure = false;
      if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
        heartbeatIntervalSettingFailure = true;
      }
      // Check
      if (heartBeatIntervalSettingFailure && heartbeatIntervalSettingFailure) {
        await Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.BOOT_NOTIFICATION,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'handleBootNotification',
          message: `Cannot set heartbeat interval OCPP Parameter on '${chargingStation.id}' in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
          detailedMessages: { heartbeatIntervalSecs, chargingStation }
        });
      }
      // Apply Charging Station Template OCPP configuration
      if (templateUpdateResult.ocppStandardUpdated || templateUpdateResult.ocppVendorUpdated) {
        result = await OCPPUtils.applyTemplateOcppParametersToChargingStation(tenant, chargingStation);
      }
      if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
        await Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.BOOT_NOTIFICATION,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'handleBootNotification',
          message: `Cannot request and save OCPP Parameters from '${chargingStation.id}' in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
          detailedMessages: { result, chargingStation }
        });
      }
    }, Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS);
  }

  private enrichAuthorize(user: User, chargingStation: ChargingStation, headers: OCPPHeader, authorize: OCPPAuthorizeRequestExtended) {
    // Enrich
    this.enrichOCPPRequest(chargingStation, authorize);
    // Roaming User
    if (user && !user.issuer) {
      // Authorization ID provided?
      if (user.authorizationID) {
        // Public Charging Station
        if (chargingStation.public) {
          // Keep Roaming Auth ID
          authorize.authorizationId = user.authorizationID;
        } else {
          throw new BackendError({
            user: user,
            action: ServerAction.AUTHORIZE,
            module: MODULE_NAME,
            method: 'handleAuthorize',
            message: 'Cannot authorize a roaming user on a private charging station',
            detailedMessages: { headers, authorize }
          });
        }
      } else {
        throw new BackendError({
          user: user,
          action: ServerAction.AUTHORIZE,
          module: MODULE_NAME,
          method: 'handleAuthorize',
          message: 'Authorization ID has not been supplied',
          detailedMessages: { headers, authorize }
        });
      }
    }
    // Set
    authorize.user = user;
  }

  private enrichOCPPRequest(chargingStation: ChargingStation, ocppRequest: any, withTimeStamp = true) {
    // Enrich Request
    ocppRequest.chargeBoxID = chargingStation.id;
    ocppRequest.timezone = Utils.getTimezone(chargingStation.coordinates);
    if (withTimeStamp) {
      ocppRequest.timestamp = new Date();
    }
    // Update Charging Station
    chargingStation.lastSeen = new Date();
  }

  private async bypassStopTransaction(tenant: Tenant, chargingStation: ChargingStation,
      headers: OCPPHeader, stopTransaction: OCPPStopTransactionRequestExtended): Promise<boolean> {
    // Ignore it (DELTA bug)?
    if (stopTransaction.transactionId === 0) {
      await Logging.logWarning({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleStopTransaction',
        action: ServerAction.STOP_TRANSACTION,
        message: 'Ignored Transaction ID = 0',
        detailedMessages: { headers, stopTransaction }
      });
      return true;
    }
    return false;
  }

  private async getTransactionFromMeterValues(tenant: Tenant, chargingStation: ChargingStation, headers: OCPPHeader, meterValues: OCPPMeterValuesRequest): Promise<Transaction> {
    // Handle Meter Value only for transaction
    if (!meterValues.transactionId) {
      throw new BackendError({
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleMeterValues',
        message: `Connector ID '${meterValues.connectorId.toString()}' > Meter Values are ignored as it is not linked to a transaction`,
        action: ServerAction.METER_VALUES,
        detailedMessages: { headers, meterValues }
      });
    }
    const transaction = await TransactionStorage.getTransaction(tenant.id, meterValues.transactionId);
    if (!transaction) {
      throw new BackendError({
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleMeterValues',
        message: `Transaction with ID '${meterValues.transactionId.toString()}' doesn't exist`,
        action: ServerAction.METER_VALUES,
        detailedMessages: { headers, meterValues }
      });
    }
    // Received Meter Values after the Transaction End Meter Value
    if (transaction.transactionEndReceived) {
      await Logging.logWarning({
        tenantID: tenant.id,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleMeterValues',
        action: ServerAction.METER_VALUES,
        message: `Connector ID '${meterValues.connectorId.toString()}' > Transaction ID '${meterValues.transactionId.toString()}' > Meter Values received after the 'Transaction.End' Meter Values`,
        detailedMessages: { headers, meterValues }
      });
    }
    return transaction;
  }

  private async getTransactionFromStopTransaction(tenant: Tenant, chargingStation: ChargingStation,
      headers: OCPPHeader, stopTransaction: OCPPStopTransactionRequestExtended): Promise<Transaction> {
    const transaction = await TransactionStorage.getTransaction(tenant.id, stopTransaction.transactionId);
    if (!transaction) {
      throw new BackendError({
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleStopTransaction',
        message: `Transaction with ID '${stopTransaction.transactionId}' doesn't exist`,
        action: ServerAction.STOP_TRANSACTION,
        detailedMessages: { headers, stopTransaction }
      });
    }
    return transaction;
  }

  private checkSoftStopTransaction(transaction: Transaction, stopTransaction: OCPPStopTransactionRequestExtended, isSoftStop: boolean) {
    if (isSoftStop) {
      // Yes: Add the latest Meter Value
      if (transaction.lastConsumption) {
        stopTransaction.meterStop = transaction.lastConsumption.value;
      } else {
        stopTransaction.meterStop = 0;
      }
    }
  }

  private async checkAndApplyLastConsumptionInStopTransaction(tenant: Tenant, chargingStation: ChargingStation,
      transaction: Transaction, stopTransaction: OCPPStopTransactionRequestExtended) {
    // No need to compute the last consumption if Transaction.End Meter Value has been received
    if (!transaction.transactionEndReceived) {
      // Recreate the last meter value to price the last Consumption
      const stopMeterValues = OCPPUtils.createTransactionStopMeterValues(chargingStation, transaction, stopTransaction);
      // Build final Consumptions (only one consumption)
      const consumptions = await OCPPUtils.createConsumptionsFromMeterValues(tenant, chargingStation, transaction, stopMeterValues);
      // Update
      for (const consumption of consumptions) {
        // Update Transaction with Consumption
        OCPPUtils.updateTransactionWithConsumption(chargingStation, transaction, consumption);
        if (consumption.toPrice) {
          // Price
          await OCPPUtils.processTransactionPricing(tenant, transaction, chargingStation, consumption, TransactionAction.STOP);
        }
        // Save Consumption
        await ConsumptionStorage.saveConsumption(tenant.id, consumption);
      }
    // Check Inactivity and Consumption between the last Transaction.End and Stop Transaction
    } else if (transaction.lastConsumption) {
      // The consumption should be the same
      if (transaction.lastConsumption.value !== stopTransaction.meterStop) {
        await Logging.logWarning({
          tenantID: tenant.id,
          source: chargingStation.id,
          action: ServerAction.STOP_TRANSACTION,
          module: MODULE_NAME, method: 'checkAndApplyLastConsumptionInStopTransaction',
          message: `Connector ID '${transaction.connectorId}' > Transaction ID '${transaction.id}' > Transaction.End consumption '${transaction.lastConsumption.value}' differs from Stop Transaction '${stopTransaction.meterStop}'`,
          detailedMessages: { stopTransaction, transaction }
        });
      }
      // Handle inactivity
      const inactivitySecs = Utils.createDecimal(new Date(stopTransaction.timestamp).getTime() - new Date(transaction.lastConsumption.timestamp).getTime()).div(1000).toNumber();
      // Add inactivity to Transaction
      if (inactivitySecs > 0) {
        transaction.currentTotalInactivitySecs += inactivitySecs;
        transaction.currentTotalDurationSecs += inactivitySecs;
      }
    }
  }
}
