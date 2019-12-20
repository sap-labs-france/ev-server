import Constants from '../../utils/Constants';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import Logging from '../../utils/Logging';
import OCPIClient from './OCPIClient';
import EmspOCPIClient from './EmspOCPIClient';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import CpoOCPIClient from './CpoOCPIClient';

export default class OCPIClientFactory {
  static async getOcpiClient(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIClient> {
    // Check if OCPI component is active
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.OCPI)
    ) {
      const ocpiSettings = await SettingStorage.getOCPISettings(tenant.id);
      // Check
      if (!ocpiSettings) {
        Logging.logError({
          tenantID: tenant.id,
          module: 'OCPIClientFactory',
          method: 'getOcpiClient',
          message: 'OCPI settings are not configured'
        });
      }
      switch (ocpiEndpoint.role) {
        case Constants.OCPI_ROLE.CPO:
          return new CpoOCPIClient(tenant, ocpiSettings, ocpiEndpoint);
        case Constants.OCPI_ROLE.EMSP:
          return new EmspOCPIClient(tenant, ocpiSettings, ocpiEndpoint);
      }
    }
  }

  static async getCpoOcpiClient(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<CpoOCPIClient> {
    if (ocpiEndpoint.role === Constants.OCPI_ROLE.CPO) {
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
    if (ocpiEndpoint.role === Constants.OCPI_ROLE.EMSP) {
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
}
