import { OCPIToken, OCPITokenType, OCPITokenWhitelist } from '../../types/ocpi/OCPIToken';

import BackendError from '../../exception/BackendError';
import ChargingStation from '../../types/ChargingStation';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Company from '../../types/Company';
import CompanyStorage from '../../storage/mongodb/CompanyStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { OCPICdr } from '../../types/ocpi/OCPICdr';
import OCPIClient from './OCPIClient';
import { OCPICommandResponse } from '../../types/ocpi/OCPICommandResponse';
import { OCPICommandType } from '../../types/ocpi/OCPICommandType';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import { OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';
import { OCPILocation } from '../../types/ocpi/OCPILocation';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import { OCPIResult } from '../../types/ocpi/OCPIResult';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { OCPISession } from '../../types/ocpi/OCPISession';
import OCPISessionsService from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPISessionsService';
import { OCPIStartSession } from '../../types/ocpi/OCPIStartSession';
import { OCPIStopSession } from '../../types/ocpi/OCPIStopSession';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import { OcpiSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteArea from '../../types/SiteArea';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import _ from 'lodash';
import moment from 'moment';

const MODULE_NAME = 'EmspOCPIClient';

export default class EmspOCPIClient extends OCPIClient {
  constructor(tenant: Tenant, settings: OcpiSetting, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, OCPIRole.EMSP);
    if (ocpiEndpoint.role !== OCPIRole.EMSP) {
      throw new BackendError({
        message: `EmspOCPIClient requires OCPI Endpoint with role ${OCPIRole.EMSP}`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
  }

  async sendTokens(): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: [],
    };
    // Perfs trace
    const startTime = new Date().getTime();
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    // Get all tokens
    const tokensResult = await OCPIMapping.getAllTokens(this.tenant, 0, 0);
    for (const token of tokensResult.result) {
      result.total++;
      try {
        await this.pushToken(token);
        result.success++;
      } catch (error) {
        result.failure++;
        result.objectIDsInFailure.push(token.uid);
        result.logs.push(
          `Failed to update Token ID '${token.uid}': ${error.message}`
        );
      }
    }
    // Save result in ocpi endpoint
    this.ocpiEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (result) {
      this.ocpiEndpoint.lastPatchJobResult = {
        'successNbr': result.success,
        'failureNbr': result.failure,
        'totalNbr': result.total,
        'tokenIDsInFailure': _.uniq(result.objectIDsInFailure),
      };
    } else {
      this.ocpiEndpoint.lastPatchJobResult = {
        'successNbr': 0,
        'failureNbr': 0,
        'totalNbr': 0,
        'tokenIDsInFailure': [],
      };
    }
    // Save
    await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant.id, this.ocpiEndpoint);
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    Utils.logOcpiResult(this.tenant.id, ServerAction.OCPI_PUSH_TOKENS,
      MODULE_NAME, 'sendTokens', result,
      `{{inSuccess}} Token(s) were successfully pushed in ${executionDurationSecs}s`,
      `{{inError}} Token(s) failed to be pushed in ${executionDurationSecs}s`,
      `{{inSuccess}} Token(s) were successfully pushed and {{inError}} failed to be pushed in ${executionDurationSecs}s`,
      'No Tokens have been pushed'
    );
    return result;
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

  async pullLocations(partial = true): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Perfs trace
    const startTime = new Date().getTime();
    // Get locations endpoint url
    let locationsUrl = this.getEndpointUrl('locations', ServerAction.OCPI_PULL_LOCATIONS);
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
    do {
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_PULL_LOCATIONS,
        message: `Retrieve locations from ${locationsUrl}`,
        module: MODULE_NAME, method: 'pullLocations'
      });
      // Call IOP
      const response = await this.axiosInstance.get(locationsUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
        });
      for (const location of response.data.data as OCPILocation[]) {
        try {
          await this.processLocation(location, company, sites.result);
          result.success++;
        } catch (error) {
          result.failure++;
          result.logs.push(
            `Failed to update Location '${location.name}': ${error.message}`
          );
        }
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== locationsUrl) {
        locationsUrl = nextUrl;
      } else {
        nextResult = false;
      }
    } while (nextResult);
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    Utils.logOcpiResult(this.tenant.id, ServerAction.OCPI_PULL_LOCATIONS,
      MODULE_NAME, 'pullLocations', result,
      `{{inSuccess}} Location(s) were successfully pulled in ${executionDurationSecs}s`,
      `{{inError}} Location(s) failed to be pulled in ${executionDurationSecs}s`,
      `{{inSuccess}} Location(s) were successfully pulled and {{inError}} failed to be pulled in ${executionDurationSecs}s`,
      'No Locations have been pulled'
    );
    return result;
  }

  async pullSessions(): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Perfs trace
    const startTime = new Date().getTime();
    // Get sessions endpoint url
    let sessionsUrl = this.getEndpointUrl('sessions', ServerAction.OCPI_PULL_SESSIONS);
    const momentFrom = moment().utc().subtract(2, 'days').startOf('day');
    sessionsUrl = `${sessionsUrl}?date_from=${momentFrom.format()}&limit=10`;
    let nextResult = true;
    do {
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_PULL_SESSIONS,
        message: `Retrieve OCPI Sessions from ${sessionsUrl}`,
        module: MODULE_NAME, method: 'pullSessions'
      });
      // Call IOP
      const response = await this.axiosInstance.get(sessionsUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
        });
      for (const session of response.data.data as OCPISession[]) {
        try {
          await OCPISessionsService.updateTransaction(this.tenant.id, session);
          result.success++;
        } catch (error) {
          result.failure++;
          result.logs.push(
            `Failed to update OCPI Transaction ID '${session.id}': ${error.message}`
          );
        }
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== sessionsUrl) {
        sessionsUrl = nextUrl;
      } else {
        nextResult = false;
      }
    } while (nextResult);
    result.total = result.failure + result.success;
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    Utils.logOcpiResult(this.tenant.id, ServerAction.OCPI_PULL_SESSIONS,
      MODULE_NAME, 'pullSessions', result,
      `{{inSuccess}} Session(s) were successfully pulled in ${executionDurationSecs}s`,
      `{{inError}} Session(s) failed to be pulled in ${executionDurationSecs}s`,
      `{{inSuccess}} Session(s) were successfully pulled and {{inError}} failed to be pulled in ${executionDurationSecs}s`,
      'No Sessions have been pulled'
    );
    return result;
  }

  async pullCdrs(): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Perfs trace
    const startTime = new Date().getTime();
    // Get cdrs endpoint url
    let cdrsUrl = this.getEndpointUrl('cdrs', ServerAction.OCPI_PULL_CDRS);
    const momentFrom = moment().utc().subtract(2, 'days').startOf('day');
    cdrsUrl = `${cdrsUrl}?date_from=${momentFrom.format()}&limit=10`;
    let nextResult = true;
    do {
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_PULL_CDRS,
        message: `Retrieve CDRs from ${cdrsUrl}`,
        module: MODULE_NAME, method: 'pullCdrs'
      });
      // Call IOP
      const response = await this.axiosInstance.get(cdrsUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
        });
      for (const cdr of response.data.data as OCPICdr[]) {
        try {
          await OCPISessionsService.processCdr(this.tenant.id, cdr);
          result.success++;
        } catch (error) {
          result.failure++;
          result.logs.push(
            `Failed to update CDR ID '${cdr.id}': ${error.message}`
          );
        }
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== cdrsUrl) {
        cdrsUrl = nextUrl;
      } else {
        nextResult = false;
      }
    } while (nextResult);
    result.total = result.failure + result.success;
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    Utils.logOcpiResult(this.tenant.id, ServerAction.OCPI_PULL_CDRS,
      MODULE_NAME, 'pullCdrs', result,
      `{{inSuccess}} CDR(s) were successfully pulled in ${executionDurationSecs}s`,
      `{{inError}} CDR(s) failed to be pulled in ${executionDurationSecs}s`,
      `{{inSuccess}} CDR(s) were successfully pulled and {{inError}} failed to be pulled in ${executionDurationSecs}s`,
      'No CDRs have been pulled'
    );
    return result;
  }

  async processLocation(location: OCPILocation, company: Company, sites: Site[]): Promise<void> {
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_PULL_LOCATIONS,
      message: `Processing Location '${location.name}' with ID '${location.id}'`,
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
          Utils.convertToFloat(location.coordinates.longitude),
          Utils.convertToFloat(location.coordinates.latitude)
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
          Utils.convertToFloat(location.coordinates.longitude),
          Utils.convertToFloat(location.coordinates.latitude)
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
            action: ServerAction.OCPI_PULL_LOCATIONS,
            message: `Missing Charging Station ID in Location '${location.name}'`,
            module: MODULE_NAME, method: 'processLocation',
            detailedMessages: location
          });
        } else if (evse.status === OCPIEvseStatus.REMOVED) {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: ServerAction.OCPI_PULL_LOCATIONS,
            message: `Removed Charging Station ID '${chargingStationId}' in Location '${location.name}'`,
            module: MODULE_NAME, method: 'processLocation',
            detailedMessages: location
          });
          await ChargingStationStorage.deleteChargingStation(this.tenant.id, chargingStationId);
        } else {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: ServerAction.OCPI_PULL_LOCATIONS,
            message: `Updated Charging Station ID '${chargingStationId}' in Location '${location.name}'`,
            module: MODULE_NAME, method: 'processLocation',
            detailedMessages: location
          });
          const chargingStation = OCPIMapping.convertEvseToChargingStation(chargingStationId, evse, location);
          chargingStation.siteAreaID = siteArea.id;
          await ChargingStationStorage.saveChargingStation(this.tenant.id, chargingStation);
        }
      }
    }
  }

  async checkToken(tokenUid: string): Promise<boolean> {
    // Get tokens endpoint url
    const tokensUrl = this.getEndpointUrl('tokens', ServerAction.OCPI_CHECK_TOKENS);
    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode(ServerAction.OCPI_CHECK_TOKENS);
    const partyID = this.getLocalPartyID(ServerAction.OCPI_CHECK_TOKENS);
    // Build url to IOP
    const fullUrl = tokensUrl + `/${countryCode}/${partyID}/${tokenUid}`;
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CHECK_TOKENS,
      message: `Get Token ID '${tokenUid}' from ${fullUrl}`,
      module: MODULE_NAME, method: 'getToken',
      detailedMessages: { tokenUid }
    });
    // Call IOP
    const response = await this.axiosInstance.get(fullUrl,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`
        },
      });
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CHECK_LOCATIONS,
      message: `Token ID '${tokenUid}' checked successfully`,
      module: MODULE_NAME, method: 'checkToken',
      detailedMessages: { response : response.data }
    });
    const checkedToken = response.data.data as OCPILocation;
    if (checkedToken) {
      return true;
    }
    // Check response
    if (!response.data) {
      throw new BackendError({
        action: ServerAction.OCPI_CHECK_TOKENS,
        message: `Get Token ID '${tokenUid}' failed with status ${JSON.stringify(response)}`,
        module: MODULE_NAME, method: 'getToken',
        detailedMessages: { response: response.data }
      });
    }
  }

  async pushToken(token: OCPIToken): Promise<boolean> {
    // Get tokens endpoint url
    const tokensUrl = this.getEndpointUrl('tokens', ServerAction.OCPI_PUSH_TOKENS);
    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode(ServerAction.OCPI_PUSH_TOKENS);
    const partyID = this.getLocalPartyID(ServerAction.OCPI_PUSH_TOKENS);
    // Build url to IOP
    const fullUrl = tokensUrl + `/${countryCode}/${partyID}/${token.uid}`;
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_PUSH_TOKENS,
      message: `Push Token ID '${token.uid}' to ${fullUrl}`,
      module: MODULE_NAME, method: 'pushToken',
      detailedMessages: { token }
    });
    // Call IOP
    await this.axiosInstance.put(fullUrl, token,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    return this.checkToken(token.uid);
  }

  async remoteStartSession(chargingStation: ChargingStation, connectorId: number, tagId: string): Promise<OCPICommandResponse> {
    // Get command endpoint url
    const commandUrl = this.getEndpointUrl('commands', ServerAction.OCPI_START_SESSION) + '/' + OCPICommandType.START_SESSION;
    const callbackUrl = this.getLocalEndpointUrl('commands') + '/' + OCPICommandType.START_SESSION;
    const tag = await UserStorage.getTag(this.tenant.id, tagId, { withUser: true });
    if (!tag || !tag.issuer || !tag.active) {
      throw new BackendError({
        action: ServerAction.OCPI_START_SESSION,
        source: chargingStation.id,
        message: `Connector ID '${connectorId}' > OCPI Remote Start Session is not available for Tag ID '${tagId}'`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { tag: tag }
      });
    }
    if (!tag.user || tag.user.deleted || !tag.user.issuer) {
      throw new BackendError({
        action: ServerAction.OCPI_START_SESSION,
        source: chargingStation.id,
        message: `OCPI Remote Start Session is not available for user with Tag ID '${tagId}'`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { user: tag.user }
      });
    }
    const token: OCPIToken = {
      uid: tag.id,
      type: OCPITokenType.RFID,
      auth_id: tag.user.id,
      visual_number: tag.user.id,
      issuer: this.tenant.name,
      valid: true,
      whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
      last_updated: new Date()
    };
    const authorizationId = Utils.generateUUID();
    const payload: OCPIStartSession = {
      response_url: callbackUrl + '/' + authorizationId,
      token: token,
      evse_uid: chargingStation.imsi,
      location_id: chargingStation.iccid,
      authorization_id: authorizationId
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_START_SESSION,
      source: chargingStation.id,
      message: `Connector ID '${connectorId}' > OCPI Remote Start Session with Tad ID '${tagId}' at ${commandUrl}`,
      module: MODULE_NAME, method: 'remoteStartSession',
      detailedMessages: { payload }
    });
    // Call IOP
    const response = await this.axiosInstance.post(commandUrl, payload,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_START_SESSION,
      source: chargingStation.id,
      message: `Connector ID '${connectorId}' > OCPI Remote Start session response status ${response.status}`,
      module: MODULE_NAME, method: 'remoteStartSession',
      detailedMessages: { response: response.data }
    });
    return response.data.data as OCPICommandResponse;
  }

  async remoteStopSession(transactionId: number): Promise<OCPICommandResponse> {
    // Get command endpoint url
    const commandUrl = this.getEndpointUrl('commands', ServerAction.OCPI_START_SESSION) + '/' + OCPICommandType.STOP_SESSION;
    const callbackUrl = this.getLocalEndpointUrl('commands') + '/' + OCPICommandType.STOP_SESSION;
    const transaction = await TransactionStorage.getTransaction(this.tenant.id, transactionId);
    if (!transaction || !transaction.ocpiData || !transaction.ocpiData.session || transaction.issuer) {
      throw new BackendError({
        action: ServerAction.OCPI_START_SESSION,
        source: transaction ? transaction.chargeBoxID : null,
        message: `OCPI Remote Stop Session is not available for the Session ID '${transactionId}'`,
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { transaction: transaction }
      });
    }
    const payload: OCPIStopSession = {
      response_url: callbackUrl + '/' + transaction.ocpiData.session.id,
      session_id: transaction.ocpiData.session.id
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_STOP_SESSION,
      source: transaction.chargeBoxID,
      message: `Connector ID '${transaction.connectorId}' > OCPI Remote Stop Session ID '${transactionId}' at ${commandUrl}`,
      module: MODULE_NAME, method: 'remoteStopSession',
      detailedMessages: { payload }
    });
    // Call IOP
    const response = await this.axiosInstance.post(commandUrl, payload,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_STOP_SESSION,
      source: transaction.chargeBoxID,
      message: `Connector ID '${transaction.connectorId}' > OCPI Remote Stop Session ID '${transactionId}' response status ${response.status}`,
      module: MODULE_NAME, method: 'remoteStopSession',
      detailedMessages: { response: response.data }
    });
    return response.data.data as OCPICommandResponse;
  }
}
