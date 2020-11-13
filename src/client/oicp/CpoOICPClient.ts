import ChargingStation, { Connector } from '../../types/ChargingStation';
import { OICPActionType, OICPPushEvseDataCpoSend } from '../../types/oicp/OICPEvseData';
import { OICPAuthorizeStartCpoReceive, OICPAuthorizeStartCpoSend, OICPAuthorizeStopCpoReceive, OICPAuthorizeStopCpoSend } from '../../types/oicp/OICPAuthorize';
import { OICPChargingNotification, OICPCode, OICPErrorClass } from '../../types/oicp/OICPStatusCode';
import { OICPChargingNotificationEndCpoSend, OICPChargingNotificationErrorCpoSend, OICPChargingNotificationProgressCpoSend, OICPChargingNotificationStartCpoSend } from '../../types/oicp/OICPChargingNotifications';
import { OICPEVSEPricing, OICPPricingProductData } from '../../types/oicp/OICPPricing';
import { OICPEvseDataRecord, OICPEvseStatusRecord, OICPOperatorEvseData, OICPOperatorEvseStatus } from '../../types/oicp/OICPEvse';
import { OICPIdentification, OICPRFIDmifarefamilyIdentification } from '../../types/oicp/OICPIdentification';
import { OICPPushEVSEPricingCpoSend, OICPPushPricingProductDataCpoSend } from '../../types/oicp/OICPDynamicPricing';
import { OICPSession, OICPSessionStatus } from '../../types/oicp/OICPSession';
import Transaction, { TransactionAction } from '../../types/Transaction';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OICPAcknowledgment } from '../../types/oicp/OICPAcknowledgment';
import { OICPAuthorizationStatus } from '../../types/oicp/OICPAuthentication';
import { OICPChargeDetailRecord } from '../../types/oicp/OICPChargeDetailRecord';
import OICPClient from './OICPClient';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import OICPEndpointStorage from '../../storage/mongodb/OICPEndpointStorage';
import { OICPJobResult } from '../../types/oicp/OICPJobResult';
import OICPMapping from '../../server/oicp/oicp-services-impl/oicp-2.3.0/OICPMapping';
import { OICPPushEvseStatusCpoSend } from '../../types/oicp/OICPEvseStatus';
import { OICPRole } from '../../types/oicp/OICPRole';
import { OicpSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import Tenant from '../../types/Tenant';
import _ from 'lodash';

const MODULE_NAME = 'CpoOICPClient';

export default class CpoOICPClient extends OICPClient {

  constructor(tenant: Tenant, settings: OicpSetting, oicpEndpoint: OICPEndpoint) {
    super(tenant, settings, oicpEndpoint, OICPRole.CPO);
    if (oicpEndpoint.role !== OICPRole.CPO) {
      throw new BackendError({
        message: `CpoOicpClient requires Oicp Endpoint with role ${OICPRole.CPO}`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
  }

  async startSession(chargingStation: ChargingStation, transaction: Transaction): Promise<void> {
    // Build payload
    // Tbd: Hubject differentiates between different identification Methods. Eg. RFID, Remote start, QR Code, Plug&Charge
    const identification: OICPIdentification = {} as OICPIdentification;
    const rfidIdentification: OICPRFIDmifarefamilyIdentification = {} as OICPRFIDmifarefamilyIdentification;
    rfidIdentification.UID = transaction.tagID;
    identification.RFIDMifareFamilyIdentification = rfidIdentification;

    let siteArea;
    if (!chargingStation.siteArea) {
      siteArea = await SiteAreaStorage.getSiteArea(this.tenant.id, chargingStation.siteAreaID);
    } else {
      siteArea = chargingStation.siteArea;
    }

    const options = {
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_SESSIONS),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_SESSIONS),
      addChargeBoxID: true
    };
    const oicpEvse = OICPMapping.getEvseByConnectorId(this.tenant, siteArea, chargingStation, transaction.connectorId, options);

    const oicpSession: OICPSession = {} as OICPSession;
    oicpSession.start_datetime = transaction.timestamp;
    oicpSession.kwh = 0;
    oicpSession.identification = identification;
    oicpSession.evse = oicpEvse;
    oicpSession.currency = this.settings.currency;
    oicpSession.status = OICPSessionStatus.PENDING;
    oicpSession.total_cost = transaction.currentCumulatedPrice > 0 ? transaction.currentCumulatedPrice : 0;
    oicpSession.last_updated = transaction.timestamp;
    transaction.oicpData = {
      session: oicpSession
    };

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_SESSIONS,
      message: `Start OICP Transaction ID (ID '${transaction.id}') to Hubject`,
      module: MODULE_NAME, method: 'startSession',
      detailedMessages: { payload: oicpSession }
    });

    // Call Hubject
    const response = await this.authorizeStart(transaction);
    // Save Session ID that was created by Hubject
    transaction.oicpData.session.id = response.SessionID;
    transaction.oicpData.session.empPartnerSessionID = response.EMPPartnerSessionID;
    transaction.oicpData.session.providerID = response.ProviderID;

    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_SESSIONS,
      message: `Start OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') response received from Hubject`,
      module: MODULE_NAME, method: 'startSession',
      detailedMessages: { response: response }
    });
  }

  async updateSession(transaction: Transaction): Promise<void> {
    if (!transaction.oicpData || !transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: 'OICP Session not started',
        module: MODULE_NAME, method: 'updateSession',
      });
    }

    // Hubject restriction: "Progress Notification can be sent only at interval of at least 300 seconds." (5 Minutes)
    const date = transaction.currentTimestamp; // New Date();
    const t1 = date.getTime();
    const t2 = transaction.oicpData.session.last_updated.getTime();
    const updateDuration = ((t1 - t2) / 1000);
    console.log('update duration: ', updateDuration);
    if (updateDuration >= 300 || transaction.oicpData.session.status === OICPSessionStatus.PENDING) {
      transaction.oicpData.session.kwh = transaction.currentTotalConsumptionWh / 1000;
      transaction.oicpData.session.last_updated = transaction.currentTimestamp;
      transaction.oicpData.session.total_cost = transaction.currentCumulatedPrice > 0 ? transaction.currentCumulatedPrice : 0;
      transaction.oicpData.session.currency = this.settings.currency;
      // If (transaction.lastConsumption) {
      //   transaction.oicpData.session.meterValueInBetween.push(transaction.lastConsumption.value);
      // }

      const sessionUpdate: Partial<OICPSession> = {
        kwh: transaction.oicpData.session.kwh,
        last_updated: transaction.oicpData.session.last_updated,
        currency: transaction.oicpData.session.currency,
        total_cost: transaction.oicpData.session.total_cost > 0 ? transaction.oicpData.session.total_cost : 0,
        status: transaction.oicpData.session.status
      };
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: 'Push session update to Hubject',
        module: MODULE_NAME, method: 'updateSession',
        detailedMessages: { payload: sessionUpdate }
      });

      // Call Hubject
      let response;
      if (transaction.oicpData.session.status === OICPSessionStatus.PENDING) {
        // Send start notification to Hubject when actual energy flow starts
        // Condition: When OICPSessionStatus.PENDING switches to OICPSessionStatus.ACTIVE
        transaction.oicpData.session.status = OICPSessionStatus.ACTIVE;
        response = await this.sendChargingNotificationStart(transaction);
      } else {
        // Send progress notification
        response = await this.sendChargingNotificationProgress(transaction);
      }

      Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `Update Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') response received from Hubject`,
        module: MODULE_NAME, method: 'updateSession',
        detailedMessages: { response: response }
      });
    }
  }

  async stopSession(transaction: Transaction): Promise<void> {
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'stopSession',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'stopSession',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') not yet stopped`,
        module: MODULE_NAME, method: 'stopSession',
      });
    }

    transaction.oicpData.session.kwh = transaction.stop.totalConsumptionWh / 1000;
    transaction.oicpData.session.total_cost = transaction.stop.roundedPrice > 0 ? transaction.stop.roundedPrice : 0;
    transaction.oicpData.session.end_datetime = transaction.stop.timestamp;
    transaction.oicpData.session.last_updated = transaction.stop.timestamp;
    transaction.oicpData.session.status = OICPSessionStatus.COMPLETED;
    // If (transaction.lastConsumption) {
    //   transaction.oicpData.session.meterValueInBetween.push(transaction.lastConsumption.value);
    // }

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_SESSIONS,
      message: `Stop OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') to Hubject`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { payload: transaction.oicpData.session }
    });
    // Call Hubject
    await this.sendChargingNotificationEnd(transaction);
    const response = await this.authorizeStop(transaction);

    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_SESSIONS,
      message: `Push OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') response retrieved from Hubject`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { response: response }
    });
  }

  /**
   * Send all EVSEs
   */
  async sendEVSEs(processAllEVSEs = true, actionType?: OICPActionType): Promise<OICPJobResult> {
    if (!actionType) {
      actionType = OICPActionType.fullLoad;
    }
    // Result
    const sendResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      chargeBoxIDsInFailure: [],
      chargeBoxIDsInSuccess: []
    };
    // Define get option
    const options = {
      addChargeBoxID: true,
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSES),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_EVSES)
    };
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    // Get all EVSEs from tenant
    const evses = await OICPMapping.getAllEvses(this.tenant, 0, 0, options);
    let evsesToProcess: OICPEvseDataRecord[] = [];
    let chargeBoxIDsToProcessFromInput = [];

    // Check if all EVSEs should be processed - in case of delta send - process only following EVSEs:
    //    - EVSEs (ChargingStations) in error from previous push
    //    - EVSEs (ChargingStations) with status notification from latest pushDate
    if (processAllEVSEs) {
      evsesToProcess = evses.result;
      chargeBoxIDsToProcessFromInput = evsesToProcess.map((evse) => evse.chargeBoxId);
    } else {
      let chargeBoxIDsToProcess = [];

      // Get ChargingStation in Failure from previous run
      chargeBoxIDsToProcess.push(...this.getChargeBoxIDsInFailure());
      // Get ChargingStation with new status notification
      chargeBoxIDsToProcess.push(...await this.getChargeBoxIDsWithNewStatusNotifications());
      // Remove duplicates
      chargeBoxIDsToProcess = _.uniq(chargeBoxIDsToProcess);

      // Loop through EVSE
      for (const evse of evses.result) {
        if (evse && evses) {
          // Check if Charging Station should be processed
          if (!processAllEVSEs && !chargeBoxIDsToProcess.includes(evse.chargeBoxId)) {
            continue;
          }
          // Process
          evsesToProcess.push(evse);
          chargeBoxIDsToProcessFromInput.push(evse.chargeBoxId);
        }
      }
    }

    // Only one endpoint call for multiple EVSEs
    sendResult.total = evsesToProcess.length;

    if (evsesToProcess) {
      // Process it if not empty
      try {
        await this.pushEvseData(evsesToProcess, actionType);
        sendResult.success = sendResult.total;
        sendResult.chargeBoxIDsInSuccess.push(...chargeBoxIDsToProcessFromInput);
        sendResult.logs.push(
          `Pushed/Updated successfully EVSEs from tenant '${this.tenant.id}'`
        );
      } catch (error) {
        sendResult.failure = sendResult.total;
        sendResult.chargeBoxIDsInFailure.push(...chargeBoxIDsToProcessFromInput);
        sendResult.logs.push(
          `Failed to update the EVSEs from tenant '${this.tenant.id}': ${String(error.message)}`
        );
      }
      // If (sendResult.failure > 0) {
      //   // Send notification to admins
      //   // eslint-disable-next-line @typescript-eslint/no-floating-promises
      //   NotificationHandler.sendOICPPatchChargingStationsStatusesError(
      //     this.tenant.id,
      //     {
      //       location: location.name,
      //       evseDashboardURL: Utils.buildEvseURL((await TenantStorage.getTenant(this.tenant.id)).subdomain),
      //     }
      //   );
      // }
    }

    // Log error if any
    if (sendResult.failure > 0) {
      // Log error if failure
      Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSES,
        message: `Pushing of ${sendResult.failure} EVSEs has been done with errors (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendEVSEs'
      });
    } else if (sendResult.success > 0) {
      // Log info
      Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSES,
        message: `Pushing of ${sendResult.success} EVSEs has been done successfully (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendEVSEs'
      });
    }
    // Save result in oicp endpoint
    this.oicpEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (sendResult) {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: sendResult.success,
        failureNbr: sendResult.failure,
        totalNbr: sendResult.total,
        chargeBoxIDsInFailure: _.uniq(sendResult.chargeBoxIDsInFailure),
        chargeBoxIDsInSuccess: _.uniq(sendResult.chargeBoxIDsInSuccess)
      };
    } else {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: 0,
        failureNbr: 0,
        totalNbr: 0,
        chargeBoxIDsInFailure: [],
        chargeBoxIDsInSuccess: []
      };
    }
    // Save
    await OICPEndpointStorage.saveOicpEndpoint(this.tenant.id, this.oicpEndpoint);
    // Return result
    return sendResult;
  }

  /**
   * Send all EVSE Statuses
   */
  async sendEVSEStatuses(processAllEVSEs = true, actionType?: OICPActionType): Promise<OICPJobResult> {
    if (!actionType) {
      actionType = OICPActionType.fullLoad;
    }
    // Result
    const sendResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      chargeBoxIDsInFailure: [],
      chargeBoxIDsInSuccess: []
    };
    // Define get option
    const options = {
      addChargeBoxID: true,
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_STATUSES),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_STATUSES)
    };
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    // Get all EVSE Statuses from tenant
    const evseStatuses = await OICPMapping.getAllEvseStatuses(this.tenant, 0, 0, options);
    let evseStatusesToProcess: OICPEvseStatusRecord[] = [];
    let chargeBoxIDsToProcessFromInput = [];

    // Check if all EVSE Statuses should be processed - in case of delta send - process only following EVSEs:
    //    - EVSEs (ChargingStations) in error from previous push
    //    - EVSEs (ChargingStations) with status notification from latest pushDate
    if (processAllEVSEs) {
      evseStatusesToProcess = evseStatuses.result;
      chargeBoxIDsToProcessFromInput = evseStatusesToProcess.map((evseStatus) => evseStatus.chargeBoxId);
    } else {
      let chargeBoxIDsToProcess = [];

      // Get ChargingStation in Failure from previous run
      chargeBoxIDsToProcess.push(...this.getChargeBoxIDsInFailure());
      // Get ChargingStation with new status notification
      chargeBoxIDsToProcess.push(...await this.getChargeBoxIDsWithNewStatusNotifications());
      // Remove duplicates
      chargeBoxIDsToProcess = _.uniq(chargeBoxIDsToProcess);

      // Loop through EVSE
      for (const evseStatus of evseStatuses.result) {
        if (evseStatus && evseStatuses) {
          // Check if Charging Station should be processed
          if (!processAllEVSEs && !chargeBoxIDsToProcess.includes(evseStatus.chargeBoxId)) {
            continue;
          }
          // Process
          evseStatusesToProcess.push(evseStatus);
          chargeBoxIDsToProcessFromInput.push(evseStatus.chargeBoxId);
        }
      }
    }

    // Only one endpoint call for multiple EVSE Statuses
    sendResult.total = evseStatusesToProcess.length;

    if (evseStatusesToProcess) {
      try {
        await this.pushEvseStatus(evseStatusesToProcess, actionType);
        sendResult.success = sendResult.total;
        sendResult.chargeBoxIDsInSuccess.push(...chargeBoxIDsToProcessFromInput);
        sendResult.logs.push(
          `Pushed/Updated successfully EVSE Statuses from tenant '${this.tenant.id}'`
        );
      } catch (error) {
        sendResult.failure = sendResult.total;
        sendResult.chargeBoxIDsInFailure.push(...chargeBoxIDsToProcessFromInput);
        sendResult.logs.push(
          `Failed to update the EVSE Statuses from tenant '${this.tenant.id}': ${String(error.message)}`
        );
      }
      // If (sendResult.failure > 0) {
      //   // Send notification to admins
      //   // eslint-disable-next-line @typescript-eslint/no-floating-promises
      //   NotificationHandler.sendOICPPatchChargingStationsStatusesError(
      //     this.tenant.id,
      //     {
      //       location: location.name,
      //       evseDashboardURL: Utils.buildEvseURL((await TenantStorage.getTenant(this.tenant.id)).subdomain),
      //     }
      //   );
      // }
    }

    // Log error if any
    if (sendResult.failure > 0) {
      // Log error if failure
      Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSE_STATUSES,
        message: `Pushing of ${sendResult.failure} EVSE Statuses has been done with errors (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendEvseStatuses'
      });
    } else if (sendResult.success > 0) {
      // Log info
      Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSE_STATUSES,
        message: `Pushing of ${sendResult.success} EVSE Statuses has been done successfully (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendEvseStatuses'
      });
    }
    // Save result in oicp endpoint
    this.oicpEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (sendResult) {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: sendResult.success,
        failureNbr: sendResult.failure,
        totalNbr: sendResult.total,
        chargeBoxIDsInFailure: _.uniq(sendResult.chargeBoxIDsInFailure),
        chargeBoxIDsInSuccess: _.uniq(sendResult.chargeBoxIDsInSuccess)
      };
    } else {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: 0,
        failureNbr: 0,
        totalNbr: 0,
        chargeBoxIDsInFailure: [],
        chargeBoxIDsInSuccess: []
      };
    }
    // Save
    await OICPEndpointStorage.saveOicpEndpoint(this.tenant.id, this.oicpEndpoint);
    // Return result
    return sendResult;
  }

  /**
   * Update EVSE Status
   */
  async updateEVSEStatus(chargingStation: ChargingStation, connector: Connector): Promise<OICPAcknowledgment> {
    if (!chargingStation.siteAreaID && !chargingStation.siteArea) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: 'Charging Station must be associated to a site area',
        module: MODULE_NAME, method: 'updateEVSEStatus',
      });
    }
    if (!chargingStation.issuer) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: 'Only charging Station issued locally can be exposed to Hubject',
        module: MODULE_NAME, method: 'updateEVSEStatus',
      });
    }
    if (!chargingStation.public) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: 'Private charging Station cannot be exposed to Hubject',
        module: MODULE_NAME, method: 'updateEVSEStatus',
      });
    }
    // Define get option
    const options = {
      addChargeBoxID: true,
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_STATUSES),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_STATUSES)
    };
    const evseStatus = OICPMapping.convertConnector2EvseStatus(this.tenant, chargingStation, connector, options);
    const response = await this.pushEvseStatus([evseStatus], OICPActionType.update);
    return response;
  }

  /**
   * Push EVSE
   */
  async pushEvseData(evses: OICPEvseDataRecord[], actionType: OICPActionType): Promise<OICPAcknowledgment> {
    let pushEvseDataResponse: OICPAcknowledgment = {} as OICPAcknowledgment;
    // Check for input parameter
    if (!evses) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSES,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'pushEvseData',
      });
    }
    // Get EVSE endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/evsepush/v23/operators/{operatorID}/data-records
    // for PROD - environment: https://service.hubject.com/api/oicp/evsepush/v23/operators/{operatorID}/data-records
    const fullUrl = this.getEndpointUrl('evses', ServerAction.OICP_PUSH_EVSES);

    // Build payload
    const operatorEvseData: OICPOperatorEvseData = {} as OICPOperatorEvseData;
    operatorEvseData.OperatorID = this.getOperatorID(ServerAction.OICP_PUSH_EVSES);
    operatorEvseData.OperatorName = this.tenant.name;
    operatorEvseData.EvseDataRecord = evses;

    const payload: OICPPushEvseDataCpoSend = {} as OICPPushEvseDataCpoSend;
    payload.ActionType = actionType;
    payload.OperatorEvseData = operatorEvseData;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_EVSES,
      message: `Push EVSEs from tenant: ${this.tenant.id}`,
      module: MODULE_NAME, method: 'pushEvseData',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! pushEvseData: ', response);
      pushEvseDataResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log('Error! pushEvseData: ',error.message);
    });
    return pushEvseDataResponse;
  }

  /**
   * Push EVSE Status
   */
  async pushEvseStatus(evseStatuses: OICPEvseStatusRecord[], actionType: OICPActionType): Promise<OICPAcknowledgment> {
    let pushEvseStatusResponse: OICPAcknowledgment = {} as OICPAcknowledgment;
    // Check for input parameter
    if (!evseStatuses) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_STATUSES,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'pushEvseStatus',
      });
    }
    // Get EVSE Status endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/evsepush/v21/operators/{operatorID}/status-records
    // for PROD - environment: https://service.hubject.com/api/oicp/evsepush/v21/operators/{operatorID}/status-records
    const fullUrl = this.getEndpointUrl('statuses', ServerAction.OICP_PUSH_EVSE_STATUSES);

    // Build payload
    const operatorEvseStatus: OICPOperatorEvseStatus = {} as OICPOperatorEvseStatus;
    operatorEvseStatus.OperatorID = this.getOperatorID(ServerAction.OICP_PUSH_EVSE_STATUSES);
    operatorEvseStatus.OperatorName = this.tenant.name;
    operatorEvseStatus.EvseStatusRecord = evseStatuses;

    const payload: OICPPushEvseStatusCpoSend = {} as OICPPushEvseStatusCpoSend;
    payload.ActionType = actionType;
    payload.OperatorEvseStatus = operatorEvseStatus;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_EVSE_STATUSES,
      message: `Push EVSE statuses from tenant: ${this.tenant.id}`,
      module: MODULE_NAME, method: 'pushEvseStatus',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! pushEvseStatus: ', response);
      pushEvseStatusResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log('Error! pushEvseStatus: ', error.response);
    });
    return pushEvseStatusResponse;
  }

  /**
   * ERoaming Authorize Start
   */
  async authorizeStart(transaction: Transaction): Promise<OICPAuthorizeStartCpoReceive> {
    let authorizeResponse = {} as OICPAuthorizeStartCpoReceive;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'authorizeStart',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'authorizeStart',
      });
    }

    // Get authorize start endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/charging/v21/operators/{operatorID}/authorize/start
    // for PROD - environment: https://service.hubject.com/api/oicp/charging/v21/operators/{operatorID}/authorize/start
    const fullUrl = this.getEndpointUrl('authorizeStart', ServerAction.OICP_AUTHORIZE_START);

    // Build payload
    const payload: OICPAuthorizeStartCpoSend = {} as OICPAuthorizeStartCpoSend;
    payload.SessionID; // Optional
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID; // Optional
    payload.Identification = transaction.oicpData.session.identification;
    payload.PartnerProductID; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_AUTHORIZE_START);

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_AUTHORIZE_START,
      message: 'Start Authorization',
      module: MODULE_NAME, method: 'authorizeStart',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! authorizeStart: ', response);
      authorizeResponse = response.data as OICPAuthorizeStartCpoReceive;
    }).catch((error) => {
      console.log('Error! authorizeStart: ', error.response);
    });
    if (authorizeResponse.AuthorizationStatus !== OICPAuthorizationStatus.Authorized) {
      throw new BackendError({
        user: transaction.user,
        action: ServerAction.START_TRANSACTION,
        module: MODULE_NAME, method: 'authorizeStart',
        message: `User '${transaction.user.id}' with Tag ID '${transaction.tagID}' cannot ${TransactionAction.START} Transaction thought OICP protocol due to missing Authorization`
      });
    }

    return authorizeResponse;
  }

  /**
   * ERoaming Authorize Stop
   */
  async authorizeStop(transaction: Transaction): Promise<OICPAuthorizeStopCpoReceive> {
    let authorizeResponse = {} as OICPAuthorizeStopCpoReceive;
    // Check for input parameter
    if (!transaction.oicpData.session) {
      throw new BackendError({
        action: ServerAction.OICP_AUTHORIZE_STOP,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'authorizeStop',
      });
    }

    // Get authorize stop endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/charging/v21/operators/{operatorID}/authorize/stop
    // for PROD - environment: https://service.hubject.com/api/oicp/charging/v21/operators/{operatorID}/authorize/stop
    const fullUrl = this.getEndpointUrl('authorizeStop', ServerAction.OICP_AUTHORIZE_STOP);

    // Build payload
    const payload: OICPAuthorizeStopCpoSend = {} as OICPAuthorizeStopCpoSend;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_AUTHORIZE_STOP);
    payload.EvseID = transaction.oicpData.session.evse.EvseID; // Optional
    payload.Identification = transaction.oicpData.session.identification;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_AUTHORIZE_STOP,
      message: 'Stop Authorization',
      module: MODULE_NAME, method: 'authorizeStop',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! authorizeStop: ', response);
      authorizeResponse = response.data as OICPAuthorizeStopCpoReceive;
    }).catch((error) => {
      console.log('Error! authorizeStop: ', error);
    });

    return authorizeResponse;
  }

  /**
   * ERoaming Push Charge Detail Record
   */
  async pushCdr(transaction: Transaction): Promise<OICPAcknowledgment> {
    let pushCdrResponse = {} as OICPAcknowledgment;
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_CDRS,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'pushCdr',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_CDRS,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'pushCdr',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_CDRS,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') not stopped`,
        module: MODULE_NAME, method: 'pushCdr',
      });
    }

    // Get CDR endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/cdrmgmt/v22/operators/{operatorID}/charge-detail-record
    // for PROD - environment: https://service.hubject.com/api/oicp/cdrmgmt/v22/operators/{operatorID}/charge-detail-record
    const fullUrl = this.getEndpointUrl('cdrs', ServerAction.OICP_PUSH_CDRS);

    const cdr: OICPChargeDetailRecord = {} as OICPChargeDetailRecord;
    cdr.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      cdr.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    cdr.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    cdr.EvseID = transaction.oicpData.session.evse.EvseID;
    cdr.Identification = transaction.oicpData.session.identification;
    cdr.ChargingStart = transaction.timestamp;
    cdr.ChargingEnd = transaction.stop.timestamp;
    cdr.SessionStart = transaction.oicpData.session.start_datetime;
    cdr.SessionEnd = transaction.oicpData.session.end_datetime;
    cdr.MeterValueStart = parseFloat((transaction.meterStart / 1000).toFixed(3)); // Optional
    cdr.MeterValueEnd = parseFloat((transaction.stop.meterStop / 1000).toFixed(3)); // Optional
    cdr.MeterValueInBetween; // = transaction.oicpData.session.meterValueInBetween.map((mV) => parseFloat((mV / 1000).toFixed(3))); // Optional
    cdr.ConsumedEnergy = parseFloat((transaction.stop.totalConsumptionWh / 1000).toFixed(3)); // In kW.h
    cdr.SignedMeteringValues; // Optional
    cdr.CalibrationLawVerificationInfo; // Optional
    cdr.HubOperatorID; // Optional
    cdr.HubProviderID; // Optional

    transaction.oicpData.cdr = cdr;
    const payload: OICPChargeDetailRecord = transaction.oicpData.cdr;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_CDRS,
      message: `Post CDR of OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') at ${fullUrl}`,
      module: MODULE_NAME, method: 'pushCdr',
      detailedMessages: { payload: transaction.oicpData.cdr }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! pushCdr: ', response);
      pushCdrResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log('Error! pushCdr: ', error.response);
    });

    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_CDRS,
      message: `Push CDR of OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') response retrieved from ${fullUrl}`,
      module: MODULE_NAME, method: 'pushCdr',
      detailedMessages: { response: pushCdrResponse }
    });

    return pushCdrResponse;
  }

  /**
   * Push EVSE Pricing
   */
  async pushEvsePricing(evsePricing: OICPEVSEPricing[], actionType: OICPActionType): Promise<OICPAcknowledgment> {
    let pushEvsePricingResponse: OICPAcknowledgment = {} as OICPAcknowledgment;
    // Check for input parameter
    if (!evsePricing) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_PRICING,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'pushEvsePricing',
      });
    }
    // Get pricing endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/dynamicpricing/v10/operators/{operatorID}/evse-pricing
    // for PROD - environment: https://service.hubject.com/api/oicp/dynamicpricing/v10/operators/{operatorID}/evse-pricing
    const fullUrl = this.getEndpointUrl('pricing', ServerAction.OICP_PUSH_EVSE_PRICING);

    // Build payload
    const payload: OICPPushEVSEPricingCpoSend = {} as OICPPushEVSEPricingCpoSend;
    payload.ActionType = actionType;
    payload.EVSEPricing = evsePricing;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_EVSE_PRICING,
      message: `Push EVSE pricing from tenant: ${this.tenant.id}`,
      module: MODULE_NAME, method: 'pushEvsePricing',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! pushEvsePricing: ', response);
      pushEvsePricingResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log('Error! pushEvsePricing: ', error.response);
    });
    return pushEvsePricingResponse;
  }

  /**
   * Push Pricing Product Data
   */
  async pushPricingProductData(pricingProductData: OICPPricingProductData, actionType: OICPActionType): Promise<OICPAcknowledgment> {
    let pushPricingProductDataResponse: OICPAcknowledgment = {} as OICPAcknowledgment;
    // Check for input parameter
    if (!pricingProductData) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_PRICING_PRODUCT_DATA,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'pushPricingProductData',
      });
    }
    // Get pricing product endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/dynamicpricing/v10/operators/{operatorID}/pricing-products
    // for PROD - environment: https://service.hubject.com/api/oicp/dynamicpricing/v10/operators/{operatorID}/pricing-products
    const fullUrl = this.getEndpointUrl('pricingProducts', ServerAction.OICP_PUSH_PRICING_PRODUCT_DATA);

    // Build payload
    const payload: OICPPushPricingProductDataCpoSend = {} as OICPPushPricingProductDataCpoSend;
    payload.ActionType = actionType;
    payload.PricingProductData = pricingProductData;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_PRICING_PRODUCT_DATA,
      message: `Push pricing product data from tenant: ${this.tenant.id}`,
      module: MODULE_NAME, method: 'pushPricingProductData',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! pushPricingProductData: ', response);
      pushPricingProductDataResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log('Error! pushPricingProductData: ', error.response);
    });
    return pushPricingProductDataResponse;
  }

  /**
   * Send Charging Notification Start
   */
  async sendChargingNotificationStart(transaction: Transaction): Promise<OICPAcknowledgment> {
    let notificationStartResponse: OICPAcknowledgment = {} as OICPAcknowledgment;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationStart',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationStart',
      });
    }

    // Get notification endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/notificationmgmt/v11/charging-notifications
    // for PROD - environment: https://service.hubject.com/api/oicp/notificationmgmt/v11/charging-notifications
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START);

    // Build payload
    const payload: OICPChargingNotificationStartCpoSend = {} as OICPChargingNotificationStartCpoSend;
    payload.Type = OICPChargingNotification.Start;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ChargingStart = transaction.timestamp;
    payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
    payload.MeterValueStart = parseFloat((transaction.meterStart / 1000).toFixed(3)); // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START); // Optional
    payload.PartnerProductID; // Optional

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
      message: `Send Charging Notification Start for EVSE: ${payload.EvseID}`,
      module: MODULE_NAME, method: 'sendChargingNotificationStart',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! sendChargingNotificationStart: ', response);
      notificationStartResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log('Error! sendChargingNotificationStart: ', error.response);
    });
    return notificationStartResponse;
  }

  /**
   * Send Charging Notification Progress
   */
  async sendChargingNotificationProgress(transaction: Transaction): Promise<OICPAcknowledgment> {
    let notificationProgressResponse: OICPAcknowledgment = {} as OICPAcknowledgment;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationProgress',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationProgress',
      });
    }

    // Get notification endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/notificationmgmt/v11/charging-notifications
    // for PROD - environment: https://service.hubject.com/api/oicp/notificationmgmt/v11/charging-notifications
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS);

    // Build payload
    const payload: OICPChargingNotificationProgressCpoSend = {} as OICPChargingNotificationProgressCpoSend;
    payload.Type = OICPChargingNotification.Progress;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ChargingStart = transaction.timestamp;
    payload.EventOccurred = transaction.currentTimestamp;
    payload.ChargingDuration = transaction.currentTimestamp.getTime() - transaction.timestamp.getTime(); // Optional Duration in milliseconds (Integer). Charging Duration = EventOccurred - Charging Duration. Same as transaction.currentTotalDurationSecs * 1000?
    payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
    payload.ConsumedEnergyProgress = parseFloat((transaction.currentTotalConsumptionWh / 1000).toFixed(3)); // In kW.h Optional
    payload.MeterValueStart = parseFloat((transaction.meterStart / 1000).toFixed(3)); // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS); // Optional
    payload.PartnerProductID; // Optional

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
      message: `Send Charging Notification Progress for EVSE: ${payload.EvseID}`,
      module: MODULE_NAME, method: 'sendChargingNotificationProgress',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! sendChargingNotificationProgress: ', response);
      notificationProgressResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log('Error! sendChargingNotificationProgress: ', error.response);
    });
    return notificationProgressResponse;
  }

  /**
   * Send Charging Notification End
   */
  async sendChargingNotificationEnd(transaction: Transaction): Promise<OICPAcknowledgment> {
    let notificationEndResponse: OICPAcknowledgment = {} as OICPAcknowledgment;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') not stopped`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
      });
    }

    // Get notification endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/notificationmgmt/v11/charging-notifications
    // for PROD - environment: https://service.hubject.com/api/oicp/notificationmgmt/v11/charging-notifications
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END);

    // Build payload
    const payload: OICPChargingNotificationEndCpoSend = {} as OICPChargingNotificationEndCpoSend;
    payload.Type = OICPChargingNotification.End;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ChargingStart = transaction.timestamp; // Optional
    payload.ChargingEnd = transaction.stop.timestamp;
    payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
    payload.SessionEnd = transaction.oicpData.session.end_datetime; // Optional
    payload.ConsumedEnergy = parseFloat((transaction.stop.totalConsumptionWh / 1000).toFixed(3));
    payload.MeterValueStart = parseFloat((transaction.meterStart / 1000).toFixed(3)); // Optional. kw or kWh?
    payload.MeterValueEnd = parseFloat((transaction.stop.meterStop / 1000).toFixed(3)); // Optional. kW or kWh?
    payload.MeterValueInBetween; // = transaction.oicpData.session.meterValueInBetween.map((mV) => parseFloat((mV / 1000).toFixed(3))); // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END); // Optional
    payload.PartnerProductID; // Optional
    payload.PenaltyTimeStart = transaction.stop.timestamp; // Optional

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
      message: `Send Charging Notification End for EVSE: ${payload.EvseID}`,
      module: MODULE_NAME, method: 'sendChargingNotificationEnd',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! sendChargingNotificationEnd: ', response);
      notificationEndResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log('Error! sendChargingNotificationEnd: ', error.response);
    });
    return notificationEndResponse;
  }

  /**
   * Send Charging Notification Error
   */
  async sendChargingNotificationError(transaction: Transaction, error: OICPErrorClass, errorAdditionalInfo?: string): Promise<OICPAcknowledgment> {
    let notificationErrorResponse: OICPAcknowledgment = {} as OICPAcknowledgment;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationError',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationError',
      });
    }

    // Get notification endpoint url
    // for QA - environment: https://service-qa.hubject.com/api/oicp/notificationmgmt/v11/charging-notifications
    // for PROD - environment: https://service.hubject.com/api/oicp/notificationmgmt/v11/charging-notifications
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR);

    // Build payload
    const payload: OICPChargingNotificationErrorCpoSend = {} as OICPChargingNotificationErrorCpoSend;
    payload.Type = OICPChargingNotification.Error;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ErrorType = error;
    payload.ErrorAdditionalInfo = errorAdditionalInfo; // Optional

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
      message: `Send Charging Notification Error for EVSE: ${payload.EvseID}`,
      module: MODULE_NAME, method: 'sendChargingNotificationError',
      detailedMessages: { payload }
    });

    // Call Hubject
    await this.axiosInstance.post(fullUrl, payload
    ).then(function(response) {
      console.log('Success! sendChargingNotificationError: ', response);
      notificationErrorResponse = response.data as OICPAcknowledgment;
    }).catch((errors) => {
      console.log('Error! sendChargingNotificationError: ', errors.response);
    });
    return notificationErrorResponse;
  }

  // Get ChargeBoxIds with new status notifications
  async getChargeBoxIDsWithNewStatusNotifications(): Promise<string[]> {
    // Get last job
    const lastPatchJobOn = this.oicpEndpoint.lastPatchJobOn ? this.oicpEndpoint.lastPatchJobOn : new Date();
    // Build params
    const params = { 'dateFrom': lastPatchJobOn };
    // Get last status notifications
    const statusNotificationsResult = await OCPPStorage.getStatusNotifications(this.tenant.id, params, Constants.DB_PARAMS_MAX_LIMIT);
    // Loop through notifications
    if (statusNotificationsResult.count > 0) {
      return statusNotificationsResult.result.map((statusNotification) => statusNotification.chargeBoxID);
    }
    return [];
  }

  /**
   * Ping OICP Endpoint
   */
  async ping() {
    const pingResult: any = {};
    // Try to access base Url (GET .../versions)
    // Access versions API
    try {
      // Get versions
      const response = await this.pingEvseEndpoint();
      // Check response
      if (!response.Result || !(response.StatusCode.Code === OICPCode.Code000)) {
        pingResult.statusCode = 412;
        pingResult.statusText = `Invalid response from POST ${this.getEndpointUrl('evses',ServerAction.OICP_PUSH_EVSES)}`;
      } else {
        pingResult.statusCode = response.StatusCode.Code;
        pingResult.statusText = response.StatusCode.Description;
      }
    } catch (error) {
      pingResult.message = error.message;
      pingResult.statusCode = (error.response) ? error.response.status : HTTPError.GENERAL_ERROR;
    }
    // Return result
    return pingResult;
  }

  /**
   * POST to EVSE Endpoint without EVSEs
   */
  async pingEvseEndpoint() {
    Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_EVSES,
      message: `Ping Hubject at ${this.getEndpointUrl('evses',ServerAction.OICP_PUSH_EVSES)}`,
      module: MODULE_NAME, method: 'pingEvseEndpoint'
    });
    const response = await this.pushEvseData([], OICPActionType.fullLoad);
    return response;
  }

  async triggerJobs(): Promise<{
    evses?: OICPJobResult,
    evseStatuses?: OICPJobResult;
  }> {
    return {
      evses: await this.sendEVSEs(),
      evseStatuses: await this.sendEVSEStatuses(),
    };
  }

  // Get ChargeBoxIDs in failure from previous job
  private getChargeBoxIDsInFailure(): string[] {
    if (this.oicpEndpoint.lastPatchJobResult && this.oicpEndpoint.lastPatchJobResult.chargeBoxIDsInFailure) {
      return this.oicpEndpoint.lastPatchJobResult.chargeBoxIDsInFailure;
    }
    return [];
  }

}
