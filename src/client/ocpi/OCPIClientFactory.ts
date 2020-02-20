import Constants from '../../utils/Constants';
import CpoOCPIClient from './CpoOCPIClient';
import EmspOCPIClient from './EmspOCPIClient';
import Logging from '../../utils/Logging';
import OCPIClient from './OCPIClient';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { OCPIRegistationStatus } from '../../types/ocpi/OCPIRegistationStatus';

export default class OCPIClientFactory {
  static async getOcpiClient(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIClient> {
    // Check if OCPI component is active
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.OCPI)) {
      const ocpiSettings = await SettingStorage.getOCPISettings(tenant.id);
      // Check
      if (!ocpiSettings && ocpiSettings.ocpi) {
        Logging.logError({
          tenantID: tenant.id,
          module: 'OCPIClientFactory',
          method: 'getOcpiClient',
          message: 'OCPI settings are not configured'
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
      module: 'OCPIClientFactory',
      method: 'getCpoOcpiClient',
      message: `CpoOCPIClient is not compatible with endpoint role '${ocpiEndpoint.role}'`
    });
  }

  static async getEmspOcpiClient(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<EmspOCPIClient> {
    if (ocpiEndpoint.role === OCPIRole.EMSP) {
      const client = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
      return client as EmspOCPIClient;
    }
    Logging.logError({
      tenantID: tenant.id,
      module: 'OCPIClientFactory',
      method: 'getEmspOcpiClient',
      message: `EmspOCPIClient is not compatible with endpoint role '${ocpiEndpoint.role}'`
    });
  }

  static async getAvailableOcpiClient(tenant: Tenant, ocpiRole: string): Promise<OCPIClient> {
    const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant.id, { role: ocpiRole }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const ocpiEndpoint of ocpiEndpoints.result) {
      if (ocpiEndpoint.status === OCPIRegistationStatus.OCPI_REGISTERED) {
        const client = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
        return client;
      }
    }
  }
}
