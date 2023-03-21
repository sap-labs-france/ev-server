import ChargingStation, { Connector } from '../../types/ChargingStation';
import { OICPActionType, OICPPushEvseDataCpoSend } from '../../types/oicp/OICPEvseData';
import { OICPAuthorizeStartCpoReceive, OICPAuthorizeStartCpoSend, OICPAuthorizeStopCpoReceive, OICPAuthorizeStopCpoSend } from '../../types/oicp/OICPAuthorize';
import { OICPChargingNotification, OICPErrorClass, OICPStatusCode } from '../../types/oicp/OICPStatusCode';
import { OICPChargingNotificationEndCpoSend, OICPChargingNotificationErrorCpoSend, OICPChargingNotificationProgressCpoSend, OICPChargingNotificationStartCpoSend } from '../../types/oicp/OICPChargingNotifications';
import { OICPDefaultTagId, OICPIdentification, OICPSessionID } from '../../types/oicp/OICPIdentification';
import { OICPEvseDataRecord, OICPEvseStatusRecord, OICPOperatorEvseData, OICPOperatorEvseStatus } from '../../types/oicp/OICPEvse';
import { OICPSession, OICPSessionStatus } from '../../types/oicp/OICPSession';

import BackendError from '../../exception/BackendError';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import NotificationHandler from '../../notification/NotificationHandler';
import { OCPILocationOptions } from '../../types/ocpi/OCPILocation';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OICPAcknowledgment } from '../../types/oicp/OICPAcknowledgment';
import { OICPAuthorizationStatus } from '../../types/oicp/OICPAuthentication';
import { OICPBatchSize } from '../../types/oicp/OICPGeneral';
import { OICPChargeDetailRecord } from '../../types/oicp/OICPChargeDetailRecord';
import OICPClient from './OICPClient';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import OICPEndpointStorage from '../../storage/mongodb/OICPEndpointStorage';
import { OICPPushEvseStatusCpoSend } from '../../types/oicp/OICPEvseStatus';
import { OICPResult } from '../../types/oicp/OICPResult';
import { OICPRole } from '../../types/oicp/OICPRole';
import OICPUtils from '../../server/oicp/OICPUtils';
import { OicpSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';
import _ from 'lodash';

const MODULE_NAME = 'CpoOICPClient';

export default class CpoOICPClient extends OICPClient {
  public constructor(tenant: Tenant, settings: OicpSetting, oicpEndpoint: OICPEndpoint) {
    super(tenant, settings, oicpEndpoint, OICPRole.CPO);
    if (oicpEndpoint.role !== OICPRole.CPO) {
      throw new BackendError({
        message: `CpoOicpClient requires Oicp Endpoint with role ${OICPRole.CPO}`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
  }

  public async startSession(chargingStation: ChargingStation, transaction: Transaction,
      sessionId: OICPSessionID, identification: OICPIdentification): Promise<void> {
    const options: OCPILocationOptions = {
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_SESSIONS),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_SESSIONS),
      addChargeBoxAndOrgIDs: true
    };
    // Get Site Area
    const siteArea = chargingStation.siteArea;
    // Get Site
    const site = await SiteStorage.getSite(this.tenant, chargingStation.siteID);
    // Get Evse
    const oicpEvse = OICPUtils.getEvseByConnectorId(
      site, siteArea, chargingStation, transaction.connectorId, options);
    const oicpSession = {
      id: sessionId,
      start_datetime: transaction.timestamp,
      kwh: 0,
      identification: identification,
      evse: oicpEvse,
      currency: this.settings.currency,
      status: OICPSessionStatus.PENDING,
      total_cost: transaction.currentCumulatedPrice > 0 ? transaction.currentCumulatedPrice : 0,
      last_updated: transaction.timestamp,
      meterValueInBetween: [],
    } as OICPSession;
    // Set OICP data
    transaction.oicpData = {
      session: oicpSession
    };
    await Logging.logDebug({
      ...LoggingHelper.getTransactionProperties(transaction),
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_SESSIONS,
      message: `Start OICP Session ID '${transaction.id}'`,
      module: MODULE_NAME, method: 'startSession',
      detailedMessages: { session: oicpSession }
    });
  }

  public async updateSession(transaction: Transaction): Promise<void> {
    if (!transaction.oicpData || !transaction.oicpData.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: 'OICP Session not started',
        module: MODULE_NAME, method: 'updateSession',
        user: transaction.user
      });
    }
    transaction.oicpData.session.kwh = Utils.createDecimal(transaction.currentTotalConsumptionWh).div(1000).toNumber();
    transaction.oicpData.session.last_updated = transaction.currentTimestamp;
    transaction.oicpData.session.total_cost = transaction.currentCumulatedPrice > 0 ? transaction.currentCumulatedPrice : 0;
    transaction.oicpData.session.currency = this.settings.currency;
    if (transaction.lastConsumption && transaction.lastConsumption.value) {
      transaction.oicpData.session.meterValueInBetween.push(transaction.lastConsumption.value);
    }
    // Call Hubject
    if (transaction.oicpData.session.status === OICPSessionStatus.PENDING) {
      // Send start notification to Hubject when actual energy flow starts
      await this.sendChargingNotificationStart(transaction);
      transaction.oicpData.session.status = OICPSessionStatus.ACTIVE;
    } else {
      // Send progress notification
      await this.sendChargingNotificationProgress(transaction);
    }
  }

  public async stopSession(transaction: Transaction): Promise<void> {
    if (!transaction.oicpData) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'stopSession',
        user: transaction.user
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'stopSession',
        user: transaction.user
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') not yet stopped`,
        module: MODULE_NAME, method: 'stopSession',
        user: transaction.user
      });
    }
    transaction.oicpData.session.kwh = Utils.createDecimal(transaction.stop.totalConsumptionWh).div(1000).toNumber();
    transaction.oicpData.session.total_cost = transaction.stop.roundedPrice > 0 ? transaction.stop.roundedPrice : 0;
    transaction.oicpData.session.end_datetime = transaction.stop.timestamp;
    transaction.oicpData.session.last_updated = transaction.stop.timestamp;
    transaction.oicpData.session.status = OICPSessionStatus.COMPLETED;
    if (transaction.lastConsumption?.value) {
      transaction.oicpData.session.meterValueInBetween.push(transaction.lastConsumption.value);
    }
    // Call Hubject
    await this.sendChargingNotificationEnd(transaction);
    // Stop
    if (transaction.tagID !== OICPDefaultTagId.RemoteIdentification) {
      const response = await this.authorizeStop(transaction);
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') has been stopped successfully`,
        module: MODULE_NAME, method: 'stopSession',
        detailedMessages: { session: transaction.oicpData.session, response }
      });
    }
  }

  public async sendEVSEs(partial = false, actionType?: OICPActionType): Promise<OICPResult> {
    if (!actionType) {
      actionType = OICPActionType.FULL_LOAD;
    }
    if (partial) {
      actionType = OICPActionType.INSERT;
    }
    // Result
    const result = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: []
    } as OICPResult;
    // Perfs trace
    const startTime = new Date().getTime();
    // Define get option
    const options: OCPILocationOptions = {
      addChargeBoxAndOrgIDs: true,
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_DATA),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_DATA)
    };
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    let sites: Site[];
    let currentSiteSkip = 0;
    do {
      // Get the public Sites
      sites = (await SiteStorage.getSites(this.tenant,
        { public: true }, { skip: currentSiteSkip, limit: Constants.DB_RECORD_COUNT_DEFAULT })).result;
      if (!Utils.isEmptyArray(sites)) {
        for (const site of sites) {
          let chargingStations: ChargingStation[];
          let currentChargingStationSkip = 0;
          do {
            // Get all charging stations from tenant
            chargingStations = (await ChargingStationStorage.getChargingStations(this.tenant,
              { siteIDs: [site.id], public: true, withSiteArea: true }, { skip: currentChargingStationSkip, limit: Constants.DB_RECORD_COUNT_DEFAULT })).result;
            if (!Utils.isEmptyArray(chargingStations)) {
              // Convert (public) charging stations to OICP EVSEs
              const evses = await OICPUtils.convertChargingStationsToEVSEs(this.tenant, site, chargingStations, options);
              let evsesToProcess: OICPEvseDataRecord[] = [];
              let chargeBoxIDsToProcessFromInput = [];
              // Check if all EVSEs should be processed - in case of delta send - process only following EVSEs:
              //    - EVSEs (ChargingStations) in error from previous push
              //    - EVSEs (ChargingStations) with status notification from latest pushDate
              if (!partial) {
                evsesToProcess = evses;
                chargeBoxIDsToProcessFromInput = evsesToProcess.map((evse) => evse.ChargingStationID);
              } else {
                let chargeBoxIDsToProcess = [];
                // Get ChargingStation in Failure from previous run
                chargeBoxIDsToProcess.push(...this.getChargeBoxIDsInFailure());
                // Get ChargingStation with new status notification
                chargeBoxIDsToProcess.push(...await this.getChargeBoxIDsWithNewStatusNotifications());
                // Remove duplicates
                chargeBoxIDsToProcess = _.uniq(chargeBoxIDsToProcess);
                // Loop through EVSE
                for (const evse of evses) {
                  if (evse) {
                    // Check if Charging Station should be processed
                    if (!chargeBoxIDsToProcess.includes(evse.ChargingStationID)) {
                      continue;
                    }
                    // Process
                    evsesToProcess.push(evse);
                    chargeBoxIDsToProcessFromInput.push(evse.ChargingStationID);
                  }
                }
              }
              // Only one post request to Hubject for multiple EVSEs
              result.total = evsesToProcess.length;
              if (evsesToProcess.length > OICPBatchSize.EVSE_DATA) {
                // In case of multiple batches:
                // delete all EVSEs on Hubject by overwriting with empty array
                // set action type to insert to avoid overwriting each batch with a full load request
                await this.pushEvseData([], OICPActionType.FULL_LOAD);
                actionType = OICPActionType.INSERT;
              }
              if (evsesToProcess) {
                // Process it if not empty
                do {
                  // Send EVSEs in batches to avoid maxBodyLength limit of request.
                  const evseBatch = evsesToProcess.splice(0, OICPBatchSize.EVSE_DATA);
                  const evseIDBatch = chargeBoxIDsToProcessFromInput.splice(0, OICPBatchSize.EVSE_DATA);
                  try {
                    await this.pushEvseData(evseBatch, actionType);
                    result.success += evseBatch.length;
                  } catch (error) {
                    result.failure += evseBatch.length;
                    result.objectIDsInFailure.push(...evseIDBatch);
                    result.logs.push(
                      `Failed to update the EVSEs from tenant '${this.tenant.id}': ${String(error.message)}`
                    );
                  }
                } while (!Utils.isEmptyArray(evsesToProcess));
              }
            }
            currentChargingStationSkip += Constants.DB_RECORD_COUNT_DEFAULT;
          } while (!Utils.isEmptyArray(chargingStations));
        }
      }
      currentSiteSkip += Constants.DB_RECORD_COUNT_DEFAULT;
    } while (!Utils.isEmptyArray(sites));
    // Send notification to admins
    if (result.failure > 0) {
      NotificationHandler.sendOICPPatchChargingStationsError(
        this.tenant,
        {
          evseDashboardURL: Utils.buildEvseURL(this.tenant.subdomain)
        }
      ).catch((error) => {
        Logging.logPromiseError(error, this.tenant?.id);
      });
    }
    // Save result in oicp endpoint
    this.oicpEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (result) {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: result.success,
        failureNbr: result.failure,
        totalNbr: result.total,
        chargeBoxIDsInFailure: _.uniq(result.objectIDsInFailure),
        chargeBoxIDsInSuccess: []
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
    const executionDurationSecs = Utils.createDecimal(new Date().getTime()).minus(startTime).div(1000).toNumber();
    await OICPEndpointStorage.saveOicpEndpoint(this.tenant, this.oicpEndpoint);
    await Logging.logOicpResult(this.tenant.id, ServerAction.OICP_PUSH_EVSE_DATA,
      MODULE_NAME, 'sendEVSEs', result,
      `{{inSuccess}} EVSE(s) were successfully patched in ${executionDurationSecs}s`,
      `{{inError}} EVSE(s) failed to be patched in ${executionDurationSecs}s`,
      `{{inSuccess}} EVSE(s) were successfully patched and {{inError}} failed to be patched in ${executionDurationSecs}s`,
      'No EVSE has been patched'
    );
    return result;
  }

  public async sendEVSEStatuses(partial = false, actionType?: OICPActionType): Promise<OICPResult> {
    if (!actionType) {
      actionType = OICPActionType.FULL_LOAD;
    }
    if (partial) {
      actionType = OICPActionType.INSERT;
    }
    // Result
    const result = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: []
    } as OICPResult;
    // Perfs trace
    const startTime = new Date().getTime();
    // Define get option
    const options: OCPILocationOptions = {
      addChargeBoxAndOrgIDs: true,
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_STATUSES),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_STATUSES)
    };
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    let sites: Site[];
    let currentSiteSkip = 0;
    do {
      // Get the public Sites
      sites = (await SiteStorage.getSites(this.tenant,
        { public: true }, { skip: currentSiteSkip, limit: Constants.DB_RECORD_COUNT_DEFAULT })).result;
      if (!Utils.isEmptyArray(sites)) {
        for (const site of sites) {
          let chargingStations: ChargingStation[];
          let currentChargingStationSkip = 0;
          do {
            // Get all charging stations from tenant
            chargingStations = (await ChargingStationStorage.getChargingStations(this.tenant,
              { siteIDs: [site.id], public: true, withSiteArea: true }, { skip: currentChargingStationSkip, limit: Constants.DB_RECORD_COUNT_DEFAULT })).result;
            if (!Utils.isEmptyArray(chargingStations)) {
              // Convert (public) charging stations to OICP EVSE Statuses
              const evseStatuses = OICPUtils.convertChargingStationsToEvseStatuses(chargingStations, options);
              let evseStatusesToProcess: OICPEvseStatusRecord[] = [];
              let chargeBoxIDsToProcessFromInput = [];
              // Check if all EVSE Statuses should be processed - in case of delta send - process only following EVSEs:
              //    - EVSEs (ChargingStations) in error from previous push
              //    - EVSEs (ChargingStations) with status notification from latest pushDate
              if (!partial) {
                evseStatusesToProcess = evseStatuses;
                chargeBoxIDsToProcessFromInput = evseStatusesToProcess.map((evseStatus) => evseStatus.ChargingStationID);
              } else {
                let chargeBoxIDsToProcess = [];
                // Get ChargingStation in Failure from previous run
                chargeBoxIDsToProcess.push(...this.getChargeBoxIDsInFailure());
                // Get ChargingStation with new status notification
                chargeBoxIDsToProcess.push(...await this.getChargeBoxIDsWithNewStatusNotifications());
                // Remove duplicates
                chargeBoxIDsToProcess = _.uniq(chargeBoxIDsToProcess);
                // Loop through EVSE statuses
                for (const evseStatus of evseStatuses) {
                  if (evseStatus) {
                    // Check if Charging Station should be processed
                    if (!chargeBoxIDsToProcess.includes(evseStatus.ChargingStationID)) {
                      continue;
                    }
                    // Process
                    evseStatusesToProcess.push(evseStatus);
                    chargeBoxIDsToProcessFromInput.push(evseStatus.ChargingStationID);
                  }
                }
              }
              // Only one post request for multiple EVSE Statuses
              result.total = evseStatusesToProcess.length;
              if (!Utils.isEmptyArray(evseStatusesToProcess)) {
                try {
                  await this.pushEvseStatus(evseStatusesToProcess, actionType);
                  result.success = result.total;
                } catch (error) {
                  result.failure = result.total;
                  result.objectIDsInFailure.push(...chargeBoxIDsToProcessFromInput);
                  result.logs.push(
                    `Failed to update the EVSE Statuses from tenant '${this.tenant.id}': ${String(error.message)}`
                  );
                }
                if (result.failure > 0) {
                  // Send notification to admins
                  NotificationHandler.sendOICPPatchChargingStationsStatusesError(
                    this.tenant,
                    {
                      evseDashboardURL: Utils.buildEvseURL(this.tenant.subdomain)
                    }
                  ).catch((error) => {
                    Logging.logPromiseError(error, this.tenant?.id);
                  });
                }
              }
            }
            currentChargingStationSkip += Constants.DB_RECORD_COUNT_DEFAULT;
          } while (!Utils.isEmptyArray(chargingStations));
        }
      }
      currentSiteSkip += Constants.DB_RECORD_COUNT_DEFAULT;
    } while (!Utils.isEmptyArray(sites));
    // Save result in oicp endpoint
    this.oicpEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (result) {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: result.success,
        failureNbr: result.failure,
        totalNbr: result.total,
        chargeBoxIDsInFailure: _.uniq(result.objectIDsInFailure),
        chargeBoxIDsInSuccess: []
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
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await OICPEndpointStorage.saveOicpEndpoint(this.tenant, this.oicpEndpoint);
    await Logging.logOicpResult(this.tenant.id, ServerAction.OICP_PUSH_EVSE_STATUSES,
      MODULE_NAME, 'sendEVSEStatuses', result,
      `{{inSuccess}} EVSE Status(es) were successfully patched in ${executionDurationSecs}s`,
      `{{inError}} EVSE Status(es) failed to be patched in ${executionDurationSecs}s`,
      `{{inSuccess}} EVSE Status(es) were successfully patched and {{inError}} failed to be patched in ${executionDurationSecs}s`,
      'No EVSE Status has been patched'
    );
    return result;
  }

  public async updateEVSEStatus(chargingStation: ChargingStation, connector: Connector): Promise<OICPAcknowledgment> {
    if (!chargingStation.siteAreaID && !chargingStation.siteArea) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: 'Charging Station must be associated to a site area',
        module: MODULE_NAME, method: 'updateEVSEStatus',
      });
    }
    if (!chargingStation.issuer) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: 'Only charging Station issued locally can be exposed to Hubject',
        module: MODULE_NAME, method: 'updateEVSEStatus',
      });
    }
    if (!chargingStation.public) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: 'Private charging Station cannot be exposed to Hubject',
        module: MODULE_NAME, method: 'updateEVSEStatus',
      });
    }
    // Define get option
    const options: OCPILocationOptions = {
      addChargeBoxAndOrgIDs: true,
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_STATUSES),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_STATUSES)
    };
    const evseStatus = OICPUtils.convertConnector2EvseStatus(chargingStation, connector, options);
    const response = await this.pushEvseStatus([evseStatus], OICPActionType.UPDATE);
    return response;
  }

  public async pushEvseData(evses: OICPEvseDataRecord[], actionType: OICPActionType): Promise<OICPAcknowledgment> {
    this.axiosInstance.defaults.httpsAgent = await this.getHttpsAgent(ServerAction.OICP_CREATE_AXIOS_INSTANCE);
    let pushEvseDataResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!evses) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_DATA,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'pushEvseData',
      });
    }
    // Get EVSE endpoint url
    const fullUrl = this.getEndpointUrl('evses', ServerAction.OICP_PUSH_EVSE_DATA);
    // Build payload
    const operatorEvseData: OICPOperatorEvseData = {} as OICPOperatorEvseData;
    operatorEvseData.OperatorID = this.getOperatorID(ServerAction.OICP_PUSH_EVSE_DATA);
    operatorEvseData.OperatorName = this.tenant.name;
    operatorEvseData.EvseDataRecord = evses;
    const payload = {} as OICPPushEvseDataCpoSend;
    payload.ActionType = actionType;
    payload.OperatorEvseData = operatorEvseData;
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      pushEvseDataResponse = response.data;
    } catch (error) {
      pushEvseDataResponse = error.response?.data;
      requestError = error;
    }
    if (!pushEvseDataResponse?.Result || pushEvseDataResponse?.Result !== true) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_DATA,
        message: this.buildOICPChargingNotificationErrorMessage(pushEvseDataResponse, requestError),
        module: MODULE_NAME, method: 'pushEvseData',
        detailedMessages: {
          error: requestError?.stack,
          evse: payload,
          response: pushEvseDataResponse,
        }
      });
    } else {
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSE_DATA,
        message: `${evses.length} EVSEs have been pushed successfully`,
        module: MODULE_NAME, method: 'pushEvseData',
        detailedMessages: { evses: payload, response: pushEvseDataResponse }
      });
    }
    return pushEvseDataResponse;
  }

  public async pushEvseStatus(evseStatuses: OICPEvseStatusRecord[], actionType: OICPActionType): Promise<OICPAcknowledgment> {
    this.axiosInstance.defaults.httpsAgent = await this.getHttpsAgent(ServerAction.OICP_CREATE_AXIOS_INSTANCE);
    let pushEvseStatusResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!evseStatuses) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_STATUSES,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'pushEvseStatus',
      });
    }
    // Get EVSE Status endpoint url
    const fullUrl = this.getEndpointUrl('statuses', ServerAction.OICP_PUSH_EVSE_STATUSES);
    // Build payload
    const operatorEvseStatus: OICPOperatorEvseStatus = {} as OICPOperatorEvseStatus;
    operatorEvseStatus.OperatorID = this.getOperatorID(ServerAction.OICP_PUSH_EVSE_STATUSES);
    operatorEvseStatus.OperatorName = this.tenant.name;
    operatorEvseStatus.EvseStatusRecord = evseStatuses;
    const payload = {} as OICPPushEvseStatusCpoSend;
    payload.ActionType = actionType;
    payload.OperatorEvseStatus = operatorEvseStatus;
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      pushEvseStatusResponse = response.data;
    } catch (error) {
      pushEvseStatusResponse = error.response?.data;
      requestError = error;
    }
    if (!pushEvseStatusResponse?.Result || pushEvseStatusResponse?.Result !== true) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSE_STATUSES,
        message: this.buildOICPChargingNotificationErrorMessage(pushEvseStatusResponse, requestError),
        module: MODULE_NAME, method: 'pushEvseStatus',
        detailedMessages: {
          error: requestError?.stack,
          evseStatus: payload,
          response: pushEvseStatusResponse,
        }
      });
    } else {
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSE_STATUSES,
        message: `${evseStatuses.length} EVSE Statuses have been pushed successfully`,
        module: MODULE_NAME, method: 'pushEvseStatus',
        detailedMessages: { evses: payload, response: pushEvseStatusResponse }
      });
    }
    return pushEvseStatusResponse;
  }

  public async authorizeStart(tagID: string, transactionId?: number): Promise<OICPAuthorizeStartCpoReceive> {
    this.axiosInstance.defaults.httpsAgent = await this.getHttpsAgent(ServerAction.OICP_CREATE_AXIOS_INSTANCE);
    let authorizeResponse: OICPAuthorizeStartCpoReceive;
    let requestError: any;
    if (!tagID) {
      throw new BackendError({
        action: ServerAction.OICP_AUTHORIZE_START,
        message: 'No Tag ID for OICP Authorization',
        module: MODULE_NAME, method: 'authorizeStart'
      });
    }
    const identification = OICPUtils.convertTagID2OICPIdentification(tagID);
    // Get authorize start endpoint url
    const fullUrl = this.getEndpointUrl('authorizeStart', ServerAction.OICP_AUTHORIZE_START);
    // Build payload
    const payload = {} as OICPAuthorizeStartCpoSend;
    payload.SessionID; // Optional
    if (transactionId) {
      payload.CPOPartnerSessionID = String(transactionId); // Optional
    }
    payload.EMPPartnerSessionID; // Optional
    payload.EvseID; // Optional
    payload.Identification = identification;
    payload.PartnerProductID; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_AUTHORIZE_START);
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      authorizeResponse = response.data;
    } catch (error) {
      authorizeResponse = error.response?.data;
      requestError = error;
    }
    if (requestError) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_AUTHORIZE_START,
        message: this.buildOICPChargingNotificationErrorMessage(authorizeResponse, requestError),
        module: MODULE_NAME, method: 'authorizeStart',
        detailedMessages: {
          error: requestError?.stack,
          authorize: payload,
          response: authorizeResponse,
        }
      });
    }
    if (authorizeResponse?.AuthorizationStatus !== OICPAuthorizationStatus.Authorized) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_AUTHORIZE_START,
        module: MODULE_NAME, method: 'authorizeStart',
        message: `OICP Tag ID '${tagID}' has not been authorized`,
        detailedMessages: { authorize: payload, response: authorizeResponse }
      });
    } else {
      await Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_AUTHORIZE_START,
        message: `OICP Tag ID '${tagID}' has been authorized`,
        module: MODULE_NAME, method: 'authorizeStart',
        detailedMessages: { authorize: payload, response: authorizeResponse }
      });
    }
    return authorizeResponse;
  }

  public async authorizeStop(transaction: Transaction): Promise<OICPAuthorizeStopCpoReceive> {
    const user = transaction.user;
    let authorizeResponse: OICPAuthorizeStopCpoReceive;
    let requestError: any;
    // Check for input parameter
    if (!transaction.oicpData.session) {
      throw new BackendError({
        action: ServerAction.OICP_AUTHORIZE_STOP,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'authorizeStop',
        user: transaction.user
      });
    }
    // Get authorize stop endpoint url
    const fullUrl = this.getEndpointUrl('authorizeStop', ServerAction.OICP_AUTHORIZE_STOP);
    // Build payload
    const payload = {} as OICPAuthorizeStopCpoSend;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_AUTHORIZE_STOP);
    payload.EvseID = transaction.oicpData.session.evse.EvseID; // Optional
    payload.Identification = transaction.oicpData.session.identification;
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      authorizeResponse = response.data;
    } catch (error) {
      authorizeResponse = error.response?.data;
      requestError = error;
    }
    if (requestError) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        user: user,
        action: ServerAction.OICP_AUTHORIZE_STOP,
        message: this.buildOICPChargingNotificationErrorMessage(authorizeResponse, requestError),
        module: MODULE_NAME, method: 'authorizeStop',
        detailedMessages: {
          error: requestError?.stack,
          authorize: payload,
          response: authorizeResponse,
        }
      });
    }
    if (authorizeResponse?.AuthorizationStatus !== OICPAuthorizationStatus.Authorized) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        user: user,
        action: ServerAction.OICP_AUTHORIZE_STOP,
        module: MODULE_NAME, method: 'authorizeStop',
        message: `User ID '${user.id}' is not authorized to Stop a Transaction`,
        detailedMessages: { authorize: payload, response: authorizeResponse }
      });
    } else {
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        user: user,
        action: ServerAction.OICP_AUTHORIZE_STOP,
        message: 'Stop Transaction has been authorized',
        module: MODULE_NAME, method: 'authorizeStop',
        detailedMessages: { authorize: payload, response: authorizeResponse }
      });
    }
    return authorizeResponse;
  }

  public async pushCdr(transaction: Transaction): Promise<OICPAcknowledgment> {
    let pushCdrResponse: OICPAcknowledgment;
    let requestError: any;
    if (!transaction.oicpData) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_PUSH_CDRS,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'pushCdr',
        user: transaction.user
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_PUSH_CDRS,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'pushCdr',
        user: transaction.user
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_PUSH_CDRS,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') has not been stopped`,
        module: MODULE_NAME, method: 'pushCdr',
        user: transaction.user
      });
    }
    // Get CDR endpoint url
    const fullUrl = this.getEndpointUrl('cdr', ServerAction.OICP_PUSH_CDRS);
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
    cdr.MeterValueStart = Utils.convertWattHourToKiloWattHour(transaction.meterStart, 3); // Optional
    cdr.MeterValueEnd = Utils.convertWattHourToKiloWattHour(transaction.stop.meterStop, 3); // Optional
    if (!Utils.isEmptyArray(transaction.oicpData.session.meterValueInBetween)) {
      cdr.MeterValueInBetween = {
        meterValues: transaction.oicpData.session.meterValueInBetween.map(
          (wattHour) => Utils.convertWattHourToKiloWattHour(wattHour, 3))
      }; // Optional
    }
    cdr.ConsumedEnergy = Utils.convertWattHourToKiloWattHour(transaction.stop.totalConsumptionWh, 3); // In kW.h
    cdr.SignedMeteringValues; // Optional
    cdr.CalibrationLawVerificationInfo; // Optional
    cdr.HubOperatorID; // Optional
    cdr.HubProviderID; // Optional
    transaction.oicpData.cdr = cdr;
    const payload = transaction.oicpData.cdr;
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      pushCdrResponse = response.data;
    } catch (error) {
      pushCdrResponse = error.response?.data;
      requestError = error;
    }
    if (!pushCdrResponse?.Result || pushCdrResponse?.Result !== true) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_CDRS,
        message: this.buildOICPChargingNotificationErrorMessage(pushCdrResponse, requestError),
        module: MODULE_NAME, method: 'pushCdr',
        detailedMessages: {
          error: requestError?.stack,
          cdr: payload,
          response: pushCdrResponse,
        }
      });
    } else {
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_CDRS,
        message: `CDR of Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') has been pushed successfully`,
        module: MODULE_NAME, method: 'pushCdr',
        detailedMessages: { cdr: payload, response: pushCdrResponse }
      });
    }
    return pushCdrResponse;
  }

  public async sendChargingNotificationStart(transaction: Transaction): Promise<void> {
    let notificationStartResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationStart',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationStart',
      });
    }
    // Get notification endpoint url
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START);
    // Build payload
    const payload = {} as OICPChargingNotificationStartCpoSend;
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
    payload.MeterValueStart = Utils.convertWattHourToKiloWattHour(transaction.meterStart, 3); // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START); // Optional
    payload.PartnerProductID; // Optional
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      notificationStartResponse = response.data;
    } catch (error) {
      notificationStartResponse = error.response?.data;
      requestError = error;
    }
    if (!notificationStartResponse?.Result || notificationStartResponse?.Result !== true) {
      await Logging.logWarning({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
        message: this.buildOICPChargingNotificationErrorMessage(notificationStartResponse, requestError),
        module: MODULE_NAME, method: 'sendChargingNotificationStart',
        detailedMessages: {
          chargingStart: payload,
          error: requestError?.stack,
          response: notificationStartResponse,
        }
      });
    } else {
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
        message: `Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') has been started successfully`,
        module: MODULE_NAME, method: 'sendChargingNotificationStart',
        detailedMessages: { chargingStart: payload, response: notificationStartResponse }
      });
    }
  }

  public async sendChargingNotificationProgress(transaction: Transaction): Promise<void> {
    if (this.checkProgressUpdateInterval(transaction)) {
      let notificationProgressResponse: OICPAcknowledgment;
      let requestError: any;
      // Check for input parameter
      if (!transaction.oicpData) {
        throw new BackendError({
          ...LoggingHelper.getTransactionProperties(transaction),
          action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
          message: `OICP data does not exists on Session ID '${transaction.id}'`,
          module: MODULE_NAME, method: 'sendChargingNotificationProgress',
        });
      }
      if (!transaction.oicpData.session) {
        throw new BackendError({
          ...LoggingHelper.getTransactionProperties(transaction),
          action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
          message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
          module: MODULE_NAME, method: 'sendChargingNotificationProgress',
        });
      }
      // Get notification endpoint url
      const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS);
      // Build payload
      const payload = {} as OICPChargingNotificationProgressCpoSend;
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
      payload.ChargingDuration = Utils.createDecimal(transaction.currentTimestamp.getTime()).minus(transaction.timestamp.getTime()).toNumber(); // Optional Duration in milliseconds (Integer). Charging Duration = EventOccurred - Charging Duration. Same as transaction.currentTotalDurationSecs * 1000?
      payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
      payload.ConsumedEnergyProgress = Utils.convertWattHourToKiloWattHour(transaction.currentTotalConsumptionWh, 3); // In kW.h Optional
      payload.MeterValueStart = Utils.convertWattHourToKiloWattHour(transaction.meterStart, 3); // Optional
      payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS); // Optional
      payload.PartnerProductID; // Optional
      // Call Hubject
      try {
        const response = await this.axiosInstance.post(fullUrl, payload);
        notificationProgressResponse = response.data;
      } catch (error) {
        notificationProgressResponse = error.response?.data;
        requestError = error;
      }
      transaction.oicpData.session.last_progress_notification = new Date();
      if (!notificationProgressResponse?.Result || notificationProgressResponse?.Result !== true) {
        await Logging.logWarning({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: this.tenant.id,
          action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
          message: this.buildOICPChargingNotificationErrorMessage(notificationProgressResponse, requestError),
          module: MODULE_NAME, method: 'sendChargingNotificationProgress',
          detailedMessages: {
            error: requestError?.stack,
            chargingProgress: payload,
            response: notificationProgressResponse,
          }
        });
      } else {
        await Logging.logInfo({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: this.tenant.id,
          action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
          message: `Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') has been updated successfully`,
          module: MODULE_NAME, method: 'sendChargingNotificationProgress',
          detailedMessages: { chargingProgress: payload, response: notificationProgressResponse }
        });
      }
    }
  }

  public async sendChargingNotificationEnd(transaction: Transaction): Promise<OICPAcknowledgment> {
    let notificationEndResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') not stopped`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
      });
    }
    // Get notification endpoint url
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END);
    // Build payload
    const payload = {} as OICPChargingNotificationEndCpoSend;
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
    payload.ConsumedEnergy = Utils.convertWattHourToKiloWattHour(transaction.stop.totalConsumptionWh, 3);
    payload.MeterValueStart = Utils.convertWattHourToKiloWattHour(transaction.meterStart, 3); // Optional. kw or kWh?
    payload.MeterValueEnd = Utils.convertWattHourToKiloWattHour(transaction.stop.meterStop, 3); // Optional. kW or kWh?
    payload.MeterValueInBetween = {
      meterValues: transaction.oicpData.session.meterValueInBetween.map(
        (wattHour) => Utils.convertWattHourToKiloWattHour(wattHour, 3))
    }; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END); // Optional
    payload.PartnerProductID; // Optional
    payload.PenaltyTimeStart = transaction.stop.timestamp; // Optional
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      notificationEndResponse = response.data;
    } catch (error) {
      notificationEndResponse = error.response?.data;
      requestError = error;
    }
    if (!notificationEndResponse?.Result || notificationEndResponse?.Result !== true) {
      await Logging.logWarning({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: this.buildOICPChargingNotificationErrorMessage(notificationEndResponse, requestError),
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
        detailedMessages: {
          error: requestError?.stack,
          chargingEnd: payload,
          response: notificationEndResponse,
        }
      });
    } else {
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') has been ended successfully`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
        detailedMessages: { chargingEnd: payload, response: notificationEndResponse }
      });
    }
    return notificationEndResponse;
  }

  public async sendChargingNotificationError(transaction: Transaction, error: OICPErrorClass, errorAdditionalInfo?: string): Promise<OICPAcknowledgment> {
    let notificationErrorResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationError',
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationError',
      });
    }
    // Get notification endpoint url
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR);
    // Build payload
    const payload = {} as OICPChargingNotificationErrorCpoSend;
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
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      notificationErrorResponse = response.data;
    } catch (err) {
      notificationErrorResponse = err.response?.data;
      requestError = err;
    }
    if (!notificationErrorResponse?.Result || notificationErrorResponse?.Result !== true) {
      await Logging.logWarning({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
        message: this.buildOICPChargingNotificationErrorMessage(notificationErrorResponse, requestError),
        module: MODULE_NAME, method: 'sendChargingNotificationError',
        detailedMessages: {
          error: requestError?.stack,
          chargingError: payload,
          response: notificationErrorResponse,
        }
      });
    }
    return notificationErrorResponse;
  }

  public async ping(): Promise<any> {
    const pingResult: any = {};
    // Try to access base Url (GET .../versions)
    // Access versions API
    try {
      // Get versions
      const response = await this.pingEvseEndpoint();
      // Check response
      if (!response.Result || !(response.StatusCode.Code === OICPStatusCode.Code000)) {
        pingResult.statusCode = StatusCodes.PRECONDITION_FAILED;
        pingResult.statusText = `Invalid response from POST ${this.getEndpointUrl('evses',ServerAction.OICP_PUSH_EVSE_DATA)}`;
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

  private async pingEvseEndpoint(): Promise<any> {
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_EVSE_DATA,
      message: `Ping Hubject at ${this.getEndpointUrl('evses',ServerAction.OICP_PUSH_EVSE_DATA)}`,
      module: MODULE_NAME, method: 'pingEvseEndpoint'
    });
    const response = await this.pushEvseData([], OICPActionType.INSERT);
    return response;
  }

  private getChargeBoxIDsInFailure(): string[] {
    if (this.oicpEndpoint.lastPatchJobResult && this.oicpEndpoint.lastPatchJobResult.chargeBoxIDsInFailure) {
      return this.oicpEndpoint.lastPatchJobResult.chargeBoxIDsInFailure;
    }
    return [];
  }

  private checkProgressUpdateInterval(transaction: Transaction): boolean {
    // Hubject restriction: "Progress Notification can be sent only at interval of at least 300 seconds." (5 Minutes)
    let lastProgressUpdate = 0;
    if (transaction.oicpData.session.last_progress_notification) {
      const currentTime = new Date().getTime();
      const lastProgressUpdateTime = transaction.oicpData.session.last_progress_notification.getTime();
      lastProgressUpdate = ((currentTime - lastProgressUpdateTime) / 1000); // Difference in seconds
    }
    if (lastProgressUpdate >= Constants.OICP_PROGRESS_NOTIFICATION_MAX_INTERVAL || lastProgressUpdate === 0) {
      return true;
    }
    return false;
  }

  private async getChargeBoxIDsWithNewStatusNotifications(): Promise<string[]> {
    // Get last job
    const lastPatchJobOn = this.oicpEndpoint.lastPatchJobOn ? this.oicpEndpoint.lastPatchJobOn : new Date();
    // Build params
    const params = { 'dateFrom': lastPatchJobOn };
    // Get last status notifications
    const statusNotificationsResult = await OCPPStorage.getStatusNotifications(this.tenant, params, Constants.DB_PARAMS_MAX_LIMIT);
    // Loop through notifications
    if (statusNotificationsResult.count > 0) {
      return statusNotificationsResult.result.map((statusNotification) => statusNotification.chargeBoxID);
    }
    return [];
  }

  private buildOICPChargingNotificationErrorMessage(notificationProgressResponse: OICPAcknowledgment | OICPAuthorizeStopCpoReceive, requestError: Error): string {
    let errorMessage = '';
    if (notificationProgressResponse) {
      errorMessage = notificationProgressResponse?.StatusCode?.AdditionalInfo?.length > 0 ?
        notificationProgressResponse?.StatusCode?.AdditionalInfo : notificationProgressResponse?.StatusCode?.Description;
    }
    if (requestError) {
      if (errorMessage.length > 0) {
        errorMessage += ' ';
      }
      errorMessage += requestError.message;
    }
    return errorMessage;
  }
}
