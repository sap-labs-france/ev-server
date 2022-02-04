import { ChargePointErrorCode, ChargePointStatus, OCPPAttribute, OCPPAuthorizationStatus, OCPPAuthorizeRequestExtended, OCPPAuthorizeResponse, OCPPBootNotificationRequestExtended, OCPPBootNotificationResponse, OCPPDataTransferRequestExtended, OCPPDataTransferResponse, OCPPDataTransferStatus, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequestExtended, OCPPHeartbeatResponse, OCPPLocation, OCPPMeasurand, OCPPMeterValue, OCPPMeterValuesRequest, OCPPMeterValuesRequestExtended, OCPPMeterValuesResponse, OCPPNormalizedMeterValue, OCPPNormalizedMeterValues, OCPPPhase, OCPPProtocol, OCPPReadingContext, OCPPSampledValue, OCPPStartTransactionRequestExtended, OCPPStartTransactionResponse, OCPPStatusNotificationRequestExtended, OCPPStatusNotificationResponse, OCPPStopTransactionRequestExtended, OCPPStopTransactionResponse, OCPPUnitOfMeasure, OCPPValueFormat, OCPPVersion, RegistrationStatus } from '../../../types/ocpp/OCPPServer';
import { ChargingProfilePurposeType, ChargingRateUnitType } from '../../../types/ChargingProfile';
import ChargingStation, { ChargerVendor, Connector, ConnectorCurrentLimitSource, ConnectorType, CurrentType, StaticLimitAmps, TemplateUpdateResult } from '../../../types/ChargingStation';
import { OCPPConfigurationStatus, OCPPRemoteStartStopStatus } from '../../../types/ocpp/OCPPClient';
import Tenant, { TenantComponents } from '../../../types/Tenant';
import Transaction, { InactivityStatus, TransactionAction } from '../../../types/Transaction';

import { Action } from '../../../types/Authorization';
import Authorizations from '../../../authorization/Authorizations';
import BackendError from '../../../exception/BackendError';
import CarConnectorFactory from '../../../integration/car-connector/CarConnectorFactory';
import CarStorage from '../../../storage/mongodb/CarStorage';
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import Consumption from '../../../types/Consumption';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import CpoOCPIClient from '../../../client/ocpi/CpoOCPIClient';
import CpoOICPClient from '../../../client/oicp/CpoOICPClient';
import I18nManager from '../../../utils/I18nManager';
import LockingHelper from '../../../locking/LockingHelper';
import LockingManager from '../../../locking/LockingManager';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import NotificationHandler from '../../../notification/NotificationHandler';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import OCPPCommon from '../utils/OCPPCommon';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import OCPPUtils from '../utils/OCPPUtils';
import OCPPValidation from '../validation/OCPPValidation';
import OICPClientFactory from '../../../client/oicp/OICPClientFactory';
import { OICPRole } from '../../../types/oicp/OICPRole';
import { ServerAction } from '../../../types/Server';
import SiteArea from '../../../types/SiteArea';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import SmartChargingFactory from '../../../integration/smart-charging/SmartChargingFactory';
import Tag from '../../../types/Tag';
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
      const { tenant } = headers;
      let { chargingStation } = headers;
      OCPPValidation.getInstance().validateBootNotification(bootNotification);
      // Enrich Boot Notification
      this.enrichBootNotification(headers, bootNotification);
      // Get heartbeat interval
      const heartbeatIntervalSecs = this.getHeartbeatInterval(headers.ocppProtocol);
      // Check Charging Station
      if (!headers.chargeBoxIdentity) {
        throw new BackendError({
          action: ServerAction.OCPP_BOOT_NOTIFICATION,
          module: MODULE_NAME, method: 'handleBootNotification',
          message: 'Should have the required property \'chargeBoxIdentity\'!',
          detailedMessages: { bootNotification }
        });
      }
      // Get Charging Station
      if (!chargingStation) {
        // Create Charging Station
        chargingStation = await this.createChargingStationFromBootNotification(tenant, bootNotification, headers);
      } else {
        // Check Charging Station
        this.checkSameChargingStation(headers, chargingStation, bootNotification);
      }
      // Enrich Charging Station
      await this.enrichChargingStationFromBootNotification(tenant, chargingStation, headers, bootNotification);
      // Apply Charging Station Template
      const templateUpdateResult = await this.applyChargingStationTemplate(tenant, chargingStation);
      // Save Charging Station
      await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
      // Save Boot Notification
      await OCPPStorage.saveBootNotification(tenant, bootNotification);
      // Notify
      this.notifyBootNotification(tenant, chargingStation);
      // Request OCPP configuration
      this.requestOCPPConfigurationAfterBootNotification(tenant, chargingStation, templateUpdateResult, heartbeatIntervalSecs);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPP_BOOT_NOTIFICATION,
        module: MODULE_NAME, method: 'handleBootNotification',
        message: 'Boot Notification has been accepted',
        detailedMessages: { bootNotification }
      });
      // Accept
      return {
        currentTime: bootNotification.timestamp.toISOString(),
        status: RegistrationStatus.ACCEPTED,
        interval: heartbeatIntervalSecs
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.OCPP_BOOT_NOTIFICATION, error, { bootNotification });
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
      // Get the header infos
      const { chargingStation, tenant } = headers;
      OCPPValidation.getInstance().validateHeartbeat(heartbeat);
      // Set Heart Beat Object
      heartbeat = {
        chargeBoxID: chargingStation.id,
        timestamp: new Date(),
        timezone: Utils.getTimezone(chargingStation.coordinates)
      };
      // Save Heart Beat
      await OCPPStorage.saveHeartbeat(tenant, heartbeat);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'handleHeartbeat',
        action: ServerAction.OCPP_HEARTBEAT,
        message: 'Heartbeat saved',
        detailedMessages: { heartbeat }
      });
      return {
        currentTime: new Date().toISOString()
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.OCPP_HEARTBEAT, error, { heartbeat });
      return {
        currentTime: new Date().toISOString()
      };
    }
  }

  public async handleStatusNotification(headers: OCPPHeader, statusNotification: OCPPStatusNotificationRequestExtended): Promise<OCPPStatusNotificationResponse> {
    try {
      // Get the header infos
      const { chargingStation, tenant } = headers;
      // Check props
      OCPPValidation.getInstance().validateStatusNotification(statusNotification);
      // Set Header
      this.enrichOCPPRequest(chargingStation, statusNotification, false);
      // Skip connectorId = 0 case
      if (statusNotification.connectorId <= 0) {
        await Logging.logInfo({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action: ServerAction.OCPP_STATUS_NOTIFICATION,
          module: MODULE_NAME, method: 'handleStatusNotification',
          message: `Connector ID '0' > ${this.buildStatusNotification(statusNotification)}, will be ignored (Connector ID = '0')`,
          detailedMessages: { statusNotification }
        });
        return {};
      }
      // Update only the given Connector ID
      await this.processConnectorStatusNotification(tenant, chargingStation, statusNotification);
      return {};
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.OCPP_STATUS_NOTIFICATION, error, { statusNotification });
      return {};
    }
  }

  public async handleMeterValues(headers: OCPPHeader, meterValues: OCPPMeterValuesRequestExtended): Promise<OCPPMeterValuesResponse> {
    try {
      // Get the header infos
      const { chargingStation, tenant } = headers;
      await OCPPValidation.getInstance().validateMeterValues(tenant.id, chargingStation, meterValues);
      // Normalize Meter Values
      const normalizedMeterValues = this.normalizeMeterValues(chargingStation, meterValues);
      // Handle Charging Station's specificities
      this.filterMeterValuesOnSpecificChargingStations(tenant, chargingStation, normalizedMeterValues);
      if (Utils.isEmptyArray(normalizedMeterValues.values)) {
        await Logging.logDebug({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          module: MODULE_NAME, method: 'handleMeterValues',
          action: ServerAction.OCPP_METER_VALUES,
          message: 'No relevant Meter Values to save',
          detailedMessages: { meterValues }
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
      // Handle current SOC
      await this.processTransactionCar(tenant, transaction, chargingStation, consumptions[consumptions.length - 1], null, TransactionAction.UPDATE);
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
        await ConsumptionStorage.saveConsumption(tenant, consumption);
      }
      // Get the phases really used from Meter Values (for AC single phase charger/car)
      if (!transaction.phasesUsed &&
        Utils.checkIfPhasesProvidedInTransactionInProgress(transaction) &&
        transaction.numberOfMeterValues >= 1) {
        transaction.phasesUsed = Utils.getUsedPhasesInTransactionInProgress(chargingStation, transaction);
      }
      // Roaming
      await OCPPUtils.processTransactionRoaming(tenant, transaction, chargingStation, transaction.tag, TransactionAction.UPDATE);
      // Save Transaction
      await TransactionStorage.saveTransaction(tenant, transaction);
      // Update Charging Station
      await this.updateChargingStationWithTransaction(tenant, chargingStation, transaction);
      // Handle End Of charge
      await this.checkNotificationEndOfCharge(tenant, chargingStation, transaction);
      // Save Charging Station
      await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
      // First Meter Value -> Trigger Smart Charging to adjust the limit
      if (transaction.numberOfMeterValues === 1 && transaction.phasesUsed) {
        // Yes: Trigger Smart Charging
        await this.triggerSmartCharging(tenant, chargingStation);
      }
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPP_METER_VALUES,
        user: transaction.userID,
        module: MODULE_NAME, method: 'handleMeterValues',
        message: `${Utils.buildConnectorInfo(meterValues.connectorId, meterValues.transactionId)}  MeterValue have been saved`,
        detailedMessages: { normalizedMeterValues }
      });
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.OCPP_METER_VALUES, error, { meterValues });
    }
    return {};
  }

  public async handleAuthorize(headers: OCPPHeader, authorize: OCPPAuthorizeRequestExtended): Promise<OCPPAuthorizeResponse> {
    try {
      // Get the header infos
      const { chargingStation, tenant } = headers;
      // Check props
      OCPPValidation.getInstance().validateAuthorize(authorize);
      const { user } = await Authorizations.isAuthorizedOnChargingStation(tenant, chargingStation,
        authorize.idTag, ServerAction.OCPP_AUTHORIZE, Action.AUTHORIZE);
      // Check Billing Prerequisites
      await OCPPUtils.checkBillingPrerequisites(tenant, ServerAction.OCPP_AUTHORIZE, chargingStation, user);
      // Enrich
      this.enrichAuthorize(user, chargingStation, headers, authorize);
      // Save
      await OCPPStorage.saveAuthorize(tenant, authorize);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'handleAuthorize',
        action: ServerAction.OCPP_AUTHORIZE, user: (authorize.user ? authorize.user : null),
        message: `User has been authorized with RFID Card '${authorize.idTag}'`,
        detailedMessages: { authorize }
      });
      // Accepted
      return {
        idTagInfo: {
          status: OCPPAuthorizationStatus.ACCEPTED
        }
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.OCPP_AUTHORIZE, error, { authorize });
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
    // Get the header infos
    const { chargingStation, tenant } = headers;
    try {
      // Check props
      OCPPValidation.getInstance().validateDiagnosticsStatusNotification(chargingStation, diagnosticsStatusNotification);
      // Enrich
      this.enrichOCPPRequest(chargingStation, diagnosticsStatusNotification);
      // Save it
      await OCPPStorage.saveDiagnosticsStatusNotification(tenant, diagnosticsStatusNotification);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION,
        module: MODULE_NAME, method: 'handleDiagnosticsStatusNotification',
        message: 'Diagnostics Status Notification has been saved',
        detailedMessages: { diagnosticsStatusNotification }
      });
      return {};
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION, error, { diagnosticsStatusNotification });
      return {};
    }
  }

  public async handleFirmwareStatusNotification(headers: OCPPHeader,
      firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended): Promise<OCPPFirmwareStatusNotificationResponse> {
    // Get the header infos
    const { chargingStation, tenant } = headers;
    try {
      // Check props
      OCPPValidation.getInstance().validateFirmwareStatusNotification(chargingStation, firmwareStatusNotification);
      // Enrich
      this.enrichOCPPRequest(chargingStation, firmwareStatusNotification);
      // Save the status to Charging Station
      await ChargingStationStorage.saveChargingStationFirmwareStatus(tenant, chargingStation.id, firmwareStatusNotification.status);
      // Save it
      await OCPPStorage.saveFirmwareStatusNotification(tenant, firmwareStatusNotification);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'handleFirmwareStatusNotification',
        action: ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION,
        message: `Firmware Status Notification '${firmwareStatusNotification.status}' has been saved`,
        detailedMessages: { firmwareStatusNotification }
      });
      return {};
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION, error, { firmwareStatusNotification });
      return {};
    }
  }

  public async handleStartTransaction(headers: OCPPHeader, startTransaction: OCPPStartTransactionRequestExtended): Promise<OCPPStartTransactionResponse> {
    try {
      // Get the header infos
      const { chargingStation, tenant } = headers;
      // Check props
      OCPPValidation.getInstance().validateStartTransaction(chargingStation, startTransaction);
      // Enrich
      this.enrichStartTransaction(tenant, startTransaction, chargingStation);
      // Create Transaction
      const newTransaction = await this.createTransaction(tenant, startTransaction);
      // Check User
      const { user, tag } = await Authorizations.isAuthorizedToStartTransaction(
        tenant, chargingStation, startTransaction.tagID, newTransaction, ServerAction.OCPP_START_TRANSACTION, Action.START_TRANSACTION);
      if (user) {
        startTransaction.userID = user.id;
        newTransaction.userID = user.id;
        newTransaction.user = user;
        newTransaction.authorizationID = user.authorizationID;
      }
      // Cleanup ongoing Transaction
      await this.processExistingTransaction(tenant, chargingStation, startTransaction.connectorId);
      // Handle car and current SOC
      await this.processTransactionCar(tenant, newTransaction, chargingStation, null, user, TransactionAction.START);
      // Pricing
      const firstConsumption = await OCPPUtils.createFirstConsumption(tenant, chargingStation, newTransaction);
      await OCPPUtils.processTransactionPricing(tenant, newTransaction, chargingStation, firstConsumption, TransactionAction.START);
      // Billing
      await OCPPUtils.processTransactionBilling(tenant, newTransaction, TransactionAction.START);
      // Roaming
      await OCPPUtils.processTransactionRoaming(tenant, newTransaction, chargingStation, tag, TransactionAction.START);
      // Save it
      await TransactionStorage.saveTransaction(tenant, newTransaction);
      // Clean up
      await this.updateChargingStationConnectorWithTransaction(tenant, newTransaction, chargingStation, user);
      // Save
      await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
      // Notify
      this.notifyStartTransaction(tenant, newTransaction, chargingStation, user);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'handleStartTransaction',
        action: ServerAction.OCPP_START_TRANSACTION, user: user,
        message: `${Utils.buildConnectorInfo(newTransaction.connectorId, newTransaction.id)} Transaction has been started successfully`,
        detailedMessages: { transaction: newTransaction, startTransaction }
      });
      // Accepted
      return {
        transactionId: newTransaction.id,
        idTagInfo: {
          status: OCPPAuthorizationStatus.ACCEPTED
        }
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.OCPP_START_TRANSACTION, error, { startTransaction });
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
      // Get the header infos
      const { chargingStation, tenant } = headers;
      // Check props
      OCPPValidation.getInstance().validateDataTransfer(chargingStation, dataTransfer);
      // Enrich
      this.enrichOCPPRequest(chargingStation, dataTransfer);
      // Save it
      await OCPPStorage.saveDataTransfer(tenant, dataTransfer);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'handleDataTransfer',
        action: ServerAction.CHARGING_STATION_DATA_TRANSFER, message: 'Data Transfer has been saved',
        detailedMessages: { dataTransfer }
      });
      // Accepted
      return {
        status: OCPPDataTransferStatus.ACCEPTED
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.CHARGING_STATION_DATA_TRANSFER, error, { dataTransfer });
      // Rejected
      return {
        status: OCPPDataTransferStatus.REJECTED
      };
    }
  }

  public async handleStopTransaction(headers: OCPPHeader, stopTransaction: OCPPStopTransactionRequestExtended,
      isSoftStop = false, isStoppedByCentralSystem = false): Promise<OCPPStopTransactionResponse> {
    try {
      // Get the header infos
      const { chargingStation, tenant } = headers;
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
      OCPPUtils.clearChargingStationConnectorRuntimeData(chargingStation, transaction.connectorId);
      // Save Charging Station
      await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
      // Soft Stop
      this.checkSoftStopTransaction(transaction, stopTransaction, isSoftStop);
      // Transaction End has already been received?
      await this.checkAndApplyLastConsumptionInStopTransaction(tenant, chargingStation, transaction, stopTransaction);
      // Signed Data
      this.checkAndUpdateTransactionWithSignedDataInStopTransaction(transaction, stopTransaction);
      // Update Transaction with Stop Transaction and Stop MeterValues
      OCPPUtils.updateTransactionWithStopTransaction(transaction, chargingStation, stopTransaction, user, alternateUser, tagID, isSoftStop);
      // Bill
      await OCPPUtils.processTransactionBilling(tenant, transaction, TransactionAction.STOP);
      // Roaming
      await OCPPUtils.processTransactionRoaming(tenant, transaction, chargingStation, transaction.tag, TransactionAction.STOP);
      // Save the transaction
      await TransactionStorage.saveTransaction(tenant, transaction);
      // Notify
      this.notifyStopTransaction(tenant, chargingStation, transaction, user, alternateUser);
      // Recompute the Smart Charging Plan
      await this.triggerSmartChargingStopTransaction(tenant, chargingStation, transaction);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'handleStopTransaction',
        action: ServerAction.OCPP_STOP_TRANSACTION,
        user: alternateUser ?? (user ?? null),
        actionOnUser: alternateUser ? (user ?? null) : null,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction has been stopped successfully`,
        detailedMessages: { stopTransaction }
      });
      // Accepted
      return {
        idTagInfo: {
          status: OCPPAuthorizationStatus.ACCEPTED
        }
      };
    } catch (error) {
      this.addChargingStationToException(error, headers.chargeBoxIdentity);
      await Logging.logActionExceptionMessage(headers.tenantID, ServerAction.OCPP_STOP_TRANSACTION, error, { stopTransaction });
      // Invalid
      return {
        idTagInfo: {
          status: OCPPAuthorizationStatus.INVALID
        }
      };
    }
  }

  public async softStopTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, siteArea: SiteArea): Promise<boolean> {
    // Check
    if (!tenant || !transaction || !chargingStation) {
      return false;
    }
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION) && !siteArea) {
      return false;
    }
    // Set
    chargingStation.siteArea = siteArea;
    // Stop Transaction
    const result = await this.handleStopTransaction(
      { // OCPP Header
        chargeBoxIdentity: transaction.chargeBoxID,
        chargingStation: chargingStation,
        companyID: transaction.companyID,
        siteID: transaction.siteID,
        siteAreaID: transaction.siteAreaID,
        tenantID: tenant.id,
        tenant: tenant,
      },
      { // OCPP Stop Transaction
        transactionId: transaction.id,
        chargeBoxID: transaction.chargeBoxID,
        idTag: transaction.tagID,
        timestamp: Utils.convertToDate(transaction.lastConsumption ? transaction.lastConsumption.timestamp : transaction.timestamp).toISOString(),
        meterStop: transaction.lastConsumption ? transaction.lastConsumption.value : transaction.meterStart
      },
      true
    );
    return (result.idTagInfo?.status === OCPPAuthorizationStatus.ACCEPTED);
  }

  private checkAndUpdateTransactionWithSignedDataInStopTransaction(transaction: Transaction, stopTransaction: OCPPStopTransactionRequestExtended) {
    // Handle Signed Data in Stop Transaction
    if (!Utils.isEmptyArray(stopTransaction.transactionData)) {
      for (const meterValue of stopTransaction.transactionData as OCPPMeterValue[]) {
        for (const sampledValue of meterValue.sampledValue) {
          if (sampledValue.format === OCPPValueFormat.SIGNED_DATA) {
            // Set Signed data in Start of Transaction
            if (sampledValue.context === OCPPReadingContext.TRANSACTION_BEGIN) {
              transaction.signedData = sampledValue.value;
            }
            if (sampledValue.context === OCPPReadingContext.TRANSACTION_END) {
              transaction.currentSignedData = sampledValue.value;
            }
          }
        }
      }
    }
  }

  private async checkAuthorizeStopTransactionAndGetUsers(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction,
      tagId: string, isStoppedByCentralSystem: boolean): Promise<{ user: User; alternateUser: User; }> {
    let user: User;
    let alternateUser: User;
    if (!isStoppedByCentralSystem) {
      // Check and get the authorized Users
      const authorizedUsers = await Authorizations.isAuthorizedToStopTransaction(
        tenant, chargingStation, transaction, tagId, ServerAction.OCPP_STOP_TRANSACTION, Action.STOP_TRANSACTION);
      user = authorizedUsers.user;
      alternateUser = authorizedUsers.alternateUser;
    } else {
      // Get the User
      user = await UserStorage.getUserByTagId(tenant, tagId);
    }
    // Already Stopped?
    if (transaction.stop) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'checkAuthorizeStopTransactionAndGetUsers',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction has already been stopped`,
        action: ServerAction.OCPP_STOP_TRANSACTION,
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
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            module: MODULE_NAME, method: 'triggerSmartChargingStopTransaction',
            action: ServerAction.OCPP_STOP_TRANSACTION,
            message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Smart Charging exception occurred`,
            detailedMessages: { error: error.stack, transaction, chargingStation }
          });
        }
      }, Constants.DELAY_SMART_CHARGING_EXECUTION_MILLIS);
    }
  }

  private async deleteAllTransactionTxProfile(tenant: Tenant, transaction: Transaction) {
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(tenant, {
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
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: tenant.id,
          action: ServerAction.CHARGING_PROFILE_DELETE,
          message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} TX Charging Profile with ID '${chargingProfile.id}'`,
          module: MODULE_NAME, method: 'deleteAllTransactionTxProfile',
          detailedMessages: { chargingProfile }
        });
      } catch (error) {
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: tenant.id,
          action: ServerAction.CHARGING_PROFILE_DELETE,
          message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Cannot delete TX Charging Profile with ID '${chargingProfile.id}'`,
          module: MODULE_NAME, method: 'deleteAllTransactionTxProfile',
          detailedMessages: { error: error.stack, chargingProfile }
        });
      }
    }
  }

  private async processConnectorStatusNotification(tenant: Tenant, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended) {
    // Get Connector
    const { connector, ignoreStatusNotification } =
      await this.checkAndGetConnectorFromStatusNotification(tenant, chargingStation, statusNotification);
    if (!ignoreStatusNotification) {
      // Check last Transaction
      await this.checkAndUpdateLastCompletedTransactionFromStatusNotification(tenant, chargingStation, statusNotification, connector);
      // Update Connector
      connector.connectorId = statusNotification.connectorId;
      connector.status = statusNotification.status;
      connector.errorCode = statusNotification.errorCode;
      connector.info = statusNotification.info;
      connector.vendorErrorCode = statusNotification.vendorErrorCode;
      connector.statusLastChangedOn = new Date(statusNotification.timestamp);
      // Save Status Notification
      await OCPPStorage.saveStatusNotification(tenant, statusNotification);
      // Process Roaming
      await this.processRoamingFromStatusNotification(tenant, chargingStation, connector);
      // Sort connectors
      if (!Utils.isEmptyArray(chargingStation?.connectors)) {
        chargingStation.connectors.sort((connector1: Connector, connector2: Connector) =>
          connector1?.connectorId - connector2?.connectorId);
      }
      // Save Charging Station
      await ChargingStationStorage.saveChargingStationConnectors(tenant, chargingStation.id,
        chargingStation.connectors, chargingStation.backupConnectors);
      // Process Smart Charging
      await this.processSmartChargingFromStatusNotification(tenant, chargingStation, connector);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'processConnectorStatusNotification',
        action: ServerAction.OCPP_STATUS_NOTIFICATION,
        message: `${Utils.buildConnectorInfo(statusNotification.connectorId, connector.currentTransactionID)} ${this.buildStatusNotification(statusNotification)} has been saved`,
        detailedMessages: { statusNotification, connector }
      });
      // Notify Users
      await this.notifyStatusNotification(tenant, chargingStation, connector, statusNotification);
    }
  }

  private async processSmartChargingFromStatusNotification(tenant: Tenant, chargingStation: ChargingStation, connector: Connector): Promise<void> {
    // Trigger Smart Charging
    if (connector.status === ChargePointStatus.CHARGING ||
      connector.status === ChargePointStatus.SUSPENDED_EV) {
      try {
        // Trigger Smart Charging
        await this.triggerSmartCharging(tenant, chargingStation);
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          module: MODULE_NAME, method: 'processSmartChargingStatusNotification',
          action: ServerAction.OCPP_STATUS_NOTIFICATION,
          message: `${Utils.buildConnectorInfo(connector.connectorId, connector.currentTransactionID)} Smart Charging exception occurred`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private async processRoamingFromStatusNotification(tenant: Tenant, chargingStation: ChargingStation, foundConnector: Connector): Promise<void> {
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
  }

  private async checkAndGetConnectorFromStatusNotification(tenant: Tenant, chargingStation: ChargingStation,
      statusNotification: OCPPStatusNotificationRequestExtended): Promise<{ connector: Connector; ignoreStatusNotification: boolean; }> {
    let ignoreStatusNotification = false;
    let foundConnector = Utils.getConnectorFromID(chargingStation, statusNotification.connectorId);
    if (!foundConnector) {
      // Check backup first
      foundConnector = Utils.getLastSeenConnectorFromID(chargingStation, statusNotification.connectorId);
      if (foundConnector) {
        // Append the backup connector
        chargingStation.connectors.push(foundConnector);
        chargingStation.backupConnectors = chargingStation.backupConnectors.filter(
          (backupConnector) => backupConnector.connectorId !== foundConnector.connectorId);
      } else {
        // Does not exist: Create
        foundConnector = {
          currentTransactionID: 0,
          currentTransactionDate: null,
          currentTagID: null,
          currentUserID: null,
          connectorId: statusNotification.connectorId,
          currentInstantWatts: 0,
          status: ChargePointStatus.UNAVAILABLE,
          power: 0,
          type: ConnectorType.UNKNOWN
        };
        chargingStation.connectors.push(foundConnector);
      }
      // Enrich Charging Station's Connector
      const chargingStationTemplate = await OCPPUtils.getChargingStationTemplate(chargingStation);
      if (chargingStationTemplate) {
        await OCPPUtils.enrichChargingStationConnectorWithTemplate(
          tenant, chargingStation, statusNotification.connectorId, chargingStationTemplate);
      }
      // Same Status Notification?
    } else if (Utils.objectAllPropertiesAreEqual(statusNotification, foundConnector, ['status', 'info', 'errorCode', 'vendorErrorCode'])) {
      ignoreStatusNotification = true;
      await Logging.logWarning({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPP_STATUS_NOTIFICATION,
        module: MODULE_NAME, method: 'handleStatusNotification',
        message: `${this.buildStatusNotification(statusNotification)} has not changed and will be ignored`,
        detailedMessages: { foundConnector, statusNotification }
      });
    }
    return { connector: foundConnector, ignoreStatusNotification };
  }

  private async checkAndUpdateLastCompletedTransactionFromStatusNotification(tenant: Tenant, chargingStation: ChargingStation,
      statusNotification: OCPPStatusNotificationRequestExtended, connector: Connector) {
    // Check last transaction
    if (statusNotification.status === ChargePointStatus.AVAILABLE ||
        statusNotification.status === ChargePointStatus.PREPARING) {
      // Get the last transaction
      const lastTransaction = await TransactionStorage.getLastTransactionFromChargingStation(
        tenant, chargingStation.id, connector.connectorId, { withUser: true });
      if (lastTransaction) {
        // Transaction completed
        if (lastTransaction.stop) {
          // Check Inactivity
          const transactionUpdated = await this.checkAndComputeTransactionExtraInactivityFromStatusNotification(
            tenant, chargingStation, lastTransaction, connector, statusNotification);
          // Billing: Trigger the asynchronous billing task
          const billingDataUpdated = await this.checkAndBillTransaction(tenant, lastTransaction);
          // OCPI: Post the CDR
          const ocpiUpdated = await this.checkAndSendOCPITransactionCdr(
            tenant, lastTransaction, chargingStation, lastTransaction.tag);
          // OICP: Post the CDR
          const oicpUpdated = await this.checkAndSendOICPTransactionCdr(
            tenant, lastTransaction, chargingStation, lastTransaction.tag);
          // Save
          if (transactionUpdated || billingDataUpdated || ocpiUpdated || oicpUpdated) {
            await TransactionStorage.saveTransaction(tenant, lastTransaction);
          }
        } else {
          await Logging.logWarning({
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            module: MODULE_NAME, method: 'checkAndUpdateLastCompletedTransaction',
            action: ServerAction.OCPP_STATUS_NOTIFICATION,
            message: `${Utils.buildConnectorInfo(lastTransaction.connectorId, lastTransaction.id)} Received Status Notification '${statusNotification.status}' while a transaction is ongoing`,
            detailedMessages: { statusNotification }
          });
        }
        // Clear Connector Runtime Data
        OCPPUtils.clearChargingStationConnectorRuntimeData(chargingStation, lastTransaction.connectorId);
      }
    }
  }

  private async checkAndComputeTransactionExtraInactivityFromStatusNotification(tenant: Tenant, chargingStation: ChargingStation,
      transaction: Transaction, connector: Connector, statusNotification: OCPPStatusNotificationRequestExtended): Promise<boolean> {
    let extraInactivityUpdated = false;
    if (Utils.objectHasProperty(statusNotification, 'timestamp')) {
      // Session is finished
      if (!transaction.stop.extraInactivityComputed) {
        transaction.stop.extraInactivitySecs = 0;
        // Calculate Extra Inactivity
        if ((connector.status === ChargePointStatus.FINISHING ||
             connector.status === ChargePointStatus.CHARGING ||
             connector.status === ChargePointStatus.SUSPENDED_EV ||
             connector.status === ChargePointStatus.SUSPENDED_EVSE ||
             connector.status === ChargePointStatus.OCCUPIED ||
             connector.status === ChargePointStatus.UNAVAILABLE) &&
            statusNotification.status === ChargePointStatus.AVAILABLE) {
          const transactionStopTimestamp = Utils.convertToDate(transaction.stop.timestamp);
          const currentStatusNotifTimestamp = Utils.convertToDate(statusNotification.timestamp);
          // Diff
          transaction.stop.extraInactivitySecs =
            Utils.createDecimal(currentStatusNotifTimestamp.getTime()).minus(transactionStopTimestamp.getTime()).div(1000).floor().toNumber();
          // Negative inactivity
          if (transaction.stop.extraInactivitySecs < 0) {
            await Logging.logWarning({
              tenantID: tenant.id,
              ...LoggingHelper.getChargingStationProperties(chargingStation),
              module: MODULE_NAME, method: 'checkAndUpdateLastCompletedTransaction',
              action: ServerAction.OCPP_STATUS_NOTIFICATION,
              message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Extra Inactivity is negative and will be ignored: ${transaction.stop.extraInactivitySecs} secs`,
              detailedMessages: { statusNotification }
            });
            transaction.stop.extraInactivitySecs = 0;
          }
          if (transaction.stop.extraInactivitySecs > 0) {
            // Fix the Inactivity severity
            transaction.stop.inactivityStatus = Utils.getInactivityStatusLevel(chargingStation,
              transaction.connectorId,
              transaction.stop.totalInactivitySecs + transaction.stop.extraInactivitySecs
            );
            // Build extra inactivity consumption
            await OCPPUtils.buildAndPriceExtraConsumptionInactivity(tenant, chargingStation, transaction);
            await Logging.logInfo({
              tenantID: tenant.id,
              ...LoggingHelper.getChargingStationProperties(chargingStation),
              user: transaction.userID,
              module: MODULE_NAME, method: 'checkAndUpdateLastCompletedTransaction',
              action: ServerAction.EXTRA_INACTIVITY,
              message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Extra Inactivity of ${transaction.stop.extraInactivitySecs} secs has been added`,
              detailedMessages: { statusNotification, connector, lastTransaction: transaction }
            });
          }
        } else {
          // No extra inactivity - connector status is not set to FINISHING
          await Logging.logInfo({
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            user: transaction.userID,
            module: MODULE_NAME, method: 'checkAndUpdateLastCompletedTransaction',
            action: ServerAction.EXTRA_INACTIVITY,
            message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} No Extra Inactivity for this transaction`,
            detailedMessages: { statusNotification, connector, lastTransaction: transaction }
          });
        }
        // Flag
        transaction.stop.extraInactivityComputed = true;
        extraInactivityUpdated = true;
      }
    }
    return extraInactivityUpdated;
  }

  private async checkAndBillTransaction(tenant: Tenant, transaction: Transaction): Promise<boolean> {
    let transactionUpdated = false;
    // Make sure the Extra Inactivity is already known
    if (transaction.stop?.extraInactivityComputed) {
      transactionUpdated = true;
      // Billing - Start the asynchronous billing flow
      await OCPPUtils.processTransactionBilling(tenant, transaction, TransactionAction.END);
    }
    return transactionUpdated;
  }

  private async checkAndSendOCPITransactionCdr(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, tag: Tag): Promise<boolean> {
    let transactionUpdated = false;
    // CDR not already pushed
    if (transaction.ocpiData?.session && !transaction.ocpiData.cdr?.id) {
      // Get the lock
      const ocpiLock = await LockingHelper.acquireOCPIPushCdrLock(tenant.id, transaction.id);
      if (ocpiLock) {
        try {
          // Roaming
          transactionUpdated = true;
          await OCPPUtils.processTransactionRoaming(tenant, transaction, chargingStation, tag, TransactionAction.END);
        } finally {
          // Release the lock
          await LockingManager.release(ocpiLock);
        }
      }
    }
    return transactionUpdated;
  }

  private async checkAndSendOICPTransactionCdr(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, tag: Tag): Promise<boolean> {
    let transactionUpdated = false;
    // CDR not already pushed
    if (transaction.oicpData?.session && !transaction.oicpData.cdr?.SessionID) {
      // Get the lock
      const oicpLock = await LockingHelper.acquireOICPPushCdrLock(tenant.id, transaction.id);
      if (oicpLock) {
        try {
          // Roaming
          transactionUpdated = true;
          await OCPPUtils.processTransactionRoaming(tenant, transaction, chargingStation, tag, TransactionAction.END);
        } finally {
          // Release the lock
          await LockingManager.release(oicpLock);
        }
      }
    }
    return transactionUpdated;
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
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          module: MODULE_NAME, method: 'updateOCPIConnectorStatus',
          action: ServerAction.OCPI_PATCH_STATUS,
          message: `An error occurred while patching the charging station status of ${chargingStation.id}`,
          detailedMessages: { error: error.stack }
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
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'updateOICPConnectorStatus',
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: `An error occurred while updating the charging station status of ${chargingStation.id}`,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private async notifyStatusNotification(tenant: Tenant, chargingStation: ChargingStation, connector: Connector, statusNotification: OCPPStatusNotificationRequestExtended) {
    // Faulted?
    if (connector.status !== ChargePointStatus.AVAILABLE &&
      connector.status !== ChargePointStatus.FINISHING && // TODO: To remove after fix of ABB bug having Finishing status with an Error Code to avoid spamming Admins
      connector.errorCode !== ChargePointErrorCode.NO_ERROR) {
      await Logging.logError({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPP_STATUS_NOTIFICATION,
        module: MODULE_NAME, method: 'notifyStatusNotification',
        message: `${Utils.buildConnectorInfo(connector.connectorId)} Error occurred: ${this.buildStatusNotification(statusNotification)}`
      });
      // Send Notification (Async)
      void NotificationHandler.sendChargingStationStatusError(
        tenant,
        Utils.generateUUID(),
        chargingStation,
        {
          chargeBoxID: chargingStation.id,
          siteID: chargingStation.siteID,
          siteAreaID: chargingStation.siteAreaID,
          companyID: chargingStation.companyID,
          connectorId: Utils.getConnectorLetterFromConnectorID(connector.connectorId),
          error: this.buildStatusNotification(statusNotification),
          evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
          evseDashboardChargingStationURL: Utils.buildEvseChargingStationURL(tenant.subdomain, chargingStation, '#inerror')
        }
      );
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
      foundConnector.currentUserID = transaction.userID;
      const instantPower = Utils.truncTo(Utils.createDecimal(foundConnector.currentInstantWatts).div(1000).toNumber(), 3);
      const totalConsumption = Utils.truncTo(Utils.createDecimal(foundConnector.currentTotalConsumptionWh).div(1000).toNumber(), 3);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'updateChargingStationWithTransaction',
        action: ServerAction.CONSUMPTION,
        user: transaction.userID,
        message: `${Utils.buildConnectorInfo(foundConnector.connectorId, foundConnector.currentTransactionID)} Instant: ${instantPower} kW, Total: ${totalConsumption} kW.h${foundConnector.currentStateOfCharge ? ', SoC: ' + foundConnector.currentStateOfCharge.toString() + ' %' : ''}`
      });
      // Cleanup connector transaction data
    } else if (foundConnector) {
      OCPPUtils.clearChargingStationConnectorRuntimeData(chargingStation, foundConnector.connectorId);
    }
  }

  private notifyEndOfCharge(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (this.chargingStationConfig.notifEndOfChargeEnabled && transaction.user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notify (Async)
      void NotificationHandler.sendEndOfCharge(
        tenant,
        transaction.id.toString() + '-EOC',
        transaction.user,
        chargingStation,
        {
          user: transaction.user,
          transactionId: transaction.id,
          chargeBoxID: chargingStation.id,
          siteID: chargingStation.siteID,
          siteAreaID: chargingStation.siteAreaID,
          companyID: chargingStation.companyID,
          connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          totalConsumption: i18nManager.formatNumber(Math.round(transaction.currentTotalConsumptionWh / 10) / 100),
          stateOfCharge: transaction.currentStateOfCharge,
          totalDuration: this.transactionDurationToString(transaction),
          evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress'),
          evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
        }
      );
    }
  }

  private notifyOptimalChargeReached(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (this.chargingStationConfig.notifBeforeEndOfChargeEnabled && transaction.user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notification Before End Of Charge (Async)
      void NotificationHandler.sendOptimalChargeReached(
        tenant,
        transaction.id.toString() + '-OCR',
        transaction.user,
        chargingStation,
        {
          user: transaction.user,
          chargeBoxID: chargingStation.id,
          siteID: chargingStation.siteID,
          siteAreaID: chargingStation.siteAreaID,
          companyID: chargingStation.companyID,
          transactionId: transaction.id,
          connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          totalConsumption: i18nManager.formatNumber(Math.round(transaction.currentTotalConsumptionWh / 10) / 100),
          stateOfCharge: transaction.currentStateOfCharge,
          evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress'),
          evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
        }
      );
    }
  }

  private async checkNotificationEndOfCharge(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    // Transaction in progress?
    if (!transaction?.stop && transaction.currentTotalConsumptionWh > 0) {
      // Check the battery
      if (transaction.currentStateOfCharge > 0) {
        // Check if battery is full (100%)
        if (transaction.currentStateOfCharge === 100) {
          // Send Notification
          this.notifyEndOfCharge(tenant, chargingStation, transaction);
          // Check if optimal charge has been reached (85%)
        } else if (transaction.currentStateOfCharge >= this.chargingStationConfig.notifBeforeEndOfChargePercent) {
          // Send Notification
          this.notifyOptimalChargeReached(tenant, chargingStation, transaction);
        }
        // No battery information: check last consumptions
      } else {
        // Connector' status must be 'Suspended'
        const connector = Utils.getConnectorFromID(chargingStation, transaction.connectorId);
        if (connector.status === ChargePointStatus.SUSPENDED_EVSE ||
          connector.status === ChargePointStatus.SUSPENDED_EV) {
          // Check the last 3 consumptions
          const consumptions = await ConsumptionStorage.getTransactionConsumptions(
            tenant, { transactionId: transaction.id }, { limit: 3, skip: 0, sort: { startedAt: -1 } });
          if (consumptions.count === 3) {
            // Check the consumptions
            const noConsumption = consumptions.result.every((consumption) =>
              consumption.consumptionWh === 0 &&
              (consumption.limitSource !== ConnectorCurrentLimitSource.CHARGING_PROFILE ||
                consumption.limitAmps >= StaticLimitAmps.MIN_LIMIT_PER_PHASE * Utils.getNumberOfConnectedPhases(chargingStation, null, transaction.connectorId)));
            // Send Notification
            if (noConsumption) {
              this.notifyEndOfCharge(tenant, chargingStation, transaction);
            }
          }
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
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            module: MODULE_NAME, method: 'filterMeterValuesOnSpecificChargingStations',
            action: ServerAction.OCPP_METER_VALUES,
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
      siteID: chargingStation.siteID,
      siteAreaID: chargingStation.siteAreaID,
      companyID: chargingStation.companyID,
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
      context: sampledValue.context ? sampledValue.context : OCPPReadingContext.SAMPLE_PERIODIC,
      format: sampledValue.format ? sampledValue.format : OCPPValueFormat.RAW,
      measurand: sampledValue.measurand ? sampledValue.measurand : OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER,
      location: sampledValue.location ? sampledValue.location : OCPPLocation.OUTLET,
      unit: sampledValue.unit ? sampledValue.unit : OCPPUnitOfMeasure.WATT_HOUR,
      phase: sampledValue.phase ? sampledValue.phase : null
    };
  }

  private async processExistingTransaction(tenant: Tenant, chargingStation: ChargingStation, connectorId: number) {
    let activeTransaction: Transaction, lastCheckedTransactionID: number;
    do {
      // Check if the charging station has already a transaction
      activeTransaction = await TransactionStorage.getActiveTransaction(tenant, chargingStation.id, connectorId);
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
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            module: MODULE_NAME, method: 'stopOrDeleteActiveTransactions',
            action: ServerAction.CLEANUP_TRANSACTION,
            actionOnUser: activeTransaction.user,
            message: `${Utils.buildConnectorInfo(activeTransaction.connectorId, activeTransaction.id)} Transaction with no consumption has been deleted`
          });
          // Delete
          await TransactionStorage.deleteTransaction(tenant, activeTransaction.id);
          // Clear connector
          OCPPUtils.clearChargingStationConnectorRuntimeData(chargingStation, activeTransaction.connectorId);
        } else {
          // Simulate a Stop Transaction
          const result = await this.handleStopTransaction({
            tenantID: tenant.id,
            chargeBoxIdentity: activeTransaction.chargeBoxID,
            companyID: activeTransaction.companyID,
            siteID: activeTransaction.siteID,
            siteAreaID: activeTransaction.siteAreaID,
          }, {
            chargeBoxID: activeTransaction.chargeBoxID,
            transactionId: activeTransaction.id,
            meterStop: (activeTransaction.lastConsumption ? activeTransaction.lastConsumption.value : activeTransaction.meterStart),
            timestamp: Utils.convertToDate(activeTransaction.lastConsumption ? activeTransaction.lastConsumption.timestamp : activeTransaction.timestamp).toISOString(),
          }, false, true);
          if (result.idTagInfo.status === OCPPAuthorizationStatus.INVALID) {
            // Cannot stop it
            await Logging.logError({
              tenantID: tenant.id,
              ...LoggingHelper.getChargingStationProperties(chargingStation),
              module: MODULE_NAME, method: 'stopOrDeleteActiveTransactions',
              action: ServerAction.CLEANUP_TRANSACTION,
              actionOnUser: activeTransaction.userID,
              message: `${Utils.buildConnectorInfo(activeTransaction.connectorId, activeTransaction.id)} Pending transaction cannot be stopped`,
              detailedMessages: { result }
            });
          } else {
            // Stopped
            await Logging.logWarning({
              tenantID: tenant.id,
              ...LoggingHelper.getChargingStationProperties(chargingStation),
              module: MODULE_NAME, method: 'stopOrDeleteActiveTransactions',
              action: ServerAction.CLEANUP_TRANSACTION,
              actionOnUser: activeTransaction.userID,
              message: `${Utils.buildConnectorInfo(activeTransaction.connectorId, activeTransaction.id)}  Pending transaction has been stopped`,
              detailedMessages: { result }
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
      void NotificationHandler.sendSessionStarted(
        tenant,
        transaction.id.toString(),
        user,
        chargingStation,
        {
          'user': user,
          'transactionId': transaction.id,
          'chargeBoxID': chargingStation.id,
          'siteID': chargingStation.siteID,
          'siteAreaID': chargingStation.siteAreaID,
          'companyID': chargingStation.companyID,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain),
          'evseDashboardChargingStationURL': Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress')
        }
      );
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
      void NotificationHandler.sendEndOfSession(
        tenant,
        transaction.id.toString() + '-EOS',
        user,
        chargingStation,
        {
          user: user,
          alternateUser: (alternateUser ? alternateUser : null),
          transactionId: transaction.id,
          chargeBoxID: chargingStation.id,
          siteID: chargingStation.siteID,
          siteAreaID: chargingStation.siteAreaID,
          companyID: chargingStation.companyID,
          connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          totalConsumption: i18nManager.formatNumber(Math.round(transaction.stop.totalConsumptionWh / 10) / 100),
          totalDuration: this.buildTransactionDuration(transaction),
          totalInactivity: this.transactionInactivityToString(transaction, user),
          stateOfCharge: transaction.stop.stateOfCharge,
          evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#history'),
          evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
        }
      );
      // Notify Signed Data
      if (transaction.stop.signedData !== '') {
        // Send Notification (Async)
        void NotificationHandler.sendEndOfSignedSession(
          tenant,
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
        );
      }
    }
  }

  private async triggerSmartCharging(tenant: Tenant, chargingStation: ChargingStation) {
    // Smart Charging must be active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
      // Get Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(tenant, chargingStation.siteAreaID);
      if (siteArea && siteArea.smartCharging) {
        const siteAreaLock = await LockingHelper.acquireSiteAreaSmartChargingLock(tenant.id, siteArea);
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

  private async updateChargingStationConnectorWithTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User): Promise<void> {
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
      foundConnector.currentUserID = transaction.userID;
    } else {
      await Logging.logWarning({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'clearChargingStationConnectorRuntimeData',
        action: ServerAction.OCPP_START_TRANSACTION, user: user,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Connector does not exist`
      });
    }
  }

  private async processTransactionCar(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, consumption: Consumption, user: User,
      action: TransactionAction): Promise<void> {
    let soc = null;
    switch (action) {
      case TransactionAction.START:
        // Handle car in transaction start
        if (Utils.isTenantComponentActive(tenant, TenantComponents.CAR) && user) {
          // Check Car from User selection (valid for 5 mins)
          if (user.startTransactionData?.lastSelectedCar &&
              user.startTransactionData.lastChangedOn?.getTime() + 5 * 60 * 1000 > Date.now()) {
            transaction.carID = user.startTransactionData.lastSelectedCarID;
            transaction.carSoc = user.startTransactionData.lastCarSoc;
            transaction.carOdometer = user.startTransactionData.lastCarOdometer;
            transaction.departureTime = user.startTransactionData.lastDepartureTime;
          } else {
            // Get default car if any
            const defaultCar = await CarStorage.getDefaultUserCar(tenant, user.id, {},
              ['id', 'carCatalogID', 'vin', 'carConnectorData.carConnectorID', 'carConnectorData.carConnectorMeterID']);
            if (defaultCar) {
              transaction.carID = defaultCar.id;
              transaction.carCatalogID = defaultCar.carCatalogID;
              transaction.car = defaultCar;
            }
          }
          // Set Car Catalog ID
          if (transaction.carID && !transaction.carCatalogID) {
            const car = await CarStorage.getCar(tenant, transaction.carID, {},
              ['id', 'carCatalogID', 'vin', 'carConnectorData.carConnectorID', 'carConnectorData.carConnectorMeterID']);
            transaction.carCatalogID = car?.carCatalogID;
            transaction.car = car;
          }
          // Clear
          await UserStorage.saveStartTransactionData(tenant, user.id, {
            lastChangedOn: null,
            lastSelectedCarID: null,
            lastSelectedCar: false,
            lastCarSoc: null,
            lastCarOdometer: null,
            lastDepartureTime: null
          });
          // Handle SoC
          soc = await this.getCurrentSoc(tenant, transaction, chargingStation);
          if (soc) {
            transaction.stateOfCharge = soc;
          }
        }
        break;
      case TransactionAction.UPDATE:
        // Handle SoC
        if (Utils.isNullOrUndefined(transaction.car) || Utils.isNullOrUndefined(consumption)) {
          return;
        }
        // Reassignment not needed anymore with specific connector data in car object --> Coming with Tronity implementation
        transaction.car.carCatalog = transaction.carCatalog;
        soc = await this.getCurrentSoc(tenant, transaction, chargingStation);
        if (soc) {
          consumption.stateOfCharge = soc;
        }
        break;
    }
  }

  private async getCurrentSoc(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation): Promise<number> {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.CAR_CONNECTOR) && !Utils.isNullOrUndefined(transaction.car) &&
      !Utils.isNullOrUndefined(transaction.car.carConnectorData?.carConnectorID) &&
      Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId) === CurrentType.AC) {
      const carImplementation = await CarConnectorFactory.getCarConnectorImpl(tenant, transaction.car.carConnectorData.carConnectorID);
      if (carImplementation) {
        try {
          return await carImplementation.getCurrentSoC(transaction.car, transaction.userID);
        } catch {
          return null;
        }
      }
    }
    return null;
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
      // Set the Organization IDs
      startTransaction.companyID = chargingStation.companyID;
      startTransaction.siteID = chargingStation.siteID;
      startTransaction.siteAreaID = chargingStation.siteAreaID;
    }
  }

  private async createTransaction(tenant: Tenant, startTransaction: OCPPStartTransactionRequestExtended): Promise<Transaction> {
    return {
      id: await TransactionStorage.findAvailableID(tenant),
      issuer: true,
      chargeBoxID: startTransaction.chargeBoxID,
      tagID: startTransaction.idTag,
      timezone: startTransaction.timezone,
      userID: startTransaction.userID,
      companyID: startTransaction.companyID,
      siteID: startTransaction.siteID,
      siteAreaID: startTransaction.siteAreaID,
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
    bootNotification.timestamp = new Date();
  }

  private async createChargingStationFromBootNotification(tenant: Tenant,
      bootNotification: OCPPBootNotificationRequestExtended, headers: OCPPHeader): Promise<ChargingStation> {
    // New Charging Station: Create (Token has already been checked and provided!)
    const newChargingStation = {} as ChargingStation;
    for (const key in bootNotification) {
      newChargingStation[key] = bootNotification[key];
    }
    // Update props
    newChargingStation.createdOn = new Date();
    newChargingStation.issuer = true;
    newChargingStation.tokenID = headers.tokenID;
    newChargingStation.powerLimitUnit = ChargingRateUnitType.AMPERE;
    // Assign to Site Area
    if (headers.token.siteAreaID) {
      const siteArea = await SiteAreaStorage.getSiteArea(tenant, headers.token.siteAreaID, { withSite: true });
      if (siteArea) {
        newChargingStation.companyID = siteArea.site?.companyID;
        newChargingStation.siteID = siteArea.siteID;
        newChargingStation.siteAreaID = headers.token.siteAreaID;
        // Set coordinates
        if (siteArea.address?.coordinates?.length === 2) {
          newChargingStation.coordinates = siteArea.address.coordinates;
          // Backup on Site's coordinates
        } else if (siteArea.site?.address?.coordinates?.length === 2) {
          newChargingStation.coordinates = siteArea.site.address.coordinates;
        }
      }
    }
    return newChargingStation;
  }

  private checkSameChargingStation(headers: OCPPHeader, chargingStation: ChargingStation, bootNotification: OCPPBootNotificationRequestExtended) {
    // Existing Charging Station: Update
    // Check if same vendor and model
    if ((chargingStation.chargePointVendor !== bootNotification.chargePointVendor ||
      chargingStation.chargePointModel !== bootNotification.chargePointModel) ||
      (chargingStation.chargePointSerialNumber && bootNotification.chargePointSerialNumber &&
        chargingStation.chargePointSerialNumber !== bootNotification.chargePointSerialNumber)) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPP_BOOT_NOTIFICATION,
        module: MODULE_NAME, method: 'checkExistingChargingStation',
        message: 'Boot Notification Rejected: Attribute mismatch: ' +
          (bootNotification.chargePointVendor !== chargingStation.chargePointVendor ?
            `Got chargePointVendor='${bootNotification.chargePointVendor}' but expected '${chargingStation.chargePointVendor}'! ` : '') +
          (bootNotification.chargePointModel !== chargingStation.chargePointModel ?
            `Got chargePointModel='${bootNotification.chargePointModel}' but expected '${chargingStation.chargePointModel}'! ` : '') +
          (bootNotification.chargePointSerialNumber !== chargingStation.chargePointSerialNumber ?
            `Got chargePointSerialNumber='${bootNotification.chargePointSerialNumber ? bootNotification.chargePointSerialNumber : ''}' but expected '${chargingStation.chargePointSerialNumber ? chargingStation.chargePointSerialNumber : ''}'!` : ''),
        detailedMessages: { bootNotification }
      });
    }
  }

  private async enrichChargingStationFromBootNotification(tenant: Tenant, chargingStation: ChargingStation, headers: OCPPHeader,
      bootNotification: OCPPBootNotificationRequestExtended) {
    // Set common params
    chargingStation.ocppProtocol = bootNotification.ocppProtocol;
    chargingStation.ocppVersion = bootNotification.ocppVersion;
    chargingStation.currentIPAddress = bootNotification.currentIPAddress;
    chargingStation.cloudHostIP = Utils.getHostIP();
    chargingStation.cloudHostName = Utils.getHostName();
    chargingStation.lastReboot = bootNotification.timestamp;
    chargingStation.lastSeen = bootNotification.timestamp;
    chargingStation.chargePointSerialNumber = bootNotification.chargePointSerialNumber;
    chargingStation.chargeBoxSerialNumber = bootNotification.chargeBoxSerialNumber;
    chargingStation.firmwareVersion = bootNotification.firmwareVersion;
    chargingStation.deleted = false;
    // Set the Charging Station URL?
    if (headers.chargingStationURL) {
      chargingStation.chargingStationURL = headers.chargingStationURL;
    }
    // Clear Firmware Status
    if (chargingStation.firmwareUpdateStatus) {
      await ChargingStationStorage.saveChargingStationFirmwareStatus(tenant, chargingStation.id, null);
    }
    // Backup connectors
    if (!Utils.isEmptyArray(chargingStation.connectors)) {
      // Init array
      if (Utils.isEmptyArray(chargingStation.backupConnectors)) {
        chargingStation.backupConnectors = [];
      }
      // Check and backup connectors
      for (const connector of chargingStation.connectors) {
        // Check if already backed up
        const foundBackupConnector = chargingStation.backupConnectors.find(
          (backupConnector) => backupConnector.connectorId === connector.connectorId);
        if (!foundBackupConnector) {
          chargingStation.backupConnectors.push(connector);
        }
      }
    }
    // Clear Connectors
    chargingStation.connectors = [];
  }

  private async applyChargingStationTemplate(tenant: Tenant, chargingStation: ChargingStation): Promise<TemplateUpdateResult> {
    const templateUpdateResult = await OCPPUtils.applyTemplateToChargingStation(tenant, chargingStation, false);
    // No matching template or manual configuration
    if (!templateUpdateResult.chargingStationUpdated) {
      OCPPUtils.checkAndSetChargingStationAmperageLimit(chargingStation);
      await OCPPUtils.setChargingStationPhaseAssignment(tenant, chargingStation);
    }
    return templateUpdateResult;
  }

  private notifyBootNotification(tenant: Tenant, chargingStation: ChargingStation) {
    void NotificationHandler.sendChargingStationRegistered(
      tenant,
      Utils.generateUUID(),
      chargingStation,
      {
        chargeBoxID: chargingStation.id,
        siteID: chargingStation.siteID,
        siteAreaID: chargingStation.siteAreaID,
        companyID: chargingStation.companyID,
        evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
        evseDashboardChargingStationURL: Utils.buildEvseChargingStationURL(tenant.subdomain, chargingStation, '#all')
      }
    );
  }

  private requestOCPPConfigurationAfterBootNotification(tenant: Tenant, chargingStation: ChargingStation,
      templateUpdateResult: TemplateUpdateResult, heartbeatIntervalSecs: number) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
      // Synchronize heartbeat interval OCPP parameter for charging stations that do not take into account its value in the boot notification response
      for (const heartbeatOcppKey of Constants.OCPP_HEARTBEAT_KEYS) {
        try {
          const result = await OCPPCommon.requestChangeChargingStationOcppParameter(tenant, chargingStation, {
            key: heartbeatOcppKey,
            value: heartbeatIntervalSecs.toString()
          }, false);
          if (result.status === OCPPConfigurationStatus.ACCEPTED ||
            result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
            break;
          }
          await Logging.logError({
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action: ServerAction.OCPP_BOOT_NOTIFICATION,
            module: MODULE_NAME, method: 'requestOCPPConfigurationDelayed',
            message: `Cannot set '${heartbeatOcppKey}' to '${heartbeatIntervalSecs.toString()}' secs`
          });
        } catch (error) {
          await Logging.logError({
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action: ServerAction.OCPP_BOOT_NOTIFICATION,
            module: MODULE_NAME, method: 'requestOCPPConfigurationDelayed',
            message: `Cannot set '${heartbeatOcppKey}' to '${heartbeatIntervalSecs.toString()}' secs`,
            detailedMessages: { error: error.stack }
          });
        }
      }
      // Apply Charging Station Template OCPP configuration
      if (templateUpdateResult.ocppStandardUpdated || templateUpdateResult.ocppVendorUpdated) {
        try {
          const result = await OCPPUtils.applyTemplateOcppParametersToChargingStation(tenant, chargingStation);
          if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
            await Logging.logError({
              tenantID: tenant.id,
              ...LoggingHelper.getChargingStationProperties(chargingStation),
              action: ServerAction.OCPP_BOOT_NOTIFICATION,
              module: MODULE_NAME, method: 'requestOCPPConfigurationDelayed',
              message: `Cannot apply Template OCPP Parameters: '${result.status}'`
            });
          }
        } catch (error) {
          await Logging.logError({
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action: ServerAction.OCPP_BOOT_NOTIFICATION,
            module: MODULE_NAME, method: 'requestOCPPConfigurationDelayed',
            message: `Cannot apply Template OCPP Parameters: ${error.message as string}`,
            detailedMessages: { error: error.stack }
          });
        }
      }
    }, Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS);
  }

  private enrichAuthorize(user: User, chargingStation: ChargingStation, headers: OCPPHeader, authorize: OCPPAuthorizeRequestExtended) {
    // Enrich
    this.enrichOCPPRequest(chargingStation, authorize);
    // Roaming User
    if (user && !user.issuer && chargingStation.siteArea.accessControl) {
      // Authorization ID provided?
      if (user.authorizationID) {
        // Public Charging Station
        if (chargingStation.public) {
          // Keep Roaming Auth ID
          authorize.authorizationId = user.authorizationID;
        } else {
          throw new BackendError({
            user: user,
            action: ServerAction.OCPP_AUTHORIZE,
            module: MODULE_NAME,
            method: 'enrichAuthorize',
            message: 'Cannot authorize a roaming user on a private charging station',
            detailedMessages: { authorize }
          });
        }
      } else {
        throw new BackendError({
          user: user,
          action: ServerAction.OCPP_AUTHORIZE,
          module: MODULE_NAME,
          method: 'enrichAuthorize',
          message: 'Authorization ID has not been supplied',
          detailedMessages: { authorize }
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
    if (withTimeStamp && !ocppRequest.timestamp) {
      ocppRequest.timestamp = new Date();
    }
  }

  private async bypassStopTransaction(tenant: Tenant, chargingStation: ChargingStation,
      headers: OCPPHeader, stopTransaction: OCPPStopTransactionRequestExtended): Promise<boolean> {
    // Ignore it (DELTA bug)?
    if (stopTransaction.transactionId === 0) {
      await Logging.logWarning({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'bypassStopTransaction',
        action: ServerAction.OCPP_STOP_TRANSACTION,
        message: 'Ignored Transaction ID = 0',
        detailedMessages: { stopTransaction }
      });
      return true;
    }
    return false;
  }

  private async getTransactionFromMeterValues(tenant: Tenant, chargingStation: ChargingStation, headers: OCPPHeader, meterValues: OCPPMeterValuesRequest): Promise<Transaction> {
    // Handle Meter Value only for transaction
    if (!meterValues.transactionId) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'getTransactionFromMeterValues',
        message: `${Utils.buildConnectorInfo(meterValues.connectorId)} Meter Values are not linked to a transaction and will be ignored`,
        action: ServerAction.OCPP_METER_VALUES,
        detailedMessages: { meterValues }
      });
    }
    const transaction = await TransactionStorage.getTransaction(tenant, meterValues.transactionId, { withUser: true, withTag: true, withCar: true });
    if (!transaction) {
      // Abort the ongoing Transaction
      if (meterValues.transactionId) {
        await this.abortOngoingTransactionInMeterValues(tenant, chargingStation, headers, meterValues);
      }
      // Unkown Transaction
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'getTransactionFromMeterValues',
        message: `${Utils.buildConnectorInfo(meterValues.connectorId, meterValues.transactionId)} Transaction does not exist`,
        action: ServerAction.OCPP_METER_VALUES,
        detailedMessages: { meterValues }
      });
    }
    // Transaction finished
    if (transaction?.stop) {
      // Abort the ongoing Transaction
      await this.abortOngoingTransactionInMeterValues(tenant, chargingStation, headers, meterValues);
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'getTransactionFromMeterValues',
        message: `${Utils.buildConnectorInfo(meterValues.connectorId, meterValues.transactionId)} Transaction has already been stopped`,
        action: ServerAction.OCPP_METER_VALUES,
        detailedMessages: { transaction, meterValues }
      });
    }
    // Received Meter Values after the Transaction End Meter Value
    if (transaction.transactionEndReceived) {
      await Logging.logWarning({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'getTransactionFromMeterValues',
        action: ServerAction.OCPP_METER_VALUES,
        message: `${Utils.buildConnectorInfo(meterValues.connectorId, meterValues.transactionId)} Meter Values received after the 'Transaction.End'`,
        detailedMessages: { meterValues }
      });
    }
    return transaction;
  }

  private async abortOngoingTransactionInMeterValues(tenant: Tenant, chargingStation: ChargingStation, headers: OCPPHeader, meterValues: OCPPMeterValuesRequest) {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
    if (!chargingStationClient) {
      await Logging.logError({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'abortOngoingTransactionInMeterValues',
        action: ServerAction.OCPP_METER_VALUES,
        message: `${Utils.buildConnectorInfo(meterValues.connectorId, meterValues.transactionId)} Charging Station is not connected to the backend, cannot send a Remote Stop Transaction on an ongoing Transaction`,
        detailedMessages: { meterValues }
      });
    } else {
      // Send Remote Stop
      const result = await chargingStationClient.remoteStopTransaction({
        transactionId: meterValues.transactionId
      });
      if (result.status === OCPPRemoteStartStopStatus.ACCEPTED) {
        await Logging.logWarning({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          module: MODULE_NAME, method: 'abortOngoingTransactionInMeterValues',
          action: ServerAction.OCPP_METER_VALUES,
          message: `${Utils.buildConnectorInfo(meterValues.connectorId, meterValues.transactionId)} Transaction has been automatically remotely stopped`,
          detailedMessages: { meterValues }
        });
      } else {
        await Logging.logError({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          module: MODULE_NAME, method: 'abortOngoingTransactionInMeterValues',
          action: ServerAction.OCPP_METER_VALUES,
          message: `${Utils.buildConnectorInfo(meterValues.connectorId, meterValues.transactionId)} Cannot send a Remote Stop Transaction on an unknown ongoing Transaction`,
          detailedMessages: { meterValues }
        });
      }
    }
  }

  private async getTransactionFromStopTransaction(tenant: Tenant, chargingStation: ChargingStation,
      headers: OCPPHeader, stopTransaction: OCPPStopTransactionRequestExtended): Promise<Transaction> {
    const transaction = await TransactionStorage.getTransaction(tenant, stopTransaction.transactionId, { withUser: true, withTag: true });
    if (!transaction) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'getTransactionFromStopTransaction',
        message: `Transaction with ID '${stopTransaction.transactionId}' doesn't exist`,
        action: ServerAction.OCPP_STOP_TRANSACTION,
        detailedMessages: { stopTransaction }
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
        await ConsumptionStorage.saveConsumption(tenant, consumption);
      }
      // Check Inactivity and Consumption between the last Transaction.End and Stop Transaction
    } else if (transaction.lastConsumption) {
      // The consumption should be the same
      if (transaction.lastConsumption.value !== stopTransaction.meterStop) {
        await Logging.logWarning({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action: ServerAction.OCPP_STOP_TRANSACTION,
          module: MODULE_NAME, method: 'checkAndApplyLastConsumptionInStopTransaction',
          message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction.End consumption '${transaction.lastConsumption.value}' differs from Stop Transaction '${stopTransaction.meterStop}'`,
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

  private buildStatusNotification(statusNotification: OCPPStatusNotificationRequestExtended) {
    const statusNotifications: string[] = [];
    statusNotifications.push(`Status: '${statusNotification.status}'`);
    if (statusNotification.errorCode && statusNotification.errorCode !== 'NoError') {
      statusNotifications.push(`errorCode: '${statusNotification.errorCode}'`);
    }
    if (statusNotification.info) {
      statusNotifications.push(`info: '${statusNotification.info}'`);
    }
    if (statusNotification.vendorErrorCode) {
      statusNotifications.push(`vendorErrorCode: '${statusNotification.vendorErrorCode}'`);
    }
    if (statusNotification.vendorId) {
      statusNotifications.push(`vendorId: '${statusNotification.vendorId}'`);
    }
    return statusNotifications.join(', ');
  }
}
