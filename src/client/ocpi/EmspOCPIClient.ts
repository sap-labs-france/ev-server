import axios from 'axios';
import _ from 'lodash';
import moment from 'moment';
import uuid from 'uuid';
import BackendError from '../../exception/BackendError';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import OCPISessionsService from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPISessionsService';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import CompanyStorage from '../../storage/mongodb/CompanyStorage';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import { Action } from '../../types/Authorization';
import ChargingStation from '../../types/ChargingStation';
import Company from '../../types/Company';
import { OCPICommandResponse } from '../../types/ocpi/OCPICommandResponse';
import { OCPICommandType } from '../../types/ocpi/OCPICommandType';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import { OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';
import { OCPILocation } from '../../types/ocpi/OCPILocation';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { OCPIStartSession } from '../../types/ocpi/OCPIStartSession';
import { OCPIStopSession } from '../../types/ocpi/OCPIStopSession';
import { OCPIToken, OCPITokenType, OCPITokenWhitelist } from '../../types/ocpi/OCPIToken';
import { OcpiSetting } from '../../types/Setting';
import Site from '../../types/Site';
import SiteArea from '../../types/SiteArea';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import OCPIClient from './OCPIClient';

const MODULE_NAME = 'EmspOCPIClient';

export default class EmspOCPIClient extends OCPIClient {
  constructor(tenant: Tenant, settings: OcpiSetting, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, OCPIRole.EMSP);
    if (ocpiEndpoint.role !== OCPIRole.EMSP) {
      throw new BackendError({
        message: `EmspOCPIClient requires Ocpi Endpoint with role ${OCPIRole.EMSP}`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
  }

  async sendTokens() {
    // Result
    const sendResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      tokenIDsInFailure: [],
      tokenIDsInSuccess: []
    };
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    // Get all tokens
    const tokensResult = await OCPIMapping.getAllTokens(this.tenant, 0, 0);
    for (const token of tokensResult.result) {
      sendResult.total++;
      try {
        await this.pushToken(token);
        sendResult.success++;
        sendResult.tokenIDsInSuccess.push(token.uid);
        sendResult.logs.push(
          `Token ${token.uid} successfully updated`
        );
      } catch (error) {
        sendResult.failure++;
        sendResult.tokenIDsInFailure.push(token.uid);
        sendResult.logs.push(
          `Failure updating token:${token.uid}:${error.message}`
        );
      }
    }
    // Log error if any
    if (sendResult.failure > 0) {
      // Log error if failure
      Logging.logError({
        tenantID: this.tenant.id,
        action: Action.OCPI_PUSH_TOKENS,
        message: `Patching of ${sendResult.logs.length} tokens has been done with errors (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendTokens'
      });
    } else if (sendResult.success > 0) {
      // Log info
      Logging.logInfo({
        tenantID: this.tenant.id,
        action: Action.OCPI_PUSH_TOKENS,
        message: `Patching of ${sendResult.logs.length} tokens has been done successfully (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendTokens'
      });
    }
    // Save result in ocpi endpoint
    this.ocpiEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (sendResult) {
      this.ocpiEndpoint.lastPatchJobResult = {
        'successNbr': sendResult.success,
        'failureNbr': sendResult.failure,
        'totalNbr': sendResult.total,
        'tokenIDsInFailure': _.uniq(sendResult.tokenIDsInFailure),
        'tokenIDsInSuccess': _.uniq(sendResult.tokenIDsInSuccess)
      };
    } else {
      this.ocpiEndpoint.lastPatchJobResult = {
        'successNbr': 0,
        'failureNbr': 0,
        'totalNbr': 0,
        'tokenIDsInFailure': [],
        'tokenIDsInSuccess': []
      };
    }
    // Save
    await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant.id, this.ocpiEndpoint);
    // Return result
    return sendResult;
  }

  async getCompany(): Promise<Company> {
    let company = await CompanyStorage.getCompany(this.tenant.id, this.ocpiEndpoint.id);
    if (!company) {
      company = {
        id: this.ocpiEndpoint.id,
        name: this.ocpiEndpoint.name,
        issuer: false,
        createdOn: new Date()
      } as Company;
      await CompanyStorage.saveCompany(this.tenant.id, company, false);
    }
    return company;
  }

  async pullLocations(partial = true) {
    // Result
    const sendResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Get locations endpoint url
    let locationsUrl = this.getEndpointUrl('locations', Action.OCPI_PULL_LOCATIONS);
    if (partial) {
      const momentFrom = moment().utc().subtract(1, 'days').startOf('day');
      locationsUrl = `${locationsUrl}?date_from=${momentFrom.format()}&limit=5`;
    } else {
      locationsUrl = `${locationsUrl}?limit=5`;
    }
    const company = await this.getCompany();
    const sites = await SiteStorage.getSites(this.tenant.id, { companyIDs: [company.id] },
      Constants.DB_PARAMS_MAX_LIMIT);
    let nextResult = true;
    while (nextResult) {
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: Action.OCPI_PULL_LOCATIONS,
        message: `Retrieve locations at ${locationsUrl}`,
        module: MODULE_NAME, method: 'pullLocations'
      });
      // Call IOP
      const response = await axios.get(locationsUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
          timeout: 10000
        });
      // Check response
      if (response.status !== 200 || !response.data) {
        throw new BackendError({
          action: Action.OCPI_PULL_LOCATIONS,
          message: `Invalid response code ${response.status} from Get locations`,
          module: MODULE_NAME, method: 'pullLocations',
        });
      }
      if (!response.data.data) {
        throw new BackendError({
          action: Action.OCPI_PULL_LOCATIONS,
          message: 'Invalid response from Get locations',
          module: MODULE_NAME, method: 'pullLocations',
          detailedMessages: { response: response.data }
        });
      }
      for (const location of response.data.data) {
        try {
          await this.processLocation(location, company, sites.result);
          sendResult.success++;
          sendResult.logs.push(
            `Location ${location.name} successfully updated`
          );
        } catch (error) {
          sendResult.failure++;
          sendResult.logs.push(
            `Failure updating location:${location.name}:${error.message}`
          );
        }
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== locationsUrl) {
        locationsUrl = nextUrl;
      } else {
        nextResult = false;
      }
    }
    return sendResult;
  }

  async pullSessions() {
    // Result
    const sendResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Get sessions endpoint url
    let sessionsUrl = this.getEndpointUrl('sessions', Action.OCPI_PULL_SESSIONS);
    const momentFrom = moment().utc().subtract(2, 'days').startOf('day');
    sessionsUrl = `${sessionsUrl}?date_from=${momentFrom.format()}&limit=20`;
    let nextResult = true;
    while (nextResult) {
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: Action.OCPI_PULL_SESSIONS,
        message: `Retrieve sessions at ${sessionsUrl}`,
        module: MODULE_NAME, method: 'pullSessions'
      });
      // Call IOP
      const response = await axios.get(sessionsUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
          timeout: 10000
        });
      // Check response
      if (response.status !== 200 || !response.data) {
        throw new BackendError({
          action: Action.OCPI_PULL_SESSIONS,
          message: `Invalid response code ${response.status} from Get sessions`,
          module: MODULE_NAME, method: 'pullSessions',
        });
      }
      if (!response.data.data) {
        throw new BackendError({
          action: Action.OCPI_PULL_SESSIONS,
          message: 'Invalid response from Get sessions',
          module: MODULE_NAME, method: 'pullSessions',
          detailedMessages: { response: response.data }
        });
      }
      for (const session of response.data.data) {
        try {
          await OCPISessionsService.updateTransaction(this.tenant.id, session);
          sendResult.success++;
          sendResult.logs.push(
            `Session ${session.id} successfully updated`
          );
        } catch (error) {
          sendResult.failure++;
          sendResult.logs.push(
            `Failure updating session:${session.id}:${error.message}`
          );
        }
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== sessionsUrl) {
        sessionsUrl = nextUrl;
      } else {
        nextResult = false;
      }
    }
    sendResult.total = sendResult.failure + sendResult.success;
    return sendResult;
  }

  async pullCdrs() {
    // Result
    const sendResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Get cdrs endpoint url
    let cdrsUrl = this.getEndpointUrl('cdrs', Action.OCPI_PULL_CDRS);
    const momentFrom = moment().utc().subtract(2, 'days').startOf('day');
    cdrsUrl = `${cdrsUrl}?date_from=${momentFrom.format()}&limit=20`;
    let nextResult = true;
    while (nextResult) {
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: Action.OCPI_PULL_CDRS,
        message: `Retrieve cdrs at ${cdrsUrl}`,
        module: MODULE_NAME, method: 'pullCdrs'
      });
      // Call IOP
      const response = await axios.get(cdrsUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
          timeout: 10000
        });
      // Check response
      if (response.status !== 200 || !response.data) {
        throw new BackendError({
          action: Action.OCPI_PULL_CDRS,
          message: `Get cdrs failed with status ${response.status}`,
          module: MODULE_NAME, method: 'pullCdrs',
          detailedMessages: { response: response.data }
        });
      }
      if (!response.data.data) {
        throw new BackendError({
          action: Action.OCPI_PULL_CDRS,
          message: 'Invalid response from Get cdrs',
          module: MODULE_NAME, method: 'pullCdrs',
          detailedMessages: { response: response.data }
        });
      }
      for (const cdr of response.data.data) {
        try {
          await OCPISessionsService.processCdr(this.tenant.id, cdr);
          sendResult.success++;
          sendResult.logs.push(
            `Cdr ${cdr.id} successfully updated`
          );
        } catch (error) {
          sendResult.failure++;
          sendResult.logs.push(
            `Failure updating cdr:${cdr.id}:${error.message}`
          );
        }
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== cdrsUrl) {
        cdrsUrl = nextUrl;
      } else {
        nextResult = false;
      }
    }
    sendResult.total = sendResult.failure + sendResult.success;
    return sendResult;
  }

  async processLocation(location: OCPILocation, company: Company, sites: Site[]) {
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PULL_LOCATIONS,
      message: `Processing location ${location.name} with id ${location.id}`,
      module: MODULE_NAME, method: 'processLocation',
      detailedMessages: location
    });
    let site: Site;
    const siteName = location.operator && location.operator.name ? location.operator.name
      : OCPIUtils.buildOperatorName(this.ocpiEndpoint.countryCode, this.ocpiEndpoint.partyId);
    site = sites.find((value) => value.name === siteName);
    if (!site) {
      site = {
        name: siteName,
        createdOn: new Date(),
        companyID: company.id,
        issuer: false,
        address: {
          address1: location.address,
          postalCode: location.postal_code,
          city: location.city,
          country: location.country,
          coordinates: []
        }
      } as Site;
      if (location.coordinates && location.coordinates.latitude && location.coordinates.longitude) {
        site.address.coordinates = [
          Number.parseFloat(location.coordinates.longitude),
          Number.parseFloat(location.coordinates.latitude)
        ];
      }
      site.id = await SiteStorage.saveSite(this.tenant.id, site, false);
      sites.push(site);
    }
    const locationName = site.name + '-' + location.id;
    const siteAreas = await SiteAreaStorage.getSiteAreas(this.tenant.id, {
      siteIDs: [site.id],
      search: locationName
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    let siteArea = siteAreas && siteAreas.result.length === 1 ? siteAreas.result[0] : null;
    if (!siteArea) {
      siteArea = {
        name: locationName,
        createdOn: new Date(),
        siteID: site.id,
        issuer: false,
        address: {
          address1: location.address,
          address2: location.name,
          postalCode: location.postal_code,
          city: location.city,
          country: location.country,
          coordinates: []
        }
      } as SiteArea;
      if (location.coordinates && location.coordinates.latitude && location.coordinates.longitude) {
        siteArea.address.coordinates = [
          Number.parseFloat(location.coordinates.longitude),
          Number.parseFloat(location.coordinates.latitude)
        ];
      }
      siteArea.id = await SiteAreaStorage.saveSiteArea(this.tenant.id, siteArea, false);
    }
    if (location.evses && location.evses.length > 0) {
      for (const evse of location.evses) {
        const chargingStationId = OCPIUtils.buildChargingStationId(location.id, evse.uid);
        if (!evse.uid) {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: Action.OCPI_PULL_LOCATIONS,
            message: `Missing evse uid of location ${location.name}`,
            module: MODULE_NAME, method: 'processLocation',
            detailedMessages: location
          });
        } else if (evse.status === OCPIEvseStatus.REMOVED) {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: Action.OCPI_PULL_LOCATIONS,
            message: `Delete removed evse ${chargingStationId} of location ${location.name}`,
            module: MODULE_NAME, method: 'processLocation',
            detailedMessages: location
          });
          await ChargingStationStorage.deleteChargingStation(this.tenant.id, chargingStationId);
        } else {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: Action.OCPI_PULL_LOCATIONS,
            message: `Update evse ${chargingStationId} of location ${location.name}`,
            module: MODULE_NAME, method: 'processLocation',
            detailedMessages: location
          });
          const chargingStation = OCPIMapping.convertEvseToChargingStation(chargingStationId, evse, location);
          chargingStation.siteAreaID = siteArea.id;
          await ChargingStationStorage.saveChargingStation(Action.OCPI_GET_LOCATIONS, this.tenant.id, chargingStation);
        }
      }
    }
  }

  async pushToken(token: OCPIToken) {
    // Get tokens endpoint url
    const tokensUrl = this.getEndpointUrl('tokens', Action.OCPI_PUSH_TOKENS);
    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode(Action.OCPI_PUSH_TOKENS);
    const partyID = this.getLocalPartyID(Action.OCPI_PUSH_TOKENS);
    // Build url to IOP
    const fullUrl = tokensUrl + `/${countryCode}/${partyID}/${token.uid}`;
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_TOKENS,
      message: `Put token at ${fullUrl}`,
      module: MODULE_NAME, method: 'pushToken',
      detailedMessages: { token }
    });
    // Call IOP
    const response = await axios.put(fullUrl, token,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    // Check response
    if (!response.data) {
      throw new BackendError({
        action: Action.OCPI_PUSH_TOKENS,
        message: `Push token failed with status ${JSON.stringify(response)}`,
        module: MODULE_NAME, method: 'pushToken',
        detailedMessages: { response: response.data }
      });
    }
  }

  async remoteStartSession(chargingStation: ChargingStation, connectorId: number, tagId: string): Promise<OCPICommandResponse> {
    // Get command endpoint url
    const commandUrl = this.getEndpointUrl('commands', Action.OCPI_START_SESSION) + '/' + OCPICommandType.START_SESSION;
    const user = await UserStorage.getUserByTagId(this.tenant.id, tagId);
    if (!user || user.deleted || !user.issuer) {
      throw new BackendError({
        action: Action.OCPI_START_SESSION,
        message: `OCPI Remote Start session is not available for user with tag id ${tagId}`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { user: user }
      });
    }
    const tag = user.tags.find((value) => value.id === tagId);
    if (!tag || !tag.issuer || !tag.active) {
      throw new BackendError({
        action: Action.OCPI_START_SESSION,
        message: `OCPI Remote Start session is not available for tag id ${tagId}`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { tag: tag }
      });
    }
    const token: OCPIToken = {
      uid: tag.id,
      type: OCPITokenType.RFID,
      auth_id: user.id,
      visual_number: user.id,
      issuer: this.tenant.name,
      valid: true,
      whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
      last_updated: new Date()
    };
    const payload: OCPIStartSession = {
      response_url: commandUrl + '/' + uuid(),
      token: token,
      evse_uid: chargingStation.imsi,
      location_id: chargingStation.iccid
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_START_SESSION,
      message: `OCPI Remote Start session at ${commandUrl}`,
      module: MODULE_NAME, method: 'remoteStartSession',
      detailedMessages: { payload }
    });
    // Call IOP
    const response = await axios.post(commandUrl, payload,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    // Check response
    if (!response.data) {
      throw new BackendError({
        action: Action.OCPI_START_SESSION,
        message: `OCPI Remote Start session failed with status ${JSON.stringify(response)}`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { response: response.data }
      });
    }
    if (!response.data.data) {
      throw new BackendError({
        action: Action.OCPI_START_SESSION,
        message: 'OCPI Remote Start session response is invalid',
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { response: response.data }
      });
    }
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_START_SESSION,
      message: `OCPI Remote Start session response status ${response.status}`,
      module: MODULE_NAME, method: 'remoteStartSession',
      detailedMessages: { response: response.data }
    });
    return response.data.data as OCPICommandResponse;
  }

  async remoteStopSession(transactionId: number): Promise<OCPICommandResponse> {
    // Get command endpoint url
    const commandUrl = this.getEndpointUrl('commands', Action.OCPI_START_SESSION) + '/' + OCPICommandType.STOP_SESSION;
    const transaction = await TransactionStorage.getTransaction(this.tenant.id, transactionId);
    if (!transaction || !transaction.ocpiSession || transaction.issuer) {
      throw new BackendError({
        action: Action.OCPI_START_SESSION,
        message: `OCPI Remote Stop session is not available for the transaction ${transactionId}`,
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { transaction: transaction }
      });
    }
    const payload: OCPIStopSession = {
      response_url: commandUrl + '/' + uuid(),
      session_id: transaction.ocpiSession.id
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_STOP_SESSION,
      message: `OCPI Remote Stop session at ${commandUrl}`,
      module: MODULE_NAME, method: 'remoteStopSession',
      detailedMessages: { payload }
    });
    // Call IOP
    const response = await axios.post(commandUrl, payload,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    // Check response
    if (!response.data) {
      throw new BackendError({
        action: Action.OCPI_STOP_SESSION,
        message: `OCPI Remote Stop session failed with status ${response.status}`,
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { response: response.data }
      });
    }
    if (!response.data.data) {
      throw new BackendError({
        action: Action.OCPI_STOP_SESSION,
        message: 'OCPI Remote Stop session response is invalid',
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { response: response.data }
      });
    }
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_STOP_SESSION,
      message: `OCPI Remote Stop session response status ${response.status}`,
      module: MODULE_NAME, method: 'remoteStopSession',
      detailedMessages: { response: response.data }
    });
    return response.data.data as OCPICommandResponse;
  }

  async triggerJobs() {
    return {
      tokens: await this.sendTokens(),
      locations: await this.pullLocations(false),
      sessions: await this.pullSessions(),
      cdrs: await this.pullCdrs(),
    };
  }
}
