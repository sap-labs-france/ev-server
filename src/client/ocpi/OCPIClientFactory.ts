import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import CpoOCPIClient from './CpoOCPIClient';
import EmspOCPIClient from './EmspOCPIClient';
import Logging from '../../utils/Logging';
import OCPIChargingStationClient from './OCPIChargingStationClient';
import OCPIClient from './OCPIClient';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import { OCPIRegistrationStatus } from '../../types/ocpi/OCPIRegistrationStatus';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OCPIClientFactory';

export default class OCPIClientFactory {
  static async getOcpiClient(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIClient> {
    // Check if OCPI component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
      const ocpiSettings = await SettingStorage.getOCPISettings(tenant.id);
      // Check
      if (!ocpiSettings && ocpiSettings.ocpi) {
        Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.OCPI_SETTINGS,
          module: MODULE_NAME, method: 'getOcpiClient',
          message: 'OCPI Settings are not configured'
        });
      }
      switch (ocpiEndpoint.role) {
        case OCPIRole.CPO:
          return new CpoOCPIClient(tenant, ocpiSettings.ocpi, ocpiEndpoint);
        case OCPIRole.EMSP:
          return new EmspOCPIClient(tenant, ocpiSettings.ocpi, ocpiEndpoint);
      }
    }
  }

  static async getCpoOcpiClient(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<CpoOCPIClient> {
    if (ocpiEndpoint.role === OCPIRole.CPO) {
      const client = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
      return client as CpoOCPIClient;
    }
    Logging.logError({
      tenantID: tenant.id,
      action: ServerAction.OCPI_CLIENT_INITIALIZATION,
      module: MODULE_NAME, method: 'getCpoOcpiClient',
      message: `CPO OCPI Client is not compatible with endpoint role '${ocpiEndpoint.role}'`
    });
  }

  static async getEmspOcpiClient(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<EmspOCPIClient> {
    if (ocpiEndpoint.role === OCPIRole.EMSP) {
      const client = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
      return client as EmspOCPIClient;
    }
    Logging.logError({
      tenantID: tenant.id,
      action: ServerAction.OCPI_CLIENT_INITIALIZATION,
      module: MODULE_NAME, method: 'getEmspOcpiClient',
      message: `EMSP OCPI Client is not compatible with endpoint role '${ocpiEndpoint.role}'`
    });
  }

  static async getAvailableOcpiClient(tenant: Tenant, ocpiRole: string): Promise<OCPIClient> {
    const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant.id, { role: ocpiRole }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const ocpiEndpoint of ocpiEndpoints.result) {
      if (ocpiEndpoint.status === OCPIRegistrationStatus.REGISTERED) {
        const client = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
        return client;
      }
    }
  }

  static async getChargingStationClient(tenant: Tenant, chargingStation: ChargingStation): Promise<OCPIChargingStationClient> {
    const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant.id, { role: OCPIRole.EMSP }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const ocpiEndpoint of ocpiEndpoints.result) {
      if (ocpiEndpoint.status === OCPIRegistrationStatus.REGISTERED) {
        const client = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
        if (client) {
          return new OCPIChargingStationClient(client, chargingStation);
        }
      }
    }
  }
}
