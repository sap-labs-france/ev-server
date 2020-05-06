import { OCPIConnector } from '../../../../types/ocpi/OCPIConnector';
import { OCPIEvse } from '../../../../types/ocpi/OCPIEvse';
import { OCPILocation } from '../../../../types/ocpi/OCPILocation';
import OCPIMapping from './OCPIMapping';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import Tenant from '../../../../types/Tenant';

const MODULE_NAME = 'OCPILocationsService';

export default class OCPILocationsService {
  /**
   * Get OCPI Location from its id (Site ID)
   * @param {*} tenant
   * @param {*} locationId
   */
  static async getLocation(tenant: Tenant, locationId: string, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPILocation> {
    // Get site
    const site = await SiteStorage.getSite(tenant.id, locationId);
    if (!site) {
      return null;
    }
    // Convert
    return await OCPIMapping.convertSite2Location(tenant, site, options);
  }

  /**
   * Get OCPI EVSE from its location id/evse_id
   * @param {*} tenant
   * @param {*} locationId
   * @param {*} evseId
   */
  static async getEvse(tenant: Tenant, locationId: string, evseUid: string, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIEvse> {
    // Get site
    const site = await SiteStorage.getSite(tenant.id, locationId);
    if (!site) {
      return null;
    }
    // Convert to location
    const location = await OCPIMapping.convertSite2Location(tenant, site, options);
    // Loop through EVSE
    if (location) {
      for (const evse of location.evses) {
        if (evse.uid === evseUid) {
          return evse;
        }
      }
    }
  }

  /**
   * Get OCPI Connector from its location_id/evse_uid/connector id
   * @param {*} tenant
   * @param {*} locationId
   * @param {*} evseUid
   * @param {*} connectorId
   */
  static async getConnector(tenant: Tenant, locationId: string, evseUid: string, connectorId: string, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIConnector> {
    // Get site
    const evse = await this.getEvse(tenant, locationId, evseUid, options);
    // Loop through Connector
    if (evse) {
      for (const connector of evse.connectors) {
        if (connector.id === connectorId) {
          return connector;
        }
      }
    }
  }
}
