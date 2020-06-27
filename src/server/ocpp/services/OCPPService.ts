import { ChargePointStatus, OCPPAttribute, OCPPAuthorizationStatus, OCPPAuthorizeRequestExtended, OCPPBootNotificationRequestExtended, OCPPBootNotificationResponse, OCPPDataTransferRequestExtended, OCPPDataTransferResponse, OCPPDataTransferStatus, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequestExtended, OCPPHeartbeatResponse, OCPPIdTagInfo, OCPPLocation, OCPPMeasurand, OCPPMeterValuesExtended, OCPPMeterValuesResponse, OCPPNormalizedMeterValue, OCPPNormalizedMeterValues, OCPPPhase, OCPPReadingContext, OCPPSampledValue, OCPPStartTransactionRequestExtended, OCPPStartTransactionResponse, OCPPStatusNotificationRequestExtended, OCPPStatusNotificationResponse, OCPPStopTransactionRequestExtended, OCPPUnitOfMeasure, OCPPValueFormat, OCPPVersion, RegistrationStatus } from '../../../types/ocpp/OCPPServer';
import { ChargingProfilePurposeType, ChargingRateUnitType } from '../../../types/ChargingProfile';
import ChargingStation, { ChargerVendor, Connector, ConnectorType, CurrentType } from '../../../types/ChargingStation';
import Transaction, { InactivityStatus, TransactionAction } from '../../../types/Transaction';

import Authorizations from '../../../authorization/Authorizations';
import BackendError from '../../../exception/BackendError';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import CpoOCPIClient from '../../../client/ocpi/CpoOCPIClient';
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
import RegistrationToken from '../../../types/RegistrationToken';
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
import UtilsService from '../../rest/service/UtilsService';
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
          action: ServerAction.BOOT_NOTIFICATION,
          module: MODULE_NAME, method: 'handleBootNotification',
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
            action: ServerAction.BOOT_NOTIFICATION,
            module: MODULE_NAME, method: 'handleBootNotification',
            message: `Registration rejected: Token is required for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress}'`,
          });
        }
        const token: RegistrationToken = await RegistrationTokenStorage.getRegistrationToken(headers.tenantID, headers.token);
        if (!token || !token.expirationDate || moment().isAfter(token.expirationDate)) {
          throw new BackendError({
            source: headers.chargeBoxIdentity,
            action: ServerAction.BOOT_NOTIFICATION,
            module: MODULE_NAME, method: 'handleBootNotification',
            message: `Registration rejected: Token '${headers.token}' is invalid or expired for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress}'`,
          });
        }
        if (token.revocationDate || moment().isAfter(token.revocationDate)) {
          throw new BackendError({
            source: headers.chargeBoxIdentity,
            action: ServerAction.BOOT_NOTIFICATION,
            module: MODULE_NAME, method: 'handleBootNotification',
            message: `Registration rejected: Token '${headers.token}' is revoked for: '${headers.chargeBoxIdentity}' on ip '${headers.currentIPAddress}'`,
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
        chargingStation.powerLimitUnit = ChargingRateUnitType.AMPERE;
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
            action: ServerAction.BOOT_NOTIFICATION,
            module: MODULE_NAME, method: 'handleBootNotification',
            message: 'Boot Notif Rejected: Attribute mismatch: ' +
              (bootNotification.chargePointVendor !== chargingStation.chargePointVendor ?
                `Got chargePointVendor='${bootNotification.chargePointVendor}' but expected '${chargingStation.chargePointVendor}'! ` : '') +
              (bootNotification.chargePointModel !== chargingStation.chargePointModel ?
                `Got chargePointModel='${bootNotification.chargePointModel}' but expected '${chargingStation.chargePointModel}'! ` : '') +
              (bootNotification.chargePointSerialNumber !== chargingStation.chargePointSerialNumber ?
                `Got chargePointSerialNumber='${bootNotification.chargePointSerialNumber ? bootNotification.chargePointSerialNumber : ''}' but expected '${chargingStation.chargePointSerialNumber ? chargingStation.chargePointSerialNumber : ''}'!` : ''),
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
      // Enrich Charging Station
      const chargingStationTemplateUpdated =
        await OCPPUtils.enrichChargingStationWithTemplate(headers.tenantID, chargingStation);
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
      ).catch(
        () => { }
      );
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID,
        source: chargingStation.id,
        action: ServerAction.BOOT_NOTIFICATION,
        module: MODULE_NAME, method: 'handleBootNotification',
        message: 'Boot notification saved'
      });
      // Handle the get of configuration later on
      // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-undef
      setTimeout(async () => {
        // Get config and save it
        await OCPPUtils.requestAndSaveChargingStationOcppParameters(
          headers.tenantID, chargingStation, chargingStationTemplateUpdated.ocppUpdated);
      }, Constants.DELAY_REQUEST_CONFIGURATION_EXECUTION_MILLIS);
      // Return the result
      return {
        'currentTime': bootNotification.timestamp.toISOString(),
        'status': RegistrationStatus.ACCEPTED,
        'heartbeatInterval': this.chargingStationConfig.heartbeatIntervalSecs
      };
    } catch (error) {
      // Log error
      error.source = headers.chargeBoxIdentity;
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.BOOT_NOTIFICATION, error);
      // Reject
      return {
        'status': RegistrationStatus.REJECTED,
        'currentTime': bootNotification.timestamp ? bootNotification.timestamp.toISOString() : new Date().toISOString(),
        'heartbeatInterval': this.chargingStationConfig.heartbeatIntervalSecs
      };
    }
  }

  public async handleHeartbeat(headers: OCPPHeader, heartbeat: OCPPHeartbeatRequestExtended): Promise<OCPPHeartbeatResponse> {
    try {
      // Get Charging Station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Replace IPs
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
      await ChargingStationStorage.saveChargingStationHeartBeat(headers.tenantID, chargingStation.id, {
        lastHeartBeat: chargingStation.lastHeartBeat,
        currentIPAddress: chargingStation.currentIPAddress,
      });
      // Save Heart Beat
      await OCPPStorage.saveHeartbeat(headers.tenantID, heartbeat);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleHeartbeat',
        action: ServerAction.HEARTBEAT,
        message: `Heartbeat saved with IP '${chargingStation.currentIPAddress}'`
      });
      // Return
      return {
        'currentTime': chargingStation.lastHeartBeat.toISOString()
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.HEARTBEAT, error);
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
            source: chargingStation.id,
            action: ServerAction.STATUS_NOTIFICATION,
            module: MODULE_NAME, method: 'handleStatusNotification',
            message: `Connector '0' > Received Status: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
          });
          // Get the connectors
          const connectors = chargingStation.connectors;
          // Update ALL connectors
          for (let i = 0; i < connectors.length; i++) {
            // Update message with proper connectorId
            statusNotification.connectorId = connectors[i].connectorId;
            // Update
            await this.updateConnectorStatus(headers.tenantID, chargingStation, statusNotification);
          }
        } else {
          // Do not take connector '0' into account for EBEE
          Logging.logWarning({
            tenantID: headers.tenantID,
            source: chargingStation.id,
            module: MODULE_NAME, method: 'handleStatusNotification',
            action: ServerAction.STATUS_NOTIFICATION,
            message: `Connector '0' > Ignored EBEE with with Status: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
          });
        }
      } else {
        // Update only the given connectorId
        await this.updateConnectorStatus(headers.tenantID, chargingStation, statusNotification);
      }
      // Respond
      return {};
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.STATUS_NOTIFICATION, error);
      // Return
      return {};
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
      this.filterMeterValuesOnSpecificChargingStations(headers.tenantID, chargingStation, newMeterValues);
      // No Values?
      if (newMeterValues.values.length === 0) {
        Logging.logDebug({
          tenantID: headers.tenantID,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'handleMeterValues',
          action: ServerAction.METER_VALUES,
          message: 'No relevant Meter Values to save',
          detailedMessages: { meterValues }
        });
        // Process values
      } else {
        // Handle Meter Value only for transaction
        // eslint-disable-next-line no-lonely-if
        if (meterValues.transactionId) {
          // Get the transaction
          const transaction = await TransactionStorage.getTransaction(headers.tenantID, meterValues.transactionId);
          UtilsService.assertObjectExists(ServerAction.METER_VALUES, transaction, `Transaction with ID '${meterValues.transactionId}' doesn't exist`,
            'OCPPService', 'handleMeterValues');
          // Save Meter Values
          await OCPPStorage.saveMeterValues(headers.tenantID, newMeterValues);
          // Update Transaction
          this.updateTransactionWithMeterValues(chargingStation, transaction, newMeterValues.values);
          // Create Consumptions
          const consumptions = await OCPPUtils.createConsumptionsFromMeterValues(
            headers.tenantID, chargingStation, transaction, newMeterValues.values);
          // Price/Bill Transaction and Save the Consumptions
          for (const consumption of consumptions) {
            // Update Transaction with Consumption
            OCPPUtils.updateTransactionWithConsumption(chargingStation, transaction, consumption);
            // Price & Bill
            if (consumption.toPrice) {
              await OCPPUtils.priceTransaction(headers.tenantID, transaction, consumption, TransactionAction.UPDATE);
              await OCPPUtils.billTransaction(headers.tenantID, transaction, TransactionAction.UPDATE);
            }
            // Save all
            await ConsumptionStorage.saveConsumption(headers.tenantID, consumption);
          }
          // Handle OCPI
          await this.updateOCPITransaction(headers.tenantID, transaction, chargingStation, TransactionAction.UPDATE);
          // Save Transaction
          await TransactionStorage.saveTransaction(headers.tenantID, transaction);
          // Update Charging Station
          await this.updateChargingStationWithTransaction(headers.tenantID, chargingStation, transaction);
          // Save Charging Station
          await ChargingStationStorage.saveChargingStation(headers.tenantID, chargingStation);
          // First Meter Value and no Car -> Trigger Smart Charging to adjust the single phase Car
          if (transaction.numberOfMeterValues === 1 && !transaction.carID) {
            const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
            // Single Phase car?
            if (currentType === CurrentType.AC &&
                transaction.currentInstantAmpsL1 > 0 &&
                transaction.currentInstantAmpsL2 === 0 &&
                transaction.currentInstantAmpsL3 === 0) {
              // Yes: Trigger Smart Charging
              await this.triggerSmartCharging(headers.tenantID, chargingStation);
            }
          }
          // Log
          Logging.logInfo({
            tenantID: headers.tenantID,
            source: chargingStation.id,
            action: ServerAction.METER_VALUES,
            user: transaction.userID,
            module: MODULE_NAME, method: 'handleMeterValues',
            message: `Connector '${meterValues.connectorId}' > Transaction ID '${meterValues.transactionId}' > MeterValue have been saved`,
            detailedMessages: { newMeterValues }
          });
        } else {
          // Log
          Logging.logWarning({
            tenantID: headers.tenantID,
            source: chargingStation.id,
            action: ServerAction.METER_VALUES,
            module: MODULE_NAME, method: 'handleMeterValues',
            message: `Connector '${meterValues.connectorId}' > Meter Values are ignored as it is not linked to a transaction`,
            detailedMessages: { newMeterValues }
          });
        }
      }
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.METER_VALUES, error);
    }
    return {};
  }

  public async handleAuthorize(headers: OCPPHeader, authorize: OCPPAuthorizeRequestExtended): Promise<OCPPIdTagInfo> {
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
      const user = await Authorizations.isAuthorizedOnChargingStation(headers.tenantID, chargingStation, authorize.idTag);

      if (user && !user.issuer) {
        const tenant: Tenant = await TenantStorage.getTenant(headers.tenantID);
        if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
          throw new BackendError({
            user: user,
            action: ServerAction.AUTHORIZE,
            module: MODULE_NAME, method: 'handleAuthorize',
            message: `Unable to authorize user '${user.id}' not issued locally`
          });
        }
        const tag = user.tags.find(((value) => value.id === authorize.idTag));
        if (!tag.ocpiToken) {
          throw new BackendError({
            user: user,
            action: ServerAction.AUTHORIZE,
            module: MODULE_NAME, method: 'handleAuthorize',
            message: `user '${user.id}' with tag '${authorize.idTag}' cannot be authorized thought OCPI protocol due to missing ocpiToken`
          });
        }
        const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
        if (!ocpiClient) {
          throw new BackendError({
            user: user,
            action: ServerAction.AUTHORIZE,
            module: MODULE_NAME, method: 'handleAuthorize',
            message: 'OCPI component requires at least one CPO endpoint to authorize users'
          });
        }
        authorize.authorizationId = await ocpiClient.authorizeToken(tag.ocpiToken, chargingStation);
      }
      authorize.user = user;
      // Save
      await OCPPStorage.saveAuthorize(headers.tenantID, authorize);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleAuthorize',
        action: ServerAction.AUTHORIZE, user: (authorize.user ? authorize.user : null),
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
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.AUTHORIZE, error);
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
        tenantID: headers.tenantID,
        source: chargingStation.id,
        action: ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION,
        module: MODULE_NAME, method: 'handleDiagnosticsStatusNotification',
        message: 'Diagnostics Status Notification has been saved'
      });
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION, error);
      return {};
    }
  }

  public async handleFirmwareStatusNotification(headers: OCPPHeader, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended): Promise<OCPPFirmwareStatusNotificationResponse> {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateFirmwareStatusNotification(chargingStation, firmwareStatusNotification);
      // Save the status to Charging Station
      await ChargingStationStorage.saveChargingStationFirmwareStatus(headers.tenantID, chargingStation.id, firmwareStatusNotification.status);
      // Set the Charging Station ID
      firmwareStatusNotification.chargeBoxID = chargingStation.id;
      firmwareStatusNotification.timestamp = new Date();
      firmwareStatusNotification.timezone = Utils.getTimezone(chargingStation.coordinates);
      // Save it
      await OCPPStorage.saveFirmwareStatusNotification(headers.tenantID, firmwareStatusNotification);
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleFirmwareStatusNotification',
        action: ServerAction.FIRMWARE_STATUS_NOTIFICATION,
        message: `Firmware Status Notification '${firmwareStatusNotification.status}' has been saved`
      });
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.FIRMWARE_STATUS_NOTIFICATION, error);
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
      if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
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
        lastEnergyActiveImportMeterValue: {
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
      // Build first Dummy consumption for pricing the Start Transaction
      const consumption = await OCPPUtils.createConsumptionFromMeterValue(
        headers.tenantID, chargingStation, transaction,
        { timestamp: transaction.timestamp, value: transaction.meterStart },
        {
          id: '666',
          chargeBoxID: transaction.chargeBoxID,
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          timestamp: transaction.timestamp,
          value: transaction.meterStart,
          attribute: Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE
        }
      );
      // Price it
      await OCPPUtils.priceTransaction(headers.tenantID, transaction, consumption, TransactionAction.START);
      // Billing
      await OCPPUtils.billTransaction(headers.tenantID, transaction, TransactionAction.START);
      // OCPI
      await this.updateOCPITransaction(headers.tenantID, transaction, chargingStation, TransactionAction.START);
      // Save it
      transaction.id = await TransactionStorage.saveTransaction(headers.tenantID, transaction);
      // Clean up Charging Station's connector transaction info
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
        Logging.logWarning({
          tenantID: headers.tenantID,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'handleStartTransaction',
          action: ServerAction.START_TRANSACTION, user: user,
          message: `Missing connector '${transaction.connectorId}' > Transaction ID '${transaction.id}'`
        });
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
          source: chargingStation.id,
          module: MODULE_NAME, method: 'handleStartTransaction',
          action: ServerAction.START_TRANSACTION, user: user,
          message: `Connector '${transaction.connectorId}' > Transaction ID '${transaction.id}' has been started`
        });
      } else {
        // Log
        Logging.logInfo({
          tenantID: headers.tenantID,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'handleStartTransaction',
          action: ServerAction.START_TRANSACTION,
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
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.START_TRANSACTION, error);
      return {
        'transactionId': 0,
        'status': OCPPAuthorizationStatus.INVALID
      };
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
        tenantID: headers.tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleDataTransfer',
        action: ServerAction.CHARGING_STATION_DATA_TRANSFER, message: 'Data Transfer has been saved'
      });
      // Return
      return {
        'status': OCPPDataTransferStatus.ACCEPTED
      };
    } catch (error) {
      // Set the source
      error.source = headers.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.CHARGING_STATION_DATA_TRANSFER, error);
      return {
        'status': OCPPDataTransferStatus.REJECTED
      };
    }
  }

  public async handleStopTransaction(headers: OCPPHeader, stopTransaction: OCPPStopTransactionRequestExtended, isSoftStop = false, stoppedByCentralSystem = false): Promise<OCPPIdTagInfo> {
    try {
      // Get the charging station
      const chargingStation = await OCPPUtils.checkAndGetChargingStation(headers.chargeBoxIdentity, headers.tenantID);
      // Check props
      OCPPValidation.getInstance().validateStopTransaction(chargingStation, stopTransaction);
      // Set header
      stopTransaction.chargeBoxID = chargingStation.id;
      // Get the transaction
      const transaction = await TransactionStorage.getTransaction(headers.tenantID, stopTransaction.transactionId);
      UtilsService.assertObjectExists(ServerAction.STOP_TRANSACTION, transaction, `Transaction with ID '${stopTransaction.transactionId}' doesn't exist`,
        'OCPPService', 'handleStopTransaction');
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
          module: MODULE_NAME, method: 'handleStopTransaction',
          message: `Transaction ID '${stopTransaction.transactionId}' has already been stopped`,
          action: ServerAction.STOP_TRANSACTION,
          user: (alternateUser ? alternateUser : user),
          actionOnUser: (alternateUser ? (user ? user : null) : null)
        });
      }
      // Free the connector
      OCPPUtils.checkAndFreeChargingStationConnector(chargingStation, transaction.connectorId);
      chargingStation.lastHeartBeat = new Date();
      // Save Charging Station
      await ChargingStationStorage.saveChargingStation(headers.tenantID, chargingStation);
      // Soft Stop?
      if (isSoftStop) {
        // Yes: Add the latest Meter Value
        if (transaction.lastEnergyActiveImportMeterValue) {
          stopTransaction.meterStop = transaction.lastEnergyActiveImportMeterValue.value;
        } else {
          stopTransaction.meterStop = 0;
        }
      }
      // Create last meter values
      const stopMeterValues = OCPPUtils.createTransactionStopMeterValues(transaction, stopTransaction);
      // Build final Consumptions
      const consumptions = await OCPPUtils.createConsumptionsFromMeterValues(
        headers.tenantID, chargingStation, transaction, stopMeterValues);
      // Update
      for (const consumption of consumptions) {
        // Update Transaction with Consumption
        OCPPUtils.updateTransactionWithConsumption(chargingStation, transaction, consumption);
        // Update Transaction with Stop Transaction
        OCPPUtils.updateTransactionWithStopTransaction(transaction, stopTransaction, user, alternateUser, tagId);
        // Price & Bill
        if (consumption.toPrice) {
          await OCPPUtils.priceTransaction(headers.tenantID, transaction, consumption, TransactionAction.STOP);
          await OCPPUtils.billTransaction(headers.tenantID, transaction, TransactionAction.STOP);
        }
        // Save Consumption
        await ConsumptionStorage.saveConsumption(headers.tenantID, consumption);
      }
      // OCPI
      await this.updateOCPITransaction(headers.tenantID, transaction, chargingStation, TransactionAction.STOP);
      // Save the transaction
      transaction.id = await TransactionStorage.saveTransaction(headers.tenantID, transaction);
      // Notify User
      await this.notifyStopTransaction(headers.tenantID, chargingStation, transaction, user, alternateUser);
      // Handle Smart Charging
      const tenant = await TenantStorage.getTenant(headers.tenantID);
      // Recompute the Smart Charging Plan
      if (Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
        // Delete TxProfile if any
        await this.deleteAllTransactionTxProfile(headers.tenantID, transaction);
        // Call async because the Transaction ID on the connector should be cleared
        // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-undef
        setTimeout(async () => {
          try {
            // Trigger Smart Charging
            await this.triggerSmartCharging(tenant.id, chargingStation);
          } catch (error) {
            Logging.logError({
              tenantID: tenant.id,
              source: chargingStation.id,
              module: MODULE_NAME, method: 'handleStopTransaction',
              action: ServerAction.STOP_TRANSACTION,
              message: 'An error occurred while trying to call smart charging',
              detailedMessages: { error: error.message, stack: error.stack }
            });
          }
        }, Constants.DELAY_SMART_CHARGING_EXECUTION_MILLIS);
      }
      // Log
      Logging.logInfo({
        tenantID: headers.tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'handleStopTransaction',
        action: ServerAction.STOP_TRANSACTION,
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
      Logging.logActionExceptionMessage(headers.tenantID, ServerAction.STOP_TRANSACTION, error);
      // Error
      return { 'status': OCPPAuthorizationStatus.INVALID };
    }
  }

  private async deleteAllTransactionTxProfile(tenantID: string, transaction: Transaction) {
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(tenantID, {
      chargingStationID: transaction.chargeBoxID,
      connectorID: transaction.connectorId,
      profilePurposeType: ChargingProfilePurposeType.TX_PROFILE,
      transactionId: transaction.id
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Delete all TxProfiles
    for (const chargingProfile of chargingProfiles.result) {
      try {
        await OCPPUtils.clearAndDeleteChargingProfile(tenantID, chargingProfile);
        Logging.logDebug({
          tenantID: tenantID,
          source: transaction.chargeBoxID,
          action: ServerAction.CHARGING_PROFILE_DELETE,
          message: `Connector '${transaction.connectorId}' > Transaction ID '${transaction.id}' > TX Charging Profile with ID '${chargingProfile.id}'`,
          module: MODULE_NAME, method: 'handleStopTransaction',
          detailedMessages: { chargingProfile }
        });
      } catch (error) {
        Logging.logError({
          tenantID: tenantID,
          source: transaction.chargeBoxID,
          action: ServerAction.CHARGING_PROFILE_DELETE,
          message: `Connector '${transaction.connectorId}' > Transaction ID '${transaction.id}' > Cannot delete TX Charging Profile with ID '${chargingProfile.id}'`,
          module: MODULE_NAME, method: 'handleStopTransaction',
          detailedMessages: { error: error.message, stack: error.stack, chargingProfile }
        });
      }
    }
  }

  private async updateConnectorStatus(tenantID: string, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended) {
    // Get it
    let foundConnector: Connector = Utils.getConnectorFromID(chargingStation, statusNotification.connectorId);
    const oldConnectorStatus = foundConnector ? foundConnector.status : null;
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
          tenantID, chargingStation, statusNotification.connectorId, chargingStationTemplate);
      }
    }
    // Check if status has changed
    if (foundConnector.status === statusNotification.status &&
      foundConnector.errorCode === statusNotification.errorCode) {
      // No Change: Do not save it
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'updateConnectorStatus',
        action: ServerAction.STATUS_NOTIFICATION,
        message: `Connector '${statusNotification.connectorId}' > Transaction ID '${foundConnector.currentTransactionID}' > Status has not changed then not saved: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}''`,
        detailedMessages: { connector: foundConnector }
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
      tenantID: tenantID,
      source: chargingStation.id,
      module: MODULE_NAME, method: 'updateConnectorStatus',
      action: ServerAction.STATUS_NOTIFICATION,
      message: `Connector '${statusNotification.connectorId}' > Transaction ID '${foundConnector.currentTransactionID}' > Status: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}' has been saved`,
      detailedMessages: [statusNotification, foundConnector]
    });
    // Check if transaction is ongoing (ABB bug)!!!
    await this.checkStatusNotificationOngoingTransaction(tenantID, chargingStation, statusNotification, foundConnector);
    // Notify admins
    await this.notifyStatusNotification(tenantID, chargingStation, statusNotification);
    // Send new status to IOP
    await this.updateOCPIStatus(tenantID, chargingStation, foundConnector);
    // Save
    await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
    // Trigger Smart Charging
    if (statusNotification.status === ChargePointStatus.CHARGING) {
      try {
        // Trigger Smart Charging
        await this.triggerSmartCharging(tenantID, chargingStation);
      } catch (error) {
        Logging.logError({
          tenantID: tenantID,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'updateConnectorStatus',
          action: ServerAction.STATUS_NOTIFICATION,
          message: 'An error occurred while trying to call the smart charging',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
  }

  private async checkStatusNotificationInactivity(tenantID: string, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended, connector: Connector) {
    // Check Inactivity
    // OCPP 1.6: Finishing --> Available
    if (connector.status === ChargePointStatus.FINISHING &&
      statusNotification.status === ChargePointStatus.AVAILABLE &&
      Utils.objectHasProperty(statusNotification, 'timestamp')) {
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
            tenantID: tenantID,
            source: chargingStation.id,
            user: lastTransaction.userID,
            module: MODULE_NAME, method: 'checkStatusNotificationInactivity',
            action: ServerAction.EXTRA_INACTIVITY,
            message: `Connector '${lastTransaction.connectorId}' > Transaction ID '${lastTransaction.id}' > Extra Inactivity of ${lastTransaction.stop.extraInactivitySecs} secs has been added`,
            detailedMessages: [statusNotification, lastTransaction]
          });
        } else {
          // Log
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            user: lastTransaction.userID,
            module: MODULE_NAME, method: 'checkStatusNotificationInactivity',
            action: ServerAction.EXTRA_INACTIVITY,
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
          tenantID: tenantID,
          source: chargingStation.id,
          user: lastTransaction.userID,
          module: MODULE_NAME, method: 'checkStatusNotificationInactivity',
          action: ServerAction.EXTRA_INACTIVITY,
          message: `Connector '${lastTransaction.connectorId}' > Transaction ID '${lastTransaction.id}' > No Extra Inactivity has been added`,
          detailedMessages: [statusNotification, lastTransaction]
        });
      }
    }
  }

  private async checkStatusNotificationOngoingTransaction(tenantID: string, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended, connector: Connector) {
    // Check the status
    if (statusNotification.connectorId > 0 &&
      connector.currentTransactionID > 0 &&
      statusNotification.status === ChargePointStatus.AVAILABLE) {
      // Cleanup ongoing transactions on the connector
      await this.stopOrDeleteActiveTransactions(
        tenantID, chargingStation.id, statusNotification.connectorId);
      // Clean up connector
      OCPPUtils.checkAndFreeChargingStationConnector(chargingStation, statusNotification.connectorId);
    }
  }

  private async updateOCPIStatus(tenantID: string, chargingStation: ChargingStation, connector: Connector) {
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    if (chargingStation.issuer && chargingStation.public && Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
      try {
        const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
        if (ocpiClient) {
          await ocpiClient.patchChargingStationStatus(chargingStation, connector);
        }
      } catch (error) {
        Logging.logError({
          tenantID: tenantID,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'updateOCPIStatus',
          action: ServerAction.OCPI_PATCH_STATUS,
          message: `An error occurred while patching the charging station status of ${chargingStation.id}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
  }

  private async notifyStatusNotification(tenantID: string, chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequestExtended) {
    // Faulted?
    if (statusNotification.status === ChargePointStatus.FAULTED) {
      // Log
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.STATUS_NOTIFICATION,
        module: MODULE_NAME, method: 'notifyStatusNotification',
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
          // First time: Clear all values
          transaction.currentInstantWatts = 0;
          transaction.currentInstanWattsL1 = 0;
          transaction.currentInstanWattsL2 = 0;
          transaction.currentInstanWattsL3 = 0;
          transaction.currentInstanWattsDC = 0;
          transaction.currentInstantVoltage = 0;
          transaction.currentInstantVoltageL1 = 0;
          transaction.currentInstantVoltageL2 = 0;
          transaction.currentInstantVoltageL3 = 0;
          transaction.currentInstantVoltageDC = 0;
          transaction.currentInstantAmps = 0;
          transaction.currentInstantAmpsL1 = 0;
          transaction.currentInstantAmpsL2 = 0;
          transaction.currentInstantAmpsL3 = 0;
          transaction.currentInstantAmpsDC = 0;
          transaction.transactionEndReceived = true;
        }
      }
      // Signed Data
      if (meterValue.attribute.format === OCPPValueFormat.SIGNED_DATA) {
        if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_BEGIN) {
          // Set the first Signed Data and keep it
          transaction.signedData = meterValue.value as string;
          continue;
        } else if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
          // Set the last Signed Data (used in the last consumtion)
          transaction.currentSignedData = meterValue.value as string;
          continue;
        }
      }
      // SoC
      if (meterValue.attribute.measurand === OCPPMeasurand.STATE_OF_CHARGE) {
        // Set the first SoC and keep it
        if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_BEGIN) {
          transaction.stateOfCharge = Utils.convertToFloat(meterValue.value);
          continue;
        // Set only the last SoC (will be used in the last consumtion building in StopTransaction due to backward compat with OCPP 1.5)
        } else if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
          transaction.currentStateOfCharge = Utils.convertToFloat(meterValue.value);
          continue;
        }
      }
      // Voltage
      if (meterValue.attribute.measurand === OCPPMeasurand.VOLTAGE) {
        // Set only the last Voltage (will be used in the last consumtion building in StopTransaction due to backward compat with OCPP 1.5)
        if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
          const voltage = Utils.convertToFloat(meterValue.value);
          const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
          // AC Charging Station
          switch (currentType) {
            case CurrentType.DC:
              transaction.currentInstantVoltageDC = voltage;
              break;
            case CurrentType.AC:
              switch (meterValue.attribute.phase) {
                case OCPPPhase.L1:
                  transaction.currentInstantVoltageL1 = voltage;
                  break;
                case OCPPPhase.L2:
                  transaction.currentInstantVoltageL2 = voltage;
                  break;
                case OCPPPhase.L3:
                  transaction.currentInstantVoltageL3 = voltage;
                  break;
                default:
                  transaction.currentInstantVoltage = voltage;
                  break;
              }
              break;
          }
          continue;
        }
      }
      // Power
      if (meterValue.attribute.measurand === OCPPMeasurand.POWER_ACTIVE_IMPORT) {
        // Set only the last Power (will be used in the last consumtion building in StopTransaction due to backward compat with OCPP 1.5)
        if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
          const powerInMeterValue = Utils.convertToFloat(meterValue.value);
          const powerInMeterValueWatts = (meterValue.attribute && meterValue.attribute.unit === OCPPUnitOfMeasure.KILO_WATT ?
            powerInMeterValue * 1000 : powerInMeterValue);
          const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
          // AC Charging Station
          switch (currentType) {
            case CurrentType.DC:
              transaction.currentInstanWattsDC = powerInMeterValueWatts;
              break;
            case CurrentType.AC:
              switch (meterValue.attribute.phase) {
                case OCPPPhase.L1:
                  transaction.currentInstanWattsL1 = powerInMeterValueWatts;
                  break;
                case OCPPPhase.L2:
                  transaction.currentInstanWattsL2 = powerInMeterValueWatts;
                  break;
                case OCPPPhase.L3:
                  transaction.currentInstanWattsL3 = powerInMeterValueWatts;
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
        // Set only the last Current (will be used in the last consumtion building in StopTransaction due to backward compat with OCPP 1.5)
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
                  transaction.currentInstantAmps = amperage;
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

  private async updateOCPITransaction(tenantID: string, transaction: Transaction, chargingStation: ChargingStation, transactionAction: TransactionAction) {
    if (!transaction.user || transaction.user.issuer) {
      return;
    }
    const user: User = transaction.user;
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    let action: ServerAction;
    switch (transactionAction) {
      case TransactionAction.START:
        action = ServerAction.START_TRANSACTION;
        break;
      case TransactionAction.UPDATE:
        action = ServerAction.UPDATE_TRANSACTION;
        break;
      case TransactionAction.STOP:
        action = ServerAction.STOP_TRANSACTION;
        break;
    }
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
      throw new BackendError({
        user: user,
        action: action,
        module: MODULE_NAME,
        method: 'updateOCPITransaction',
        message: `Unable to ${transactionAction} transaction for user '${user.id}' not issued locally`
      });
    }
    const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
    if (!ocpiClient) {
      throw new BackendError({
        user: user,
        action: action,
        module: MODULE_NAME,
        method: 'updateOCPITransaction',
        message: `OCPI component requires at least one CPO endpoint to ${transactionAction} transactions`
      });
    }
    switch (transactionAction) {
      case TransactionAction.START:
        // eslint-disable-next-line no-case-declarations
        const tag = user.tags.find(((value) => value.id === transaction.tagID));
        if (!tag.ocpiToken) {
          throw new BackendError({
            user: user,
            action: action,
            module: MODULE_NAME,
            method: 'updateOCPITransaction',
            message: `User '${user.id}' with tag '${transaction.tagID}' cannot ${transactionAction} transaction thought OCPI protocol due to missing ocpiToken`
          });
        }
        // Retrieve authorization id
        // eslint-disable-next-line no-case-declarations
        const authorizes = await OCPPStorage.getAuthorizes(tenant.id, {
          dateFrom: moment(transaction.timestamp).subtract(10, 'minutes').toDate(),
          chargeBoxID: transaction.chargeBoxID,
          tagID: transaction.tagID
        }, Constants.DB_PARAMS_SINGLE_RECORD);
        // eslint-disable-next-line no-case-declarations
        let authorizationId = '';
        if (authorizes && authorizes.result && authorizes.result.length > 0) {
          authorizationId = authorizes.result[0].authorizationId;
        }
        await ocpiClient.startSession(tag.ocpiToken, chargingStation, transaction, authorizationId);
        break;
      case TransactionAction.UPDATE:
        await ocpiClient.updateSession(transaction);
        break;
      case TransactionAction.STOP:
        await ocpiClient.stopSession(transaction);
        await ocpiClient.postCdr(transaction);
        break;
    }
  }

  private async updateChargingStationWithTransaction(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
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
      // Update Heartbeat
      chargingStation.lastHeartBeat = new Date();
      // Handle End Of charge
      await this.checkNotificationEndOfCharge(tenantID, chargingStation, transaction);
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'updateChargingStationWithTransaction',
        action: ServerAction.CONSUMPTION,
        user: transaction.userID,
        message: `Connector '${foundConnector.connectorId}' > Transaction ID '${foundConnector.currentTransactionID}' > Instant: ${Utils.getRoundedNumberToTwoDecimals(foundConnector.currentInstantWatts / 1000)} kW, Total: ${Utils.getRoundedNumberToTwoDecimals(foundConnector.currentTotalConsumptionWh / 1000)} kW.h${foundConnector.currentStateOfCharge ? ', SoC: ' + foundConnector.currentStateOfCharge + ' %' : ''}`
      });
      // Cleanup connector transaction data
    } else if (foundConnector) {
      OCPPUtils.checkAndFreeChargingStationConnector(chargingStation, foundConnector.connectorId);
    }
  }

  private async notifyEndOfCharge(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Get the i18n lib
      const i18nManager = new I18nManager(transaction.user.locale);
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
          'totalConsumption': i18nManager.formatNumber(Math.round(transaction.currentTotalConsumptionWh / 10) / 100),
          'stateOfCharge': transaction.currentStateOfCharge,
          'totalDuration': this.buildCurrentTransactionDuration(transaction),
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#inprogress'),
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
        }
      ).catch(() => { });
    }
  }

  private async notifyOptimalChargeReached(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Get the i18n lib
      const i18nManager = new I18nManager(transaction.user.locale);
      // Notification Before End Of Charge (Async)
      NotificationHandler.sendOptimalChargeReached(
        tenantID,
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
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#inprogress'),
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
        }
      ).catch(() => { });
    }
  }

  private async checkNotificationEndOfCharge(tenantID: string, chargingStation: ChargingStation, transaction: Transaction) {
    // Transaction in progress?
    if (transaction && !transaction.stop) {
      // Has consumption?
      if (transaction.numberOfMeterValues > 1 && transaction.currentTotalConsumptionWh > 0) {
        // End of charge?
        if (this.chargingStationConfig.notifEndOfChargeEnabled &&
          ((transaction.currentTotalConsumptionWh > 0 && transaction.currentTotalInactivitySecs >= 120) || transaction.currentStateOfCharge === 100)) {
          // Send Notification
          await this.notifyEndOfCharge(tenantID, chargingStation, transaction);
          // Optimal Charge? (SoC)
        } else if (this.chargingStationConfig.notifBeforeEndOfChargeEnabled &&
          transaction.currentStateOfCharge >= this.chargingStationConfig.notifBeforeEndOfChargePercent) {
          // Send Notification
          await this.notifyOptimalChargeReached(tenantID, chargingStation, transaction);
        }
      }
    }
  }

  // Build Inactivity
  private buildTransactionInactivity(transaction: Transaction, i18nHourShort = 'h') {
    const i18nManager = new I18nManager(transaction.user.locale);
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

  // Build duration
  private buildCurrentTransactionDuration(transaction: Transaction): string {
    let totalDuration;
    if (!transaction.stop) {
      totalDuration = moment.duration(moment(transaction.lastEnergyActiveImportMeterValue.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    } else {
      totalDuration = moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    }
    return moment.duration(totalDuration, 's').format('h[h]mm', { trim: false });
  }

  // Build duration
  private buildTransactionDuration(transaction: Transaction): string {
    return moment.duration(transaction.stop.totalDurationSecs, 's').format('h[h]mm', { trim: false });
  }

  private filterMeterValuesOnSpecificChargingStations(tenantID: string, chargingStation: ChargingStation, meterValues: OCPPNormalizedMeterValues) {
    // Clean up Sample.Clock meter value
    if (chargingStation.chargePointVendor !== ChargerVendor.ABB ||
      chargingStation.ocppVersion !== OCPPVersion.VERSION_15) {
      // Filter Sample.Clock meter value for all chargers except ABB using OCPP 1.5
      meterValues.values = meterValues.values.filter((meterValue) => {
        // Remove Sample Clock
        if (meterValue.attribute && meterValue.attribute.context === 'Sample.Clock') {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            module: MODULE_NAME, method: 'filterMeterValuesOnSpecificChargingStations',
            action: ServerAction.METER_VALUES,
            message: 'Removed Meter Value with attribute context \'Sample.Clock\'',
            detailedMessages: { meterValue }
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
            if (newLocalMeterValue.attribute.format === OCPPValueFormat.RAW) {
              newLocalMeterValue.value = Utils.convertToFloat(sampledValue.value);
              // Data is represented as a signed binary data block, encoded as hex data
            } else if (newLocalMeterValue.attribute.format === OCPPValueFormat.SIGNED_DATA) {
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
      // OCPP 1.5
      } else if (value['value']) {
        if (Array.isArray(value['value'])) {
          for (const currentValue of value['value']) {
            newMeterValue.value = Utils.convertToFloat(currentValue['$value']);
            newMeterValue.attribute = currentValue.attributes;
            newMeterValues.values.push(JSON.parse(JSON.stringify(newMeterValue)));
          }
        } else {
          newMeterValue.value = Utils.convertToFloat(value['value']['$value']);
          newMeterValue.attribute = value['value'].attributes;
          newMeterValues.values.push(newMeterValue);
        }
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
        if (activeTransaction.currentTotalConsumptionWh <= 0) {
          // No consumption: delete
          Logging.logWarning({
            tenantID: tenantID,
            source: chargeBoxID,
            module: MODULE_NAME, method: 'stopOrDeleteActiveTransactions',
            action: ServerAction.CLEANUP_TRANSACTION,
            actionOnUser: activeTransaction.user,
            message: `Connector '${activeTransaction.connectorId}' > Pending Transaction ID '${activeTransaction.id}' with no consumption has been deleted`
          });
          // Delete
          await TransactionStorage.deleteTransaction(tenantID, activeTransaction.id);
        } else {
          // Simulate a Stop Transaction
          const result = await this.handleStopTransaction({
            'tenantID': tenantID,
            'chargeBoxIdentity': activeTransaction.chargeBoxID
          }, {
            'chargeBoxID': activeTransaction.chargeBoxID,
            'transactionId': activeTransaction.id,
            'meterStop': (activeTransaction.lastEnergyActiveImportMeterValue ? activeTransaction.lastEnergyActiveImportMeterValue.value : activeTransaction.meterStart),
            'timestamp': Utils.convertToDate(activeTransaction.lastEnergyActiveImportMeterValue ? activeTransaction.lastEnergyActiveImportMeterValue.timestamp : activeTransaction.timestamp).toISOString(),
          }, false, true);
          // Check
          if (result.status === OCPPAuthorizationStatus.INVALID) {
            // No consumption: delete
            Logging.logError({
              tenantID: tenantID,
              source: chargeBoxID,
              module: MODULE_NAME, method: 'stopOrDeleteActiveTransactions',
              action: ServerAction.CLEANUP_TRANSACTION,
              actionOnUser: activeTransaction.userID,
              message: `Connector '${activeTransaction.connectorId}' > Cannot delete pending Transaction ID '${activeTransaction.id}' with no consumption`
            });
          } else {
            // Has consumption: close it!
            Logging.logWarning({
              tenantID: tenantID,
              source: chargeBoxID,
              module: MODULE_NAME, method: 'stopOrDeleteActiveTransactions',
              action: ServerAction.CLEANUP_TRANSACTION,
              actionOnUser: activeTransaction.userID,
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
        transaction.id.toString() + '',
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

  private async notifyStopTransaction(tenantID: string, chargingStation: ChargingStation, transaction: Transaction, user: User, alternateUser: User) {
    // User provided?
    if (user) {
      // Get the i18n lib
      const i18nManager = new I18nManager(user.locale);
      // Send Notification (Async)
      NotificationHandler.sendEndOfSession(
        tenantID,
        transaction.id.toString() + '-EOS',
        user,
        chargingStation,
        {
          'user': user,
          'alternateUser': (alternateUser ? alternateUser : null),
          'transactionId': transaction.id,
          'chargeBoxID': chargingStation.id,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'totalConsumption': i18nManager.formatNumber(Math.round(transaction.stop.totalConsumptionWh / 10) / 100),
          'totalDuration': this.buildTransactionDuration(transaction),
          'totalInactivity': this.buildTransactionInactivity(transaction),
          'stateOfCharge': transaction.stop.stateOfCharge,
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(tenantID, chargingStation, transaction.id, '#history'),
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
        }
      ).catch(() => { });
      if (transaction.stop.signedData !== '') {
        // Send Notification (Async)
        NotificationHandler.sendEndOfSignedSession(
          tenantID,
          transaction.id.toString() + '-EOSS',
          user,
          chargingStation,
          {
            'user': user,
            'alternateUser': (alternateUser ? alternateUser : null),
            'transactionId': transaction.id,
            'chargeBoxID': chargingStation.id,
            'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
            'tagId': transaction.tagID,
            'startDate': transaction.timestamp.toLocaleString(user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            'endDate': transaction.stop.timestamp.toLocaleString(user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            'meterStart': (transaction.meterStart / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            'meterStop': (transaction.stop.meterStop / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            'totalConsumption': (transaction.stop.totalConsumptionWh / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            'price': transaction.stop.price,
            'relativeCost': (transaction.stop.price / (transaction.stop.totalConsumptionWh / 1000)),
            'startSignedData': transaction.signedData,
            'endSignedData': transaction.stop.signedData,
            'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain)
          }
        ).catch(() => { });
      }
    }
  }

  private async triggerSmartCharging(tenantID: string, chargingStation: ChargingStation) {
    // Get Site Area
    const siteArea = await SiteAreaStorage.getSiteArea(tenantID, chargingStation.siteAreaID);
    if (siteArea && siteArea.smartCharging) {
      const siteAreaLock = await LockingHelper.createAndAquireExclusiveLockForSiteArea(tenantID, siteArea);
      if (siteAreaLock) {
        try {
          const smartCharging = await SmartChargingFactory.getSmartChargingImpl(tenantID);
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

