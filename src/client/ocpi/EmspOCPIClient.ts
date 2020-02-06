import OCPIClient from './OCPIClient';
import Tenant from '../../types/Tenant';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import Constants from '../../utils/Constants';
import { OcpiSetting } from '../../types/Setting';
import Logging from '../../utils/Logging';
import axios from 'axios';
import _ from 'lodash';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import { OCPIToken } from '../../types/ocpi/OCPIToken';
import { OCPILocation } from '../../types/ocpi/OCPILocation';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import CompanyStorage from '../../storage/mongodb/CompanyStorage';
import Company from '../../types/Company';
import Site from '../../types/Site';
import SiteArea from '../../types/SiteArea';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import moment from 'moment';
import OCPISessionsService from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPISessionsService';
import Transaction from '../../types/Transaction';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';

export default class EmspOCPIClient extends OCPIClient {
  constructor(tenant: Tenant, settings: OcpiSetting, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, Constants.OCPI_ROLE.EMSP);

    if (ocpiEndpoint.role !== Constants.OCPI_ROLE.EMSP) {
      throw new Error(`EmspOCPIClient requires Ocpi Endpoint with role ${Constants.OCPI_ROLE.EMSP}`);
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
        action: 'OcpiPushTokens',
        message: `Patching of ${sendResult.logs.length} tokens has been done with errors (see details)`,
        detailedMessages: sendResult.logs,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'sendTokens'
      });
    } else if (sendResult.success > 0) {
      // Log info
      Logging.logInfo({
        tenantID: this.tenant.id,
        action: 'OcpiPushTokens',
        message: `Patching of ${sendResult.logs.length} tokens has been done successfully (see details)`,
        detailedMessages: sendResult.logs,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'sendTokens'
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
    let locationsUrl = this.getEndpointUrl('locations');
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
        action: 'OcpiGetLocations',
        message: `Retrieve locations at ${locationsUrl}`,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'pullLocations'
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
        throw new Error(`Invalid response code ${response.status} from Get locations`);
      }
      if (!response.data.data) {
        throw new Error(`Invalid response from Get locations: ${JSON.stringify(response.data)}`);
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
    let sessionsUrl = this.getEndpointUrl('sessions');
    const momentFrom = moment().utc().subtract(2, 'days').startOf('day');
    sessionsUrl = `${sessionsUrl}?date_from=${momentFrom.format()}&limit=20`;

    let nextResult = true;

    while (nextResult) {
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: 'OcpiGetSessions',
        message: `Retrieve sessions at ${sessionsUrl}`,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'pullSessions'
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
        throw new Error(`Invalid response code ${response.status} from Get sessions`);
      }
      if (!response.data.data) {
        throw new Error(`Invalid response from Get sessions: ${JSON.stringify(response.data)}`);
      }

      for (const session of response.data.data) {
        try {
          await OCPISessionsService.updateSession(this.tenant.id, session);
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
    let cdrsUrl = this.getEndpointUrl('cdrs');
    const momentFrom = moment().utc().subtract(2, 'days').startOf('day');
    cdrsUrl = `${cdrsUrl}?date_from=${momentFrom.format()}&limit=20`;

    let nextResult = true;

    while (nextResult) {
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: 'OcpiGetCdrs',
        message: `Retrieve cdrs at ${cdrsUrl}`,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'pullCdrs'
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
        throw new Error(`Invalid response code ${response.status} from Get cdrs`);
      }
      if (!response.data.data) {
        throw new Error(`Invalid response from Get cdrs: ${JSON.stringify(response.data)}`);
      }

      for (const cdr of response.data.data) {
        try {
          const transaction: Transaction = await TransactionStorage.getOCPITransaction(this.tenant.id, cdr.id);

          if (!transaction) {
            Logging.logError({
              tenantID: this.tenant.id,
              action: 'OcpiGetCdrs',
              message: `No transaction found for cdr with id ${cdr.id}`,
              source: 'OCPI Client',
              module: 'OCPIClient',
              method: 'pullCdrs',
              detailedMessages: cdr,
            });
            sendResult.failure++;
          }
          if (!transaction.ocpiCdr) {
            transaction.ocpiCdr = cdr;
            await TransactionStorage.saveTransaction(this.tenant.id, transaction);
            sendResult.success++;
            sendResult.logs.push(
              `Cdr ${cdr.id} successfully updated`
            );
          }
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
      action: 'OcpiGetLocations',
      message: `Processing location ${location.name} with id ${location.id}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'processLocation',
      detailedMessage: location
    });
    let site: Site;
    const siteName = location.operator && location.operator.name ? location.operator.name
      : OCPIUtils.buildSiteName(this.ocpiEndpoint.countryCode, this.ocpiEndpoint.partyId);
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
            action: 'OcpiGetLocations',
            message: `Missing evse uid of location ${location.name}`,
            source: 'OCPI Client',
            module: 'OCPIClient',
            method: 'processLocation',
            detailedMessage: location
          });
        } else if (evse.status === OCPIEvseStatus.REMOVED) {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: 'OcpiGetLocations',
            message: `Delete removed evse ${chargingStationId} of location ${location.name}`,
            source: 'OCPI Client',
            module: 'OCPIClient',
            method: 'processLocation',
            detailedMessage: location
          });
          await ChargingStationStorage.deleteChargingStation(this.tenant.id, chargingStationId);
        } else {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: 'OcpiGetLocations',
            message: `Update evse ${chargingStationId} of location ${location.name}`,
            source: 'OCPI Client',
            module: 'OCPIClient',
            method: 'processLocation',
            detailedMessage: location
          });
          const chargingStation = OCPIMapping.convertEvseToChargingStation(chargingStationId, evse, location);
          chargingStation.siteAreaID = siteArea.id;
          await ChargingStationStorage.saveChargingStation(this.tenant.id, chargingStation);
        }
      }
    }
  }

  async pushToken(token: OCPIToken) {
    // Get tokens endpoint url
    const tokensUrl = this.getEndpointUrl('tokens');

    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode();
    const partyID = this.getLocalPartyID();

    // Build url to IOP
    const fullUrl = tokensUrl + `/${countryCode}/${partyID}/${token.uid}`;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: 'OcpiPushTokens',
      message: `Put token at ${fullUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'pushToken',
      detailedMessages: token
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
      throw new Error(`Invalid response from put token ${JSON.stringify(response)}`);
    }
  }

  async remoteStartSession() {

  }

  async remoteStopSession() {

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
