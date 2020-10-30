/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { OICPActionType, OICPPushEvseDataCpoSend } from '../../types/oicp/OICPEvseData';
import { OICPAuthorizeStartCpoReceive, OICPAuthorizeStartCpoSend, OICPAuthorizeStopCpoReceive, OICPAuthorizeStopCpoSend } from '../../types/oicp/OICPAuthorize';
import { OICPChargingNotification, OICPCode, OICPErrorClass } from '../../types/oicp/OICPStatusCode';
import { OICPChargingNotificationEndCpoSend, OICPChargingNotificationErrorCpoSend, OICPChargingNotificationProgressCpoSend, OICPChargingNotificationStartCpoSend } from '../../types/oicp/OICPChargingNotifications';
import { OICPEVSEPricing, OICPPricingProductData } from '../../types/oicp/OICPPricing';
import { OICPEvseDataRecord, OICPEvseStatusRecord, OICPOperatorEvseData, OICPOperatorEvseStatus } from '../../types/oicp/OICPEvse';
import { OICPIdentification, OICPSessionID } from '../../types/oicp/OICPIdentification';
import { OICPPushEVSEPricingCpoSend, OICPPushPricingProductDataCpoSend } from '../../types/oicp/OICPDynamicPricing';
import { OicpIdentifier, OicpSetting, RoamingSettingsType, SettingDB, SettingDBContent } from '../../types/Setting';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OICPAcknowledgment } from '../../types/oicp/OICPAcknowledgment';
import { OICPChargeDetailRecord } from '../../types/oicp/OICPChargeDetailRecord';
import OICPClient from './OICPClient';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import OICPEndpointStorage from '../../storage/mongodb/OICPEndpointStorage';
import { OICPJobResult } from '../../types/oicp/OICPJobResult';
import OICPMapping from '../../server/oicp/oicp-services-impl/oicp-2.3.0/OICPMapping';
import { OICPPushEvseStatusCpoSend } from '../../types/oicp/OICPEvseStatus';
import { OICPRole } from '../../types/oicp/OICPRole';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Transaction from '../../types/Transaction';
import _ from 'lodash';
import axios from 'axios';
import https from 'https';

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

    // Only one endpoint call for multiple EVSE Statuses
    sendResult.total = 1;

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

    if (evsesToProcess) {
      // Process it if not empty
      try {
        await this.pushEvseData(evsesToProcess, actionType);
        sendResult.success++;
        sendResult.chargeBoxIDsInSuccess.concat(chargeBoxIDsToProcessFromInput);
        sendResult.logs.push(
          `Pushed/Updated successfully EVSEs from tenant '${this.tenant.id}'`
        );
      } catch (error) {
        sendResult.failure++;
        sendResult.chargeBoxIDsInFailure.concat(chargeBoxIDsToProcessFromInput);
        sendResult.logs.push(
          `Failed to update the EVSEs from tenant '${this.tenant.id}': ${error.message}`
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
        message: `Pushing of ${chargeBoxIDsToProcessFromInput.length} EVSEs has been done with errors (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendEVSEs'
      });
    } else if (sendResult.success > 0) {
      // Log info
      Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSES,
        message: `Pushing of ${chargeBoxIDsToProcessFromInput.length} EVSEs has been done successfully (see details)`,
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

    // Only one endpoint call for multiple EVSE Statuses
    sendResult.total = 1;

    // To DO: Check if all EVSE Statuses should be processed - in case of delta send - process only following EVSEs:
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

    if (evseStatusesToProcess) {
      try {
        await this.pushEvseStatus(evseStatusesToProcess, actionType);
        sendResult.success++;
        sendResult.chargeBoxIDsInSuccess.concat(chargeBoxIDsToProcessFromInput);
        sendResult.logs.push(
          `Pushed/Updated successfully EVSE Statuses from tenant '${this.tenant.id}'`
        );
      } catch (error) {
        sendResult.failure++;
        sendResult.chargeBoxIDsInFailure.concat(chargeBoxIDsToProcessFromInput);
        sendResult.logs.push(
          `Failed to update the EVSE Statuses from tenant '${this.tenant.id}': ${error.message}`
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
        message: `Pushing of ${chargeBoxIDsToProcessFromInput.length} EVSE Statuses has been done with errors (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendEvseStatuses'
      });
    } else if (sendResult.success > 0) {
      // Log info
      Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSE_STATUSES,
        message: `Pushing of ${chargeBoxIDsToProcessFromInput.length} EVSE Statuses has been done successfully (see details)`,
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

    const publicCert = this.getClientCertificate(ServerAction.OICP_PUSH_EVSES);
    const privateKey = this.getPrivateKey(ServerAction.OICP_PUSH_EVSES);

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: publicCert,
      key: privateKey,
      passphrase: ''
    });

    // Call Hubject
    await axios.post(fullUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      httpsAgent: httpsAgent
    }).then(function(response) {
      console.log(response);
      pushEvseDataResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log(error.response);
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

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_PUSH_EVSE_STATUSES),
      key: this.getPrivateKey(ServerAction.OICP_PUSH_EVSE_STATUSES),
      passphrase: ''
    });

    // Call Hubject
    await axios.post(fullUrl, String(JSON.stringify(payload)), {
      headers: {
        'Content-Type': 'application/json'
      },
      httpsAgent: httpsAgent
    }).then(function(response) {
      console.log(response);
      pushEvseStatusResponse = response.data as OICPAcknowledgment;
    }).catch((error) => {
      console.log(error.response);
    });
    return pushEvseStatusResponse;
  }

  /**
   * ERoaming Authorize Start
   */
  async authorizeStart(identification: OICPIdentification): Promise<OICPAuthorizeStartCpoReceive> {
    let authorizeResponse = {} as OICPAuthorizeStartCpoReceive;
    // Check for input parameter
    if (!identification) {
      throw new BackendError({
        action: ServerAction.OICP_AUTHORIZE_START,
        message: 'Invalid parameters',
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
    payload.CPOPartnerSessionID; // Optional
    payload.EMPPartnerSessionID; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_AUTHORIZE_START);
    payload.EvseID; // Optional
    payload.Identification = identification;
    payload.PartnerProductID; // Optional

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_AUTHORIZE_START,
      message: 'Start Authorization',
      module: MODULE_NAME, method: 'authorizeStart',
      detailedMessages: { payload }
    });

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_AUTHORIZE_START),
      key: this.getPrivateKey(ServerAction.OICP_AUTHORIZE_START),
      passphrase: ''
    });

    // Call Hubject
    const response = await this.axiosInstance.post(fullUrl, payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });
    authorizeResponse = response.data as OICPAuthorizeStartCpoReceive;
    return authorizeResponse;
  }

  /**
   * ERoaming Authorize Stop
   */
  async authorizeStop(identification: OICPIdentification, sessionID: OICPSessionID): Promise<OICPAuthorizeStopCpoReceive> {
    let authorizeResponse = {} as OICPAuthorizeStopCpoReceive;
    // Check for input parameter
    if (!identification) {
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
    payload.SessionID = sessionID;
    payload.CPOPartnerSessionID; // Optional
    payload.EMPPartnerSessionID; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_AUTHORIZE_STOP);
    payload.EvseID; // Optional
    payload.Identification = identification;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_AUTHORIZE_STOP,
      message: 'Stop Authorization',
      module: MODULE_NAME, method: 'authorizeStop',
      detailedMessages: { payload }
    });

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_AUTHORIZE_STOP),
      key: this.getPrivateKey(ServerAction.OICP_AUTHORIZE_STOP),
      passphrase: ''
    });

    // Call Hubject
    const response = await this.axiosInstance.post(fullUrl, payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });
    authorizeResponse = response.data as OICPAuthorizeStopCpoReceive;
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
    cdr.CPOPartnerSessionID; // Optional
    cdr.EMPPartnerSessionID; // Optional
    cdr.EvseID = transaction.oicpData.session.evse.EvseID;
    cdr.Identification = transaction.oicpData.session.identification;
    cdr.ChargingStart = transaction.timestamp;
    cdr.ChargingEnd = transaction.stop.timestamp;
    cdr.SessionStart = transaction.oicpData.session.start_datetime;
    cdr.SessionEnd = transaction.oicpData.session.end_datetime;
    cdr.MeterValueStart = transaction.meterStart; // Optional
    cdr.MeterValueEnd = transaction.stop.meterStop; // Optional
    cdr.MeterValueInBetween; // Optional
    cdr.ConsumedEnergy = transaction.stop.totalConsumptionWh / 1000; // In kW.h
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

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_PUSH_CDRS),
      key: this.getPrivateKey(ServerAction.OICP_PUSH_CDRS),
      passphrase: ''
    });

    // Call Hubject
    const response = await this.axiosInstance.post(fullUrl, payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });

    pushCdrResponse = response.data as OICPAcknowledgment;

    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_CDRS,
      message: `Push CDR of OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') response retrieved from ${fullUrl}`,
      module: MODULE_NAME, method: 'pushCdr',
      detailedMessages: { response: response.data }
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

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_PUSH_EVSE_PRICING),
      key: this.getPrivateKey(ServerAction.OICP_PUSH_EVSE_PRICING),
      passphrase: ''
    });

    // Call Hubject
    const response = await this.axiosInstance.post(fullUrl, payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });
    pushEvsePricingResponse = response.data as OICPAcknowledgment;
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

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_PUSH_PRICING_PRODUCT_DATA),
      key: this.getPrivateKey(ServerAction.OICP_PUSH_PRICING_PRODUCT_DATA),
      passphrase: ''
    });

    // Call Hubject
    const response = await this.axiosInstance.post(fullUrl, payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });
    pushPricingProductDataResponse = response.data as OICPAcknowledgment;
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
    payload.CPOPartnerSessionID; // Optional
    payload.EMPPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ChargingStart = transaction.timestamp;
    payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
    payload.MeterValueStart = transaction.meterStart; // Optional
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

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START),
      key: this.getPrivateKey(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START),
      passphrase: ''
    });

    // Call Hubject
    const response = await this.axiosInstance.post(fullUrl, payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });
    notificationStartResponse = response.data as OICPAcknowledgment;
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
    payload.CPOPartnerSessionID; // Optional
    payload.EMPPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ChargingStart = transaction.timestamp;
    payload.EventOcurred = transaction.currentTimestamp;
    payload.ChargingDuration = transaction.currentTimestamp.getTime() - transaction.timestamp.getTime(); // Optional Duration in milliseconds (Integer). Charging Duration = EventOccurred - Charging Duration. Same as transaction.currentTotalDurationSecs * 1000?
    payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
    payload.ConsumedEnergyProgress = transaction.values[transaction.values.length - 1].cumulatedConsumptionWh / 1000; // In kW.h Optional
    payload.MeterValueStart = transaction.meterStart; // Optional
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

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS),
      key: this.getPrivateKey(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS),
      passphrase: ''
    });

    // Call Hubject
    const response = await this.axiosInstance.post(fullUrl, payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });
    notificationProgressResponse = response.data as OICPAcknowledgment;
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
    payload.CPOPartnerSessionID; // Optional
    payload.EMPPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ChargingStart = transaction.timestamp; // Optional
    payload.ChargingEnd = transaction.stop.timestamp;
    payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
    payload.SessionEnd = transaction.oicpData.session.end_datetime; // Optional
    payload.ConsumedEnergy = transaction.stop.totalConsumptionWh / 1000;
    payload.MeterValueStart = transaction.meterStart; // Optional. kw or kWh?
    payload.MeterValueEnd = transaction.stop.meterStop; // Optional. kW or kWh?
    payload.MeterValueInBetween; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END); // Optional
    payload.PartnerProductID; // Optional
    payload.PenaltyTimeStart;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
      message: `Send Charging Notification End for EVSE: ${payload.EvseID}`,
      module: MODULE_NAME, method: 'sendChargingNotificationEnd',
      detailedMessages: { payload }
    });

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END),
      key: this.getPrivateKey(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END),
      passphrase: ''
    });

    // Call Hubject
    const response = await this.axiosInstance.post(fullUrl, payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });
    notificationEndResponse = response.data as OICPAcknowledgment;
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
    payload.CPOPartnerSessionID; // Optional
    payload.EMPPartnerSessionID; // Optional
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

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // (NOTE: this will disable client verification)
      cert: this.getClientCertificate(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR),
      key: this.getPrivateKey(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR),
      passphrase: ''
    });

    // Call Hubject
    const response = await this.axiosInstance.post(fullUrl, payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });
    notificationErrorResponse = response.data as OICPAcknowledgment;
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
